# TASK: DEDUPLICAÇÃO DE PRODUTOS DO ERP SOLIDCOM & SUPORTE A MÚLTIPLOS EANS (MULTI-EAN)

## 1. Contexto & Diagnóstico da Causa Raiz
- No ERP Solidcom (módulo comercial), um produto com o mesmo cadastro (ex.: `REFRIGERANTE COCA COLA PET`, variação `2650` ORIGINAL) possui múltiplos EANs (`7894900011517`, `7894900027013`, `2650`).
- A API do Solidcom (`/api/Produto/GetProdutos` e `/api/Produto/GetProdutosAlterados`) achata o resultado e devolve **uma linha para cada EAN cadastrado**, com o mesmo `id_produto: 2650` e mesmo estoque.
- Como o nosso modelo `Product` usava o `ean` como chave única (`@unique`), cada linha virou um produto separado no banco, triplicando ou duplicando itens na loja e na busca.

## 2. Requisitos de Implementação

### A. Schema Prisma (`prisma/schema.prisma`):
- No `model Product`:
  - Adicionar `erpProductId Int?` com índice `@@index([tenantId, erpProductId])`.
  - Adicionar `secondaryEans String[] @default([])` para armazenar os outros códigos de barras/EANs alternativos e PLUs vinculados a esse mesmo produto.
- Criar e aplicar migration Prisma no backend.

### B. Mapeamento e Agrupamento no Sync (`solidcom-erp.service.ts` e `products.service.ts`):
1. No `solidcom-erp.service.ts`:
   - Extrair `id_produto` como número/inteiro (`erpProductId`).
2. No `products.service.ts` (`applyErpProducts`):
   - Agrupar os itens vindos da API pelo `erpProductId` (quando presente) ou pelo `ean`.
   - Para cada grupo de mesmo `erpProductId`:
     - Selecionar o **EAN Principal**: preferência para EAN padrão de 13 dígitos (`length === 13`); se não houver, o maior/mais específico.
     - Coletar todos os outros EANs do grupo em `secondaryEans: string[]` (removendo duplicatas e excluindo o EAN principal).
     - Upsert do produto único associando `erpProductId`, `ean` principal e `secondaryEans`.

### C. Script de Deduplicação e Limpeza no Banco da VPS:
- Criar `sistema/backend/scripts/deduplicate-products.ts`:
  - Encontrar produtos existentes que compartilham o mesmo `erpProductId` (ou mesmo nome normalizado + unidade + classificação do ERP).
  - Eleger o registro canônico (priorizar o que possui fotos salvas em `uploads/` ou pedidos vinculados).
  - Unificar os EANs dos registros duplicados no array `secondaryEans` do canônico.
  - Atualizar chaves estrangeiras (`order_items`, `category_curations`, `product_category_mappings`, etc.) apontando para o registro canônico se necessário.
  - Remover com segurança os registros duplicados secundários.

### D. Suporte a Busca e Bipagem no Scanner / Picking:
- Na busca de produtos (`products.service.ts`, Meilisearch, `/products` e picking):
  - Ao buscar por código de barras / EAN, consultar tanto `ean = :q` quanto `secondaryEans @> ARRAY[:q]::text[]`.
  - Garantir que o separador consiga bipar qualquer um dos 3 códigos de barras físicos na loja e o item seja reconhecido com sucesso.

---

## 3. Validação & Deploy
1. `npm test` no backend.
2. `npm run build` limpo em backend, frontend e admin.
3. Executar o script de deduplicação e sync na VPS.
4. Confirmar via curl e no navegador que buscas como `"COCA COLA"` ou `"7894900027013"` retornam **1 único produto consolidado**.
5. Commit estruturado e deploy na VPS.
