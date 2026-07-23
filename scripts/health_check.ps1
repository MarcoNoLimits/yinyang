# ============================================================
# YinYang Engine — Health Check
# Verifies all services are running and reachable
# ============================================================

Write-Host "`n=== YinYang — Health Check ===`n" -ForegroundColor Cyan

$allGood = $true

# 1. Check Ollama
Write-Host "[1/3] Ollama API..." -NoNewline
try {
    $ollamaResponse = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
    $models = $ollamaResponse.models | ForEach-Object { $_.name }
    $hasGemma = $models | Where-Object { $_ -like "*gemma4*e2b*" }
    if ($hasGemma) {
        Write-Host " OK (gemma4:e2b-it-qat loaded)" -ForegroundColor Green
    } else {
        Write-Host " WARN (Ollama running but model not found)" -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host " FAIL (Ollama not reachable)" -ForegroundColor Red
    $allGood = $false
}

# 2. Check Backend
Write-Host "[2/3] Backend API..." -NoNewline
try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:8000/" -Method GET -TimeoutSec 5
    if ($backendResponse.status -eq "healthy") {
        Write-Host " OK ($($backendResponse.service) v$($backendResponse.version))" -ForegroundColor Green
    } else {
        Write-Host " WARN (responded but status unclear)" -ForegroundColor Yellow
    }
} catch {
    Write-Host " FAIL (Backend not reachable at localhost:8000)" -ForegroundColor Red
    $allGood = $false
}

# 3. Check Frontend
Write-Host "[3/3] Frontend dev server..." -NoNewline
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173/" -Method GET -TimeoutSec 5 -UseBasicParsing
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host " OK (Vite dev server responding)" -ForegroundColor Green
    } else {
        Write-Host " WARN (HTTP $($frontendResponse.StatusCode))" -ForegroundColor Yellow
    }
} catch {
    Write-Host " FAIL (Frontend not reachable at localhost:5173)" -ForegroundColor Red
    $allGood = $false
}

# Summary
Write-Host ""
if ($allGood) {
    Write-Host "[RESULT] All systems operational!" -ForegroundColor Green
} else {
    Write-Host "[RESULT] Some services are down. Check the output above." -ForegroundColor Yellow
}
Write-Host ""
