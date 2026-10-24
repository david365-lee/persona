$ErrorActionPreference='Stop'
$extensionRoot=Join-Path $env:APPDATA 'Docker/extensions/spurin_k9s-dd-extension'
$bundleRoot=Join-Path $extensionRoot 'ui/ui/static/js'
$old='o.post("/store-kube-config",{data:null===n||void 0===n?void 0:n.stdout})'
$replacement='o.post("/store-kube-config",{data:((null===n||void 0===n?void 0:n.stdout)||"").replace(/^([ \t]*)server:[ \t]*(https:\/\/)(127\.0\.0\.1|localhost)(:\d+)?\/?[ \t]*\r?$/gm,"$1server: $2host.docker.internal$4\n$1tls-server-name: $3")})'
$patched=$false
foreach($file in Get-ChildItem -LiteralPath $bundleRoot -Filter 'main.*.js') {
  $text=[IO.File]::ReadAllText($file.FullName)
  if($text.Contains($replacement)){$patched=$true;continue}
  if(!$text.Contains($old)){continue}
  $backup=$file.FullName+'.before-kind-fix.bak'
  if(!(Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $file.FullName -Destination $backup}
  [IO.File]::WriteAllText($file.FullName,$text.Replace($old,$replacement),(New-Object Text.UTF8Encoding($false)))
  $patched=$true
}
if(!$patched){throw 'Installed extension bundle differs from the verified version; no UI changes were made.'}

# Keep the host kubeconfig untouched. Only normalize the extension's copy.
$raw=kubectl --context docker-desktop config view --raw --minify
if($LASTEXITCODE -ne 0){throw 'Cannot read the docker-desktop kubeconfig'}
$serverReplacement='$1server: $2host.docker.internal$4' + "`n" + '$1tls-server-name: $3'
$config=($raw -join "`n") -replace '(?m)^([ \t]*)server:[ \t]*(https://)(127\.0\.0\.1|localhost)(:\d+)?/?[ \t]*\r?$',$serverReplacement
$backend='spurin_k9s-dd-extension-desktop-extension-service'
docker exec $backend sh -c 'if [ ! -f /root/.kube/config.before-kind-fix ]; then cp /root/.kube/config /root/.kube/config.before-kind-fix; chmod 600 /root/.kube/config.before-kind-fix; fi'
if($LASTEXITCODE -ne 0){throw 'Cannot back up the extension kubeconfig'}
$config | docker exec -i $backend sh -c 'umask 077; cat > /root/.kube/config; chmod 600 /root/.kube/config'
if($LASTEXITCODE -ne 0){throw 'Cannot update the extension kubeconfig'}
docker exec $backend kubectl get nodes --request-timeout=10s
if($LASTEXITCODE -ne 0){throw 'Extension backend cannot reach Kubernetes'}
docker exec k9s kubectl get pods -A --request-timeout=10s
if($LASTEXITCODE -ne 0){throw 'k9s cannot reach Kubernetes'}
Write-Output 'Kind compatibility fix applied. Reopen the k9s extension tab.'
