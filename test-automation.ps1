# Blender Upload Automation Test Script

Write-Host ""
Write-Host "Testing Blender Upload Automation" -ForegroundColor Cyan
Write-Host ""
Write-Host "============================================================" -ForegroundColor Gray

$API_URL = "http://localhost:5002"

# Test 1: Server Health
Write-Host ""
Write-Host "1. Testing server health..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/" -Method Get
    Write-Host "   Server is healthy: $($response.status)" -ForegroundColor Green
    Write-Host "   Total models: $($response.totalModels)" -ForegroundColor Gray
} catch {
    Write-Host "   Server health check failed" -ForegroundColor Red
    exit 1
}

# Test 2: Stats Endpoint
Write-Host ""
Write-Host "2. Testing stats endpoint..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$API_URL/admin/stats" -Method Get
    Write-Host "   Stats retrieved successfully" -ForegroundColor Green
    Write-Host "   Total: $($stats.total)" -ForegroundColor Gray
    Write-Host "   Processing: $($stats.processing)" -ForegroundColor Gray
    Write-Host "   Generated: $($stats.generated)" -ForegroundColor Gray
    Write-Host "   Approved: $($stats.approved)" -ForegroundColor Gray
    Write-Host "   Failed: $($stats.failed)" -ForegroundColor Gray
    Write-Host "   Queue: $($stats.queue.active)/$($stats.queue.maxConcurrent) active, $($stats.queue.queued) queued" -ForegroundColor Gray
} catch {
    Write-Host "   Stats check failed" -ForegroundColor Red
    exit 1
}

# Test 3: List Glasses
Write-Host ""
Write-Host "3. Listing current glasses..." -ForegroundColor Yellow
try {
    $glasses = Invoke-RestMethod -Uri "$API_URL/admin/glasses" -Method Get
    Write-Host "   Retrieved $($glasses.total) glasses" -ForegroundColor Green
    foreach ($item in $glasses.glasses) {
        Write-Host "   - $($item.brand) $($item.model) [$($item.status)]" -ForegroundColor Gray
    }
} catch {
    Write-Host "   List glasses failed" -ForegroundColor Red
}

# Test 4: Check Blender Installation
Write-Host ""
Write-Host "4. Checking Blender installation..." -ForegroundColor Yellow
$blenderPath = "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
if (Test-Path $blenderPath) {
    Write-Host "   Blender found at: $blenderPath" -ForegroundColor Green
} else {
    Write-Host "   Blender not found at: $blenderPath" -ForegroundColor Red
}

# Test 5: Check Blender Script
Write-Host ""
Write-Host "5. Checking Blender script..." -ForegroundColor Yellow
$scriptPath = "backend/scripts/glasses_parametric.py"
if (Test-Path $scriptPath) {
    Write-Host "   Blender script found: $scriptPath" -ForegroundColor Green
} else {
    Write-Host "   Blender script not found: $scriptPath" -ForegroundColor Red
}

# Test 6: Check Output Directory
Write-Host ""
Write-Host "6. Checking output directory..." -ForegroundColor Yellow
if (Test-Path "backend/output") {
    $files = Get-ChildItem "backend/output" -Filter "*.glb"
    Write-Host "   Output directory exists with $($files.Count) GLB files" -ForegroundColor Green
} else {
    Write-Host "   Output directory not found" -ForegroundColor Yellow
}

# Test 7: Frontend Accessibility
Write-Host ""
Write-Host "7. Testing frontend accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173/admin-workflow-automated.html" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   Frontend is accessible" -ForegroundColor Green
        Write-Host "   URL: http://localhost:5173/admin-workflow-automated.html" -ForegroundColor Gray
    }
} catch {
    Write-Host "   Frontend not accessible" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Gray
Write-Host "Basic tests completed!" -ForegroundColor Cyan
Write-Host ""

Write-Host "Manual Testing Instructions:" -ForegroundColor Cyan
Write-Host "1. Open: http://localhost:5173/admin-workflow-automated.html" -ForegroundColor White
Write-Host "2. Fill in the upload form with test data" -ForegroundColor White
Write-Host "3. Click Upload and Generate button" -ForegroundColor White
Write-Host "4. Watch the status change from PROCESSING to GENERATED" -ForegroundColor White
Write-Host "5. The page will auto-refresh every 3 seconds" -ForegroundColor White
Write-Host ""
Write-Host "Expected behavior:" -ForegroundColor Cyan
Write-Host "   - Upload completes immediately" -ForegroundColor Gray
Write-Host "   - Status shows PROCESSING with pulsing animation" -ForegroundColor Gray
Write-Host "   - After 5-10 seconds status changes to GENERATED" -ForegroundColor Gray
Write-Host "   - Approve button appears when generated" -ForegroundColor Gray
Write-Host "   - If failed Retry button appears with error message" -ForegroundColor Gray
Write-Host ""
