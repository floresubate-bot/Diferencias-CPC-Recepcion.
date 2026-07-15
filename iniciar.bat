@echo off
title Diferencias CPC vs Recepcion
echo ============================================================
echo   Iniciando Servidor: Diferencias CPC vs Recepcion
echo ============================================================
echo.

:: Check for python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo Por favor, instala Python desde https://www.python.org/downloads/
    echo Asegurate de marcar la casilla "Add Python to PATH" durante la instalacion.
    echo.
    pause
    exit /b
)

echo [1/3] Instalando y verificando dependencias (Flask, Pandas, etc.)...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] Ocurrio un error al instalar algunas dependencias.
    echo Intentando continuar...
)
echo.

echo [2/3] Abriendo el navegador en la aplicacion...
start http://127.0.0.1:5001
echo.

echo [3/3] Iniciando el servidor Flask local (Puerto 5001)...
echo Para cerrar la aplicacion, cierra esta ventana.
echo ============================================================
python app.py
pause
