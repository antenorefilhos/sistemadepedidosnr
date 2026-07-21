# M12 - Higienização do Sistema (Code Cleanup & Debugging)
## Checklist Tático e Rastreamento

**Data Criação:** 01 de maio de 2026  
**Criticidade:** MÉDIA (Qualidade de código e estabilidade)  
**Status:** CONCLUÍDO (HISTÓRICO)  
**Responsável:** Execução por agente IA  

> Este checklist permanece para rastreabilidade histórica. O status oficial consolidado está em `STATUS.md` e `ROADMAP.md`.

---

## FASE A: Console.log & Debug Cleanup

### A1 - Backend Console Removal
- [ ] **A1.1** `sistema/backend/src/main.ts`
  - Remove: `console.log` na linha 77-78 (Server running message)
  - Substitui por: Logger NestJS com `this.logger.log()` estruturado
  - Mantém: Apenas startup success message (com estrutura de log)

- [ ] **A1.2** `sistema/backend/reindex-search.js`
  - Remove: Todos os `console.log` (linhas 10, 25, 29, 52)
  - Substitui por: Logger estruturado ou silent mode (script de administração)
  - Mantém: Resumo final com `console.log` (índice criado, documentos indexados)

- [ ] **A1.3** `sistema/backend/scripts/do-sync.js` e `do-sync.ts`
  - Remove: Progress logs internos (linhas 7, 30, 43, 46)
  - Mantém: Status inicial e resumo final
  - Substitui: `console.log('Progresso:', ...)` por silent ou logger

- [ ] **A1.4** `sistema/backend/scripts/import-images.js` e `import-images.ts`
  - Remove: Logs de progresso interno
  - Mantém: Resumo final (linhas 233-240)
  - Status: Manter user-facing messages, remover debug

### A2 - Frontend Console Removal
- [ ] **A2.1** `sistema/frontend/src/pages/Checkout.tsx`
  - Remove linhas: 94, 96, 102, 104, 118
  - Context: CEP validation debug logs (`[CEP]` prefix)
  - Validação: CEP ainda funciona sem logs

- [ ] **A2.2** `sistema/frontend/src/contexts/CartContext.tsx`
  - Remove linha: 56 (`console.log('[CART] Adding item...')`)
  - Validação: Carrinho adiciona items corretamente

- [ ] **A2.3** `sistema/frontend/src/contexts/AuthContext.tsx`
  - Remove linhas: 42 (erro ao ler usuário), 64 (falha login), 85 (falha cadastro)
  - Mantém: Error handling estruturado, sem console
  - Validação: Auth funciona, erros em states/modal

- [ ] **A2.4** `sistema/frontend/src/components/ErrorBoundary.tsx`
  - Remove: `console.error('Erro de renderizacao...')` 
  - Substitui por: Logging estruturado (se houver logger frontend)
  - Mantém: Error boundary funcionando

- [ ] **A2.5** `sistema/frontend/src/utils/analytics.ts`
  - Remove: `console.debug('Analytics failed silently...')`
  - Mantém: Silent failure para analytics (sem impactar UX)

- [ ] **A2.6** `sistema/admin/src/components/ErrorBoundary.tsx`
  - Remove: `console.error('Erro de renderizacao no admin...')`
  - Mantém: Error boundary funcionando

- [ ] **A2.7** `sistema/admin/src/pages/Intelligence.tsx`
  - Remove linhas: 197, 233, 368 (console.error em async handlers)
  - Substitui por: Error states/modal feedback
  - Validação: Erros ainda são mostrados ao user

- [ ] **A2.8** `sistema/admin/src/pages/sections/DashboardSection.tsx`
  - Remove linha: 96 (`console.error('Failed to load analytics...')`)
  - Substitui por: Loading state ou error message visual

### A3 - Validação Completa de Console
- [ ] **A3.1** Busca final por console statements
  - Rodar: `grep -r "console\." sistema/ --include="*.ts" --include="*.tsx" --include="*.js" | grep -v node_modules | grep -v dist`
  - Resultado esperado: Apenas em scripts de administração (reindex-search.js, import-images.js, do-sync.js)

- [ ] **A3.2** Verificar que nenhum console em código de produção
  - ✓ Storefront: zero console em src/
  - ✓ Admin: zero console em src/
  - ✓ Backend: zero console em src/ (permitir logger NestJS)

---

## FASE B: Type Safety & any Removal

### B1 - Replace any Types
- [ ] **B1.1** `sistema/frontend/src/pages/Home.tsx`
  - Linhas: 546 e 585 (`.map((slide: any, index)` e `.map((_: any, index)`)
  - Cause: Slides vêm do CMS, tipo não definido
  - Fix: Definir interface `CMSSlide` em `src/types/cms.ts` (ou usar tipo existente)
  - Replace:
    ```typescript
    // Antes:
    {slides.map((slide: any, index: number) => (
    
    // Depois:
    {slides.map((slide: CMSSlide, index: number) => (
    ```

- [ ] **B1.2** `sistema/backend/src/modules/audit-log/audit-log.service.ts`
  - Campo: `changes?: any;` (linha ~13)
  - Cause: Audit log pode ter diferentes tipos de mudanças
  - Fix: Definir tipo `AuditLogChange = Record<string, unknown>` ou interface específica
  - Replace: `changes?: any;` → `changes?: Record<string, unknown>;`

- [ ] **B1.3** `sistema/backend/src/modules/analytics/analytics.service.ts`
  - Campo: `metadata?: any;` (linha ~99)
  - Cause: Analytics metadata é variável por evento
  - Fix: `metadata?: Record<string, unknown>;` ou `metadata?: unknown;`
  - Replace: `metadata?: any;` → `metadata?: Record<string, unknown>;`

- [ ] **B1.4** `sistema/admin/src/services/api.ts` e `api.d.ts`
  - Função: `getApiErrorMessage(error: any, fallback?: string)`
  - Cause: Precisa aceitar qualquer tipo de erro
  - Fix: Usar `unknown` em vez de `any`
  - Replace:
    ```typescript
    // Antes:
    export function getApiErrorMessage(error: any, fallback = '...'): string {
    
    // Depois:
    export function getApiErrorMessage(error: unknown, fallback = '...'): string {
    ```
  - Atualizar `api.d.ts` também com mesma assinatura

### B2 - Validar Tipagem
- [ ] **B2.1** Build sem erros de tipo
  - Rodar: `cd sistema/backend && npx tsc --noEmit`
  - Resultado: Zero errors
  - Rodar: `cd sistema/frontend && npx tsc --noEmit`
  - Resultado: Zero errors
  - Rodar: `cd sistema/admin && npx tsc --noEmit`
  - Resultado: Zero errors

---

## FASE C: Build Validation & Dependencies

### C1 - Build Sem Warnings
- [ ] **C1.1** Backend build
  - Executar: `cd sistema/backend && npm run build`
  - Validar: Exit code 0
  - Validar: Zero warnings na saída
  - Armazenar: Baseline de bundle size

- [ ] **C1.2** Storefront build
  - Executar: `cd sistema/frontend && npm run build`
  - Validar: Exit code 0
  - Validar: Zero warnings na saída

- [ ] **C1.3** Admin build
  - Executar: `cd sistema/admin && npm run build`
  - Validar: Exit code 0
  - Validar: Zero warnings na saída

### C2 - Audit & Dependencies
- [ ] **C2.1** Auditoria de vulnerabilidades
  - Executar: `cd sistema/backend && npm audit --audit-level=moderate`
  - Resultado: Sem vulnerabilidades críticas/altas
  - Executar: `cd sistema/frontend && npm audit --audit-level=moderate`
  - Resultado: Sem vulnerabilidades críticas/altas
  - Executar: `cd sistema/admin && npm audit --audit-level=moderate`
  - Resultado: Sem vulnerabilidades críticas/altas

- [ ] **C2.2** Remover unused imports (via ESLint auto-fix)
  - Executar: `cd sistema/frontend && npx eslint src --fix` (se houver ESLint)
  - Validar: Nenhum import não utilizado

### C3 - Bundle Size Validation
- [ ] **C3.1** Registrar baseline
  - Storefront: `dist/index.html` size (esperado: ~50-100KB gzip)
  - Admin: `dist/index.html` size (esperado: ~80-150KB gzip)
  - Sem regressão comparado a build anterior

---

## FASE D: Debug Completo & Validação Visual

### D1 - Console Audit (F12)
- [ ] **D1.1** Storefront (http://localhost:3000)
  - Abrir: F12 → Console tab
  - Navegar: Home (scroll completo)
  - Validar: Console vazio (zero logs, warnings, errors)
  - Resultado: Screenshot console vazio

- [ ] **D1.2** Storefront continuação
  - Navegar: Mercado → Produto (AIPIM)
  - Validar: Console continua vazio
  - Navegar: Carrinho → Adicionar item
  - Validar: Console vazio

- [ ] **D1.3** Storefront checkout
  - Navegar: Checkout
  - Inserir: CEP (com máscara, sem console logs)
  - Validar: Console vazio
  - Validar: CEP mask funciona
  - Resultado: Screenshot checkout vazio

- [ ] **D1.4** Admin (http://localhost:3002)
  - Abrir: F12 → Console tab
  - Navegar: Dashboard
  - Validar: Console vazio
  - Navegar: Produtos → Pedidos → Integrações
  - Validar: Console vazio em todas as páginas
  - Resultado: Screenshot admin console vazio

### D2 - Network Audit (DevTools Network Tab)
- [ ] **D2.1** Storefront network
  - Abrir: F12 → Network tab
  - Navegar: Home → Mercado → Produto
  - Validar: Todos os requests têm status 200 ou 304
  - Validar: Zero 4xx/5xx errors
  - Validar: Sem pending/hanging requests
  - Resultado: Screenshot network panel sem erros

- [ ] **D2.2** Checkout network
  - Navegar: Carrinho → Checkout
  - Validar: CEP request 200 (sem error)
  - Validar: Create order request 201 (sem error)
  - Validar: Zero 4xx/5xx
  - Resultado: Screenshot checkout network clean

- [ ] **D2.3** Admin network
  - Navegar: Dashboard, Produtos, Pedidos
  - Validar: Todos os requests 200/304
  - Validar: Zero 4xx/5xx
  - Resultado: Screenshot admin network clean

### D3 - Performance Validation (Core Web Vitals)
- [ ] **D3.1** Storefront performance
  - Tool: Lighthouse (F12 → Lighthouse tab)
  - Rodar: Análise de desktop (http://localhost:3000)
  - Validar: LCP < 2.5s (GOOD)
  - Validar: CLS < 0.1 (GOOD)
  - Validar: INP < 200ms (GOOD)
  - Resultado: Screenshot Lighthouse scores

- [ ] **D3.2** Storefront paginação
  - Navegar: Home (scroll completo), Mercado (múltiplas pages)
  - Validar: Sem layout shifts (CLS)
  - Validar: Sem delays ao clicar (INP)
  - Resultado: Visual validation (video ou screenshot múltiplo)

### D4 - Feature Validation
- [ ] **D4.1** Produto fracionado (AIPIM 0.25)
  - Navegar: Mercado → AIPIM
  - Validar: Exibe "Porção mínima de 250 g" (não 100g fallback)
  - Validar: Preço exibe corretamente por porção
  - Adicionar: 1 porção ao carrinho
  - Validar: Carrinho = 1 × 0.25 × preço = total correto

- [ ] **D4.2** Checkout com fracionado
  - Carrinho: AIPIM × 2 porções
  - Validar: Subtotal = 2 × 0.25 × preço
  - Inserir: CEP (com máscara automática)
  - Validar: Sem console logs de CEP debug
  - Validar: Endereço preenchido corretamente
  - Enviar: Pedido
  - Validar: WhatsApp message com produto + quantidade + total

- [ ] **D4.3** CEP & Mask
  - Campo: CEP
  - Digite: 01310100 (sem máscara)
  - Validar: Automaticamente formata para 01310-100 (máscara)
  - Validar: Sem console logs de CEP validation
  - Validar: Keyboard mobile é numérico (inputMode="numeric")
  - Blur: Campo perde foco
  - Validar: API call de CEP foi feito (Network tab)
  - Validar: Endereço preenchido (street, neighborhood, city, state)

- [ ] **D4.4** WhatsApp Message
  - Criar: Pedido com 2 itens (1 fracionado, 1 normal)
  - Validar: Message exibe:
    - Número do pedido ✓
    - Data/hora ✓
    - Itens (Produto - quantidade - valor unitário - subtotal) ✓
    - Método de pagamento ✓
    - Troco (se selecionado dinheiro) ✓
    - Total ✓
    - Endereço ✓
  - Resultado: Screenshot da message formatada

---

## Encerramento de M12

### E1 - Documentação de Conclusão
- [ ] **E1.1** Atualizar `ROADMAP.md`
  - Marcar todos checkboxes de M12 como ✓
  - Status: "CONCLUÍDO EM 01/05/2026"

- [ ] **E1.2** Atualizar `STATUS.md`
  - Remover alerta de M12 ATIVO
  - Adicionar: "M12 ENCERRADO ✓ - 01/05/2026 - Sistema higienizado e debugado"
  - Atualizar data de referência para 01/05/2026

- [ ] **E1.3** Atualizar `MEMORIA_PROJETO.md`
  - Registrar: "Phase 27 - M12 Higienização do Sistema (01/05/2026)"
  - Documentar: Console cleanup, type safety, build validation, debug completo

- [ ] **E1.4** Atualizar `REFERENCIA_TECNICA.md`
  - Adicionar seção: "Code Quality Standards"
  - Regra: "Nenhum console.log em src/ (apenas logger estruturado)"
  - Regra: "Nenhum `any` type sem justificativa"
  - Regra: "Build deve ser zero warnings"
  - Regra: "F12 Console deve estar limpo ao navegar"

### E2 - Evidências Finais
- [ ] **E2.1** Screenshots de validação
  - ✓ F12 Console vazio (storefront home)
  - ✓ F12 Console vazio (storefront checkout)
  - ✓ F12 Console vazio (admin dashboard)
  - ✓ Network panel zero 4xx/5xx (storefront)
  - ✓ Network panel zero 4xx/5xx (admin)
  - ✓ Lighthouse scores (LCP/CLS/INP)
  - ✓ AIPIM produto com "250 g" (não 100g fallback)

- [ ] **E2.2** Build logs
  - ✓ Backend build exit code 0 (zero warnings)
  - ✓ Storefront build exit code 0 (zero warnings)
  - ✓ Admin build exit code 0 (zero warnings)
  - ✓ npm audit clean (sem críticas)

---

## Regras Finais de M12

✅ **MANDATÓRIO:** Nenhum console.log em src/ (permitir apenas em scripts de admin)  
✅ **MANDATÓRIO:** Nenhum `any` type fora de casos explícitos (Record<string, unknown> preferred)  
✅ **MANDATÓRIO:** Build sem warnings em backend, storefront, admin  
✅ **MANDATÓRIO:** F12 Console limpo ao navegar (zero erros)  
✅ **MANDATÓRIO:** Network panel sem 4xx/5xx errors  
✅ **MANDATÓRIO:** Core Web Vitals LCP < 2.5s, CLS < 0.1, INP < 200ms  
❌ **NUNCA** deixar código morto ou debug statements em production  
❌ **NUNCA** regressar em performance ou bundle size  

---

**Última Atualização:** 01/05/2026  
**Próximo Status Check:** Após fase C  
**ETA Conclusão:** TBD (depende de quantidade de changes)
