# ANÁLISE ESTRATÉGICA - Antenor & Filhos Plataforma de Pedidos

**Data da Análise:** 21 de julho de 2026  
**Versão de Referência:** 1.24.150-alpha  
**Status Geral:** Stack operacional em Docker, M0-M33 validados  

---

## 1. VISÃO EXECUTIVA

O projeto **Antenor & Filhos** é uma plataforma completa de e-commerce B2C + B2B + Admin para um supermercado premium tradicional de família, com ambição de se tornar referência em entrega ágil de produtos frescos.

### Posicionamento
"Supermercado premium de tradição familiar com entrega ágil e curadoria de produtos frescos e selecionados, direto na sua casa."

**Personalidade da marca:** Familiar, acolhedor, local. Foco em tradição, frescor e proximidade.

### Usuários
- Clientes finais buscando compras de supermercado premium para delivery ou retirada na loja
- Famílias e clientes locais que valorizam praticidade + produtos frescos
- Clientes B2B (restaurantes, pequenos comércios) — milestone M19 ativo

---

## 2. ARQUITETURA TÉCNICA

### Stack Resumida
```
Frontend/Storefront:   React 18 + Vite 4 + TailwindCSS + React Query
Admin Dashboard:       React 18 + Vite 4 + ApexCharts
Backend/API:           NestJS 11 + Prisma 5.22.0 + TypeScript
Dados:                 PostgreSQL 15 + Redis 7 + MeiliSearch
Infra/Deploy:          Docker Compose 6 serviços + Nginx Alpine
Busca:                 MeiliSearch (catálogo full-text)
Pagamentos:            Ledger foundation (M09) — gateway desligado por padrão
Integrações:           Solidcom ERP (sincronização de estoque/produtos)
```

### Endereços Locais
- **Storefront (Loja):** http://localhost:3000
- **Admin:** http://localhost:3002
- **API/Swagger:** http://localhost:3001/api
- **MeiliSearch Console:** http://localhost:7700

### Arquitetura em Camadas
```
[Storefront React]                [Admin React]
      ↓                                ↓
         [API NestJS] — /api/v1
         ├─ Auth (JWT)
         ├─ Products (catálogo, preços, pesáveis)
         ├─ Orders (criação, confirmação, cancel)
         ├─ Stock (inventário, reservas, reconciliação)
         ├─ Customers (perfil, endereços, CRM)
         ├─ Delivery (áreas, slots, fulfillment)
         ├─ Recipes (receitas, recomendações)
         ├─ CMS (categorias, banners, vitrines)
         ├─ Webhooks (eventos assinados)
         ├─ Admin (operações, relatórios, BI)
         └─ Integrations (Solidcom, notificações)
         ↓
      [PostgreSQL 15]  [Redis 7]  [MeiliSearch]
```

---

## 3. FUNCIONALIDADES ATIVAS (M0-M33 + M39)

| Milestone | Funcionalidade | Status | Data | Nota |
|-----------|---|---|---|---|
| **P0** | Fundação de segurança (JWT, CORS, rate-limit, RBAC) | ✅ | 26/05 | Tenant + Store model |
| **M01** | Multi-tenant + RBAC (roles, permissões) | ✅ | 26/05 | TenantContext, PermissionGuard |
| **M02** | Catálogo (ProductMaster, categorias, atributos) | ✅ | 26/05 | 2.633 produtos no MeiliSearch |
| **M03** | Estoque (reserva, reconciliação, ledger) | ✅ | 26/05 | `available = onHand - reserved - safety` |
| **M04** | Preços + Promoções | ✅ | 26/05 | productPricing.ts centralizador |
| **M05** | Checkout operacional (carrinho, entrega, pedido) | ✅ | 26/05 | CartContext, sessão idempotente |
| **M06** | OMS — Order Management System | ✅ | 26/05 | Eventos auditáveis, status por item |
| **M07** | Picking/Separação/Conferência/Embalagem | ✅ | 26/05 | Fila por loja, conferência final |
| **M08** | Fulfillment/Logística (áreas, slots, delivery) | ✅ | 26/05 | Retirada + Entrega com capacidade |
| **M09** | Ledger/Pagamentos (transações, refund, chargeback) | ✅ | 26/05 | Foundation — gateway off por padrão |
| **M10** | Integrações resilientes (Solidcom, outbox, retry) | ✅ | 26/05 | DLQ, replay manual, observabilidade |
| **M11** | API pública + Webhooks assinados | ✅ | 26/05 | /v1, API key, scopes, rate-limit |
| **M12** | CRM/Fidelidade (perfis, pontos, cashback, campanhas) | ✅ | 26/05 | Ledger de pontos, segmentos |
| **M13** | BI/Analytics operacional (eventos padronizados, dashboards) | ✅ | 26/05 | MetricSnapshot, drill-down por loja/cat/prod |
| **M14** | Observabilidade/SRE (trace, logs JSON, Prometheus, health) | ✅ | 26/05 | Request/correlation/order trace ID |
| **M15** | Marketplace/Multicanal (canais, mapeamento, margens) | ✅ | 26/05 | Pedidos externos no OMS |
| **M16** | Personalização/Recomendação (recompra, complementares, substitutos) | ✅ | 26/05 | Vitrine por segmento, BI de conversão |
| **M17** | Segurança/LGPD (DSR, consentimentos, retenção, audit) | ✅ | 26/05 | Exportação/anonimização do titular |
| **M18** | UX/UI premium (Home, vitrines, busca, checkout mobile) | ✅ | 26/05 | shadcn/ui, TailwindCSS, responsive |
| **M19** | B2B/Atacarejo (contas comerciais, limite/prazo) | ✅ | 26/05 | Pedido mínimo, recorrente, faturamento |
| **M20** | QA/Release (E2E, staging, smoke, backup) | ✅ | 26/05 | Cypress crítico, release runbook |
| **M33** | Web Push + PWA (notificações, subscriptions) | ✅ | 06/06 | VAPID persistente, envio real validado |
| **M39** | Receitas (5 receitas, 4 categorias, SEO, relacionadas) | ✅ | 05/06 | Capas WebP, copy revisado, staging |

### Funcionalidades Operacionais Validadas
- ✅ Catálogo: 2.633 produtos indexados no MeiliSearch
- ✅ Carrinho: CartContext global com localStorage, suporte a pesáveis com `fractionStep`
- ✅ Checkout: Entrega/retirada, cálculo de frete, pagamento por fora (PIX/Dinheiro/Cartão entrega)
- ✅ Pedidos: Criação, confirmação, cancelamento, corte/substituição
- ✅ Picking: Fila, atribuição, conferência, embalagem com peso final
- ✅ Admin: Filtros rápidos, seleção em lote, edição inline, CMS de categorias, analytics
- ✅ CMS: Taxonomia N1/N2, vitrines controladas por `priority`/`active`/`limit`, hero banners
- ✅ Home: Vitrines de recompra, ofertas, frescos, receitas, churrasco, recorrentes
- ✅ Receitas: 5 receitas, 4 categorias, capas WebP, copy SEO, relacionadas
- ✅ Busca: Full-text com filtros de categoria/preço, mobile responsivo
- ✅ Login/Cadastro: JWT, OAuth-ready, perfil com endereços, histórico de pedidos
- ✅ WhatsApp: Confirmação de pedido com método e troco
- ✅ Substituição: Por item no admin, sugestão automática por complementares
- ✅ Web Push: Notificações com VAPID, subscription real registrada

---

## 4. REGRAS INVIOLÁVEIS DO PROJETO

### 🚨 Preços — SEMPRE usar `productPricing.ts`
```typescript
// ✅ CORRETO
import { getProductPricePresentation, getProductLineTotal } from '../utils/productPricing'
const priceInfo = getProductPricePresentation(product)
const total = getProductLineTotal(product, quantity)

// ❌ PROIBIDO — regressão imediata
const total = product.price * quantity * step
```

### 🚨 Carrinho — USE `CartContext`, NUNCA estado local
```typescript
// ✅ CORRETO
const { cart, addItem } = useCartContext()

// ❌ PROIBIDO
const [cart, setCart] = useState([])
```

### 🚨 Pagamentos — Gateway está DESLIGADO por padrão
- O checkout registra apenas a **intenção** de pagamento (PIX/Dinheiro/Cartão na entrega)
- Pagamento real é fechado pela equipe após separação do pedido
- `ENABLE_PAYMENTS_INTEGRATION=false` e `VITE_PAYMENTS_UI_ENABLED=false`
- **NUNCA** ligar gateway sem aprovação explícita

### 🚨 CEP/Endereço — SEMPRE em INGLÊS
- Backend retorna `street`, `neighborhood`, `city`, `state` (NÃO traduzir)

### 🚨 Docker — DIRETO, sem proxy IDE
- Acessar `http://localhost:3000`, não pelo VS Code preview

### 🚨 Documentação — SEMPRE atualizar no mesmo ciclo
- Toda mudança de regra, fluxo, arquitetura, endpoint, layout → atualizar markdowns canônicos:
  - `STATUS.md` (estado operacional)
  - `MEMORIA_PROJETO.md` (decisões arquiteturais)
  - `REFERENCIA_TECNICA.md` (stack, rotas, schema)
  - `CONFIGURACOES.md` (segredos, URLs, env vars)
  - `ROADMAP.md` (próximas fases)
  - `CMS_MANUAL.md` (operação do CMS)

### 🚨 Milestone M completo — Flush de cache obrigatório
```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker exec antenor_redis redis-cli FLUSHALL
docker compose build api admin storefront
docker compose up -d --force-recreate api admin storefront
docker ps --filter "name=antenor" --format "table {{.Names}}`t{{.Status}}"
```

---

## 5. RISCOS E GARGALOS IDENTIFICADOS

### 🔴 CRÍTICOS

| Risco | Descrição | Impacto | Mitigação |
|-------|-----------|--------|-----------|
| **Gateway de pagamento** | Ligado sem aprovação = aceitação real de cartões sem preparação | Crítico | Flag environment controlado, revisão de PR obrigatória |
| **Pesáveis/fractionStep** | Cálculo wrong sem productPricing.ts = pedidos com preço errado | Alto | Guardrail E2E em Cypress, teste de preço em checkout |
| **Drift documental** | Código avança, documentação fica para trás = confusão | Alto | Obrigação de sincronizar no mesmo ciclo, checklist |
| **Sincronização Solidcom** | ERP desatualizado = estoque incorreto, pedido sem produto | Alto | Retry/backoff automático, outbox pattern, alert |
| **Performance em produção** | MeiliSearch indexação lenta com 2.633+ produtos | Médio | Indexação assíncrona, caching, rate-limit client |

### 🟡 MODERADOS

| Risco | Descrição | Mitigação |
|-------|-----------|-----------|
| **Integrações third-party (WhatsApp, notificações)** | API pode cair, webhooks não chegar | Dead Letter Queue (DLQ), manual replay |
| **Estoque negativo em alta concorrência** | Race condition em reserva simultânea | `available = onHand - reserved - safety`, teste de carga |
| **Scale de web push** | 10k subscriptions = custo FCM + latência | Batch send, rate-limit por dispositivo |
| **LGPD/DSR (M17)** | Exportação de dados de usuário pode expor | Criptografia, PII masking, audit log |
| **Cache Redis expirado** | Sessão de usuário/carrinho cai sem aviso | TTL configurado, fallback a banco, refresh automático |

### 🟢 BAIXOS / OBSERVADOS

| Item | Observação |
|------|-----------|
| **Imagens de produto** | Removidas do fluxo (M0-M33 encerrado sem imagens); quando retomar, redesenhar integrada ao ERP |
| **SEO/indexação** | Home + Receitas com head tags meta; MeiliSearch não é indexável por crawlers — preparar XML sitemap |
| **PWA offline** | Web Push sim, mas offline-first não; app descarta dados se perder conexão |
| **Mobile performance** | Vite build otimizado, mas verificar budget em <3G |

---

## 6. PADRÕES ARQUITETURAIS CRÍTICOS

### 6.1 Preços Centralizados
**Arquivo:** `sistema/frontend/src/utils/productPricing.ts`

Toda apresentação de preço passa por lá. Suporta:
- Produtos normais (por unidade)
- Pesáveis (por kg/g com `fractionStep`: 100g, 500g, 1kg)
- Promoções (desconto % ou R$)
- Cálculo de totais com frações

**Garantia:** Um único ponto de mudança de lógica de preço.

### 6.2 Carrinho Global
**Arquivo:** `sistema/frontend/src/contexts/CartContext.tsx`

- Centralized state (React Context)
- Persisted em localStorage
- Sincronizado entre abas
- Suporta `fractionStep` em pesáveis

**Garantia:** Sem estado local isolado = sem perda de dados.

### 6.3 Checkout Idempotente
**Arquivo:** `sistema/frontend/src/pages/Checkout.tsx` + `sistema/backend/src/modules/orders/orders.service.ts`

- Cliente gera `idempotencyKey` na primeira tentativa
- Backend valida e persiste em `idempotency_keys`
- Retry automático usa mesma chave = mesma resposta
- Quote server-side (não confia no cliente)

**Garantia:** Usuário clica "Confirmar" 3x = 1 pedido (não 3).

### 6.4 Taxonomia N1/N2
**Contrato:** `/cms/categories` (admin) vs `/cms/categories/commercial` (público)

- N1 = raiz (45 categorias: Frutas, Carnes, Bebidas, etc.)
- N2 = sub (72 variações: Frutas → Maçã/Pera/Banana)
- Fallback automático: produto sem mapeamento → N1/N2 sugerida por ML, sem quebrar fluxo

**Garantia:** Navegação consistente, sem "categoria órfã".

### 6.5 Pedido por Item (não por documento único)
**Schema:** `Orders` + `OrderItems` + `OrderItemHistory`

- Cada item rastreável: adicionado/cortado/substituído/conferido
- Peso final, preco real, status granular
- Picking por item (não por pedido monolítico)
- Admin de pedidos exibe timeline de cada item

**Garantia:** Transparência total, auditabilidade.

---

## 7. FLUXOS CRÍTICOS

### 7.1 Criação de Pedido
```
1. Cliente adiciona produto ao carrinho (CartContext)
2. Cliente vai para checkout
3. Frontend envia POST /orders/create (idempotencyKey, items, delivery, payment intent)
4. Backend:
   - Valida idempotencyKey (unique ou retorna pedido anterior)
   - Valida estoque disponível (reserva atômica)
   - Calcula quote server-side (não confia no cliente)
   - Persiste pedido + items + snapshot de preço
   - Retorna orderId
5. Frontend redireciona para confirmação (status: PENDING)
6. Evento auditável salvo (OrderCreatedEvent)
7. Job assíncrono envia confirmação WhatsApp
```

### 7.2 Picking/Separação
```
1. Admin/Picker acessa fila `/admin/picking-queue` filtrada por loja
2. Picker escolhe pedido, marca início
3. Por cada item:
   - Escaneia EAN do produto
   - Sistema valida se está no pedido
   - Entrada de peso real (se pesável)
   - Marca "pronto" ou "falta/substitui"
4. Conferencia de embalagem (outro usuário)
5. Status passa para READY_FOR_DELIVERY
```

### 7.3 Entrega
```
1. Logística/Motorista consulta /deliveries?store=X&status=PENDING
2. Escaneia pedido
3. Registra prova de entrega (localização GPS, foto)
4. Sistema atualiza status DELIVERED
5. Cliente recebe notificação (Web Push ou WhatsApp)
```

### 7.4 Reembolso/Chargeback (M09)
```
1. Cliente disputa pagamento
2. Checkout ledger cria transação reversa
3. Estoque é devolvido (se não entregue)
4. Admin ve operação em `/admin/ledger`
5. Notificação enviada
```

---

## 8. MATRIZ DE DECISÃO — O QUE ESTÁ CONGELADO

| Decisão | Status | Justificativa |
|---------|--------|---------------|
| Preços em productPricing.ts | ✅ Congelado | Múltiplas dependências E2E |
| CartContext global | ✅ Congelado | Estado único de verdade |
| Checkout idempotente | ✅ Congelado | Previne duplicatas |
| Pagamento desligado por padrão | ✅ Congelado | Requer aprovação executiva |
| Taxonomia N1/N2 | ✅ Congelado | 45+72 mapeamentos estruturados |
| Pesáveis com fractionStep | ✅ Congelado | Guardrail E2E existente |
| Admin por permissão (RBAC) | ✅ Congelado | Security-critical |
| Nginx proxy para imagens | ✅ Congelado | Performance em pico |

---

## 9. PRÓXIMAS PRIORIDADES (Backlog)

### Curto Prazo (1-4 semanas)
- [ ] **Go-live em produção** — DNS, SSL, deploy em K8s/VPS
- [ ] **Imagens de produto** — Integração ao ERP/Solidcom, upload em lote
- [ ] **Afiliados/partners** — API para outras lojas usarem catálogo
- [ ] **Agendamento de entregas** — Slot picker interativo (hoje é manual)
- [ ] **Nota fiscal** — Integração para B2B (M19 já pronto estruturalmente)

### Médio Prazo (1-3 meses)
- [ ] **Aplicativo mobile nativo** — React Native ou Flutter
- [ ] **Social shopping** — Instagram/TikTok shoppable posts
- [ ] **Marketplace interno** — Produtores locais venderem via plataforma
- [ ] **Assinatura/Recorrência** — Entrega automática semanal de itens
- [ ] **AI/ML avançado** — Churn prediction, dinâmica de preço

### Longo Prazo (3-6 meses)
- [ ] **Observabilidade avançada** — Grafana dashboard público
- [ ] **Automação de suporte** — Chatbot com NLP
- [ ] **Segunda loja física** — Multi-loja full operacional
- [ ] **Geolocalização dinâmica** — Entrega por microárea

---

## 10. CHECKLIST DE ONBOARDING PARA NOVO DESENVOLVEDOR

**Tempo esperado:** 2-3 horas

- [ ] Clonar repo e ler `INICIO_AQUI.md`
- [ ] Subir Docker Compose: `docker compose up -d`
- [ ] Testar URLs locais (storefront 3000, admin 3002, API 3001)
- [ ] Ler `REFERENCIA_TECNICA.md` (stack, estrutura de pastas)
- [ ] Explorar `productPricing.ts`, `CartContext.tsx`, `Checkout.tsx`
- [ ] Rodar `npm run build` na raiz
- [ ] Rodar E2E crítico: `npx cypress run --spec "cypress/e2e/checkout.cy.ts"`
- [ ] Criar branch `feature/seu-nome` + fazer 1 pequena mudança (ex: text de botão)
- [ ] PR com descrição clara + screenshot/video se UI
- [ ] Revisor aprova → merge

---

## 11. CONCLUSÃO EXECUTIVA

O projeto **Antenor & Filhos** é um sistema de e-commerce robusto, bem-documentado e altamente estruturado. Com **20 milestones + M33/M39 validados**, a plataforma cobre:

✅ Catálogo (2.633 produtos)  
✅ Carrinho e checkout operacional  
✅ OMS com rastreamento por item  
✅ Picking/separação/embalagem  
✅ Delivery com tracking  
✅ Admin multi-função  
✅ CRM + fidelidade  
✅ BI operacional  
✅ Integrações (Solidcom, WhatsApp, Web Push)  
✅ Segurança (RBAC, LGPD, JWT)  
✅ QA (Cypress, E2E crítico)  

### Força Principais
1. **Arquitetura escalável** — tenant/store ready, multi-canal, microserviços internos
2. **Documentação impecável** — INICIO_AQUI.md + STATUS.md + REFERENCIA_TECNICA.md
3. **Guardrails técnicos** — productPricing.ts, CartContext, Cypress E2E
4. **Padrões consistentes** — RBAC, idempotência, auditabilidade
5. **Operações mauras** — alertas, observabilidade, runbooks

### Oportunidades de Melhoria
1. Imagens de produto — integração ao ERP, não manual
2. Performance em alta escala — indexação assíncrona, caching estratégico
3. Mobile nativo — aplicativo dedicado
4. Automação de suporte — chatbot com NLP
5. Recomendação avançada — ML para churn/upsell

---

**Recomendação:** O projeto está pronto para **Go-live em produção**. Todas as fundações técnicas estão em lugar. O próximo passo é infraestrutura (DNS, SSL, K8s) e homologação com a equipe de operações.

---

*Última atualização: 21 de julho de 2026*  
*Versão analisada: 1.24.150-alpha*  
*Análise completa: M0-M39 + P0 + Auditoria top-tier 26/05/2026*
