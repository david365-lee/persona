param([int]$TraceJob=0)
$ErrorActionPreference='Stop'
$s=kubectl --context docker-desktop -n gitlab get secret llmops-project-automation -o json | ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'Cannot read project automation Secret'}
$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s.data.token))
$h=@{'PRIVATE-TOKEN'=$t}
$base='https://gitlab.clush.cloud/api/v4/projects/2'
$pipelines=Invoke-RestMethod "$base/pipelines?per_page=3" -Headers $h
foreach($p in $pipelines){Write-Output "Pipeline $($p.id): $($p.status) $($p.web_url)"}
$jobs=Invoke-RestMethod "$base/jobs?per_page=12" -Headers $h
foreach($j in $jobs){Write-Output "Job $($j.id): $($j.name) $($j.status) $($j.failure_reason)"}
if($TraceJob){
    $trace=Invoke-RestMethod "$base/jobs/$TraceJob/trace" -Headers $h
    ($trace -split "`n" | Select-Object -Last 65) -join "`n"
}
