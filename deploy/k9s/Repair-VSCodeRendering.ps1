$ErrorActionPreference='Stop'
$k9sPath=(Get-Command k9s.exe -ErrorAction Stop).Source
$settingsPath=Join-Path $env:APPDATA 'Code/User/settings.json'
$settingsBackup=$settingsPath+'.before-k9s-rendering.bak'
if(!(Test-Path -LiteralPath $settingsBackup)){Copy-Item -LiteralPath $settingsPath -Destination $settingsBackup}
$settings=[IO.File]::ReadAllText($settingsPath) | ConvertFrom-Json
$values=@{
  'terminal.integrated.fontFamily'='Consolas, ''Cascadia Mono'', monospace'
  'terminal.integrated.fontSize'=14
  'terminal.integrated.fontWeight'='normal'
  'terminal.integrated.fontWeightBold'='normal'
  'terminal.integrated.letterSpacing'=0
  'terminal.integrated.lineHeight'=1
  'terminal.integrated.gpuAcceleration'='on'
  'terminal.integrated.customGlyphs'=$true
  'terminal.integrated.unicodeVersion'='11'
}
foreach($key in $values.Keys){$settings | Add-Member -NotePropertyName $key -NotePropertyValue $values[$key] -Force}
$profiles=$settings.'terminal.integrated.profiles.windows'
if(!$profiles){$profiles=[pscustomobject]@{}; $settings | Add-Member -NotePropertyName 'terminal.integrated.profiles.windows' -NotePropertyValue $profiles -Force}
$profile=[pscustomobject]@{path=$k9sPath;args=@();overrideName=$true;icon='server';env=@{TERM='xterm-256color';COLORTERM='truecolor'}}
$profiles | Add-Member -NotePropertyName 'K9s Native' -NotePropertyValue $profile -Force
[IO.File]::WriteAllText($settingsPath,($settings | ConvertTo-Json -Depth 50),(New-Object Text.UTF8Encoding($false)))

$ext=Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.vscode/extensions') -Directory | Where-Object {$_.Name -like 'ofekmasas.k9s-for-vscode-*'} | Sort-Object Name -Descending | Select-Object -First 1
if(!$ext){throw 'k9s for vscode extension is not installed'}
$entry=Join-Path $ext.FullName 'out/extension.js'
$source=[IO.File]::ReadAllText($entry)
$old='shellPath: "C:\\Program Files\\Git\\bin\\bash.exe",'
$marker='// K9s starts directly as a native Windows terminal process.'
if(!$source.Contains($marker)){
  if(!$source.Contains($old) -or !$source.Contains('terminal.sendText("k9s");')){throw 'Extension startup differs from the verified version; no extension patch applied'}
  $backup=$entry+'.before-native-k9s.bak'
  if(!(Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $entry -Destination $backup}
  $source=$source.Replace($old,('shellPath: '+($k9sPath | ConvertTo-Json -Compress)+",`n            env: { TERM: 'xterm-256color', COLORTERM: 'truecolor' },"))
  $source=$source.Replace('terminal.sendText("k9s");',$marker)
  [IO.File]::WriteAllText($entry,$source,(New-Object Text.UTF8Encoding($false)))
}
node --check $entry
if($LASTEXITCODE -ne 0){throw 'Patched extension syntax check failed'}
'K9s rendering settings and native terminal profile applied. Existing settings were backed up.'
