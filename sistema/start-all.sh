#!/bin/bash

echo "🏪 Iniciando Mercado Antenor..."

# JON-102 (Auditoria 360, Medium): pkill -f "nest start"/"vite" casava por
# padrao global de linha de comando, sem filtro de diretorio nem PID -- rodar
# este script podia matar Nest/Vite de OUTRO projeto do mesmo usuario. Agora
# so guardamos os PIDs que ESTE script cria e matamos so eles no cleanup.
cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"
declare -a CHILD_PIDS=()

cleanup() {
  echo ""
  echo "Encerrando servicos deste script..."
  for pid in "${CHILD_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# Backend
echo "🚀 Iniciando Backend (3001)..."
cd "$ROOT_DIR/backend"
npm run start:dev &
CHILD_PIDS+=($!)

sleep 3

# Frontend
echo "🎨 Iniciando Frontend (3000)..."
cd "$ROOT_DIR/frontend"
npm run dev &
CHILD_PIDS+=($!)

sleep 2

# Admin
echo "👨‍💼 Iniciando Admin (3002)..."
cd "$ROOT_DIR/admin"
npm run dev &
CHILD_PIDS+=($!)

echo ""
echo "✅ Todos os serviços iniciados!"
echo ""
echo "🌐 Endpoints:"
echo "   Loja:   http://localhost:3000"
echo "   Admin:  http://localhost:3002"
echo "   API:    http://localhost:3001"
echo ""
echo "Pressione Ctrl+C para parar todos os serviços"

wait
