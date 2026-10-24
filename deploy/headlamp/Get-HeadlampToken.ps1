param([switch]$Copy)
$ErrorActionPreference='Stop'
$raw=kubectl --context docker-desktop -n headlamp get secret headlamp-root-token -o json
if($LASTEXITCODE -ne 0){throw 'Cannot read the Headlamp login token'}
$secret=$raw | ConvertFrom-Json
if(!$secret.data.token){throw 'The service-account token has not been generated yet'}
$token=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret.data.token))
if($Copy){
  Set-Clipboard -Value $token
  'Headlamp login token copied to clipboard.'
}else{
  $token
}
