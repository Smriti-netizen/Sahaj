# Sahaj — single-port production (frontend dist + FastAPI + Ollama on same machine)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$env:Path = "C:\Program Files\nodejs;" + [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "Building frontend..."
Set-Location "$Root\frontend"
& "C:\Program Files\nodejs\npm.cmd" run build
if ($LASTEXITCODE -ne 0) { throw "npm build failed" }

Write-Host "Starting Sahaj API on http://0.0.0.0:8000 ..."
Set-Location "$Root\backend"
$venvPy = "$Root\backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    py -3.13 -m venv .venv
    & "$Root\backend\.venv\Scripts\pip.exe" install -r requirements.txt
}
& $venvPy -m uvicorn main:app --host 0.0.0.0 --port 8000
