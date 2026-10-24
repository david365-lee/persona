param(
    [string]$Context = 'docker-desktop',
    [System.Security.SecureString]$Password
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$helm = Join-Path $root '.tools\helm\windows-amd64\helm.exe'

function Invoke-Kubectl {
    param([string[]]$KubectlArguments)
    & kubectl --context $Context @KubectlArguments
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl failed with exit code $LASTEXITCODE"
    }
}

function Invoke-Helm {
    param([string[]]$HelmArguments)
    & $helm @HelmArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Helm failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path -LiteralPath $helm -PathType Leaf)) {
    throw "Helm executable was not found at $helm"
}

Invoke-Kubectl -KubectlArguments @('apply', '-f', (Join-Path $PSScriptRoot 'namespace.yaml'))

$encodedUser = & kubectl --context $Context -n minio get secret minio-admin -o 'jsonpath={.data.username}'
if ($LASTEXITCODE -ne 0) { throw 'Failed to read the MinIO storage username' }
$encodedPassword = & kubectl --context $Context -n minio get secret minio-admin -o 'jsonpath={.data.password}'
if ($LASTEXITCODE -ne 0) { throw 'Failed to read the MinIO storage password' }
$accessKey = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedUser))
$secretKey = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedPassword))
$uiPassword = $Password
if ($null -eq $uiPassword) {
    $uiPassword = Read-Host 'Velero UI administrator password' -AsSecureString
}
$uiPasswordPlain = [System.Net.NetworkCredential]::new('', $uiPassword).Password

try {
    $cloudCredentials = "[default]`naws_access_key_id=$accessKey`naws_secret_access_key=$secretKey"
    $secretYaml = & kubectl --context $Context -n velero create secret generic velero-cloud-credentials `
        --from-literal="cloud=$cloudCredentials" `
        --dry-run=client --output=yaml
    if ($LASTEXITCODE -ne 0) { throw 'Failed to render the Velero storage credentials Secret' }
    $secretYaml | & kubectl --context $Context apply -f -
    if ($LASTEXITCODE -ne 0) { throw 'Failed to apply the Velero storage credentials Secret' }

    $uiSigningKey = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $secretYaml = & kubectl --context $Context -n velero-ui create secret generic velero-ui-auth `
        --from-literal="pass_phrase=$uiSigningKey" `
        --from-literal=username=root `
        --from-literal="password=$uiPasswordPlain" `
        --dry-run=client --output=yaml
    if ($LASTEXITCODE -ne 0) { throw 'Failed to render the Velero UI credentials Secret' }
    $secretYaml | & kubectl --context $Context apply -f -
    if ($LASTEXITCODE -ne 0) { throw 'Failed to apply the Velero UI credentials Secret' }
}
finally {
    $encodedUser = $null
    $encodedPassword = $null
    $accessKey = $null
    $secretKey = $null
    $cloudCredentials = $null
    $uiSigningKey = $null
    $uiPasswordPlain = $null
    $secretYaml = $null
    $uiPassword.Dispose()
}

Invoke-Helm -HelmArguments @('repo', 'add', 'vmware-tanzu', 'https://vmware-tanzu.github.io/helm-charts', '--force-update')
Invoke-Helm -HelmArguments @('repo', 'add', 'otwld', 'https://helm.otwld.com', '--force-update')
Invoke-Helm -HelmArguments @('repo', 'update')

Invoke-Helm -HelmArguments @(
    'upgrade', '--install', 'velero', 'vmware-tanzu/velero',
    '--version', '12.2.1',
    '--namespace', 'velero',
    '--kube-context', $Context,
    '--values', (Join-Path $PSScriptRoot 'velero-values.yaml')
)
Invoke-Kubectl -KubectlArguments @('-n', 'velero', 'rollout', 'status', 'deployment/velero', '--timeout=10m')
Invoke-Kubectl -KubectlArguments @('-n', 'velero', 'rollout', 'status', 'daemonset/node-agent', '--timeout=10m')

Invoke-Helm -HelmArguments @(
    'upgrade', '--install', 'velero-ui', 'otwld/velero-ui',
    '--version', '1.0.0',
    '--namespace', 'velero-ui',
    '--kube-context', $Context,
    '--values', (Join-Path $PSScriptRoot 'velero-ui-values.yaml')
)
Invoke-Kubectl -KubectlArguments @('-n', 'velero-ui', 'rollout', 'status', 'deployment/velero-ui', '--timeout=10m')

Invoke-Kubectl -KubectlArguments @('-n', 'velero', 'get', 'backupstoragelocation')
Invoke-Kubectl -KubectlArguments @('-n', 'velero-ui', 'get', 'pods,svc,ingress')
