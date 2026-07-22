@echo off
title POS Recaudo
color 0A
echo.
echo  ========================================
echo       POS Recaudo - Sistema de Venta
echo  ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descarga desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Iniciando servidor...
cd /d "%~dp0"
start /b node server.js >nul 2>nul
echo  Servidor iniciado en http://localhost:3000

timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo  ========================================
echo    Servidor corriendo. Abierto en el
echo    navegador. Para CERRAR presiona
echo    cualquier tecla en esta ventana.
echo  ========================================
echo.
pause >nul

echo.
echo  Cerrando servidor...
taskkill /f /im node.exe >nul 2>nul
timeout /t 1 /nobreak >nul
echo  Servidor cerrado.
