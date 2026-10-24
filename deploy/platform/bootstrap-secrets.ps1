$ErrorActionPreference='Stop'
function New-PlatformPassword {
  $bytes=New-Object byte[] 24
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes); $rng.Dispose()
  return 'Aa1!' + ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
}
foreach($entry in @(@('harbor','platform-admin'),@('minio','minio-admin'),@('milvus','attu-admin'),@('milvus','milvus-admin'))) {
  $ns=$entry[0]; $name=$entry[1]
  $existing = kubectl --context docker-desktop -n $ns get secret $name --ignore-not-found -o name
  if($LASTEXITCODE -ne 0){throw 'Cannot read Kubernetes secrets'}
  if($existing){continue}
  $data=@{password=(New-PlatformPassword)}
  if($name -ne 'platform-admin'){$data.username='root'}
  $secret=@{apiVersion='v1';kind='Secret';metadata=@{name=$name;namespace=$ns};type='Opaque';stringData=$data}
  $secret | ConvertTo-Json -Depth 8 | kubectl --context docker-desktop apply -f -
  if($LASTEXITCODE -ne 0){throw "Secret bootstrap failed: $ns/$name"}
}
