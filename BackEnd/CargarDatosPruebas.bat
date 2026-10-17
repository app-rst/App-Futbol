@echo off
setlocal
cd /d "%~dp0"
title Fulbito - Cargar datos de prueba

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js. Instalalo desde https://nodejs.org ^(version 22 o superior^).
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
echo ============================================
echo   Fulbito - Cargar datos de prueba
echo ============================================
echo   Vas a CREAR usuarios y partidos de prueba.
echo   Se crean 15 usuarios ficticios (jugador01..15@dev.fulbito.test) y 3 partidos "[Prueba]". Se borran con borrarDatosPrueba.bat.
echo.
set "confirm="
set /p confirm=Escribi PRUEBAS para confirmar: 
if not "%confirm%"=="PRUEBAS" (
  echo Cancelado.
  pause
  exit /b 1
)

rem El script vuelve a pedir PRUEBAS en produccion: se lo pasamos ya confirmado.
echo PRUEBAS| npm run seed
echo.
pause
