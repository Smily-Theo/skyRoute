@echo off
setlocal
cd /d "%~dp0"
title SkyRoute Intelligence
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python was not found. Install Python 3.10 or newer from python.org and enable Add Python to PATH.
  pause
  exit /b 1
)
echo.
echo  ================================================
echo    SKYROUTE INTELLIGENCE - LOCAL DEMO
echo  ================================================
echo.
echo  Starting the app. No pip or npm install is needed.
echo  Keep this window open while using SkyRoute.
echo.
start "SkyRoute Intelligence" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8000"
python app\server.py --host 127.0.0.1 --port 8000
if errorlevel 1 (
  echo.
  echo [ERROR] The server could not start. Port 8000 may already be in use.
  echo Try closing the other app or edit the port in start.bat.
  pause
)
endlocal
