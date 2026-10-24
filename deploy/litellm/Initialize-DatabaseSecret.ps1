$ErrorActionPreference = 'Stop'
$existing = kubectl --context docker-desktop -n litellm get secret litellm-db --ignore-not-found -o name
if ($LASTEXITCODE -ne 0) { throw 'Cannot check LiteLLM database Secret' }
if ($existing) {
    Write-Output 'Existing database credentials and salt preserved.'
    return
}
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $password = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    $rng.GetBytes($bytes)
    $salt = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    $values = @{
        POSTGRES_PASSWORD = $password
        DATABASE_URL = "postgresql://litellm:${password}@litellm-postgres.litellm.svc.cluster.local:5432/litellm"
        LITELLM_SALT_KEY = $salt
    }
    $data = @{}
    foreach ($key in $values.Keys) {
        $data[$key] = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($values[$key]))
    }
    @{
        apiVersion = 'v1'
        kind = 'Secret'
        metadata = @{ name = 'litellm-db'; namespace = 'litellm' }
        type = 'Opaque'
        data = $data
    } | ConvertTo-Json -Depth 10 | kubectl --context docker-desktop create -f -
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create LiteLLM database Secret' }
} finally {
    $rng.Dispose()
    $password = $salt = $values = $data = $bytes = $null
}
