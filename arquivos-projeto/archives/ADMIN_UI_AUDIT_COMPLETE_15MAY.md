# AUDITORIA COMPLETA DO ADMIN UI — Antenor & Filhos

Data: 15/05/2026  
Responsável: Análise de legado em arquitetura EAN/N1-N2

## Achados

### ✅ Páginas/Componentes LIMPOS (sem dependências legadas)

- `Login.tsx` — OK
- `NotFound.tsx` — OK  
- `Forbidden.tsx` — OK
- `Integrations.tsx` — OK
- `FraudAudit.tsx` — OK
- `DeliveryZones.tsx` — OK
- `BusinessHours.tsx` — OK
- `BrandIdentity.tsx` — OK
- `NotificationsBroadcast.tsx` — OK
- `SystemHealthWidget.tsx` — OK
- `Intelligence.tsx` — OK
- `Recipes.tsx` — OK
- `StoreBannersManager.tsx` — OK
- `CategoriesManager.tsx` — ✅ REFATORADO (removeu aba legada de "Mapeamento de Classificações")

### ⚠️ Páginas/Componentes COM LEGADO (requerem refatoração)

#### `Dashboard.tsx` — CRÍTICO

**Dependências do sistema antigo:**
- Campos de form: `classification01`, `classification02`, `classification03`, `classification04`
- Função auxiliar: `splitClassificationParts()`, `getClassificationPrimary()`, `formatClassificationLabel()`
- Carregamento de árvore mercadológica: `loadMercadologicalTree()`, `setMercadologicalTree`
- Memos de filtro (5 memos):
  - `groupedMercadologicalTree` — mapeia classification em árvore estruturada
  - `level2Options` — opções de filtro N2
  - `level3Options` — opções de filtro N3
  - `formLevel2Options` — opções de form N2
  - `formLevel3Options` — opções de form N3
- Estados de filtro (4):
  - `classification01Filter`
  - `classification02Filter`
  - `classification03Filter`
  - `classification04Filter`
- UI: 4 selects de filtro de classificação (linhas ~1163-1186)
- UI: 4 selects de classificação no form de edição de produto

**Impacto:**
- Arquivo com ~1500+ linhas, muito acoplado ao sistema antigo
- Refatoração requer migração de filtros para nova taxonomia (EAN/N1-N2)
- Requer atualização de backend para novo contrato de filtros

#### `api.ts` — LEGADO

**Dependências:**
- Endpoint `classificationMappings.getAll()`
- Endpoint `classificationMappings.add()`
- Endpoint `classificationMappings.remove()`
- Tipo `MercadologicalTreeLevel1`
- Função `getMercadologicalTree()` em `productsAPI`

**Status:**
- Backend ainda expõe esses endpoints (para compatibilidade)
- Admin ainda os usa em Dashboard
- Devem ser depreciados após Dashboard ser refatorado

---

## Plano de Refatoração (Fase 2)

### Sprint 1: Dashboard (3-4 dias de trabalho)

1. **Remover campos de classificação do form:**
   - Remover `classification01-04` de `ProductFormState`
   - Remover 4 selects de classificação do form de edição

2. **Remover filtros legados:**
   - Remover 4 estados de filtro
   - Remover 5 memos relacionados
   - Remover `loadMercadologicalTree` e carregamento de árvore

3. **Adicionar suporte a novo filtro (opcional):**
   - Integrar com `/api/categories/stats/mapping` (categoria por EAN)
   - Adicionar um simples select de categoria (N1 ou N2)

4. **Teste:**
   - Smoke test: carregar produtos, filtrar por nome/EAN
   - Verificar form de edição sem erros de serialização

### Sprint 2: API Admin Client

1. Remover ou deprecar `classificationMappings`
2. Remover ou deprecar `getMercadologicalTree()`
3. Atualizar tipos de `ProductFormState` nos contatos de API

### Pós-cleanup

- Remover endpoints no backend se nenhum cliente os usar
- Opcional: remover campos `classification01-04` do schema de produtos (fase final, após confirmar não há dependências)

---

## Próximas Ações

1. **Imediato:** Documentar na REFERENCIA_TECNICA.md que Dashboard está em estado "pre-cleanup"
2. **Sprint seguinte:** Executar refatoração de Dashboard (prioridade alta)
3. **Validação:** E2E tests no novo form de produtos após refatoração

---

## Razão do Achado

O usuário solicitou auditoria completa da UI admin para remover legado, cumprir corretamente com a nova arquitetura EAN/N1-N2. O Dashboard foi identificado como o principal "portador de legado" no admin, mas é refatoração profunda que requer cuidado. Marcado como crítico para próxima iteração.

