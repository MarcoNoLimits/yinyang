# ============================================================
# YinYang Engine — Start / Pull Gemma4 Model
# Ensures the model is pulled and loaded in Ollama
# ============================================================

Write-Host "`n=== YinYang — Model Launcher ===`n" -ForegroundColor Cyan

$MODEL = "gemma4:e2b-it-qat"

# Check if Ollama is reachable
try {
    $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
} catch {
    Write-Host "[ERROR] Ollama is not running. Starting Ollama..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Minimized
    Write-Host "Waiting 5 seconds for Ollama to initialize..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
}

# Check if model exists
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
    $models = $response.models | ForEach-Object { $_.name }
    $found = $models | Where-Object { $_ -like "*gemma4*e2b*" }
    
    if (-not $found) {
        Write-Host "[INFO] Model '$MODEL' not found locally. Pulling from registry..." -ForegroundColor Yellow
        & ollama pull $MODEL
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Failed to pull model '$MODEL'." -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] Model '$MODEL' pulled successfully." -ForegroundColor Green
    } else {
        Write-Host "[OK] Model '$MODEL' is already available locally." -ForegroundColor Green
    }
} catch {
    Write-Host "[ERROR] Cannot reach Ollama API. Aborting." -ForegroundColor Red
    exit 1
}

# Warm up the model and pin it in GPU memory
Write-Host "`n[INFO] Warming up model (loading into GPU memory)..." -ForegroundColor Yellow
try {
    $body = @{
        model = $MODEL
        prompt = "Hello"
        stream = $false
        keep_alive = "30m"
    } | ConvertTo-Json
    
    $warmup = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120
    Write-Host "[OK] Model '$MODEL' is loaded and ready!" -ForegroundColor Green
    Write-Host "  Response: $($warmup.response.Substring(0, [Math]::Min(100, $warmup.response.Length)))..." -ForegroundColor Gray
    
    # Show GPU status
    $ps = Invoke-RestMethod -Uri "http://localhost:11434/api/ps" -Method GET -TimeoutSec 5
    if ($ps.models) {
        foreach ($m in $ps.models) {
            $proc = if ($m.size_vram -gt 0) { "GPU" } else { "CPU" }
            $sizeMB = [math]::Round($m.size / 1MB, 0)
            Write-Host "  Processor: $proc | VRAM: ${sizeMB}MB | Keep-alive: 30 minutes" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "[WARN] Warmup call failed: $_" -ForegroundColor Yellow
    Write-Host "  The model may still load on first API call." -ForegroundColor Gray
}

Write-Host "`n"
