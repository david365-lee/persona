param(
    [string]$Context = 'docker-desktop',
    [System.Security.SecureString]$RootPassword
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$helm = Join-Path $root '.tools\helm\windows-amd64\helm.exe'
$namespace = 'argocd'

function Invoke-Kubectl([string[]]$Arguments) {
    & kubectl --context $Context @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path -LiteralPath $helm -PathType Leaf)) {
    throw "Helm executable was not found at $helm"
}

$password = $RootPassword
if ($null -eq $password) {
    $password = Read-Host 'Argo CD root administrator password' -AsSecureString
}

$plainPassword = [System.Net.NetworkCredential]::new('', $password).Password
try {
    $namespaceYaml = & kubectl --context $Context create namespace $namespace --dry-run=client -o yaml
    if ($LASTEXITCODE -ne 0) { throw 'Failed to render Argo CD namespace' }
    $namespaceYaml | & kubectl --context $Context apply -f -
    if ($LASTEXITCODE -ne 0) { throw 'Failed to apply Argo CD namespace' }

    & $helm repo add argo https://argoproj.github.io/argo-helm --force-update
    if ($LASTEXITCODE -ne 0) { throw 'Failed to add the Argo Helm repository' }
    & $helm repo update argo
    if ($LASTEXITCODE -ne 0) { throw 'Failed to update the Argo Helm repository' }

    & $helm upgrade --install argocd argo/argo-cd `
        --version 10.11.1 `
        --namespace $namespace `
        --kube-context $Context `
        --values (Join-Path $PSScriptRoot 'values.yaml') `
        --wait --timeout 15m
    if ($LASTEXITCODE -ne 0) { throw 'Argo CD Helm installation failed' }

    $serverPod = (& kubectl --context $Context -n $namespace get pods `
        -l app.kubernetes.io/name=argocd-server `
        -o jsonpath='{.items[0].metadata.name}').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $serverPod) {
        throw 'Could not find the Argo CD server pod'
    }

    $hashOutput = & kubectl --context $Context -n $namespace exec $serverPod -- `
        argocd account bcrypt --password $plainPassword
    if ($LASTEXITCODE -ne 0) { throw 'Failed to generate the root password hash' }
    $passwordHash = ($hashOutput | Where-Object { $_ -match '^\$2[aby]\$' } | Select-Object -Last 1)
    if (-not $passwordHash) { throw 'Argo CD returned an invalid root password hash' }

    $patch = @{
        stringData = @{
            'accounts.root.password'       = $passwordHash
            'accounts.root.passwordMtime' = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
        }
    } | ConvertTo-Json -Compress
    $patchFile = Join-Path $env:TEMP "argocd-root-password-$PID.json"
    [System.IO.File]::WriteAllText($patchFile, $patch, [System.Text.UTF8Encoding]::new($false))
    Invoke-Kubectl @('-n', $namespace, 'patch', 'secret', 'argocd-secret', '--type=merge', '--patch-file', $patchFile)

    $body = @{ username = 'root'; password = $plainPassword } | ConvertTo-Json -Compress
    $session = Invoke-RestMethod -Method Post `
        -Uri 'https://argocd.clush.cloud/api/v1/session' `
        -ContentType 'application/json' `
        -Body $body `
        -TimeoutSec 30
    if (-not $session.token) { throw 'Argo CD root login validation returned no token' }
    $session = $null

    Write-Output 'Argo CD installed and root login validated at https://argocd.clush.cloud'
}
finally {
    $plainPassword = $null
    $passwordHash = $null
    $hashOutput = $null
    $body = $null
    if ($patchFile -and (Test-Path -LiteralPath $patchFile)) {
        Remove-Item -LiteralPath $patchFile -Force
    }
    $password.Dispose()
}
