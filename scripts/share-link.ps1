# Share Sahaj with a public URL (your PC must stay on; Ollama runs locally).
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "=== Sahaj shareable link ===" -ForegroundColor Cyan
Write-Host "Project: $Root"
Write-Host ""
Write-Host "1) Build frontend (once):" -ForegroundColor Yellow
Write-Host "   cd `"$Root\frontend`""
Write-Host "   npm install"
Write-Host "   npm run build"
Write-Host ""
Write-Host "2) Start backend (keep open):" -ForegroundColor Yellow
Write-Host "   cd `"$Root\backend`""
Write-Host "   python -m uvicorn main:app --host 0.0.0.0 --port 8000"
Write-Host ""
Write-Host "3) Public URL (pick one):" -ForegroundColor Yellow
Write-Host "   cloudflared tunnel --url http://localhost:8000"
Write-Host "   ngrok http 8000"
Write-Host ""
Write-Host "Share the https URL. PC + Ollama must stay running." -ForegroundColor Green
