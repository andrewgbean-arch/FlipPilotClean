# Repairs a broken Ollama install on Windows and checks that a model can actually run.
#
# Symptom this fixes: "error starting llama-server: llama-server binary not found".
#
# Run it in PowerShell (no admin needed; admin is only used for the optional antivirus step):
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   .\fix-ollama.ps1
#
# It writes a report to your Desktop (ollama-report.txt) that you can send to whoever is helping you.

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"   # makes downloads much faster in Windows PowerShell
$model = if ($env:GENESIS_CHAT_MODEL) { $env:GENESIS_CHAT_MODEL } else { "llama3.1:8b" }
$ollamaDir = Join-Path $env:LOCALAPPDATA "Programs\Ollama"
$desktop = [Environment]::GetFolderPath("Desktop")
$report = Join-Path $desktop "ollama-report.txt"
$log = New-Object System.Collections.Generic.List[string]

function Say($msg, $color = "White") {
  Write-Host $msg -ForegroundColor $color
  $log.Add($msg)
}

function Test-Api {
  try { Invoke-RestMethod "http://127.0.0.1:11434/api/version" -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}

function Find-LlamaServer {
  if (-not (Test-Path $ollamaDir)) { return @() }
  return @(Get-ChildItem $ollamaDir -Recurse -Filter "llama-server*.exe" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
}

function Stop-Ollama {
  Get-Process -Name "ollama", "ollama app", "llama-server" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

function Start-Ollama {
  $app = Join-Path $ollamaDir "ollama app.exe"
  if (Test-Path $app) { Start-Process $app } else { Start-Process (Join-Path $ollamaDir "ollama.exe") -ArgumentList "serve" -WindowStyle Hidden }
  for ($i = 0; $i -lt 60; $i++) { if (Test-Api) { return $true }; Start-Sleep -Seconds 1 }
  return $false
}

Say "=== Ollama repair  $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===" Cyan
Say "Windows: $([Environment]::OSVersion.VersionString)  |  PowerShell: $($PSVersionTable.PSVersion)"
Say "Install folder: $ollamaDir  (exists: $(Test-Path $ollamaDir))"

# ---------------------------------------------------------------- 1. What's wrong now?
Say "`n[1/5] Checking the current install..." Cyan
$servers = Find-LlamaServer
if ($servers.Count -gt 0) { Say "llama-server found: $($servers -join ', ')" Green } else { Say "llama-server.exe is MISSING (this is the problem)." Yellow }

$detections = @()
try {
  $detections = @(Get-MpThreatDetection -ErrorAction Stop | Where-Object { ($_.Resources -join " ") -match "ollama|llama" })
} catch { Say "(Could not read Windows Defender history: $($_.Exception.Message))" }
if ($detections.Count -gt 0) {
  Say "Windows Defender has removed Ollama files $($detections.Count) time(s):" Yellow
  foreach ($d in $detections) { Say "  - $($d.InitialDetectionTime): $($d.Resources -join ', ')" Yellow }
} else {
  Say "No Windows Defender removals of Ollama files found."
}

# ---------------------------------------------------------------- 2. Optional antivirus exclusion
if ($detections.Count -gt 0) {
  Say "`n[2/5] Antivirus removed Ollama's engine before, so reinstalling alone may not stick." Cyan
  $answer = Read-Host "Add an exclusion for the Ollama folder to Windows Defender? This asks for admin permission. (y/n)"
  if ($answer -match "^[yY]") {
    try {
      Start-Process powershell -Verb RunAs -Wait -ArgumentList "-NoProfile", "-Command", "Add-MpPreference -ExclusionPath '$ollamaDir'"
      Say "Exclusion added for $ollamaDir" Green
    } catch { Say "Could not add the exclusion: $($_.Exception.Message)" Yellow }
  } else { Say "Skipped the exclusion." }
} else {
  Say "`n[2/5] No antivirus step needed." Cyan
}

# ---------------------------------------------------------------- 3. Reinstall
Say "`n[3/5] Downloading a fresh Ollama installer (about 1.5 GB, a few minutes)..." Cyan
Stop-Ollama
$setup = Join-Path $env:TEMP "OllamaSetup.exe"
$sources = @("https://ollama.com/download/OllamaSetup.exe", "https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe")
$downloaded = $false
foreach ($url in $sources) {
  Say "Trying $url"
  Remove-Item $setup -ErrorAction SilentlyContinue
  if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe -L --fail --silent --show-error -o $setup $url
  } else {
    try { Invoke-WebRequest $url -OutFile $setup -UseBasicParsing } catch { Say "  failed: $($_.Exception.Message)" }
  }
  if ((Test-Path $setup) -and ((Get-Item $setup).Length -gt 50MB)) { $downloaded = $true; break }
}
if (-not $downloaded) {
  Say "Could not download the installer. Check the internet connection and run this script again." Red
  $log | Set-Content $report; Say "Report saved to $report"; exit 1
}
Say "Downloaded $([math]::Round((Get-Item $setup).Length / 1MB)) MB. Installing (a window may flash up)..."
Start-Process $setup -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait
Start-Sleep -Seconds 3
Stop-Ollama   # the installer auto-starts it; restart cleanly below

$servers = Find-LlamaServer
if ($servers.Count -gt 0) { Say "llama-server is now present: $($servers -join ', ')" Green }
else { Say "llama-server.exe is STILL missing after reinstalling. Antivirus is almost certainly deleting it (see step 2)." Red }

# ---------------------------------------------------------------- 4. Start Ollama and check models
Say "`n[4/5] Starting Ollama..." Cyan
if (-not (Start-Ollama)) {
  Say "Ollama did not start (nothing answering on http://127.0.0.1:11434)." Red
  $log | Set-Content $report; Say "Report saved to $report"; exit 1
}
$version = (Invoke-RestMethod "http://127.0.0.1:11434/api/version").version
Say "Ollama $version is running." Green
$installed = @((Invoke-RestMethod "http://127.0.0.1:11434/api/tags").models | ForEach-Object { $_.name })
Say "Installed models: $($installed -join ', ')"
foreach ($m in @($model, "nomic-embed-text")) {
  $base = $m.Split(":")[0]
  if (-not ($installed | Where-Object { $_ -eq $m -or $_.Split(":")[0] -eq $base })) {
    Say "Model $m is missing; downloading..." Yellow
    & (Join-Path $ollamaDir "ollama.exe") pull $m
  }
}

# ---------------------------------------------------------------- 5. Real test: make the model talk
Say "`n[5/5] Asking $model to say hello (the first load can take a minute or two)..." Cyan
try {
  $body = @{ model = $model; prompt = "Say hello in one short sentence."; stream = $false } | ConvertTo-Json
  $r = Invoke-RestMethod "http://127.0.0.1:11434/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 600
  Say "Model replied: $($r.response.Trim())" Green
  Say "`nSUCCESS: Ollama is fixed. Start Genesis again from the desktop icon." Green
} catch {
  $detail = $_.ErrorDetails.Message
  if (-not $detail) { $detail = $_.Exception.Message }
  Say "The model could not run: $detail" Red
  Say "Send the report file below to your helper." Yellow
}

$log | Set-Content $report
Say "`nReport saved to $report"
