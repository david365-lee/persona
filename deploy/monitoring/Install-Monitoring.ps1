param(
    [string]$Context = 'docker-desktop',
    [System.Security.SecureString]$GrafanaPassword
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

$namespaceYaml = & kubectl --context $Context create namespace monitoring --dry-run=client -o yaml
if ($LASTEXITCODE -ne 0) { throw 'Failed to render monitoring namespace' }
$namespaceYaml | & kubectl --context $Context apply -f -
if ($LASTEXITCODE -ne 0) { throw 'Failed to apply monitoring namespace' }

$password = $GrafanaPassword
if ($null -eq $password) {
    $password = Read-Host 'Grafana administrator password' -AsSecureString
}
$plainPassword = [System.Net.NetworkCredential]::new('', $password).Password
try {
    $secretYaml = & kubectl --context $Context -n monitoring create secret generic grafana-admin `
        --from-literal=admin-user=root `
        --from-literal="admin-password=$plainPassword" `
        --dry-run=client --output=yaml
    if ($LASTEXITCODE -ne 0) { throw 'Failed to render Grafana admin Secret' }
    $secretYaml | & kubectl --context $Context apply -f -
    if ($LASTEXITCODE -ne 0) { throw 'Failed to apply Grafana admin Secret' }
}
finally {
    $plainPassword = $null
    $secretYaml = $null
    $password.Dispose()
}

& $helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
if ($LASTEXITCODE -ne 0) { throw 'Failed to add the Prometheus Community Helm repository' }
& $helm repo update prometheus-community
if ($LASTEXITCODE -ne 0) { throw 'Failed to update the Prometheus Community Helm repository' }
& $helm upgrade --install monitoring prometheus-community/kube-prometheus-stack `
    --version 92.13.1 `
    --namespace monitoring `
    --kube-context $Context `
    --values (Join-Path $PSScriptRoot 'values.yaml') `
    --wait --timeout 15m
if ($LASTEXITCODE -ne 0) { throw 'Prometheus/Grafana Helm installation failed' }

Invoke-Kubectl @('-n', 'monitoring', 'get', 'pods,svc,ingress,pvc')
