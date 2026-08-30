#!/bin/bash
clear
echo "=================================================="
echo "     POS Recaudo - Actualizar"
echo "=================================================="
echo ""

cd "$(dirname "$0")"

# Verificar que sea un repositorio git
if [ ! -d ".git" ]; then
    echo "[ERROR] No se encontro el repositorio (.git)"
    echo "Descarga el proyecto con:"
    echo "  git clone https://github.com/saul195/POS-Recaudo.git"
    read -p "Presiona Enter para salir..."
    exit 1
fi

# Verificar git instalado
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git no esta instalado."
    echo "Instalar con: sudo apt install git"
    read -p "Presiona Enter para salir..."
    exit 1
fi

echo "1) Descargando cambios del repositorio..."
echo "------------------------------------------"
git pull
PULL_STATUS=$?
echo ""

if [ $PULL_STATUS -ne 0 ]; then
    echo "[ERROR] No se pudo actualizar."
    echo "Verifica tu conexion a internet o si tienes cambios locales sin guardar."
    read -p "Presiona Enter para salir..."
    exit 1
fi

echo ""
echo "2) Actualizando dependencias (npm install)..."
echo "---------------------------------------------"
if command -v node &> /dev/null; then
    npm install
    echo ""
    echo "Dependencias actualizadas correctamente."
else
    echo "[AVISO] Node.js no esta instalado, no se actualizaron dependencias."
fi

echo ""
echo "=================================================="
echo "     Actualizacion completada."
echo "=================================================="
read -p "Presiona Enter para cerrar..."
