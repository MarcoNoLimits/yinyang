# ============================================================
# YinYang Engine — Check Ollama Status
# Verifies that Ollama is running and gemma4:e2b-it-qat is available
# ============================================================

Write-Host "`n=== YinYang — Ollama Status Check ===`n" -ForegroundColor Cyan

# Check if Ollama process is running
$ollamaProcess = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if ($ollamaProcess) {
    Write-Host "[OK] Ollama process is running (PID: $($ollamaProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "[WARN] Ollama process not found. It may be running as a service or not started." -ForegroundColor Yellow
}

# Check Ollama API
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
    Write-Host "[OK] Ollama API is reachable at localhost:11434" -ForegroundColor Green
    
    $models = $response.models | ForEach-Object { $_.name }
    Write-Host "`nAvailable models:" -ForegroundColor White
    foreach ($model in $models) {
        if ($model -like "*gemma4*e2b*") {
            Write-Host "  -> $model" -ForegroundColor Green
        } else {
            Write-Host "  -> $model" -ForegroundColor Gray
        }
    }
    
    $targetModel = $models | Where-Object { $_ -like "*gemma4*e2b*" }
    if ($targetModel) {
        Write-Host "`n[OK] Target model 'gemma4:e2b-it-qat' is available!" -ForegroundColor Green
    } else {
        Write-Host "`n[MISSING] Model 'gemma4:e2b-it-qat' not found. Run start_model.ps1 to pull it." -ForegroundColor Red
    }
} catch {
    Write-Host "[ERROR] Cannot reach Ollama API at localhost:11434. Is Ollama running?" -ForegroundColor Red
    Write-Host "  Start Ollama with: ollama serve" -ForegroundColor Yellow
}

Write-Host "`n" 
