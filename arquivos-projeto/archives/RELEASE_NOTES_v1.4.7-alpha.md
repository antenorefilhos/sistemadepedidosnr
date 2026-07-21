# Release Notes v1.4.7-alpha

Data: 19 de abril de 2026

## Destaques

- Consolidacao da stack local com Docker Compose usando 6 servicos: api, storefront, admin, db, redis e meili.
- Busca no storefront com sugestoes e filtros visuais de categoria e preco.
- Regras ERP de visibilidade de catalogo aplicadas no backend e busca:
  - NUNCA
  - SEMPRE
  - ESTOQUE
- Pipeline de imagens estabilizado com servico em `/uploads/products/{ean}.webp`.
- Importacao em lote de fotos com `backend/scripts/import-images.js` (match por EAN e por similaridade de nome).

## Melhorias tecnicas

- Ajuste de servico estatico para `uploads` no backend em ambiente containerizado.
- Atualizacao da documentacao canonica em `arquivos-projeto/md`.
- Atualizacao dos snapshots em `arquivos-projeto/archives`.

## Observacoes operacionais

- Execute comandos de Docker Compose a partir de `sistema/`.
- Em PowerShell, use `curl.exe` para evitar conflito com alias `curl`.

## Compatibilidade

- Backend: NestJS 10 + Prisma 5.22.0
- Frontend/Admin: React 18 + Vite 4
- Banco: PostgreSQL 15
- Cache: Redis 7
- Busca: MeiliSearch 1.x
