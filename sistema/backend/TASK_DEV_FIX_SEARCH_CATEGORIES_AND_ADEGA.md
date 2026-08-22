# TASK: CORREÇÃO DAS CATEGORIAS NO /mercado, REDIRECIONAMENTO DA ADEGA E FOTOS DE PRODUTOS

## 1. Problemas Identificados (conforme Screenshot)
1. **Barra de Pílulas no `/mercado` Lotada com 70 Categorias Legadas**:
   - `Search.tsx` está consumindo `useCategoriesCMS()` que traz 70 classificações legadas do ERP com `priority=0` em vez das **17 categorias comerciais oficiais**.
   - As pílulas exibem nomes fragmentados ("Bazar", "Bebe", "Bebes", "Bebidas", "Carnes Dia a Dia", etc.), e ao clicar nelas não retornam produtos.
2. **Causa Raiz no Backend**:
   - O método `syncTaxonomyFromProducts()` no `products.service.ts` re-insere automaticamente as 70 classificações brutas do ERP no `categories_cms`. Ele não deve re-inserir categorias legadas — apenas as 17 categorias comerciais oficiais devem ser mantidas e expostas.
3. **Redirecionamento da Adega**:
   - Ao clicar na pílula/categoria "Adega", deve redirecionar diretamente para a página exclusiva da adega (`/adega`) via `getCategoryHref()`, onde a carta de vinhos e espumantes é exibida com a experiência completa.
4. **Fotos de Produtos**:
   - Verificar os caminhos de imagens em `StoreProductCard.tsx` / backend `/uploads/products/` para garantir que produtos com fotos cadastradas (ex.: Heineken, Imperio, etc.) renderizem suas imagens sem cair no placeholder "PRODUTO SEM FOTO".

## 2. Implementação Necessária

### A. Frontend (`Search.tsx`):
- Atualizar a barra de pílulas de categorias para consumir **exclusivamente as 17 categorias comerciais oficiais** (via `useCommercialTaxonomy()` ou `useCategories()` / `HOME_CATEGORIES`).
- Utilizar `getCategoryHref()` para que o clique em "Adega" direcione para `/adega`.
- Quando uma categoria comercial for selecionada (ex.: `cervejas-chopp`), filtrar os produtos corretamente pelo código da taxonomia comercial (`category = 'CERVEJAS_E_CHOPP'` ou mapeamento correspondente).

### B. Backend (`products.service.ts` e `seed-cms-categories.ts`):
- Ajustar `syncTaxonomyFromProducts()` para **não sobrescrever** as 17 categorias comerciais oficiais com as 70 classificações legadas do ERP.
- Re-executar a limpeza das categorias zumbis na VPS (`count(*) FROM categories_cms` = 17).

### C. Validação das Fotos:
- Checar se as fotos de produtos em `/app/uploads/products` estão sendo servidas corretamente e com permissões intactas.

---

## 3. Validação & Deploy
1. `npm test` no backend.
2. `npm run build` limpo em frontend e admin.
3. Deploy na VPS (`docker compose up -d --build storefront api`).
4. Validar no navegador que a barra de `/mercado` possui apenas as 17 pílulas limpas, que "Adega" leva para `/adega`, e que os produtos filtram corretamente com suas fotos.
