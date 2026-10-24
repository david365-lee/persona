$ErrorActionPreference='Stop'
$harborSecret='platform-admin'
$harborRoot=kubectl --context docker-desktop -n harbor get secret harbor-root --ignore-not-found -o name
if($harborRoot){$harborSecret='harbor-root'}
$services=@(
  @('GitLab','https://gitlab.clush.cloud','gitlab','gitlab-admin','root'),
  @('Harbor','https://harbor.clush.cloud','harbor',$harborSecret,'admin'),
  @('Nexus','https://nexus.clush.cloud','nexus','nexus-root','root'),
  @('MinIO','https://minio.clush.cloud','minio','minio-admin','root'),
  @('Attu','https://attu.clush.cloud/login','milvus','attu-admin','root'),
  @('Milvus','milvus.milvus.svc.cluster.local:19530','milvus','milvus-admin','root'),
  @('Pritunl','https://pritunl.clush.cloud','pritunl','pritunl-admin','root')
)
foreach($service in $services){
  $secret=kubectl --context docker-desktop -n $service[2] get secret $service[3] -o json | ConvertFrom-Json
  if($LASTEXITCODE -ne 0){throw "Cannot read $($service[0]) credentials"}
  $username=$service[4]
  if($secret.data.username){$username=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret.data.username))}
  [pscustomobject]@{Service=$service[0];URL=$service[1];Username=$username;Password=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret.data.password))}
}
