param(
    [string]$Context = 'docker-desktop'
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$helm = Join-Path $root '.tools\helm\windows-amd64\helm.exe'

function Invoke-Kubectl([string[]]$Arguments) {
    & kubectl --context $Context @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "kubectl failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path -LiteralPath $helm -PathType Leaf)) {
    throw "Helm executable was not found at $helm"
}

$nexusPatch = Join-Path $root 'deploy\nexus\resources-patch.yaml'
Invoke-Kubectl @('-n', 'nexus', 'patch', 'deployment', 'nexus', '--type=strategic', '--patch-file', $nexusPatch)
Invoke-Kubectl @('-n', 'nexus', 'rollout', 'status', 'deployment/nexus', '--timeout=10m')

& $helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ --force-update
if ($LASTEXITCODE -ne 0) { throw 'Failed to add the Metrics Server Helm repository' }
& $helm repo update metrics-server
if ($LASTEXITCODE -ne 0) { throw 'Failed to update the Metrics Server Helm repository' }

& $helm upgrade --install metrics-server metrics-server/metrics-server `
    --version 3.13.0 `
    --namespace kube-system `
    --kube-context $Context `
    --values (Join-Path $PSScriptRoot 'values.yaml') `
    --wait --timeout 5m
if ($LASTEXITCODE -ne 0) { throw 'Metrics Server Helm installation failed' }

Invoke-Kubectl @('wait', '--for=condition=Available', 'apiservice/v1beta1.metrics.k8s.io', '--timeout=3m')

$metricsAvailable = $false
for ($attempt = 0; $attempt -lt 18; $attempt++) {
    & kubectl --context $Context top nodes
    if ($LASTEXITCODE -eq 0) {
        $metricsAvailable = $true
        break
    }
    Start-Sleep -Seconds 5
}
if (-not $metricsAvailable) {
    throw 'Metrics API is available but kubectl top did not return node metrics'
}

Invoke-Kubectl @('top', 'pods', '--all-namespaces')
