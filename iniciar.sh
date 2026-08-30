#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "Node.js no esta instalado."
    echo "Instalar con: sudo apt install nodejs npm"
    read -p "Presiona Enter para salir..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias, espera..."
    npm install
fi

echo "Iniciando POS Recaudo..."
node server.js &
sleep 2
xdg-open http://localhost:3000 2>/dev/null || sensible-browser http://localhost:3000 2>/dev/null
echo ""
echo "POS Recaudo corriendo en http://localhost:3000"
echo "Para CERRAR presiona Ctrl+C"
wait
