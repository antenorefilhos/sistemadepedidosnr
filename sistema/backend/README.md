# Backend - Antenor & Filhos

## Stack

- NestJS 10
- Prisma 5 + PostgreSQL 15
- Redis 7
- MeiliSearch

## Rodar com Docker (recomendado)

```bash
cd ../
docker compose up -d db redis meili api
```

## Scripts uteis

```bash
npm run build
npm run start:dev
npx prisma migrate deploy
npx prisma generate
```

## Integracoes

- Solidcom como ERP em segundo plano
- Regras de visibilidade de catalogo por `syncOption`:
  - `NUNCA`
  - `SEMPRE`
  - `ESTOQUE`
- CMS de categorias para vitrines da Home:
  - campos `active`, `priority` e `limit` no modelo `Category`
  - endpoint `GET /cms/categories` para leitura publica da configuracao
  - endpoints `POST` e `PATCH /cms/categories` protegidos por JWT + role admin

## Imagens

- servico estatico: `/uploads`
- catalogo: `/uploads/products/{ean}.webp`
- importacao em lote: `scripts/import-images.js`
