$ErrorActionPreference='Stop'
function Read-PlatformSecret($ns,$name,$key) {
  $raw=kubectl --context docker-desktop -n $ns get secret $name -o json
  if($LASTEXITCODE -ne 0){throw "Cannot read $ns/$name"}
  $secret=$raw | ConvertFrom-Json
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret.data.$key))
}
$private=@{
  externalS3=@{accessKey=(Read-PlatformSecret minio minio-admin username);secretKey=(Read-PlatformSecret minio minio-admin password)}
  extraConfigFiles=@{'user.yaml'="common:`n  security:`n    authorizationEnabled: true`n    defaultRootPassword: $(Read-PlatformSecret milvus milvus-admin password)`nproxy:`n  http:`n    enabled: true`n"}
}
$privatePath=Join-Path $PSScriptRoot '../../.tools/milvus-private-values.json'
try {
  [IO.File]::WriteAllText($privatePath,($private | ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
  & "$PSScriptRoot/../../.tools/helm/windows-amd64/helm.exe" upgrade --install milvus milvus/milvus --version 5.0.32 --kube-context docker-desktop --namespace milvus -f "$PSScriptRoot/milvus-values.yaml" -f $privatePath --timeout 10m
  if($LASTEXITCODE -ne 0){throw 'Milvus Helm installation failed'}
} finally {
  if(Test-Path -LiteralPath $privatePath){Remove-Item -LiteralPath $privatePath}
}
