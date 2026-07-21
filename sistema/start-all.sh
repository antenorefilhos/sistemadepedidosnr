#!/bin/bash

echo "🏪 Iniciando Mercado Antenor..."

# Kill existing processes
pkill -f "nest start"
pkill -f "vite"

# Backend
echo "🚀 Iniciando Backend (3001)..."
cd backend
npm run start:dev &

sleep 3

# Frontend
echo "🎨 Iniciando Frontend (3000)..."
cd ../frontend
npm run dev &

sleep 2

# Admin
echo "👨‍💼 Iniciando Admin (3002)..."
cd ../admin
npm run dev &

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
