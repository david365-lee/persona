$ErrorActionPreference = 'Stop'
$settingsPath = Join-Path $env:APPDATA 'Code/User/settings.json'
$settings = [IO.File]::ReadAllText($settingsPath) | ConvertFrom-Json
$backup = $settingsPath + '.before-k9s-utf8.bak'
if (!(Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $settingsPath -Destination $backup }
$terminalEnv = $settings.'terminal.integrated.env.windows'
if (!$terminalEnv) { $terminalEnv = [pscustomobject]@{} }
$terminalEnv | Add-Member -NotePropertyName RUNEWIDTH_EASTASIAN -NotePropertyValue '0' -Force
$terminalEnv | Add-Member -NotePropertyName TCELL_TRUECOLOR -NotePropertyValue 'enable' -Force
$settings | Add-Member -NotePropertyName 'terminal.integrated.env.windows' -NotePropertyValue $terminalEnv -Force
$settings | Add-Member -NotePropertyName 'jaewonK9s.windowsConsoleCompatibility' -NotePropertyValue $false -Force
$updated = @()
$profiles = $settings.'terminal.integrated.profiles.windows'
if ($profiles) {
    foreach ($property in $profiles.PSObject.Properties) {
        $profile = $property.Value
        if ($profile.path -isnot [string] -or $profile.path -notmatch '(^|[\\/])k9s(\.exe)?$') { continue }
        $arguments = @($profile.path) + @($profile.args)
        $quoted = @($arguments | ForEach-Object { "'" + ([string]$_).Replace("'", "''") + "'" })
        $script = '$utf8 = New-Object System.Text.UTF8Encoding($false)' + "`r`n" +
            '[Console]::InputEncoding = $utf8' + "`r`n" +
            '[Console]::OutputEncoding = $utf8' + "`r`n" +
            '& ' + ($quoted -join ' ') + "`r`n" + 'exit $LASTEXITCODE'
        $profile.path = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
        $profile.args = @('-NoLogo', '-NoProfile', '-EncodedCommand', [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script)))
        if (!$profile.env) { $profile | Add-Member -NotePropertyName env -NotePropertyValue ([pscustomobject]@{}) }
        $profile.env | Add-Member -NotePropertyName RUNEWIDTH_EASTASIAN -NotePropertyValue '0' -Force
        $profile.env | Add-Member -NotePropertyName TCELL_TRUECOLOR -NotePropertyValue 'enable' -Force
        $updated += $property.Name
    }
}
[IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json -Depth 50), (New-Object Text.UTF8Encoding($false)))
"K9s narrow ambiguous-width mode enabled. UTF-8 profiles updated: $($updated -join ', '). Backup: $backup"
