$ErrorActionPreference = 'Stop'
function Kube([string[]]$Arguments) {
    $out = & kubectl --context docker-desktop @Arguments
    if ($LASTEXITCODE -ne 0) { throw "kubectl failed: $($Arguments[0])" }
    return $out
}
function Decode($value) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($value)) }
function Read-Secret($namespace, $name) { (Kube @('-n', $namespace, 'get', 'secret', $name, '-o', 'json')) | ConvertFrom-Json }
function Save-Secret($namespace, $name, $values, $type='Opaque', $labels=@{}) {
    $data=@{}
    foreach($key in $values.Keys) { $data[$key]=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$values[$key])) }
    @{apiVersion='v1';kind='Secret';metadata=@{name=$name;namespace=$namespace;labels=$labels};type=$type;data=$data} |
        ConvertTo-Json -Depth 15 | & kubectl --context docker-desktop apply -f -
    if ($LASTEXITCODE -ne 0) { throw "Cannot save Secret $name" }
}
$project = Read-Secret gitlab llmops-project-automation
$projectId = Decode $project.data.project_id
$projectToken = Decode $project.data.token
$gitHeaders = @{'PRIVATE-TOKEN'=$projectToken}
$gitApi = "https://gitlab.clush.cloud/api/v4/projects/$projectId"
foreach($namespace in @('llmops-sample','llmops-ci')) {
    @{apiVersion='v1';kind='Namespace';metadata=@{name=$namespace}} | ConvertTo-Json -Depth 5 | & kubectl --context docker-desktop apply -f -
    if($LASTEXITCODE -ne 0){throw 'Namespace creation failed'}
}
$harbor = Read-Secret harbor harbor-root
$harborUser = if($harbor.data.username){Decode $harbor.data.username}else{'root'}
$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($harborUser+':'+(Decode $harbor.data.password)))
$harborHeaders = @{Authorization="Basic $basic"}
$harborApi = 'https://harbor.clush.cloud/api/v2.0'
$projects = Invoke-RestMethod "$harborApi/projects?name=llmops" -Headers $harborHeaders
if(-not ($projects | Where-Object {$_.name -eq 'llmops'})) {
    Invoke-RestMethod "$harborApi/projects" -Headers $harborHeaders -Method Post -ContentType application/json -Body '{"project_name":"llmops","public":false}' | Out-Null
}
$robotSecret = Kube @('-n','llmops-ci','get','secret','harbor-robots','--ignore-not-found','-o','name')
if(-not $robotSecret) {
    $robots=@{}
    foreach($role in @('push','pull')) {
        $access=@(@{resource='repository';action='pull'})
        if($role -eq 'push'){$access+=@{resource='repository';action='push'}}
        $body=@{name="sample-$role";description="LLMOps sample $role only";duration=90;level='project';permissions=@(@{kind='project';namespace='llmops';access=$access})} | ConvertTo-Json -Depth 10
        $r=Invoke-RestMethod "$harborApi/robots" -Headers $harborHeaders -Method Post -ContentType application/json -Body $body
        $robots["${role}_username"]=$r.name
        $robots["${role}_password"]=$r.secret
    }
    Save-Secret llmops-ci harbor-robots $robots
}
$robots = Read-Secret llmops-ci harbor-robots
$pullUser=Decode $robots.data.pull_username
$pullPass=Decode $robots.data.pull_password
$dockerConfig=@{auths=@{'harbor.clush.cloud'=@{username=$pullUser;password=$pullPass;auth=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pullUser+':'+$pullPass))}}} | ConvertTo-Json -Depth 8 -Compress
foreach($ns in @('llmops-sample','llmops-ci')){Save-Secret $ns harbor-pull @{'.dockerconfigjson'=$dockerConfig} 'kubernetes.io/dockerconfigjson'}
$appExisting=Kube @('-n','llmops-sample','get','secret','support-assistant-auth','--ignore-not-found','-o','name')
if(-not $appExisting) {
    $code=@'
import requests, os, json
r=requests.post('http://localhost:4000/key/generate',headers={'Authorization':'Bearer '+os.environ['LITELLM_MASTER_KEY']},json={'key_alias':'llmops-support-assistant','models':['gemini-3.5-flash-lite'],'max_budget':1,'budget_duration':'30d','duration':'90d','metadata':{'project':'llmops-support-assistant'}},timeout=30)
r.raise_for_status()
print(json.dumps({'key':r.json()['key']}))
'@
    $keyResult = $code | & kubectl --context docker-desktop -n litellm exec -i deployment/litellm -- python -
    if($LASTEXITCODE -ne 0){throw 'Cannot create LiteLLM virtual key'}
    $key = ($keyResult | ConvertFrom-Json).key
    $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes=New-Object byte[] 32
    $rng.GetBytes($bytes)
    $appToken=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
    $rng.Dispose()
    Save-Secret llmops-sample support-assistant-auth @{LITELLM_API_KEY=$key;APP_API_TOKEN=$appToken}
}
$appSecret=Read-Secret llmops-sample support-assistant-auth
$variables=@{
    HARBOR_PUSH_USERNAME=(Decode $robots.data.push_username)
    HARBOR_PUSH_PASSWORD=(Decode $robots.data.push_password)
    LITELLM_API_KEY=(Decode $appSecret.data.LITELLM_API_KEY)
    APP_API_TOKEN=(Decode $appSecret.data.APP_API_TOKEN)
    GITOPS_PROJECT_TOKEN=$projectToken
}
$existingVars=Invoke-RestMethod "$gitApi/variables" -Headers $gitHeaders
foreach($name in $variables.Keys) {
    $method = if($existingVars.key -contains $name){'Put'}else{'Post'}
    $url = if($method -eq 'Put'){"$gitApi/variables/$name"}else{"$gitApi/variables"}
    $body=@{key=$name;value=$variables[$name];variable_type='env_var';protected=$true;masked=$true;raw=$true} | ConvertTo-Json -Compress
    Invoke-RestMethod $url -Headers $gitHeaders -Method $method -ContentType application/json -Body $body | Out-Null
}
$repoExists=Kube @('-n','argocd','get','secret','llmops-gitlab-repository','--ignore-not-found','-o','name')
if(-not $repoExists) {
    $deployBody=@{name='argocd-read-only';scopes=@('read_repository');expires_at=([DateTime]::UtcNow.AddDays(90).ToString('o'))} | ConvertTo-Json
    $deploy=Invoke-RestMethod "$gitApi/deploy_tokens" -Headers $gitHeaders -Method Post -ContentType application/json -Body $deployBody
    Save-Secret argocd llmops-gitlab-repository @{type='git';url='https://gitlab.clush.cloud/root/llmops-support-assistant.git';username=$deploy.username;password=$deploy.token} 'Opaque' @{'argocd.argoproj.io/secret-type'='repository'}
}
Save-Secret langflow support-assistant-link @{SUPPORT_ASSISTANT_URL='http://support-assistant.llmops-sample.svc.cluster.local:8000';SUPPORT_ASSISTANT_TOKEN=(Decode $appSecret.data.APP_API_TOKEN)}
Write-Output 'Project-specific Harbor robots, LiteLLM budget key, protected CI variables, Argo read-only repository and Langflow link configured.'
