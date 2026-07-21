# DEPLOYMENT.md - Guia de Implantacao

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Pre-requisitos

- Docker 24+
- Docker Compose v2
- minimo de 2 vCPUs e 2 GB de RAM
- variaveis de ambiente definidas para backend, admin e storefront

## Fluxo recomendado

### 1. Clonar e entrar na pasta sistema
```bash
git clone <url-do-repositorio>
cd sistema
```

### 2. Configurar variaveis
```bash
cp backend/.env.example backend/.env
```

### 3. Subir a stack
```bash
docker compose up -d --build db redis api storefront admin
docker compose ps
```

### 4. Aplicar migracoes e seed quando necessario
```bash
docker compose run --rm api npx prisma migrate deploy
docker compose run --rm api npm run prisma:seed
```

## URLs padrao

- loja: http://localhost:3000
- admin: http://localhost:3002
- api: http://localhost:3001
- swagger: http://localhost:3001/api

## Observacoes operacionais

- uploads persistem via bind mount do backend
- PostgreSQL e Redis fazem parte da stack principal
- PostgreSQL publicado em `localhost:5432` no compose local para permitir `npx prisma migrate dev` fora de container
- API propria como frente de negocio; Solidcom permanece como integracao ERP secundaria
- vitrines da Home controladas via `/cms/categories` (campos `active`, `priority`, `limit`)