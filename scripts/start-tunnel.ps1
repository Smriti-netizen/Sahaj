# Public HTTPS URL via Cloudflare Quick Tunnel (free). PC + Ollama must stay on.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
    Write-Host "Installing cloudflared via winget..."
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

$health = $null
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 3
} catch {
    Write-Host "Backend not running on :8000. Start scripts\run-production.ps1 in another terminal first."
    exit 1
}
Write-Host ("Backend OK - model_loaded: " + $health.model_loaded)

Write-Host ""
Write-Host "=== Public URL (copy the https://....trycloudflare.com line below) ==="
Write-Host "Tunnel stops when you close this window. Keep PC on for 24/7 demo."
Write-Host ""
& cloudflared tunnel --url http://127.0.0.1:8000
