@echo off
title HYDRA - Studio video
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe-le depuis https://nodejs.org puis relance.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Premiere utilisation : installation... (quelques minutes)
  call npm install
  call npx playwright install chromium
)
echo.
echo Studio lance. Laisse cette fenetre ouverte.
node studio-server.js
pause
