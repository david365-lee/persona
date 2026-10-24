$ErrorActionPreference='Stop'
function Save-InitialCredential($ns,$name,$username,$password) {
  if(!$username -or !$password){throw "Cannot read initial credentials for $ns"}
  $value=@{apiVersion='v1';kind='Secret';metadata=@{namespace=$ns;name=$name};type='Opaque';stringData=@{username=$username;password=$password}}
  $value | ConvertTo-Json -Depth 8 | kubectl --context docker-desktop apply -f -
  if($LASTEXITCODE -ne 0){throw 'Secret creation failed'}
}
$existing=kubectl --context docker-desktop -n nexus get secret nexus-admin --ignore-not-found -o name
if(!$existing){
  $password=kubectl --context docker-desktop -n nexus exec deployment/nexus -- cat /nexus-data/admin.password
  if($LASTEXITCODE -ne 0){throw 'Cannot read initial Nexus password'}
  Save-InitialCredential nexus nexus-admin admin ($password -join '').Trim()
}
$existing=kubectl --context docker-desktop -n pritunl get secret pritunl-admin --ignore-not-found -o name
if(!$existing){
  $raw=kubectl --context docker-desktop -n pritunl exec deployment/pritunl -c pritunl -- pritunl default-password
  if($LASTEXITCODE -ne 0){throw 'Cannot read initial Pritunl password'}
  $text=$raw -join "`n"
  $username=[regex]::Match($text,'username:\s*"?([^\s"]+)').Groups[1].Value
  $password=[regex]::Match($text,'password:\s*"?([^\s"]+)').Groups[1].Value
  Save-InitialCredential pritunl pritunl-admin $username $password
}
