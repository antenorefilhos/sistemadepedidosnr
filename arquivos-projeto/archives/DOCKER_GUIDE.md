# DOCKER_GUIDE.md - Arquitetura Docker

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha

## Visao geral

O sistema roda com 6 servicos em Docker Compose:
- db
- redis
- meili
- api
- storefront
- admin

## Objetivo da stack

- oferecer ambiente local consistente
- manter PostgreSQL e Redis no caminho operacional padrao
- garantir build e execucao reproduziveis de backend, storefront e admin

## Containers

### API
- NestJS + Prisma
- exposta em 3001
- acessa PostgreSQL e Redis pela rede interna

### Storefront
- build Vite servido por Nginx
- exposto em 3000

### Admin
- build Vite servido por Nginx
- exposto em 3002

### Banco e cache
- PostgreSQL 15 (porta 5432 publicada para acesso local)
- Redis 7

## Comandos operacionais

```bash
cd sistema
docker compose up -d db redis api storefront admin
docker compose ps
docker compose logs --tail=100 api
```

## Observacao arquitetural

- API propria de negocio implementada (Phase 22 concluida)
- Solidcom utilizada como integracao ERP em segundo plano, nao como contrato primario
- CMS de categorias controla vitrines da Home via campos `priority` e `limit`