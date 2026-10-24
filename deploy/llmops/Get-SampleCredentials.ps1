$ErrorActionPreference='Stop'
$s=kubectl --context docker-desktop -n llmops-sample get secret support-assistant-auth -o json | ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'Cannot read sample API credentials'}
[pscustomobject]@{
    URL='https://llmops.clush.cloud/docs'
    APP_API_TOKEN=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s.data.APP_API_TOKEN))
}
