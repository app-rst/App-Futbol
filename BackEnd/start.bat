@echo off
setlocal
title Fulbito - BackEnd (Supabase)
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

:menu
echo.
echo ============================================
echo   Fulbito - BackEnd (Supabase en la nube)
echo ============================================
echo   1. Correr tests de la base de datos (local, sin Docker)
echo   2. Aplicar migraciones al proyecto de Supabase (db push)
echo   3. Ver estado de migraciones (local vs. remoto)
echo   4. Iniciar sesion en Supabase CLI (solo la primera vez)
echo   5. Vincular el proyecto de Supabase (solo la primera vez)
echo   6. Crear/actualizar administrador del sistema (usa el archivo .env)
echo   7. Salir
echo.
set "opt="
set /p opt=Elegi una opcion: 

if "%opt%"=="1" call npm test & goto menu
if "%opt%"=="2" call npx supabase db push & goto menu
if "%opt%"=="3" call npx supabase migration list & goto menu
if "%opt%"=="4" call npx supabase login & goto menu
if "%opt%"=="5" goto link
if "%opt%"=="6" goto admin
if "%opt%"=="7" exit /b 0
echo Opcion invalida.
goto menu

:admin
if not exist ".env" (
  echo [ERROR] Falta el archivo .env en BackEnd. Copia .env.example como .env y completalo.
  goto menu
)
call npm run admin:create
goto menu

:link
set "ref="
echo El "project ref" es lo que va antes de .supabase.co en la URL de tu proyecto.
set /p ref=Project ref: 
if "%ref%"=="" goto menu
call npx supabase link --project-ref %ref%
goto menu
