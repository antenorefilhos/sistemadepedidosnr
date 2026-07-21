# Project Summary - Snapshot 1.4.7-alpha

Data: 19 de abril de 2026
Status: operacao local estavel com Docker

## Resumo executivo

- Monorepo com backend, storefront e admin em `sistema/`.
- Stack operacional com PostgreSQL 15, Redis 7 e MeiliSearch.
- Integracao Solidcom ativa como ERP de segundo plano.
- Busca no storefront com sugestoes e filtros visuais.
- Fluxo de imagens consolidado em `/uploads/products/{ean}.webp` com importacao em lote.

## Escopo funcional ativo

- autenticacao admin e cliente
- catalogo, carrinho, checkout e pedido
- painel admin com dashboard, produtos, pedidos, clientes, layout e integracoes
- analytics administrativos e de busca
- orquestracao de pedidos com trilha de falhas e retry de integracao

## Regras de catalogo (ERP)

- NUNCA: nao exibe
- SEMPRE: exibe sempre
- ESTOQUE: exibe com estoque maior que zero

## Operacao recomendada

- executar Docker Compose sempre a partir de `sistema/`
- usar `curl.exe` no PowerShell para testes HTTP
- manter `arquivos-projeto/md` como fonte canonica e `archives` como snapshot historico
