# INICIO_AQUI.md — Entry Point para Qualquer IA

> Leia este arquivo inteiro ANTES de qualquer outra ação.  
> Ele tem tudo que você precisa para não perder tempo e não regredir o projeto.

---

## ✅ ALERTA RESOLVIDO: M11 ENCERRADO — 01/05/2026

**Resultado final validado:**
- fracionados ativos com `fractionStep` persistido corretamente
- falha estrutural de persistência encerrada
- guardrails e validações aplicados no ciclo M11-M17

**Leia:** [ROADMAP.md](ROADMAP.md) e [STATUS.md](STATUS.md) para estado consolidado mais recente

---

## O que é este projeto?

E-commerce de supermercado premium para entrega. Três apps: **storefront** (cliente), **admin** (gestão) e **backend** (API). Tudo em Docker Compose local.

**Stack:**
- Backend: NestJS 11 + Prisma 5.22.0 + PostgreSQL 15 + Redis 7
- Storefront/Admin: React 18 + Vite 7 + TailwindCSS + React Query
- Busca: MeiliSearch
- Infra: Docker Compose (6 serviços), Nginx Alpine para cada app Vite

**URLs locais:** storefront `http://localhost:3000` (`https://localhost:3443`) · admin `http://localhost:3002` (`https://localhost:3444`) · api `http://localhost:3001`

---

## Regras Invioláveis (memorize antes de tocar qualquer código)

### 1. Preços — USE productPricing.ts, NUNCA inline
```typescript
// ✅ CORRETO — sempre assim
import { getProductPricePresentation, getProductLineTotal } from '../utils/productPricing'
const priceInfo = getProductPricePresentation(product)  // { value, suffix, fullLabel, ... }
const total = getProductLineTotal(product, quantity)     // considera fractionStep automaticamente

// ❌ PROIBIDO — causa regressão imediata
const total = product.price * quantity * step   // cálculo inline fora de productPricing.ts
```

### 2. Carrinho — USE CartContext, NUNCA estado local
```typescript
// ✅ CORRETO
const { cart, addItem } = useCartContext()  // do Context global

// ❌ PROIBIDO
const [cart, setCart] = useState([])  // estado local não sincroniza entre páginas
```

### 3. Pagamento — É POR FORA, sem gateway ativo
- O checkout registra apenas a **intenção** de pagamento (PIX / Dinheiro / Cartão na entrega)
- O pagamento real é fechado pela equipe após a separação do pedido
- O valor pode mudar por peso real, corte ou substituição de item
- `ENABLE_PAYMENTS_INTEGRATION=false` e `VITE_PAYMENTS_UI_ENABLED=false` são o padrão correto
- A fundacao M09 existe para gateway futuro: ledger, webhook assinado, refund, chargeback e conciliacao. Nao ligar sem aprovacao.
- **NÃO ativar gateway sem aprovação explícita do usuário**

### 4. CEP / Endereço — campos em INGLÊS
- Backend retorna `street`, `neighborhood`, `city`, `state` (não traduzir para português)

### 5. Docker — NUNCA usar proxy da IDE
- Acessar direto `http://localhost:3000`, não pelo browser preview do VS Code/Cursor

### 6. Documentação — SEMPRE atualizar markdowns no mesmo ciclo
- Toda mudança de regra, fluxo, arquitetura, endpoint, layout, configuração ou comportamento deve atualizar os markdowns canônicos no mesmo ciclo da implementação.
- É proibido concluir alteração técnica sem refletir a mudança na documentação ativa (`STATUS.md`, `MEMORIA_PROJETO.md`, `REFERENCIA_TECNICA.md`, `CONFIGURACOES.md`, `ROADMAP.md`, `CMS_MANUAL.md`, `SOLIDCOM_API_DORSAL.md`, quando aplicável).
- Evitar drift documental: código e documentação devem permanecer sincronizados.

### 7. Encerramento de milestone M completo — flush de cache obrigatório
- Toda vez que um milestone oficial `M` for concluído, executar obrigatoriamente limpeza de cache e recreate da stack principal.
- Procedimento padrão obrigatório:
```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker exec antenor_redis redis-cli FLUSHALL
docker compose build api admin storefront
docker compose up -d --force-recreate api admin storefront
docker ps --filter "name=antenor" --format "table {{.Names}}`t{{.Status}}"
```
- Só marcar milestone como encerrado após esse ciclo e validação dos containers em `Up`.

---

## Estado atual do projeto (01/06/2026 - v1.24.26-alpha)

| Módulo | Status | Notas |
|--------|--------|-------|
| Catálogo | ✅ | 2.633 produtos, MeiliSearch indexado |
| Carrinho | ✅ | CartContext global, localStorage, fractionStep |
| Checkout | ✅ | Carrinho persistido, sessao idempotente, quote server-side, pagamento por fora |
| OMS/Pedidos | ✅ | Eventos auditaveis, status por item, corte/substituicao/recalculo e admin via `/admin/orders` |
| Separacao/Picking | ✅ | Fila por loja, atribuicao manual, operacao por item no admin, peso final, falta/substituicao, conferencia e embalagem |
| Fulfillment/Logistica | ✅ | Areas server-side, slots entrega/retirada com capacidade/cutoff, reserva no checkout, rotas e tracking basico |
| Pagamentos/Ledger | ✅ | Fundacao M09 com transacoes, eventos idempotentes, refund, chargeback e conciliacao; gateway desligado por padrao |
| Integracoes resilientes | ✅ | Fundacao M10 com conectores, outbox Postgres, jobs, tentativas, retry/backoff, DLQ, replay manual e painel operacional API |
| API publica/Webhooks | ✅ | M11 aplicado com `/v1`, API key/scopes/rate limit/logs, webhooks assinados com retry/DLQ, migration, validador SQL e runtime publicados |
| CRM/Fidelidade | ✅ | M12 aplicado com perfis, consentimentos, segmentos, ledger de pontos/cashback, campanhas com opt-in e listas de recompra |
| BI/Analytics operacional | ✅ | M13 aplicado com eventos padronizados, `MetricSnapshot`, dashboards executivo/funil/ruptura/picking/integracoes/CRM/pagamentos e drill-down por loja/categoria/produto/canal |
| Observabilidade/SRE | ✅ | M14 aplicado com request/correlation/order trace ID, logs JSON, metricas p95/erros, Prometheus, health detalhado, alertas, status page e runbooks |
| Marketplace/Multicanal | ✅ | M15 aplicado com canais de venda, mapeamento de produtos externos, pedidos externos no OMS, politicas de preco/estoque e painel de dependencia/margem |
| Personalizacao/Recomendacao | ✅ | M16 aplicado com `RecommendationEvent`, recompre, complementares por cesta, substitutos inteligentes, vitrine por segmento, BI de conversao e inteligencia operacional |
| Seguranca/LGPD | ✅ | M17 aplicado com `DataSubjectRequest`, consentimentos formais, exportacao/anonimizacao do titular, politica de retencao e audit log sensivel |
| UX/UI premium | ✅ | M18 concluido: H1/SEO, vitrines de recompra/ofertas/frescos/feira/churrasco/recorrentes, substitutos inteligentes, substituicao por item, busca/carrinho/checkout mobile, painel admin por funcao/SLA e picker mobile |
| B2B/atacarejo | ✅ | M19 concluido: contas comerciais, usuarios, preco por empresa, limite/prazo, aprovacao, financeiro, tela `Contas B2B`, lista corporativa, pedido minimo, pedido recorrente e faturamento/nota operacional |
| QA/release | ✅ | M20 encerrado: pipeline base, E2E critico, release runbook, staging homologado, smoke, backup e restore-test fechados; backend/frontend/admin com audit moderado zerado |
| WhatsApp | ✅ | Mensagem formatada com método e troco |
| Admin | ✅ | Filtros rápidos, seleção em lote, edição inline, CMS categorias, analytics |
| Preços | ✅ | Centralizados em productPricing.ts, guardrail E2E |
| Taxonomia comercial | ✅ | Home e Mercado usam contrato único `/cms/categories/commercial` |
| Coleções CMS | ✅ | contrato evoluído com `subtitle` e `link` (compatível com legado) |
| Curadoria híbrida | ✅ | categorias aceitam `curatedProductIds` com fallback automático |
| Mais vendidos | ✅ | Home conectada ao endpoint público `/analytics/top-products` |
| Destaque horizontal | ✅ | banners suportam produto exaltado + nota (`highlightedProductId`) |
| M2 CMS 2.0 | ✅ | milestone concluído com CRUD completo no admin e fallbacks definidos |
| Repositório | ✅ | Limpo — sem .opencode, sem arquivos soltos |

---

## Os 5 arquivos mais críticos para ler antes de editar

1. **`sistema/frontend/src/utils/productPricing.ts`** — fonte única de preço de produto
2. **`sistema/frontend/src/contexts/CartContext.tsx`** — estado global do carrinho
3. **`sistema/frontend/src/pages/Checkout.tsx`** — fluxo de pedido completo
4. **`sistema/backend/src/modules/orders/orders.service.ts`** — criação de pedido
5. **`arquivos-projeto/md/REFERENCIA_TECNICA.md`** — stack completa e estrutura de pastas

---

## Subir o ambiente (Docker)

```powershell
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose up -d db redis meili api storefront admin
docker compose ps
```

**URLs:** loja `http://localhost:3000` · admin `http://localhost:3002` · api `http://localhost:3001` · swagger `http://localhost:3001/api`

### ⚠️ OBRIGATÓRIO: Toda a stack UP antes de debugar no navegador
- **SEMPRE** rodar `docker compose ps` e verificar que todos têm status "Up"
- **NUNCA** tentar acessar admin se api/db não estiverem UP
- Se admin retornar erro 502, esperar 5 segundos e tentar novamente
- Guia completo legado: `memories/repo/docker-startup-complete.md` (arquivo externo antigo, nao presente neste workspace)

## Comandos de verificação rápida

```powershell
# Sanidade da stack
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
curl.exe -s -o NUL -w "health    %{http_code}`n" "http://localhost:3001/health"
curl.exe -s -o NUL -w "storefront %{http_code}`n" "http://localhost:3000/"
curl.exe -s -o NUL -w "admin     %{http_code}`n" "http://localhost:3002/"

# Rebuild somente da API
docker compose build api ; docker compose up -d --force-recreate api

# Build limpo do frontend (após edições)
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema/frontend"
npm run build

# Guardrails E2E (sempre após editar preços ou checkout)
npx cypress run --spec "cypress/e2e/product-pricing.cy.ts,cypress/e2e/checkout.cy.ts"

# Importar imagens de produto em lote
Set-Location "F:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/sistema"
docker compose run --rm api node /app/scripts/import-images.js --min-score=0.64
```

---

## Estrutura de pastas (resumo executivo)

```
raiz/
  .github/copilot-instructions.md   ← instruções de estilo para Copilot
  arquivos-projeto/md/              ← documentação canônica (LEIA AQUI)
  sistema/
    backend/src/modules/            ← auth, products, orders, customers...
    frontend/src/
      utils/productPricing.ts       ← ⭐ FONTE ÚNICA DE PREÇO
      contexts/CartContext.tsx      ← ⭐ ESTADO GLOBAL DO CARRINHO
      pages/                        ← Home, Search, Cart, Checkout, WinePage...
      cypress/e2e/                  ← guardrails E2E
    admin/src/pages/                ← Dashboard, Integrations, Intelligence...
    docker-compose.yml
    stack-ops.ps1                   ← script de operação Docker
```

---

## Armadilhas conhecidas — não caia

| Erro | Causa | Prevenção |
|------|-------|-----------|
| Preço formatado errado | Cálculo inline fora de productPricing.ts | Sempre usar productPricing.ts |
| Carrinho não atualiza | Estado local isolado | Sempre usar CartContext |
| CEP não preenche | Campos PT vs EN | Backend retorna inglês, consumir direto |
| Build passa, runtime quebra | Tipagem case-insensitive | Validar com `npm run build` + teste |
| Proxy IDE falha | Resolução de host diferente | Usar `localhost:3000` direto |
| Frete grátis bloqueia pedido | Validação de fraude ativa | Mantida comentada em orders.service.ts |
| Gateway ativo sem querer | Flag ENABLE_PAYMENTS_INTEGRATION=true | Checar `.env` antes de testar |

---

## Onde cada tipo de decisão está documentada

| Preciso saber... | Ler... |
|-----------------|--------|
| O que está operacional hoje + histórico de versões | `STATUS.md` |
| Por que uma decisão arquitetural foi tomada | `MEMORIA_PROJETO.md` |
| Stack, rotas, schema Prisma, estrutura de pastas, armadilhas | `REFERENCIA_TECNICA.md` |
| Segredos, portas, URLs, variáveis de ambiente | `CONFIGURACOES.md` |
| Próximas fases e backlog | `ROADMAP.md` |
| Operação do CMS (categorias, hero slides, vitrines) | `CMS_MANUAL.md` |
| API do ERP Solidcom (dorsal) | `SOLIDCOM_API_DORSAL.md` |

---

## Checklist oficial de implementacao

- O plano completo de execucao do projeto (milestones e tasks detalhadas) está em `ROADMAP.md`.
- Todo agente deve executar por milestones oficiais vigentes (M0 a M17 e próximos), respeitando dependencias e Definition of Done.
- Nao iniciar frente nova sem checar bloqueios no roadmap.
- Toda tarefa operacional deve ser quebrada em milestones curtos (M1 diagnostico, M2 implementacao, M3 validacao/deploy, M4 documentacao), conforme `agent.md`.

---

## Protocolo de início de sessão (execute sempre)

1. Leia este arquivo (INICIO_AQUI.md) — feito ✓
2. Leia `agent.md` e defina milestones da tarefa antes de editar código
3. Leia `STATUS.md` — para saber o que está funcionando
4. Leia os arquivos críticos da área que vai editar (lista acima)
5. Verifique se Docker está rodando: `docker ps | findstr antenor`
6. Faça a mudança mínima necessária
7. Rode `npm run build` para checar compilação
8. Se alterou preços ou checkout, rode os E2E
9. Se concluiu milestone `M`, execute flush de cache + recreate obrigatório da stack
10. Atualize `STATUS.md` se uma fase for concluída
11. Atualize os markdowns canônicos impactados pela mudança antes de encerrar a sessão

---

*Ultima atualizacao: 1 de junho de 2026 · v1.24.26-alpha · M20 security backend/frontend/admin aplicado*
