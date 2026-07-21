# Antenor & Filhos - Plataforma de Pedidos

Data: 23 de abril de 2026
Versao de referencia: 1.6.0-alpha
Status: operacional em ambiente local Docker

## Visao geral

Monorepo com tres aplicacoes em `sistema/`:

- Backend: NestJS 10 + Prisma 5 + PostgreSQL 15 + Redis 7 + MeiliSearch + integracao Solidcom
- Storefront: React 18 + Vite 4 + React Query
- Admin: React 18 + Vite 4 + ApexCharts

## Execucao rapida (recomendada)

```bash
cd sistema
docker compose up -d db redis meili api storefront admin
docker compose ps
```

## Enderecos locais

- Loja: http://localhost:3000
- Admin: http://localhost:3002
- API: http://localhost:3001
- Swagger: http://localhost:3001/api
- Meili: http://localhost:7700

## Regras de negocio em producao

- Visibilidade de produto por ERP:
	- `NUNCA`: nao exibir no storefront
	- `SEMPRE`: exibir independente do estoque
	- `ESTOQUE`: exibir apenas com estoque maior que zero
- Busca orientada ao cliente com filtros visuais (categoria e faixa de preco)
- Checkout convidado com controle por flags (`ALLOW_GUEST_CHECKOUT` e `VITE_GUEST_CHECKOUT_ENABLED`)
- Home e Carrinho acessiveis sem login obrigatorio
- Imagens servidas no storefront via `/uploads/products/{ean}.webp` (proxy Nginx para API)
- Vitrines da Home controladas pelo CMS de categorias (`/cms/categories`) com:
	- `active` para exibir/ocultar secao
	- `priority` para ordenar secoes (menor valor aparece primeiro)
	- `limit` para definir quantidade maxima de cards por secao

## Documentacao canonica

- `arquivos-projeto/md/01 - Projeto/INICIO_AQUI.md`
- `arquivos-projeto/md/01 - Projeto/STATUS.md`
- `arquivos-projeto/md/02 - Contexto/CONFIGURACOES.md`
- `arquivos-projeto/md/02 - Contexto/REFERENCIA_TECNICA.md`
- `arquivos-projeto/md/01 - Projeto/MEMORIA_PROJETO.md`
- `arquivos-projeto/md/01 - Projeto/ROADMAP.md`
- `arquivos-projeto/md/01 - Projeto/CMS_MANUAL.md`
- `arquivos-projeto/md/01 - Projeto/SOLIDCOM_API_DORSAL.md`

## Estrutura

- `sistema/`: codigo executavel
- `arquivos-projeto/md/`: documentacao canonica organizada em Wiki Obsidian
- `arquivos-projeto/archives/`: snapshots historicos

## Nota operacional

- o banco PostgreSQL no compose local esta publicado em `localhost:5432` para permitir comandos Prisma fora de container