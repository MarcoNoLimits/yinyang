# ============================================================
# YinYang Engine — Start Everything
# One-click launcher: Model -> Backend -> Frontend
# ============================================================

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "   YinYang Engine — Full Stack Launcher" -ForegroundColor Magenta
Write-Host "========================================`n" -ForegroundColor Magenta

$scriptsDir = $PSScriptRoot

# Step 1: Check & start the model
Write-Host "[Step 1/3] Checking Ollama and model..." -ForegroundColor Cyan
& (Join-Path $scriptsDir "start_model.ps1")
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Model setup failed. Aborting." -ForegroundColor Red
    exit 1
}

# Step 2: Start Backend in a new terminal window
Write-Host "`n[Step 2/3] Starting Backend in new terminal..." -ForegroundColor Cyan
$backendScript = Join-Path $scriptsDir "start_backend.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$backendScript`"" -WindowStyle Normal
Write-Host "  Backend terminal launched. Waiting 5s for server init..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Step 3: Start Frontend in a new terminal window
Write-Host "`n[Step 3/3] Starting Frontend in new terminal..." -ForegroundColor Cyan
$frontendScript = Join-Path $scriptsDir "start_frontend.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$frontendScript`"" -WindowStyle Normal

# Final health check
Write-Host "`n[INFO] Waiting 8 seconds, then running health check..." -ForegroundColor Gray
Start-Sleep -Seconds 8
& (Join-Path $scriptsDir "health_check.ps1")

Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "   All services launched!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Magenta
