@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

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

rem Si hay un solo ambiente configurado, se usa directo (hoy: un unico proyecto de Supabase).
if exist ".env.production" if not exist ".env.development" (set "ENV=prod" & set "ENVFILE=.env.production" & set "LABEL=PRODUCCION" & goto check_env)
if exist ".env.development" if not exist ".env.production" (set "ENV=dev" & set "ENVFILE=.env.development" & set "LABEL=DESARROLLO" & goto check_env)

:choose_env
echo.
echo ============================================
echo   Fulbito - BackEnd: elegi el ambiente
echo ============================================
echo   D. Desarrollo  (base de pruebas)
echo   P. Produccion  (la base que usan tus amigos)
echo   S. Salir
echo.
set "envopt="
set /p envopt=Ambiente [D/P/S]: 
if /i "%envopt%"=="D" (set "ENV=dev" & set "ENVFILE=.env.development" & set "LABEL=DESARROLLO" & goto check_env)
if /i "%envopt%"=="P" (set "ENV=prod" & set "ENVFILE=.env.production" & set "LABEL=PRODUCCION" & goto check_env)
if /i "%envopt%"=="S" exit /b 0
echo Opcion invalida.
goto choose_env

:check_env
title Fulbito - BackEnd [%LABEL%]
if not exist "%ENVFILE%" (
  echo.
  echo [ERROR] Falta el archivo %ENVFILE% en BackEnd.
  echo Copia .env.example como %ENVFILE% y completalo. Ver Docs\AMBIENTES.md
  goto choose_env
)

:menu
echo.
echo ============================================
echo   Fulbito - BackEnd    Ambiente: %LABEL%
echo ============================================
echo   1. Correr tests de la base de datos (local, sin Docker)
echo   2. Ver estado de migraciones en %LABEL%
echo   3. Aplicar migraciones en %LABEL%
echo   4. Crear/actualizar administrador del sistema en %LABEL%
echo   5. Crear datos de prueba ^(usuarios y partidos "[Prueba]"^)
echo   6. Borrar datos de prueba
echo   7. Iniciar sesion en Supabase CLI ^(solo la primera vez^)
echo   8. Cambiar de ambiente
echo   9. Salir
if "%ENV%"=="prod" echo   ^(En produccion, las opciones 3 a 6 piden confirmacion escrita^)
echo.
set "opt="
set /p opt=Elegi una opcion: 

if "%opt%"=="1" call npm test & goto menu
if "%opt%"=="2" call npm run db:status:%ENV% & goto menu
if "%opt%"=="3" call npm run db:push:%ENV% & goto menu
if "%opt%"=="4" call npm run admin:create:%ENV% & goto menu
if "%opt%"=="5" call npm run seed -- %ENV% & goto menu
if "%opt%"=="6" call npm run seed:reset -- %ENV% & goto menu
if "%opt%"=="7" call npx supabase login & goto menu
if "%opt%"=="8" goto choose_env
if "%opt%"=="9" exit /b 0
echo Opcion invalida.
goto menu
