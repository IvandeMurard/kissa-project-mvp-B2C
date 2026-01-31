@echo off
REM Script pour lancer les deux serveurs (backend + frontend)
REM Double-cliquez sur ce fichier

echo.
echo ========================================
echo   KISSA - DÉMARRAGE COMPLET
echo ========================================
echo.
echo Ce script va lancer :
echo   1. Backend (port 8000)
echo   2. Frontend (port 3000)
echo.
echo Deux fenêtres vont s'ouvrir.
echo Pour arrêter, fermez les fenêtres ou Ctrl+C dans chaque terminal.
echo.
echo ========================================
echo.

REM Lancer le backend dans une nouvelle fenêtre
start "Kissa Backend" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && set PYTHONUNBUFFERED=1 && uvicorn api:app --reload --host 127.0.0.1 --port 8000"

REM Attendre un peu avant de lancer le frontend
timeout /t 3 /nobreak >nul

REM Lancer le frontend dans une nouvelle fenêtre
start "Kissa Frontend" cmd /k "cd /d %~dp0kissa-frontend && if not exist node_modules call npm install && npm run dev"

echo.
echo Serveurs lancés dans des fenêtres séparées.
echo.
pause

