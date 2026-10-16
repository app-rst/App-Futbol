@echo off
setlocal
title Fulbito - FrontEnd
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js. Instalalo desde https://nodejs.org ^(version 22 o superior^).
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [ERROR] Falta el archivo .env.local
  echo Copia .env.example como .env.local y completa los datos de tu proyecto de Supabase.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Fallo npm install.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando la app en http://localhost:3000  (Ctrl+C para detener)
echo.
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
