$ErrorActionPreference = "Stop"

$AppName = "LimbAlign"
$Bundle  = "$AppName-win"
$Port    = 47891

# Clean previous build
if (Test-Path $Bundle) { Remove-Item -Recurse -Force $Bundle }
New-Item -ItemType Directory -Force $Bundle | Out-Null

# Copy Vite build output and server
Copy-Item -Recurse dist "$Bundle\dist"
Copy-Item scripts\server.cjs "$Bundle\server.cjs"

# Write the launcher batch file
$launcher = @"
@echo off
setlocal
set PORT=$Port
set DIR=%~dp0

:: Kill any previous instance on this port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)

:: Check for node
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is required but was not found.
    echo Please install it from https://nodejs.org/
    pause
    exit /b 1
)

:: Start server in background, then open browser
start /b node "%DIR%server.cjs" "%DIR%dist" %PORT%
timeout /t 1 /nobreak >nul
start "" "http://localhost:%PORT%"
"@

$launcher | Set-Content -Encoding UTF8 "$Bundle\LimbAlign.bat"

Write-Host ""
Write-Host "Built $Bundle\"
Write-Host "  Double-click LimbAlign.bat to run, or:"
Write-Host "  .\$Bundle\LimbAlign.bat"
