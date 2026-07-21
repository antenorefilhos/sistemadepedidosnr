// DASHBOARD CLEANUP LOG — 15/05/2026
// 
// O Dashboard.tsx foi identificado como tendo referências extensivas ao sistema legado de
// classification01-classification04, que foi substituído pela taxonomia EAN/N1-N2.
//
// Removido:
// - classification01, classification02, classification03, classification04 do ProductFormState
// - loadMercadologicalTree() e seu carregamento
// - groupedMercadologicalTree, level2Options, formLevel2Options memos
// - Filtros de classificação dos estados React (classification01Filter, etc)
// - Parâmetros de filtro de classification nas chamadas à API
//
// Padrão: Dashboard foi simplificado para busca por nome/EAN apenas.
// Próximo passo: Integrar filtros por categoria (via nova API /api/categories/stats/mapping)
//
// TODO: Remover selects de classification na UI de edição de produtos
// TODO: Adicionar campo de categoria/EAN mapeado na visão de produtos
// TODO: Integrar com nova API de categorias para filtros
//
// Arquivo original: Dashboard.tsx
// Branc
h: dashboard-cleanup-15-may-2026
