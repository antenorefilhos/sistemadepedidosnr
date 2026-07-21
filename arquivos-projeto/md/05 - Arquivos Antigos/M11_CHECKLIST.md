# M11 - Correção Crítica de Persistência de Fracionamento
## Checklist Tático e Rastreamento

**Data Criação:** 01 de maio de 2026  
**Criticidade:** CRÍTICA (BLOCKER)  
**Status:** CONCLUÍDO (HISTÓRICO)  
**Responsável:** Execução por agente IA  

> Este checklist permanece para rastreabilidade histórica. O status oficial consolidado está em `STATUS.md` e `ROADMAP.md`.

---

## FASE A: Root Cause Investigation & Fix

### A1 - Diagnóstico do Upsert Prisma
- [ ] **A1.1** Ler completo `sistema/backend/src/modules/products/products.service.ts`
  - [ ] Localizar método de upsert exato (provavelmente `upsert` ou `createOrUpdate`)
  - [ ] Verificar se `fractionStep` está incluído na cláusula UPDATE
  - [ ] Rastrear se o objeto `normalized` (vindo do parser) é passado integralmente ou parcialmente

- [ ] **A1.2** Ler `sistema/backend/prisma/schema.prisma`
  - [ ] Localizar modelo Product
  - [ ] Verificar tipo do campo `fractionStep` (deve ser `Float? | Float`)
  - [ ] Validar se há constraints/validations bloqueando write
  - [ ] Verificar se há índices ou unique constraints afetando update

- [ ] **A1.3** Executar audit SQL no banco de dados
  - [ ] Rodar: `SELECT id, name, fractionStep, isFractional FROM products WHERE isFractional=true LIMIT 10;`
  - [ ] Rodar: `SELECT COUNT(*) FROM products WHERE isFractional=true AND fractionStep IS NULL;` (deve retornar ~1471)
  - [ ] Rodar: `SELECT COUNT(*) FROM products WHERE isFractional=true AND fractionStep IS NOT NULL;` (deve retornar 0 atualmente)

- [ ] **A1.4** Identificar raiz do bloqueio
  - [ ] É o campo não estar mapeado no modelo Prisma? (verificar schema)
  - [ ] É o upsert excluindo o campo intentionalmente? (buscar filtro `select` ou `omit`)
  - [ ] É constraint de validação rejeitando o valor? (verificar `@db.Float` ou `@validator`)
  - [ ] É transaction being rolled back? (verificar logs do backend)

### A2 - Corrigir Upsert Prisma
- [ ] **A2.1** Editar `products.service.ts` para incluir `fractionStep` obrigatoriamente no update
  - Exemplo esperado:
  ```typescript
  const upserted = await this.prisma.product.upsert({
    where: { eanCode: normalized.eanCode },
    update: {
      // ... outros campos
      fractionStep: normalized.fractionStep || null,  // incluir obrigatoriamente
      isFractional: normalized.isFractional,
    },
    create: {
      // ... todos os campos
      fractionStep: normalized.fractionStep || null,
      isFractional: normalized.isFractional,
    }
  })
  ```

- [ ] **A2.2** Validar que parser `solidcom-erp.service.ts` enriquecimento está correto
  - Linha 123: `const fractionStep = this.readNumber(row, ['fracionamento'], NaN)` ✓
  - Linha 147: `if (!Number.isNaN(fractionStep) && fractionStep > 0) normalized.fractionStep = fractionStep` ✓
  - Verificar que `normalized` é retornado integralmente

- [ ] **A2.3** Build backend sem erro
  - `cd sistema/backend && npm run build`
  - Exit code deve ser 0

### A3 - Aplicar Correção ao Banco
- [ ] **A3.1** Re-sincronizar 1.471 fracionados com upsert corrigido
  - Opção 1: Rodar full sync ERP (se disponível em dev)
  - Opção 2: Executar script SQL que reseta fractionStep para NULL e depois roda parser novamente
  - [ ] Validar pós-sync: `SELECT COUNT(*) FROM products WHERE isFractional=true AND fractionStep IS NOT NULL;` deve retornar 1471 (não 0)

- [ ] **A3.2** Audit pós-fix
  - [ ] Rodar: `SELECT id, name, fractionStep FROM products WHERE isFractional=true AND fractionStep IS NOT NULL LIMIT 5;`
  - [ ] Verificar visualmente que valores são > 0 (ex: 0.25 para AIPIM)
  - [ ] Rodar: `SELECT COUNT(*) FROM products WHERE isFractional=true AND fractionStep IS NULL;` deve retornar 0 (ZERO)

---

## FASE B: Guardrails Arquiteturais Imutáveis

### B1 - Testes Unitários & Specs
- [ ] **B1.1** Criar `sistema/backend/src/modules/integrations/solidcom-erp.service.spec.ts`
  - Teste: "should read fracionamento from ERP row and set fractionStep in normalized object"
  - Teste: "should not set fractionStep if fracionamento is 0 or NaN"
  - Teste: "should persist fractionStep to database when upsert is called"

- [ ] **B1.2** Criar `sistema/backend/src/modules/products/products.service.spec.ts`
  - Teste: "should upsert product with fractionStep when isFractional=true"
  - Teste: "should include fractionStep in update clause"
  - Teste: "should not allow isFractional=true without valid fractionStep" (validação)

### B2 - Testes E2E & Guardrails
- [ ] **B2.1** Editar `sistema/frontend/cypress/e2e/product-pricing.cy.ts`
  - Adicionar teste: "AIPIM should display minimum portion of 250g (0.25, not 100g fallback)"
  - Teste: Navegar para AIPIM produto → validar texto exibe "250 g" ou "1/4 kg"
  - Teste: Adicionar ao carrinho → validar cálculo está correto (amount × 0.25 × price)
  - Teste: Checkout → validar total reflete fractionStep correto

- [ ] **B2.2** Editar `sistema/frontend/cypress/e2e/checkout.cy.ts`
  - Adicionar caso: "checkout with fractional product (AIPIM 0.25)"
  - Validar porção mínima, preço por porção, total do carrinho

### B3 - Constraints no Schema Prisma
- [ ] **B3.1** Criar migration Prisma para constraint CHECK
  - Arquivo: `sistema/backend/prisma/migrations/XXXXXXX_add_fractionstep_constraint.sql`
  - SQL esperado:
  ```sql
  ALTER TABLE "Product" 
  ADD CONSTRAINT check_fractionstep_if_fractional 
  CHECK (
    ("isFractional" = false) OR 
    ("fractionStep" IS NOT NULL AND "fractionStep" > 0)
  );
  ```

- [ ] **B3.2** Aplicar migration
  - `npx prisma migrate deploy`
  - Validar que constraint foi criado sem erro

### B4 - Documentação Arquitetural
- [ ] **B4.1** Atualizar `arquivos-projeto/md/REFERENCIA_TECNICA.md`
  - Adicionar seção "Pesáveis e Persistência de Fracionamento"
  - Regra imutável: "fractionStep MUST be persisted for all isFractional=true products"
  - Rastrear: Como dados fluem de ERP → Parser → Upsert → Bank
  - Documentar: Constraint CHECK no schema

- [ ] **B4.2** Atualizar `arquivos-projeto/md/MEMORIA_PROJETO.md`
  - Adicionar: "M11 - Pesáveis - Contrato de Persistência (Resolvido em 01/05/2026)"
  - Documentar: Root cause (Upsert não salvava fractionStep)
  - Documentar: Guardrails implementados (specs + E2E + constraint)
  - Documentar: "Nunca mais regressão sem quebrar constraint CHECK"

---

## FASE C: Build & Validação 100%

### C1 - Build Geral
- [ ] **C1.1** Build backend
  - `cd sistema/backend && npm run build`
  - Exit code: 0

- [ ] **C1.2** Build frontend
  - `cd sistema/frontend && npm run build`
  - Exit code: 0

### C2 - Testes Locais
- [ ] **C2.1** Rodar testes unitários (backend)
  - `cd sistema/backend && npm run test:all` (ou `npm test`)
  - Garantir que `solidcom-erp.service.spec.ts` e `products.service.spec.ts` passam 100%

- [ ] **C2.2** Rodar E2E (storefront)
  - `cd sistema/frontend && npm run test:e2e` ou `npx cypress run`
  - Garantir `product-pricing.cy.ts` passa 100% (incluindo novo teste de AIPIM 250g)
  - Garantir `checkout.cy.ts` passa 100% (incluindo novo caso fracionado)

### C3 - Auditoria Final do Banco
- [ ] **C3.1** Validação de dados persistidos
  - Rodar: `SELECT COUNT(*) FROM products WHERE isFractional=true AND fractionStep IS NULL;`
  - Resultado esperado: **0 (ZERO)**
  - Se houver NULL: investigar que produtos não foram sincronizados
  - Rodar: `SELECT COUNT(*) FROM products WHERE isFractional=true AND fractionStep IS NOT NULL;`
  - Resultado esperado: **~1471** (quantidade de fracionados)

---

## FASE D: Cards Sizing & Validação Visual

### D1 - Investigar Card Heights
- [ ] **D1.1** Identificar por que cards estão em tamanhos diferentes
  - Causa A: CSS (min-height insuficiente, flexbox inconsistente)
  - Causa B: Dados (descrição variada, badges diferentes, imagens)
  - Inspecionar: `sistema/frontend/src/components/ProductCard.tsx` (CSS classes)
  - Inspecionar: Renderização na Home e Mercado

- [ ] **D1.2** Padronizar altura
  - Opção A: Definir `h-[480px]` ou similar fixo em card
  - Opção B: Usar `h-full` com container pai com altura definida
  - Opção C: `min-h-[400px]` com overflow gerenciado

### D2 - Validação Visual no Storefront
- [ ] **D2.1** Rodar app local e validar visualmente
  - Abrir `http://localhost:3000`
  - Navegar para Home e Mercado
  - Verificar que cards estão alinhados horizontalmente (sem quebra de layout)
  - Verificar que AIPIM (produto fracionado real) exibe "250 g" em porção mínima (NÃO "100 g" fallback)

- [ ] **D2.2** Validação de fracionado específico
  - Buscar AIPIM no Mercado
  - Clicar em detalhe de produto
  - Validar: "Porção mínima: 250 g" (ou "1/4 kg")
  - Adicionar ao carrinho
  - Validar: Total do carrinho = quantidade × 0.25 × preço

---

## Encerramento de M11

### E1 - Documentação de Conclusão
- [ ] **E1.1** Atualizar `ROADMAP.md`
  - Marcar todos checkboxes de M11 como ✓
  - Atualizar status para "CONCLUÍDO EM 01/05/2026"

- [ ] **E1.2** Atualizar `STATUS.md`
  - Remover alerta de M11 ATIVO
  - Adicionar: "M11 ENCERRADO ✓ - 01/05/2026 - Fractionstep persistence fixed"

- [ ] **E1.3** Atualizar `MEMORIA_PROJETO.md`
  - Registrar: "Phase 26 - M11 Correção de Persistência de Fracionamento (01/05/2026)"
  - Documentar: Root cause + Fix + Guardrails

### E2 - Validação Final
- [ ] **E2.1** Regressão visual no storefront
  - Nenhum card quebrado
  - Nenhum produto fracionado exibindo 100g (fallback)
  - Checkout funcionando normalmente

- [ ] **E2.2** Build final sem erros
  - Backend: exit code 0
  - Frontend: exit code 0
  - Testes: 100% passing

---

## Regras Finais de M11

✅ **IMUTÁVEL:** `fractionStep > 0` obrigatório para `isFractional=true` (constraint CHECK)  
✅ **IMUTÁVEL:** Testes E2E garantem AIPIM 250g, não 100g fallback  
✅ **IMUTÁVEL:** Nenhum fallback 100g sem dado real persistido  
✅ **IMUTÁVEL:** Documentação canônica atualizada  
❌ **NUNCA** iniciar M12 sem M11 concluído  
❌ **NUNCA** permitir regressão sem quebrar constraint no banco  

---

**Última Atualização:** 01/05/2026  
**Próximo Status Check:** Após fase C  
**ETA Conclusão:** TBD (depende de investigação do root cause)
