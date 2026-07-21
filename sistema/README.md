# Sistema Antenor & Filhos

Este diretorio contem os servicos executaveis do projeto.

## Estrutura

- `backend/`: API NestJS + Prisma + PostgreSQL + Redis + integracoes
- `frontend/`: storefront React + Vite
- `admin/`: painel administrativo React + Vite
- `docker-compose.yml`: orquestracao local

## Stack local (Docker)

- `api` (porta 3001)
- `storefront` (porta 3000)
- `admin` (porta 3002)
- `db` PostgreSQL 15 (porta publicada 5432)
- `redis` Redis 7
- `meili` MeiliSearch (porta 7700)

## Comportamento operacional atual

- Home e carrinho publicos no storefront (sem bloqueio de login)
- Checkout convidado disponivel por padrao e controlado por flags no Compose
- Imagens de produto carregadas por `/uploads/...` no dominio da loja via proxy Nginx
- Vitrines da Home controladas pelo CMS de categorias com `active`, `priority` e `limit`

## Subir ambiente

```bash
cd sistema
docker compose up -d db redis meili api storefront admin
docker compose ps
```

## Parar ambiente

```bash
cd sistema
docker compose down
```

## Endpoints locais

- Loja: http://localhost:3000
- Admin: http://localhost:3002
- API: http://localhost:3001
- Swagger: http://localhost:3001/api

## Guias por servico

- `backend/README.md`
- `frontend/README.md`
- `admin/README.md`

## Documentacao de projeto

- `../arquivos-projeto/md/01 - Projeto/INICIO_AQUI.md`
- `../arquivos-projeto/md/01 - Projeto/STATUS.md`
- `../arquivos-projeto/md/02 - Contexto/REFERENCIA_TECNICA.md`
- `../arquivos-projeto/md/02 - Contexto/CONFIGURACOES.md`
