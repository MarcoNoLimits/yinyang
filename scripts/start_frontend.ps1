# ============================================================
# YinYang Engine — Start Frontend (React + Vite)
# Installs npm deps if needed and launches the dev server
# ============================================================

Write-Host "`n=== YinYang — Frontend Launcher ===`n" -ForegroundColor Cyan

$frontendDir = Join-Path $PSScriptRoot ".." "Frontend"
$frontendDir = (Resolve-Path $frontendDir).Path

Write-Host "Frontend directory: $frontendDir" -ForegroundColor Gray

# Check if node_modules exists
$nodeModules = Join-Path $frontendDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "[INFO] node_modules not found. Running npm install..." -ForegroundColor Yellow
    Push-Location $frontendDir
    npm install
    Pop-Location
}

# Launch Vite dev server
Write-Host "`n[STARTING] Vite dev server on http://localhost:5173" -ForegroundColor Green
Push-Location $frontendDir
npm run dev
Pop-Location
