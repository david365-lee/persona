param([string]$Message='feat: add integrated LLMOps support assistant sample', [string[]]$Paths)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../samples/llmops-support-assistant'))
$secret=kubectl --context docker-desktop -n gitlab get secret llmops-project-automation -o json | ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'Cannot read project automation Secret'}
$token=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret.data.token))
$id=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret.data.project_id))
$headers=@{'PRIVATE-TOKEN'=$token}
$base="https://gitlab.clush.cloud/api/v4/projects/$id"
if(-not $Paths){
    $Paths=Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
        $_.FullName.Substring($root.Length+1).Replace('\','/')
    } | Where-Object {$_ -notmatch '(^|/)(\.git|\.venv|__pycache__|\.pytest_cache|reports)(/|$)' -and $_ -ne '.env' -and $_ -notmatch '\.pyc$'}
}
$actions=@()
foreach($path in $Paths){
    $full=[IO.Path]::GetFullPath((Join-Path $root $path))
    if(-not $full.StartsWith($root+[IO.Path]::DirectorySeparatorChar)){throw 'Path escapes sample root'}
    $action='create'
    try{$remote=Invoke-RestMethod "$base/repository/files/$([Uri]::EscapeDataString($path))?ref=main" -Headers $headers; $action='update'}catch{if([int]$_.Exception.Response.StatusCode -ne 404){throw}}
    $bytes=[IO.File]::ReadAllBytes($full)
    $content=[Convert]::ToBase64String($bytes)
    if($action -eq 'update' -and $remote.content.Replace("`n",'') -eq $content){continue}
    $item=@{action=$action;file_path=$path;content=$content;encoding='base64'}
    if($action -eq 'update'){$item.last_commit_id=$remote.last_commit_id}
    $actions+=$item
}
if(-not $actions){Write-Output 'No sample source changes to publish';return}
$body=@{branch='main';commit_message=$Message;actions=$actions} | ConvertTo-Json -Depth 12 -Compress
$r=Invoke-RestMethod "$base/repository/commits" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
Write-Output "Published commit $($r.id) ($($actions.Count) files): $($r.web_url)"
