# DEPLOYMENT - Mercado Antenor

Data: 18 de abril de 2026  
Versao de referencia: 0.9.0-dev

Estado atual:

- o setup de desenvolvimento local usa SQLite
- a documentacao de deploy nao deve assumir que a stack local ja e a stack definitiva de producao
- antes de deploy produtivo, defina a estrategia de banco e revise o schema do Prisma se houver migracao para outro provider

Validacao de build:

```bash
npm run build:all
```

Saidas esperadas:

- backend compilado com Nest
- frontend gerado via vite build
- admin gerado via vite build

Opcao 1: deploy simples alinhado ao estado atual

- backend em um unico host Node.js
- frontend e admin servidos como estatico apos build
- SQLite apenas para cenarios controlados de baixa concorrencia e operacao centralizada

Passos:

1. instalar dependencias
2. gerar build
3. provisionar variaveis de ambiente do backend
4. publicar frontend e admin estaticos
5. executar backend com PM2 ou servico equivalente

Exemplo minimo de ambiente do backend:

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="definir-secret-forte"
PORT=3001
NODE_ENV="production"
FRONTEND_URL="https://loja.exemplo.com"
ADMIN_URL="https://admin.exemplo.com"
```

Opcao 2: evolucao para producao com banco dedicado

- migrar explicitamente o schema do Prisma
- revisar migracoes
- ajustar documentacao e runbooks
- somente depois disso documentar PostgreSQL como stack oficial

PM2:

```bash
cd sistema/backend
npm install --production
npm run build
pm2 start dist/main.js --name mercado-antenor-api
```

Frontend e admin:

- execute npm run build em sistema/frontend e sistema/admin
- publique o conteudo de dist em servidor estatico, CDN ou plataforma equivalente
- aponte VITE_API_URL para a URL publica da API antes do build de producao

Checklist antes do deploy:

- build limpo nas tres aplicacoes
- JWT_SECRET forte
- CORS e URLs publicas revisados
- estrategia de backup definida
- observabilidade e logs definidos

Se a operacao exigir PostgreSQL, Redis ou Docker, isso deve ser tratado como etapa de arquitetura e nao como pressuposto do deploy atual.
