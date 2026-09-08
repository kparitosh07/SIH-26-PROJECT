@echo off
:: MANAK - Packaging Compliance Checker Launcher
echo Checking MANAK Web App services...

:: Check if backend on port 8000 is listening
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Backend API Server...
    start /min "MANAK Backend API" cmd /c "cd /d %~dp0backend && venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
)

:: Check if frontend on port 3000 is listening
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting Frontend Server...
    start /min "MANAK Frontend UI" cmd /c "cd /d %~dp0frontend && npm run dev"
)

echo Opening MANAK Web App...
timeout /t 2 /nobreak >nul
start "" http://localhost:3000

