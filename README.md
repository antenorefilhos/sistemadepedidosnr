# Antenor & Filhos - Plataforma de Pedidos

Plataforma completa de e-commerce e gestao de pedidos para o Mercado Antenor & Filhos.

## Stack

- **Backend:** NestJS 11 + Prisma + PostgreSQL 15 + Redis 7 + MeiliSearch + integracao Solidcom (ERP)
- **Storefront:** React 18 + Vite + TypeScript + Tailwind CSS
- **Admin:** React 18 + Vite + ApexCharts
- **Picking App:** React 18 + Vite (separacao e conferencia de pedidos)
- **Delivery App:** React 18 + Vite (rastreamento de entregas)

## Execucao

```bash
cd sistema
docker compose up -d
```

## Enderecos locais

| Servico      | URL                          |
|-------------|------------------------------|
| Storefront  | http://localhost:3000         |
| API         | http://localhost:3001         |
| Admin       | http://localhost:3002         |
| Picking     | http://localhost:3003         |
| Delivery    | http://localhost:3004         |
| Swagger     | http://localhost:3001/api     |
| MeiliSearch | http://localhost:7700         |

## Estrutura

```
sistema/
  backend/        API NestJS + Prisma + PostgreSQL
  storefront/     Loja publica (React)
  admin/          Painel administrativo (React)
  picking-app/    App de separacao de pedidos (React)
  delivery-app/   App de entregas (React)
  docker-compose.yml
```

## Regras de negocio

- Visibilidade de produto controlada pelo ERP (flags `NUNCA`, `SEMPRE`, `ESTOQUE`)
- Vitrines da Home gerenciadas pelo CMS de categorias com prioridade e limite
- Checkout convidado configuravel por flags de ambiente
- Busca full-text via MeiliSearch com filtros por categoria e faixa de preco
- Gestao de equipe (admin, picker, driver) com controle de acesso por role
- Fluxo picking: atribuicao, separacao, revisao e finalizacao de pedidos
