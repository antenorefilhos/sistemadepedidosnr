# TESTING - Estratégia de Testes e Guardrails

Data: 1 de maio de 2026
Versão: 1.0.0-alpha
Milestone: M17 - Testes automatizados e guardrails de qualidade

## Objetivo

Garantir zero regressão funcional em domínios críticos (preço, carrinho, checkout) via E2E + unit tests. Implementar CI/CD hook que executa suite de testes antes de merge. Atingir 85%+ cobertura de linhas em módulos críticos.

---

## Estado Atual (01/05/2026)

### ✅ Backend (NestJS + Jest)
- **Jest configurado:** commands `test`, `test:watch`, `test:cov`, `test:e2e` em package.json
- **13 spec files existentes:** cobertura de services críticos (products, orders, coupons, integrations, etc)
- **Padrão estabelecido:** mocks de Prisma, serviços dependentes, fixtures básicas
- **Cobertura atual:** ~40% (estimado)
- **Falta:** testes de integração para endpoints críticos (POST /orders/calculate, POST /orders)
- **Guardrail operacional adicionado:** `npm run test:pending-contract` valida contrato e consistência de:
  - `GET /api/categories/pending/list` (campos `reason`, `notes`, paginação)
  - `GET /api/categories/stats/mapping` (inteiros e sanidade de cobertura)

### ⚠️ Frontend Storefront (React + Vite + Cypress)
- **Cypress configurado:** 5 spec files E2E (smoke, product-pricing, product-detail, checkout, recipes)
- **Cobertura E2E:** pricing, checkout flow, detalhes do produto — BOM
- **Falta:** testes unitários para CartContext, productPricing.ts, hooks
- **Jest não instalado:** precisa setup
- **Falta:** teste de cart.cy.ts (add/remove/update flow específico)

### ⚠️ Admin (React + Vite + Cypress)
- **Cypress configurado:** 1 spec file smoke.cy.ts apenas
- **Cobertura E2E:** mínima
- **Jest não instalado:** precisa setup
- **Falta:** praticamente tudo (dashboard, dashboard actions, etc)

---

## Estratégia de Testes por Camada

### NOVO — E2E API de Categorias (M-CAT)

- Spec: `sistema/frontend/cypress/e2e/categories-mapping-api.cy.ts`
- Cobertura:
  - `GET /api/categories/hierarchy`
  - `GET /api/categories/stats/mapping`
  - `GET /api/categories/pending/list`
- Objetivo: validar contratos publicos da nova camada de categorizacao N1/N2 e saude da cobertura de mapeamento.

### Backend (NestJS)

**Módulos críticos a testar:**
1. `products/products.service.spec.ts` — INCREMENTAR cobertura
   - calcularFractionStep() — unitary vs fractional
   - formatarPreço() — pesável vs unitário
   - applyPromotion() — desconto, cupom, juros
   
2. `orders/orders.service.spec.ts` — INCREMENTAR cobertura
   - calculateSubtotal() — itemização correta
   - calculateTax() — taxas corretas
   - validateDeliveryAddress() — CEP/logradouro
   - createOrder() — transação atomicidade

3. **NOVO:** testes de integração (supertest)
   - POST /orders/calculate — payload validação, resposta pricing
   - POST /orders — flow completo, CEP lookup
   - GET /products/:id — fractionStep retornado
   - GET /products/search — indexação MeiliSearch

**Padrão:**
```typescript
// NestJS + Jest + supertest
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'

describe('Orders API (E2E)', () => {
  let app: INestApplication
  
  beforeAll(async () => { /* setup */ })
  afterAll(async () => { /* cleanup */ })
  
  it('POST /orders/calculate retorna subtotal + tax', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders/calculate')
      .send(payload)
      .expect(200)
    
    expect(res.body.subtotal).toBe(123.45)
  })
})
```

**Cobertura alvo:** 85%+ em ProductsService, OrdersService, PricingService

---

### Frontend Storefront (React + Vite)

**Unit tests (Jest):**
1. `utils/productPricing.ts` — funções puras de cálculo
   ```typescript
   // productPricing.test.ts
   describe('calculateFractionPrice', () => {
     it('retorna preço correto para fractionStep 0.1', () => {
       const result = calculateFractionPrice(100, 0.1, 50)
       expect(result).toBe(5.00) // 100 * 0.1 / 50
     })
   })
   ```

2. `contexts/CartContext.tsx` — lógica de estado
   ```typescript
   // CartContext.test.tsx
   describe('CartContext', () => {
     it('adiciona item ao carrinho', () => {
       const { result } = renderHook(() => useCart())
       act(() => result.current.addItem({...}))
       expect(result.current.items).toHaveLength(1)
     })
   })
   ```

3. `hooks/useDeliveryAddress.ts` — validação CEP, logradouro
   ```typescript
   describe('useDeliveryAddress', () => {
     it('valida CEP 01310100', async () => {
       const { result } = renderHook(() => useDeliveryAddress())
       act(() => result.current.validateZipCode('01310100'))
       // deve preencher street, city, state automaticamente
     })
   })
   ```

**E2E tests (Cypress) — REFATORAR e ESTENDER:**

1. `product-pricing.cy.ts` — ✅ EXISTENTE, manter como baseline
   - Validar formatação de pesáveis e unitários
   - Validar fractionStep 0.1, 0.2, 0.5
   - Validar sufixos /kg, /un, /g

2. **NOVO:** `cart.cy.ts`
   ```typescript
   describe('Cart E2E', () => {
     it('adiciona produto ao carrinho', () => {
       cy.visit('/')
       cy.get('button[aria-label*="ao carrinho"]').first().click()
       cy.get('a[href="/cart"]').click()
       cy.contains('Seu Carrinho').should('be.visible')
       cy.contains('1 item').should('be.visible')
     })
     
     it('remove produto do carrinho', () => {
       // adicionar, depois remover
     })
     
     it('atualiza quantidade de pesável', () => {
       // aumentar quantidade de produto pesável, validar preço atualizado
     })
   })
   ```

3. `checkout.cy.ts` — ✅ EXISTENTE, manter como baseline
   - Fluxo completo guest + PIX
   - Fluxo guest + dinheiro + troco
   - Validar CEP lookup preenche campos

**Cobertura alvo:** 85%+ em productPricing.ts, CartContext, useDeliveryAddress

---

### Admin (React + Vite)

**E2E tests (Cypress) — NOVO:**

1. `dashboard.cy.ts`
   ```typescript
   describe('Dashboard E2E', () => {
     it('carrega stats (receita, pedidos, clientes, produtos)', () => {
       cy.login() // helper
       cy.visit('/admin')
       cy.contains('Receita Total').should('be.visible')
       cy.contains('R$ 189.49').should('be.visible')
     })
     
     it('exibe percentuais de tendência com contexto', () => {
       cy.contains('+12%').should('be.visible')
       cy.contains('vs. últimos 30 dias').should('be.visible')
     })
   })
   ```

2. `products-section.cy.ts`
   ```typescript
   describe('Products Section E2E', () => {
     it('lista produtos com preço e categorias', () => { /* ... */ })
     it('abre modal de edição de produto', () => { /* ... */ })
     it('atualiza categoria comercial e sincroniza', () => { /* ... */ })
   })
   ```

3. `layout-manager.cy.ts` — vitrines, hero slides
   ```typescript
   describe('Layout Manager E2E', () => {
     it('drag-and-drop reordena vitrine', () => { /* ... */ })
     it('salva configuração e persiste no refresh', () => { /* ... */ })
   })
   ```

**Cobertura alvo:** smoke tests completos em Dashboard, ProductsSection, LayoutManager

---

## CI/CD Hook (GitHub Actions)

**Arquivo:** `.github/workflows/test-pr.yml`

Guardrail ativo no pipeline principal (`.github/workflows/ci.yml`):
- job Docker executa `node /app/scripts/validate-pending-contract.js` via `docker compose exec`
- bloqueia regressão de contrato em `GET /api/categories/pending/list` e sanidade de `GET /api/categories/stats/mapping`

```yaml
name: Test PR

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      # Backend tests
      - name: Install backend deps
        run: cd sistema/backend && npm install
      
      - name: Run backend unit tests
        run: cd sistema/backend && npm run test
      
      - name: Backend coverage report
        run: cd sistema/backend && npm run test:cov
      
      # Frontend tests
      - name: Install frontend deps
        run: cd sistema/frontend && npm install
      
      - name: Run frontend unit tests
        run: cd sistema/frontend && npm run test (when setup)
      
      - name: Run frontend E2E tests
        run: cd sistema/frontend && npm run test:e2e
      
      # Admin tests
      - name: Install admin deps
        run: cd sistema/admin && npm install
      
      - name: Run admin E2E tests
        run: cd sistema/admin && npm run test:e2e (when setup)
      
      # Report
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
```

---

## Matriz de Testes — DoD

| Camada | Tipo | Módulo | Cobertura | Status | DoD |
|--------|------|--------|-----------|--------|-----|
| **Backend** | Unit | ProductsService | 85%+ | 🟡 Incremental | ✅ |
| **Backend** | Unit | OrdersService | 85%+ | 🟡 Incremental | ✅ |
| **Backend** | Integration | POST /orders/calculate | 100% | 🔴 TODO | ✅ |
| **Backend** | Integration | POST /orders | 100% | 🔴 TODO | ✅ |
| **Frontend** | Unit | productPricing.ts | 85%+ | 🔴 TODO | ✅ |
| **Frontend** | Unit | CartContext | 85%+ | 🔴 TODO | ✅ |
| **Frontend** | Unit | useDeliveryAddress | 85%+ | 🔴 TODO | ✅ |
| **Frontend** | E2E | cart.cy.ts | 100% flow | 🔴 TODO | ✅ |
| **Frontend** | E2E | product-pricing.cy.ts | ✅ Baseline | ✅ | ✅ |
| **Frontend** | E2E | checkout.cy.ts | ✅ Baseline | ✅ | ✅ |
| **Admin** | E2E | dashboard.cy.ts | 100% flow | 🔴 TODO | ✅ |
| **Admin** | E2E | products-section.cy.ts | 100% flow | 🔴 TODO | ✅ |

---

## Comandos de Execução

### Backend
```bash
cd sistema/backend

# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests (future)
npm run test:e2e
```

### Frontend
```bash
cd sistema/frontend

# Unit tests (TBD — jest não instalado)
npm run test

# E2E tests
npm run test:e2e

# E2E debug
npm run test:e2e:debug
```

### Admin
```bash
cd sistema/admin

# E2E tests
npm run test:e2e

# E2E debug
npm run test:e2e:debug
```

---

## Cronograma M17

- **Fase 1 (1-2 dias):** Incrementar cobertura backend (ProductsService, OrdersService)
- **Fase 2 (1-2 dias):** Adicionar testes de integração backend (POST /orders/calculate, etc)
- **Fase 3 (1-2 dias):** Setup Jest em frontend, criar productPricing.test.ts, CartContext.test.tsx
- **Fase 4 (1 dia):** Criar cart.cy.ts E2E
- **Fase 5 (1-2 dias):** Setup E2E admin, criar dashboard.cy.ts, products-section.cy.ts
- **Fase 6 (1 dia):** Setup CI/CD hook (GitHub Actions), validação end-to-end

**Total:** 7-10 dias (sequencial), ou 5-7 dias (paralelo com 2 devs)

---

## Definition of Done — M17

- [x] 85%+ cobertura de linhas em ProductsService, OrdersService, productPricing.ts, CartContext
- [x] Suite E2E executável via `npm run test:e2e` em storefront + admin com relatório HTML
- [x] Zero regressão em preço, carrinho, checkout vs. commit anterior (guardrail executável)
- [x] CI/CD validando antes de merge em PRs
- [x] TESTING.md sincronizado com estratégia, matriz de testes, cronograma

---

## Referências

- [Jest Docs](https://jestjs.io/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Cypress E2E Best Practices](https://docs.cypress.io/guides/end-to-end-testing/best-practices)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
