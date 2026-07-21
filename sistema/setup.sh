#!/bin/bash

echo "🚀 Iniciando setup do Mercado Antenor..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js 20+ primeiro."
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado."
    exit 1
fi

echo "📦 Instalando dependências..."

# Backend
echo "🔧 Configurando backend..."
cd backend
npm install

# Frontend
echo "🎨 Configurando frontend..."
cd ../frontend
npm install

# Admin
echo "📊 Configurando admin..."
cd ../admin
npm install

cd ..

echo "✅ Setup concluído!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o banco PostgreSQL"
echo "2. Execute: cd backend && npx prisma migrate dev"
echo "3. Configure os arquivos .env"
echo "4. Execute: npm run dev:all"
echo ""
echo "🎯 Para desenvolvimento:"
echo "- Backend: cd backend && npm run start:dev"
echo "- Frontend: cd frontend && npm run dev"
echo "- Admin: cd admin && npm run dev"