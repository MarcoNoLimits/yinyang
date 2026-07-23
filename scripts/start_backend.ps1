# ============================================================
# YinYang Engine — Start Backend (FastAPI)
# Activates venv, installs deps, and launches the server
# ============================================================

Write-Host "`n=== YinYang — Backend Launcher ===`n" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot ".." "SwarmService"
$backendDir = (Resolve-Path $backendDir).Path

Write-Host "Backend directory: $backendDir" -ForegroundColor Gray

# Check if venv exists
$venvActivate = Join-Path $backendDir ".venv" "Scripts" "Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Host "[INFO] Virtual environment not found. Creating..." -ForegroundColor Yellow
    Push-Location $backendDir
    python -m venv .venv
    Pop-Location
}

# Activate venv
Write-Host "[INFO] Activating virtual environment..." -ForegroundColor Yellow
& $venvActivate

# Install requirements
$reqFile = Join-Path $backendDir "requirements.txt"
if (Test-Path $reqFile) {
    Write-Host "[INFO] Installing/updating Python dependencies..." -ForegroundColor Yellow
    Push-Location $backendDir
    pip install -r requirements.txt --quiet
    Pop-Location
}

# Launch FastAPI
Write-Host "`n[STARTING] FastAPI server on http://localhost:8000" -ForegroundColor Green
Push-Location $backendDir
python main.py
Pop-Location
