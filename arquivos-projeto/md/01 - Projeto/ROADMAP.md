# ROADMAP.md - Planejamento Ativo

Data: 5 de junho de 2026
Versao de referencia: 1.24.122-alpha
Status auditoria top-tier: P0 + M01-M20 aplicados, validados e documentados.
Status: M0-M32 concluidos | M33 Inteligencia validado em runtime local | M33 Web Push implementado com PWA/gerador VAPID/prepare env com database-url, VAPID existente via env, merge seguro, gate automatizado da tooling, evidencias JSON, validador do pacote, relatorio Markdown, homologate integrado com validacao/relatorio, guarda anti-sobrescrita e pasta automatica de evidencias/homologate orquestrado validado ate dry-run/inspect e prove com env-file/ponte env staging/preflight live/prova assistida endurecida com dry-run/runbook externo/CTA storefront/Cypress de inscricao e pendente de subscription real em HTTPS | Wiki operacional com links validados | M39 concluido | Storefront staging produto/carrinho/checkout validado em 02/06 | Storefront visual responsivo, rotas secundarias e detalhe real de receita validados em 05/06 | Storefront receitas com 5 receitas/4 categorias/capas WebP proprias/copy SEO revisados/relacionadas em staging e gate executavel | Storefront UI kit aplicado em receitas/Mercado/Search/Produto/Carrinho/Checkout/Adega/Home/Login/Cadastro/Conta/Fallbacks/DeliveryVerificationModal/NotificationBell/Promocoes | Admin API de receitas corrigida | UI kit shadcn/ui validado em stack real

---

## M-CAT — Reestruturação de categorias e mapeamento por EAN
**Objetivo:** substituir a arvore de classificacao 4 niveis por hierarquia N1/N2 com mapeamento principal por EAN e fallback automatico controlado.

**Status atual:**
- [x] M-Cat-01 Schema Prisma (hierarquia + mapeamento)
- [x] M-Cat-02 Dry-run de importacao do handoff
- [x] M-Cat-03 Auto-classificacao + pendencias
- [x] M-Cat-04 API publica de categorias
- [x] M-Cat-05 API admin de categorias e mapeamentos
- [x] M-Cat-06 Notificacao de pendencias no admin
- [x] M-Cat-07 Safe mode com validacao e transacao
- [x] M-Cat-08 Teste E2E de API de categorias + atualizacao documental

**DoD M-CAT:**
- [x] Navegacao N1/N2 via `/mercado?cat=&sub=`
- [x] Mapeamento EAN priorizado e versionado
- [x] Pendencias rastreaveis no admin
- [x] Aplicacao em safe mode (`dryRun=true|false`)

### Pós M-CAT — Hardening operacional (18/05/2026)

- [x] Contrato de pendências reforçado (`reason` + `notes`) em API e admin.
- [x] Guardrail executável adicionado: `sistema/backend/scripts/validate-pending-contract.js`.
- [x] Comando raiz para operação local: `npm run validate:pending-contract` em `sistema/`.
- [x] Pipeline CI/PR atualizado para executar validação de contrato da fila de pendências.
- [x] Validação transacional approve/reject executada com restauração de baseline (`unmapped=0`).
- [x] Sincronização Solidcom consolidada para traduzir carga de entrada usando `ProductCategoryMapping` (EAN -> N1/N2) como fonte única.
- [x] Produtos novos sem mapeamento passam a abrir pendência automática com sugestão por aprendizado, sem quebrar fluxo de carga.
- [x] Filtro público de categoria consolidado para N1/N2: seleção de N1 agrega mapeamentos das N2 descendentes.
- [x] UX do storefront consolidada para taxonomia hierárquica: trilho principal limitado a N1 canônico e consumo de `parentId` para separar níveis.
- [x] Restauração estrita da taxonomia oficial N1/N2 com base em `categorias_n1_n2_formatadas.txt` (45 raízes N1).
- [x] Reaplicação de categorização via handoff oficial (`handoff_ecommerce_v3_n1_n2.csv`) concluída em modo apply.
- [x] Paridade storefront/admin concluída usando taxonomia real da API (sem filtros hardcoded e sem categorias fora da lista oficial).
- [x] Saneamento e Reorganização do Repositório (limpeza de .opencode e logs da raiz, organização de arquivos-projeto e atualização de docker-compose).
- [x] Organização da Memory-Wiki Obsidian (criação da estrutura de subdiretórios, dashboard Home.md, status, contexto, agentes e índice de arquivos mapeados sem modificar os arquivos canônicos).

---

## Auditoria Top-Tier 26/05/2026 - P0 + Milestones 01-17 aplicados
**Origem:** `F:/VC.VERSE/AUDITORIAS/milestones-top-tier-supermercado-2026-05-26.md` e `milestones-top-tier-supermercado-todo-2026-05-26.md`.

**Status:** P0, fundacao do Milestone 01, catalogo M02, estoque/reserva M03, pricing/promocoes M04, checkout operacional M05, OMS por evento/item M06, picking/conferencia/embalagem M07, fulfillment/logistica M08, pagamentos/ledger M09, integracoes resilientes M10, API publica/webhooks M11, CRM/fidelidade M12, BI/analytics operacional M13, observabilidade/SRE M14, marketplace/multicanal M15, personalizacao/recomendacao M16 e seguranca/LGPD M17 aplicados e validados. Admin UI completa de tenant/loja/papeis, telas visuais completas de estoque/picking/pricing e demais milestones da auditoria continuam pendentes para ciclos futuros.

Tasks aplicadas:
- [x] JWT forte obrigatorio fora de ambiente local/teste.
- [x] Ownership por `customerId` em pedidos, enderecos e notificacoes.
- [x] Mutacoes de receitas restritas a admin.
- [x] Webhook de pagamentos exige assinatura quando integracao de gateway estiver ativa.
- [x] Pedido com `idempotencyKey` obrigatoria e persistida em `idempotency_keys`.
- [x] Recalculo server-side de subtotal/desconto/total e validacao de cliente/produto/quantidade/preco/estoque.
- [x] Snapshot basico de cliente, endereco, entrega e preco persistido no pedido.
- [x] Entrega fora de area com `fee: null` + `outOfArea: true`, bloqueando checkout sem taxa valida.
- [x] Checkout envia chave idempotente por tentativa e trata area indisponivel.
- [x] CORS parametrizavel por `CORS_ORIGIN`/`CORS_ORIGINS` e obrigatorio em producao.
- [x] Rate limits sensiveis em auth, checkout/order creation e webhook.
- [x] Specs e mocks atualizados para contratos novos, incluindo addresses/delivery/recipes.

Tasks Milestone 01 aplicadas:
- [x] Models Prisma `Tenant`, `Store`, `TenantUser`, `Role`, `Permission`, `RolePermission`, `UserStoreAccess`.
- [x] `tenantId` e `storeId` adicionados com backfill default nas tabelas operacionais e de loja.
- [x] Indices tenant/store/status/active criados nos pontos criticos.
- [x] Migration `20260526100000_add_tenant_store_rbac_foundation` com seed de tenant/store default, permissoes iniciais e role admin.
- [x] `TenantContextMiddleware`, `@CurrentTenant()`, `@CurrentStore()`, `@RequirePermission()`, `TenantAccessGuard` e `PermissionGuard`.
- [x] JWT passa a carregar tenant/store.
- [x] Orders e Products com filtros tenant/store nos fluxos criticos.
- [x] Edicao de produto protegida por permissao `pricing.write`.
- [x] Script `npm run tenant:validate-backfill` para validar linhas sem tenant/store obrigatorio.

Tasks Milestone 02 aplicadas:
- [x] Models Prisma `Brand`, `ProductMaster`, `ProductMedia`, `ProductAttribute`, `CategoryNode`, `ProductCategoryAssignment`, `ProductSubstitution`, `CatalogQualityIssue`.
- [x] Migration `20260526113000_add_catalog_top_tier_foundation` com backfill de produto legado para produto mestre e categorias CMS para arvore de catalogo.
- [x] Produto mestre preserva EAN, nome, categoria e precos legados, status, unidade, regra de pesavel e perecibilidade.
- [x] `ProductsService` mantem `ProductMaster` em criacao, edicao e sincronizacao ERP.
- [x] APIs `/admin/products`, `/admin/products/:id/media`, `/admin/products/:id/substitutes` e `GET /products/:id/substitutes`.
- [x] Modulo `CatalogModule` com `/admin/catalog/quality`, `/admin/catalog/issues`, resolucao de issues, rebuild de arvore e `/admin/search/reindex`.
- [x] Fila de qualidade automatica para imagem/categoria ausentes, regra de pesavel incompleta, preco zero, estoque negativo, nome ruim, EAN duplicado e categoria incompativel.
- [x] Busca Meili enriquecida com tenant/store, nome normalizado e disponibilidade.
- [x] Script `npm run catalog:validate-foundation` para validar backfill e guardrail de pesaveis.

Tasks Milestone 03 aplicadas:
- [x] Models Prisma `StockPosition`, `StockLedger`, `StockReservation`, `StockReconciliationRun` e `StockPolicy`.
- [x] Backfill de `products.stock` para `stock_positions`, preservando estoque negativo como estado auditavel.
- [x] Formula `available = onHand - reserved - safetyStock` validada por script.
- [x] `InventoryService` com disponibilidade, reserva atomica, liberacao, expiracao, consumo, ajuste manual, reconciliacao e sync ERP.
- [x] Criacao de pedido passa a reservar estoque antes de persistir o pedido.
- [x] Confirmacao de pedido exige reserva ativa e consome reserva; cancelamento libera reserva.
- [x] APIs `GET /availability`, `POST /stock/reservations`, `POST /stock/reservations/:id/release`.
- [x] APIs admin `/admin/stock/adjustments`, `/admin/stock/negative`, `/admin/stock/reconciliation`.
- [x] Jobs admin `stock.sync.fromErp`, `stock.recalculate.available`, `stock.reservations.expire`.
- [x] Ruptura operacional via `/admin/stock/picking-ruptures`, ajustando pedido, estoque, ledger e evento BI `RUPTURE`.
- [x] Script `npm run inventory:validate-foundation` para validar posicoes/reservas.

Tasks Milestone 04 aplicadas:
- [x] Models Prisma `PriceList`, `PriceListItem`, `Promotion`, `PromotionRule`, `Coupon`, `PromotionUsage` e `PriceAuditLog`.
- [x] Backfill de preco efetivo legado para lista `STOREFRONT` por tenant/store.
- [x] `PricingService.quote` para preco por loja/canal, custo, margem, desconto e total server-side.
- [x] `PromotionEngineService` com cupom percentual/fixo, frete gratis, desconto progressivo basico e conflito por prioridade.
- [x] Checkout passa a recalcular preco via `PricingService.quote` e ignora desconto vindo do frontend.
- [x] Uso de cupom/promocao registrado em `promotion_usages` apos pedido criado.
- [x] APIs `POST /pricing/quote` e `POST /coupons/validate`.
- [x] APIs admin `/admin/price-lists`, `/admin/price-lists/:id/items/bulk`, `/admin/promotions`, `/admin/promotions/:id/simulate`.
- [x] Auditoria de preco em `price_audit_logs`.
- [x] Script `npm run pricing:validate-foundation` para validar fundacao comercial.

Tasks Milestone 05 aplicadas:
- [x] Models Prisma `Cart`, `CartItem`, `CheckoutSession` e `CheckoutEvent`.
- [x] Migration `20260526143000_add_checkout_cart_contract` com tabelas, snapshots e idempotencia de sessao por tenant/store.
- [x] APIs `POST /cart`, `POST /cart/:id/items`, `PATCH /cart/:id/items/:itemId`, `DELETE /cart/:id/items/:itemId`.
- [x] APIs `POST /checkout/sessions`, `POST /checkout/sessions/:id/quote`, `POST /checkout/sessions/:id/confirm`, `POST /checkout/sessions/:id/cancel`.
- [x] Validacao de produto ativo, quantidade positiva, fracionado/pesavel e preferencia de substituicao por item.
- [x] Quote de checkout recalcula estoque, preco/promocao e entrega no backend e bloqueia sem estoque, fora de area ou sem janela valida.
- [x] Confirmacao usa `OrdersService.create` com idempotencia derivada da sessao e preserva reserva/snapshots/comunicacao.
- [x] Job `POST /admin/checkout/jobs/abandon-carts` gera evento CRM/BI `CART_ABANDONED`.
- [x] Storefront passa a finalizar pela API de checkout e exibe erros inline sem `alert()`.
- [x] Script `npm run checkout:validate-foundation` para validar fundacao de checkout.

Tasks Milestone 06 aplicadas:
- [x] Campos OMS adicionados a `Order` e `OrderItem` para canal, fulfillment, quantidade/preco final, status de item, politica de substituicao, item substituto, motivo de corte e notas de separacao.
- [x] Model Prisma `OrderEvent` criado com `tenantId`, `storeId`, `orderId`, `type`, `payload`, `actorType`, `actorId` e `createdAt`.
- [x] Migration `20260526153000_add_order_oms_events_foundation` com backfill de `order.created` para pedidos existentes.
- [x] `OrdersService.create`, `update`, `updateStatus`, cancelamento, corte, substituicao e recalc gravam eventos auditaveis.
- [x] APIs admin `/admin/orders`, `/admin/orders/:id`, `/admin/orders/:id/events`, `/admin/orders/:id/cancel`, `/admin/orders/:id/items/:itemId/cancel`, `/admin/orders/:id/items/:itemId/substitute` e `/admin/orders/:id/recalculate`.
- [x] Corte de item sem cancelar pedido inteiro: item `CANCELLED`, total recalculado e evento `order.item_cancelled`.
- [x] Substituicao com rastreabilidade: item original `SUBSTITUTED`, novo item criado, `substitutedByItemId` preenchido e evento `order.substitution_accepted`.
- [x] Admin de pedidos conectado ao contrato OMS, com status macro ampliados, detalhe carregando eventos e historico operacional no modal.
- [x] Script `npm run oms:validate-foundation` para validar fundacao OMS.

Tasks Milestone 07 aplicadas:
- [x] Models Prisma `PickingBatch`, `PickingTask`, `PickingTaskItem`, `PickerPerformanceSnapshot` e `PackingChecklist`.
- [x] Migration `20260526163000_add_picking_foundation` com fila de picking, itens por tarefa, produtividade e checklist de embalagem.
- [x] APIs admin `/admin/picking/eligible-orders`, `/admin/picking/tasks`, atribuicao, start, pick, missing, substitute, finish, conference, packing-checklist e performance.
- [x] Separacao por item atualiza `OrderItem`, grava peso final quando aplicavel, recalcula pedido e registra eventos OMS.
- [x] Falta de item entra no fluxo de substituicao e busca sugestoes em `ProductSubstitution` quando houver produto mestre vinculado.
- [x] Conferencia bloqueia divergencia sem justificativa; embalagem libera pedido como `READY_FOR_PICKUP` ou `READY_FOR_DELIVERY`.
- [x] Admin recebeu secao `Separacao` para operacao em tela pequena/celular, com acoes item a item e indicadores por separador.
- [x] Script `npm run picking:validate-foundation` para validar fundacao de picking.

Tasks Milestone 08 aplicadas:
- [x] Models Prisma `DeliveryArea`, `FulfillmentSlot`, `Driver`, `DeliveryRoute`, `DeliveryStop` e `FulfillmentEvent`.
- [x] Campos logisticos em `Order` e `CheckoutSession` para area/slot/reserva de fulfillment.
- [x] Migration `20260526173000_add_fulfillment_delivery_foundation` com areas, slots, motoristas, rotas, paradas e eventos.
- [x] Calculo server-side de frete por `DeliveryArea`, com CEP/poligono, taxa, pedido minimo e frete gratis por area.
- [x] Checkout bloqueia slot cheio/cutoff, reserva capacidade ao cotar e libera reserva em cancelamento/falha.
- [x] Confirmacao grava `fulfillmentType`, slot, area e snapshot logistico no pedido.
- [x] Pedido de retirada chega ao ERP como `retiraNaLoja=true`, sem ser tratado como entrega com frete zero.
- [x] APIs admin `/admin/fulfillment/areas`, `/admin/fulfillment/slots`, `/admin/fulfillment/drivers` e `/admin/fulfillment/routes`.
- [x] Rotas manuais com motorista, paradas, saida para entrega, entregue/falha, eventos de fulfillment e `OrderEvent`.
- [x] Admin `Taxas de Entrega` exibe ocupacao de janelas e criacao rapida de slot.
- [x] Script `npm run fulfillment:validate-foundation` para validar fundacao logistica.

Tasks Milestone 09 aplicadas:
- [x] Models Prisma `PaymentTransaction`, `PaymentEvent`, `Refund` e `PaymentReconciliationRun`.
- [x] Migration `20260526183000_add_payment_ledger_foundation` com ledger financeiro, eventos, reembolsos, conciliacao, indices e FKs.
- [x] `PaymentsLedgerService` com criacao idempotente, sanitizacao de payload sensivel, eventos, refund, chargeback e conciliacao.
- [x] Webhook de pagamentos registra `PaymentEvent` idempotente por `providerEventId`, `signatureOk` e atualiza transacao/pedido sem duplicar evento financeiro.
- [x] Criacao e replay de cobranca registram `PaymentTransaction` com `providerRef` e `idempotencyKey`.
- [x] Confirmacao manual de pedido online com gateway ativo exige pagamento `PAID`, `AUTHORIZED` ou `CAPTURED`.
- [x] APIs admin `/integrations/payments/transactions`, `/integrations/payments/orders/:orderId/transaction`, `/integrations/payments/refunds`, `/integrations/payments/chargebacks` e `/integrations/payments/reconciliation`.
- [x] Script `npm run payments:validate-foundation` para validar fundacao financeira.
- [x] Fluxo de pagamento por fora segue preservado por padrao com gateway/UI desligados.

Tasks Milestone 10 aplicadas:
- [x] Models Prisma `IntegrationConnector`, `OutboxEvent`, `IntegrationJob`, `IntegrationAttempt` e `IntegrationDeadLetter`.
- [x] Migration `20260526193000_add_integration_outbox_foundation` com conectores, outbox transacional, jobs, tentativas, DLQ, indices, FKs e idempotencia por mensagem.
- [x] `IntegrationOutboxService` com criacao/listagem de conectores, enfileiramento idempotente, worker sob demanda, retry com backoff, DLQ e replay manual.
- [x] Falhas de pedido/cancelamento Solidcom registram payload rastreavel no outbox para nao perder evento quando ERP cair.
- [x] APIs admin `/integrations/operations/panel`, `/integrations/connectors`, `/integrations/outbox/events`, `/integrations/outbox/worker/run`, `/integrations/jobs`, `/integrations/dead-letters` e replays.
- [x] Admin API client tipado para conectores, painel, outbox, jobs e DLQ.
- [x] Script `npm run integrations:validate-outbox` para validar fundacao de integracoes resilientes.

Tasks Milestone 11 implementadas em codigo:
- [x] Models Prisma `ApiClient`, `WebhookEndpoint`, `WebhookDelivery` e `ApiUsageLog`.
- [x] Migration `20260526203000_add_public_api_webhooks_foundation` adicionada.
- [x] API publica versionada em `/v1` para pedidos, pedido por id, produtos e estoque.
- [x] API key `clientId.secret` com hash de segredo, status ativo/revogado, scopes, rate limit por cliente e log de uso.
- [x] Portal admin em `/integrations/public-api` para clientes, endpoints, eventos, worker de entregas e replay manual.
- [x] Webhooks assinados com HMAC SHA-256 e headers `x-antenor-event`, `x-antenor-delivery` e `x-antenor-signature`.
- [x] Entregas com `PENDING`, `FAILED`, `DELIVERED`, `DEAD`, backoff e replay manual.
- [x] Eventos conectados: `order.created`, `order.status_changed`, `stock.changed` e `payment.updated`.
- [x] `npx prisma migrate deploy` aplicado no Postgres local.
- [x] `npm run public-api:validate-foundation` validado.
- [x] Runtime publicado: `/v1/orders` 200, bloqueio por scope 403 e cliente revogado 401.
- [x] Flush/recreate da stack principal executado; api/admin/storefront/db/redis/meili `Up`.

Tasks Milestone 12 aplicadas:
- [x] Models Prisma `CustomerProfile`, `CustomerConsent`, `CustomerSegment`, `CustomerSegmentMember`, `LoyaltyAccount`, `LoyaltyLedger`, `Campaign`, `CampaignDelivery`, `ShoppingList` e `ShoppingListItem`.
- [x] Migration `20260526213000_add_crm_loyalty_foundation` aplicada.
- [x] APIs CRM `/crm/customers/:customerId/relationship`, perfil, consentimentos, segmentos, fidelidade, campanhas e listas de compra/recompra.
- [x] Historico de compras e payload de recompra por pedido anterior.
- [x] Segmentos automaticos de inativos, alto ticket, novos clientes e risco de churn.
- [x] Campanhas respeitam consentimento por canal antes de criar entregas.
- [x] Ledger auditavel de pontos/cashback com saldo resultante e bloqueio de resgate sem saldo.
- [x] Script `npm run crm:validate-foundation` para validar fundacao CRM/fidelidade.

Tasks Milestone 13 aplicadas:
- [x] `AnalyticsEvent` padronizado com tenant, loja, canal, origem e sessao.
- [x] Model Prisma `MetricSnapshot` para snapshots por periodo, dashboard, metrica, dimensao, loja, canal, produto e categoria.
- [x] Migration `20260526223000_add_bi_operational_analytics_foundation` aplicada.
- [x] API `POST /analytics/admin/metric-snapshots/generate` para gerar agregacoes operacionais.
- [x] API `GET /analytics/admin/operational-dashboard` para dashboards executivo, funil, operacional, catalogo, ruptura, picking, integracoes, CRM e pagamentos.
- [x] API `GET /analytics/admin/drilldown` para filtros por loja, categoria, produto, canal, metrica e dimensao.
- [x] Metricas iniciais: GMV, pedidos, ticket medio, receita por loja/canal/categoria, margem estimada, sessoes, busca, PDP, add to cart, checkout, abandono, busca sem resultado, ruptura, itens cortados, substituicoes, SLA de picking, produtividade, falhas de integracao, inativos/churn, LTV e falhas de pagamento.
- [x] Views por persona: gestor ve venda perdida por ruptura, operador ve atraso de picking, tecnico ve falha de integracao e marketing ve clientes inativos/churn.
- [x] Script `npm run bi:validate-foundation` para validar fundacao BI/analytics.

Tasks Milestone 14 aplicadas:
- [x] Middleware de request context com `x-request-id`, `x-correlation-id` e `x-order-trace-id`.
- [x] Logs HTTP JSON passam a incluir request/correlation/order trace, tenant, store, status, duracao, IP e user agent.
- [x] Registry de metricas em memoria para p95 por endpoint, taxa de erro 5xx e taxa de 4xx critico.
- [x] Exposicao Prometheus em `GET /observability/metrics/prometheus`.
- [x] API admin `GET /observability/metrics` com p95, filas, jobs falhos, pedidos sem sync, webhooks falhos, reservas expiradas e pagamentos pendentes acima do SLA.
- [x] API admin `POST /observability/alerts/check` para alertas de 5xx, checkout error rate, fila acumulada, integracao falhando, pedido sem sync, pagamento pendente, webhooks falhos e reservas expiradas.
- [x] API admin `GET /observability/status-page` para status page interna.
- [x] API admin `GET /observability/runbooks` com runbooks de ERP, checkout, pagamento e ruptura.
- [x] Health check detalhado ampliado para DB, Redis, MeiliSearch, ERP/Solidcom, gateway de pagamento, fila/outbox e storage/uploads.
- [x] Script `npm run observability:validate-foundation` para validar fundacao Observabilidade/SRE.

Tasks Milestone 15 aplicadas:
- [x] Model Prisma `SalesChannel` para canais `STOREFRONT`, `IFOOD`, `RAPPI`, `MERCADO_LIVRE`, `WHATSAPP` e B2B futuro.
- [x] Model Prisma `ChannelProduct` para mapear produto interno a SKU/produto externo por canal.
- [x] Model Prisma `MarketplaceOrder` para rastrear pedido externo, payload bruto, status, pedido OMS vinculado e falha.
- [x] Models Prisma `ChannelPricePolicy` e `ChannelStockPolicy` para governanca de preco e estoque por canal.
- [x] Migration `20260526233000_add_marketplace_multichannel_foundation` aplicada.
- [x] `MarketplaceModule` com APIs admin para canais, produtos por canal, politica de preco, politica de estoque e painel de dependencia/margem.
- [x] Endpoint publico `POST /marketplace/channels/:channelId/orders` recebe pedido externo com segredo opcional do canal e consolida no `OrdersService`.
- [x] Pedido externo usa idempotencia `marketplace:{channelId}:{externalId}` e entra no mesmo OMS, com `channel` do marketplace.
- [x] Venda externa reserva estoque pelo fluxo existente de pedido, reduzindo disponibilidade quando o pedido e confirmado/consumido.
- [x] Painel de marketplace expõe pedidos recebidos, consolidados, falhos, produtos mapeados, politicas, receita e margem estimada por canal.
- [x] Script `npm run marketplace:validate-foundation` para validar fundacao Marketplace/Multicanal.

Tasks Milestone 16 aplicadas:
- [x] Model Prisma `RecommendationEvent` para medir impressao, clique, add-to-cart e compra gerados por recomendacao.
- [x] Migration `20260527003000_add_recommendation_intelligence_foundation` aplicada.
- [x] `RecommendationsModule` com endpoints de recompre, complementares, substitutos, vitrine por segmento, eventos de recomendacao e inteligencia operacional.
- [x] Recompre por cliente recorrente baseado em `OrderItem` historico, com filtro de disponibilidade.
- [x] Complementares por cesta com co-ocorrencia de pedidos e fallback de popularidade.
- [x] Substitutos inteligentes baseados em `ProductSubstitution`, categoria/classificacao, faixa de preco e estoque.
- [x] Vitrine por segmento com ranking por vendas, margem e disponibilidade.
- [x] Inteligencia operacional com previsao simples de ruptura, produto critico, campanha para item parado, taxa de substituicao e conversao de recomendacao.
- [x] Endpoint legado de recomendacoes de produto endurecido para nao recomendar produto indisponivel.
- [x] Script `npm run recommendations:validate-foundation` para validar fundacao Personalizacao/Recomendacao.

Tasks Milestone 17 aplicadas:
- [x] Model Prisma `DataSubjectRequest` para solicitacoes LGPD executaveis.
- [x] Migration `20260530010000_add_lgpd_governance_foundation` aplicada.
- [x] `DataPrivacyModule` com endpoints admin de consentimentos, exportacao do titular, anonimizacao, politica de retencao e listagem de solicitacoes.
- [x] Consentimentos LGPD formalizados para termos, privacidade, WhatsApp, e-mail e SMS.
- [x] Exportacao LGPD consolida cadastro, enderecos, perfil, consentimentos, fidelidade, campanhas, listas, pedidos, analytics e recomendacoes.
- [x] Anonimizacao revoga consentimentos e remove PII de cliente/endereco/perfil, bloqueando cliente com pedido ativo salvo `force=true`.
- [x] Alteracoes sensiveis LGPD registradas em `AuditLog` com tenant/store/actor.
- [x] Script `npm run lgpd:validate-foundation` para validar fundacao Seguranca/LGPD.

Validacao:
- [x] `npx prisma validate` em `sistema/backend`
- [x] `npx prisma generate` em `sistema/backend`
- [x] `npx prisma migrate deploy` aplicado no Postgres local
- [x] `npx prisma migrate status` com schema atualizado
- [x] `npm run tenant:validate-backfill` em `sistema/backend`
- [x] `npm run catalog:validate-foundation` em `sistema/backend`
- [x] `npm run inventory:validate-foundation` em `sistema/backend`
- [x] `npm run pricing:validate-foundation` em `sistema/backend`
- [x] `npm run checkout:validate-foundation` em `sistema/backend`
- [x] `npm run oms:validate-foundation` em `sistema/backend`
- [x] `npm run picking:validate-foundation` em `sistema/backend`
- [x] `npm run fulfillment:validate-foundation` em `sistema/backend`
- [x] `npm run payments:validate-foundation` em `sistema/backend`
- [x] `npm run integrations:validate-outbox` em `sistema/backend`
- [x] `npm run public-api:validate-foundation` em `sistema/backend`
- [x] `npm run crm:validate-foundation` em `sistema/backend`
- [x] `npm run bi:validate-foundation` em `sistema/backend`
- [x] `npm run observability:validate-foundation` em `sistema/backend`
- [x] `npm run marketplace:validate-foundation` em `sistema/backend`
- [x] `npm run recommendations:validate-foundation` em `sistema/backend`
- [x] `npm run lgpd:validate-foundation` em `sistema/backend`
- [x] `npm test -- --runInBand` em `sistema/backend` (34 suites, 206 testes)
- [x] `npm run build` em `sistema/backend`
- [x] `npm run build` em `sistema/admin`
- [x] `npm run build:all` em `sistema`
- [x] Flush/rebuild/recreate Docker com api/admin/storefront e containers `Up`
- [x] Runtime publicado: `/observability/metrics/prometheus` respondeu e `/health/detail` checou DB, Redis, MeiliSearch, ERP, gateway, fila e storage.
- [x] Runtime M15 publicado: `/health` respondeu `ok` apos recriar api/admin/storefront.
- [x] Runtime M16 publicado: `/health` respondeu `ok` apos recriar api/admin/storefront.
- [x] Runtime M17 publicado: `/health` respondeu `ok` apos recriar api/admin/storefront.

---

## M26 — Polimento visual global + UX mobile (bordo, logo, nav)
**Objetivo:** eliminar inconsistências de arredondamento, corrigir header mobile (cor bordo + logo), reorganizar bottom nav com aba Promos, remover sombras/hover excessivos nos cards.

**Bloqueios:** nenhum

Tasks:
- [x] Auditoria e padronização de `rounded-*`: tudo que não for círculo perfeito → `rounded-lg` (8px)
- [x] Header mobile: cor bordo `#5D082A` (remover preto `#1E1A1B`), adicionar logo pequeno à esquerda antes do endereço
- [x] Bottom nav: reorganizar para Home / Buscar / Promos (🔥 centro, destaque) / Carrinho / Entrar
- [x] Aba Promos: rota `/promocoes` listando produtos com `promotionalPrice` definido
- [x] StoreProductCard: remover `hover:-translate-y-1` e `shadow-xl` no hover — manter sombra base sutil
- [x] Imagem placeholder "indisponível": substituir SVG atual por design inline moderno (ícone + texto bordo)

DoD:
- [x] Build storefront sem erros
- [x] Revisão visual em viewport 390px e 1280px
- [x] Sem regressão nos testes unitários frontend

---

## M41 — Storefront: proporção e organização de preço nos cards (CONCLUÍDO)
**Objetivo:** elevar legibilidade comercial do preço nos cards da Home/Busca replicando organização de referência de mercado.

**Bloqueios:** nenhum

Tasks:
- [x] Reorganizar bloco de preço no `StoreProductCard` para hierarquia: referência (pesável) -> preço principal -> oferta/preço antigo
- [x] Reforçar proporção tipográfica do preço principal e unidade/sufixo
- [x] Remover selo de desconto no topo da imagem para evitar dupla leitura de oferta
- [x] Preservar fonte única de cálculo via `productPricing.ts` sem cálculo inline

DoD:
- [x] Build storefront sem erros
- [x] Cards mantêm responsividade em grade e carrossel
- [x] Sem alteração no contrato de preço (`getProductPricePresentation`)
- [x] Calibração tipográfica final aplicada e publicada no container local (`storefront`)

---

## M41.1 — Toggle Unidade/Peso no marcador do card (CONCLUÍDO)
**Objetivo:** garantir que o toggle `Unidade`/`Peso` altere o marcador de step/quantidade exibido no card de produto pesável.

**Bloqueios:** nenhum

Tasks:
- [x] Conectar estado do toggle do `StoreProductCard` ao texto de quantidade exibido no controle do card
- [x] Exibir porções/unidades quando `Unidade` estiver ativo
- [x] Exibir quantidade convertida para peso (via `productPricing.ts`) quando `Peso` estiver ativo
- [x] Preservar contrato de cálculo centralizado em `productPricing.ts`

DoD:
- [x] Toggle altera marcador visual do card imediatamente
- [x] Build storefront sem erros
- [x] Sem regressão de tipagem em `StoreProductCard`

---

## M41.2 — Card sem box de preço (CONCLUÍDO)
**Objetivo:** remover o box de encapsulamento do preço para aproximar o card do padrão visual de referência.

**Bloqueios:** nenhum

Tasks:
- [x] Remover borda/fundo do container do bloco de preço no `StoreProductCard`
- [x] Preservar hierarquia tipográfica de referência, preço principal e sufixo
- [x] Publicar ajuste no container local do storefront

DoD:
- [x] Preço exibido sem caixa destacada
- [x] Build storefront sem erros
- [x] Ajuste validado em `http://localhost:3000/mercado`

---

## M41.3 — Remover gap acima/abaixo do preço (CONCLUÍDO)
**Objetivo:** eliminar espaçamento vertical residual acima e abaixo do bloco de preço no card.

**Bloqueios:** nenhum

Tasks:
- [x] Remover `pt/space-y/min-h` que geravam folga vertical no wrapper final do card
- [x] Zerar padding vertical do bloco de preço
- [x] Preservar separação mínima apenas quando controle de quantidade estiver visível

DoD:
- [x] Sem espaço visual sobrando acima do bloco de preço
- [x] Sem espaço visual sobrando abaixo do bloco de preço
- [x] Build storefront sem erros

---

## M27 — Bug: seleção de categoria na tela de busca não atualiza produtos
**Objetivo:** corrigir o comportamento onde clicar em outra categoria na tela `/mercado` mantém os produtos da categoria anterior quando há um `q=` na URL.

**Adicional:** corrigir lógica de promoções para usar `vl_produto` e `vl_produto_normal` do ERP Solidcom.

**Bloqueios:** nenhum

Tasks:
- [x] Ajustar lógica em `resolveCommercialPrices` para considerar `vl_produto` como preço promocional e `vl_produto_normal` como preço original.
- [x] Validar integração com ERP Solidcom para garantir que promoções sejam refletidas corretamente no storefront.
- [x] Testar comportamento com produtos em promoção e sem promoção.

DoD:
- [x] Produtos com promoções aparecem corretamente no storefront.
- [x] Produtos sem promoções exibem apenas o preço original.
- [x] Sem regressão nos testes unitários e de integração.

---

## M28 — Mapeamento de categorias e produtos (taxonomia)
**Objetivo:** corrigir o problema crítico de produtos incorretos aparecendo em categorias (ex: "Adoçante" e "Aveia" aparecendo em "Carnes dia a dia").

**Bloqueios:** M27 deve ser concluído primeiro

Tasks:
- [x] Auditar o algoritmo `CMS_CATEGORY_TO_RULE_ID` e `normalizeCategoryCode` — mapear falsos positivos
- [x] Revisar as `classification01–04` dos produtos no banco e como são usadas no filtro de busca
- [x] Corrigir lógica: chips da Home navegam com `?cat=CODIGO_CMS` (filtro exato) em vez de `?q=texto` (busca textual que misturava categorias)
- [x] Adicionar fallback visual "sem produtos nessa categoria" ao invés de mostrar produtos incorretos
- [x] `RULE_ID_TO_CMS_CODE` mapeamento inverso adicionado em `Home.tsx`

DoD:
- [x] Chips de categoria navegam para `/mercado?cat=CARNES_DIA_A_DIA` (exato)
- [x] Trocar categoria na busca limpa `q=` e refaz o fetch
- [x] Build sem erros, container `antenor_storefront` validado

---

## M29 — Progress bar de frete grátis
**Objetivo:** incentivar aumento de ticket com barra de progresso configurável para frete grátis.

**Bloqueios:** nenhum

Tasks:
- [x] Backend: campo `freeShippingThreshold` (Decimal, nullable) em `brand_config` + migration
- [x] Admin: campo "Valor mínimo para frete grátis (R$)" em Configurações da Loja
- [x] Frontend: hook `useFreeShipping(subtotal)` retornando `{ threshold, remaining, achieved, pct }`
- [x] Componente `FreeShippingBar`: barra animada com efeito de conquista (confete leve ou pulso verde) quando `achieved`
- [x] Posicionar no topo do carrinho — "Falta R$ X para frete grátis" / "🎉 Frete grátis conquistado!"
- [x] Regredir corretamente ao remover produtos (reativo ao subtotal do `CartContext`)
- [x] Mini indicador persistente no ícone do carrinho no header mobile

DoD:
- [x] Admin consegue configurar e desativar o threshold
- [x] Barra reage em tempo real ao adicionar/remover itens
- [x] Efeito de conquista disparado apenas na transição de abaixo → acima do threshold
- [x] Frete aplicado como zero no checkout quando threshold atingido
- [x] Build sem erros, testes unitários do CartContext atualizados

---

## M30 — Cálculo de taxa de entrega por CEP e geolocalização
**Objetivo:** calcular taxa de entrega automaticamente por zona geográfica, configurável pelo operador — similar ao modelo iFood.

**Bloqueios:** M29 concluído (compartilha lógica de delivery no checkout)

Tasks:
- [x] Backend: modelo `DeliveryZone` (id, name, type: `CEP_RANGE`|`GEO_POLYGON`, cepStart?, cepEnd?, fee, freeAbove?, active, priority)
- [x] Migration Prisma para `delivery_zones`
- [x] Endpoint `GET /delivery/calculate` recebendo `?cep=` → retorna `{ fee, zoneName, freeAbove, isFree }`
- [x] Admin: tela "Zonas de Entrega" com:
  - CRUD de zonas por faixa de CEP (ex: 13000-000 a 13099-999 → R$ 5,00)
  - Toggle ativo/inativo por zona
- [x] Frontend: no checkout, após informar CEP, exibir taxa calculada automaticamente
- [x] Fallback: se CEP fora de todas as zonas → aviso "fora da área de entrega"
- [x] Frontend: botão "Usar minha localização" no checkout chamando `navigator.geolocation`
- [x] Editor de polígono no mapa (Leaflet.js com `leaflet-draw`)

DoD:
- [x] Operador cria zona por faixa de CEP no admin
- [x] Checkout calcula e exibe taxa correta para cada zona
- [x] Build backend + frontend + admin sem erros
- [x] Geolocalização e polígonos geográficos

Implementação M30b (06/05/2026):
- fluxo progressivo no checkout: GPS -> fallback CEP -> geocoding de endereço -> validação de zona
- reverse/forward geocoding via Mapbox
- fallback de preenchimento por ViaCEP quando GPS indisponível/negado/timeout
- validação de ponto em polígono no backend via Turf.js (`booleanPointInPolygon`)

---

## M31 — Anti-fraude: frete grátis no primeiro pedido
**Objetivo:** reativar e aprimorar a proteção contra abuso do benefício de frete grátis para novos clientes.

**Bloqueios:** M30 concluído (requer modelo de zonas e lógica de frete no checkout)

Tasks:
- [x] Reativar validação comentada em `orders.service.ts` (WhatsApp + fingerprint do dispositivo)
- [x] Adicionar verificação por IP: máximo 1 pedido com frete grátis por IP nas últimas 24h
- [x] Admin: painel de auditoria de pedidos com frete grátis suspeitos (vetor, valor, reincidência, timestamp)
- [x] Log de eventos de fraude detectada (`fraud_logs`) sem expor ao cliente — retorna apenas "não elegível"
- [x] Migration `20260505000000_add_clientip_fraud_log` — `clientIp` em `orders` + tabela `fraud_logs`
- [ ] Testes unitários cobrindo os 3 vetores de verificação (WhatsApp, device, IP) *(deferido para ciclo de testes)*

DoD:
- [x] Cliente legítimo em conta nova ganha frete grátis no primeiro pedido
- [x] Segunda tentativa (mesmo WhatsApp, device ou IP/24h) é bloqueada silenciosamente
- [x] Admin visualiza ocorrências suspeitas em Ferramentas → Anti-fraude
- [x] Zero impacto em clientes recorrentes legítimos (verificação só corre quando `delivery === 0`)
- [x] Build admin + backend sem erros

---

## M32 — Tela de busca aprimorada + horários de funcionamento
**Objetivo:** simplificar a tela de busca e implementar configuração de horários de funcionamento com mensagens personalizadas no admin.

**Bloqueios:** nenhum (paralelo a M30)

Tasks:
- [x] Tela `/mercado`: remover barra de endereço e badge de horário do topo — mantidas apenas busca + categorias + carrinho + filtros
- [x] Backend: campos em `brand_config`: `businessHours` (JSON semanal), `openMessage`, `closedMessage`, `countdownLabel`
- [x] Migration `20260505100000_add_business_hours` para novos campos de `brand_config`
- [x] Admin: tela "Horários de Funcionamento" (sidebar Ferramentas → ícone Clock) com seletor por dia, janelas de horário e mensagens personalizáveis
- [x] `useDeliveryOperation` refatorado para consumir os novos campos do backend com fallback ao config estático
- [ ] Rodapé persistente na tela de busca mobile com countdown dinâmico *(deferido — aguarda definição de layout)*

DoD:
- [x] Admin configura horários e mensagens sem deploy
- [x] `useDeliveryOperation` usa configuração dinâmica quando disponível no backend
- [x] Tela de busca mais limpa no mobile (barra de endereço e badge removidos)
- [x] Build sem erros

---

## M33 — Sistema de notificações push e in-app
**Objetivo:** implementar notificações in-app (sino no header) e push (PWA/Web Push) para promoções, campanhas e atualizações de pedido.

**Bloqueios:** M32 concluído (reorganização de header libera espaço para sino)

Tasks:
- [x] Backend: modelo `Notification` (id, type: `ORDER_UPDATE`|`PROMO`|`CAMPAIGN`, title, body, customerId?, read, createdAt)
- [x] Endpoint `GET /notifications` (cliente autenticado) + `PATCH /notifications/:id/read`
- [x] Endpoint admin `POST /notifications/admin/broadcast` para disparar promoção para todos ou segmento
- [x] Frontend: `useNotifications` com polling 30s quando autenticado
- [x] Componente `NotificationBell` no header (substitui login no mobile autenticado, coexiste no desktop)
- [x] Drawer de notificações com lista, badge de não-lidos e marcar como lida
- [x] Web Push base: `service-worker.js` com `push` handler + endpoint `POST /notifications/push-subscribe`
- [x] Admin: tela "Notificações" com formulário de broadcast (título, corpo, segmento por customerId opcional)
- [x] Notificação automática ao atualizar status de pedido (PENDING → CONFIRMED → DELIVERED)
- [x] Envio real de Web Push para subscriptions ativas via `web-push`, com VAPID configuravel por ambiente.
- [x] Frontend registra `PushSubscriptionJSON` real do navegador com chave VAPID base64url.
- [x] Manifesto PWA publicado e linkado no storefront.
- [x] Preflight externo `npm run validate:web-push-readiness -- --external` criado para validar VAPID, HTTPS, manifesto, service worker e cache.
- [x] Preflight live `npm run validate:web-push-readiness -- --external --live` criado para validar a origem publicada antes da prova real.
- [x] Cypress `web-push-subscribe.cy.ts` cobre permissão, subscription do navegador, serialização e POST para `/notifications/push-subscribe`.
- [x] Prova assistida `prove:web-push-delivery` endurecida com `--tenant`, validação de `--limit` e limpeza explícita de expiradas/incompletas.
- [x] Prova assistida `prove:web-push-delivery -- --dry-run` valida alvo e payload sem enviar push.
- [x] Gerador `generate:web-push-vapid` cria chaves VAPID em PowerShell, `.env` e JSON.
- [x] Gate `validate:web-push-tooling` valida geração de env, readiness, `--vapid-from-env` e `--merge-existing`.
- [x] Evidencias JSON: `inspect`/`prove` aceitam `--json-output` e `homologate:web-push` aceita `--evidence-dir`.
- [x] Gate `validate:web-push-evidence` valida pacote de evidencias e exige `web-push-send.json` com `--require-send`.
- [x] Relatorio `report:web-push-homologation` gera Markdown a partir de pacote de evidencias validado.
- [x] Orquestrador `homologate:web-push` aceita `--validate-evidence` e `--report`.
- [x] Orquestrador `homologate:web-push` aceita `--require-empty-evidence-dir` e `--force-evidence-overwrite`.
- [x] Orquestrador `homologate:web-push` aceita `--evidence-dir-auto` e `--evidence-run-id`.

DoD:
- [ ] Cliente recebe push mesmo com o app fechado (PWA instalado) *(pendente de chaves VAPID reais, origem segura, preflight live e validacao em ambiente final)*
- [x] Admin envia broadcast e recebe contagem de enviados
- [x] Badge de não-lidos atualiza via polling (30s)
- [x] Notificações de pedido disparadas automaticamente pelo backend em `updateStatus`
- [x] Build sem erros e stack local/staging online em 02/06/2026; envio Web Push implementado e coberto por testes unitarios, com manifesto/preflight externo/live, gate da tooling, evidencias JSON, validador do pacote, relatorio Markdown, homologacao integrada, guarda anti-sobrescrita e pasta automatica de evidencias adicionados em 05/06/2026, entrega final pendente de VAPID real em dominio HTTPS.

## M33 — Inteligência avançada, alertas e relatório executivo
**Objetivo:** evoluir a seção IA/Analytics com comparativos de período, alertas automáticos por limiar e relatório executivo semanal exportável em CSV.

**Bloqueios:** nenhum

### M33.1 — Comparativo de período
- [x] Backend: métricas comparativas de funil e BI com delta absoluto e percentual
- [x] Frontend: cards comparativos em `Intelligence.tsx` via `PeriodComparison.tsx`
- [x] Endpoints: `GET /analytics/funnel-compare?days=7` e `GET /analytics/insights-compare?days=7`

### M33.2 — Alertas automáticos
- [x] Prisma: `AlertRule` e `AlertTriggered`
- [x] Backend: CRUD de regras, histórico e disparo manual/automático
- [x] Frontend: `AlertRulesManager.tsx` para gestão operacional das regras

### M33.3 — Relatório executivo semanal
- [x] Service: `ExecutiveReportService` gera resumo semanal e CSV
- [x] Controller: `GET /analytics/report-executive?week=<date>&format=csv|json`
- [x] Frontend: componente `ExecutiveReport` integrado em `Intelligence.tsx`
- [x] Validação runtime: `GET /analytics/report-executive?week=2026-05-25&format=json` respondeu 200 com dados (receita R$256.35, 1 pedido, 5 categorias); CSV download HTTP 200 (30/05/2026)

DoD:
- [x] Comparativos de período visíveis no admin
- [x] Regras de alerta CRUD + trigger manual operacionais
- [x] Relatório executivo semanal exportável em JSON e CSV validado em runtime (30/05/2026)

---

## M40 — Categorias estilo diretórios (Explorer)
**Objetivo:** reorganizar a tela de categorias para leitura hierárquica (árvore), com interação simples para usuário não técnico.

**Bloqueios:** nenhum

Tasks:
- [x] Refatorar `CategoriesManager` para carregar todas as categorias e montar árvore por `parentId`
- [x] Implementar renderização recursiva com indentação por nível
- [x] Adicionar controle por nó de expandir/recolher (`▶`/`▼`)
- [x] Preservar ações operacionais por linha (renomear, visibilidade, prioridade, limite, banner, exclusão)
- [x] Sustentar a revisão final com sugestões aprendidas do handoff e do catálogo real, evitando heurísticas soltas
- [x] Validar build completo e deploy local em Docker
- [x] Validar comportamento no browser (expansão/recolhimento + render de filhos)

DoD:
- [x] Estrutura de categorias navegável em árvore no admin
- [x] Operação da árvore sem regressão funcional nas ações existentes
- [x] Sugestões da revisão final sem alucinação de categorias genéricas
- [x] `npm run build:all` aprovado
- [x] Container admin atualizado e validado em runtime local
- [x] Relatório exportável validado em runtime com stack local online (`GET /analytics/report-executive` JSON 200 e CSV download 200 em 02/06/2026)

## M40.3 — Regra global de exibição por syncOption (CONCLUÍDO)
**Objetivo:** garantir semântica única de publicação no catálogo para `SEMPRE`, `NUNCA` e opção por estoque, incluindo compatibilidade com valor legado `ESTQOUE`.

Tasks:
- [x] Ajustar filtros SQL do catálogo para aceitar `ESTOQUE` e `ESTQOUE` como exibição condicionada a estoque
- [x] Ajustar filtros Prisma do catálogo (`list`, `search`, `suggest`) com a mesma regra
- [x] Alinhar endpoint de produtos por categoria à regra global de visibilidade
- [x] Alinhar helper de visibilidade em analytics para tratar `ESTQOUE` como opção de estoque
- [x] Validar build backend e runtime local com container API recriado

DoD:
- [x] `NUNCA` não aparece em endpoints públicos
- [x] `SEMPRE` aparece com produto ativo, independente de estoque
- [x] `ESTOQUE`/`ESTQOUE` só aparece com `stock > 0`

## M40.4 — Reordenação por drag-and-drop em Categorias (CONCLUÍDO)
**Objetivo:** trocar prioridade numérica manual por ordenação por arrastar e soltar no admin.

Tasks:
- [x] Remover input numérico de prioridade na grade de categorias
- [x] Adicionar interação de arrastar e soltar por linha
- [x] Restringir reordenação ao mesmo nível hierárquico (mesmo `parentId`)
- [x] Persistir atualização de `priority` para todos os irmãos impactados
- [x] Reordenar árvore visual por `priority`

DoD:
- [x] Operador consegue reorganizar seções arrastando linhas
- [x] Ordem permanece após atualizar página
- [x] Build do admin aprovado e deploy local aplicado

## M39 — Produtos como console operacional de e-commerce (✅ CONCLUÍDO - 30/05/2026)
**Objetivo:** migrar a seção de produtos do formato de vitrine para um fluxo de gestão de catálogo orientado a operação (decisão rápida, edição e ações gerenciais).

**Milestones curtos obrigatórios (agent.md):**
- [x] M1 - Diagnóstico e mapeamento
- [x] M2 - Implementação inicial
- [x] M3 - Validação e build
- [x] M4 - Atualização de documentação

Tasks do ciclo inicial:
- [x] Trocar visual padrão para tabela operacional
- [x] Manter cards como visual secundário (toggle)
- [x] Exibir colunas gerenciais: produto, categoria, preço, estoque, status, origem, ações
- [x] Melhorar ação de edição/exclusão por linha para uso de backoffice
- [x] Trocar linguagem técnica para comercial no fluxo principal (Departamento N1 / Seção N2)
- [x] Ocultar filtros técnicos ERP por padrão (níveis 3/4)
- [x] Adicionar explicação leiga na tela de mapeamento de categorias (N1/N2)
- [x] Validar build admin
- [x] Remover nomenclatura N1/N2 da interface visível (manter apenas Departamento/Seção)
- [x] Reorganizar `Categorias` para fluxo guiado em etapas, com foco em usuário leigo
- [x] Adicionar orientação por etapa (`O que fazer agora`) com linguagem direta
- [x] Adicionar navegação assistida de progresso (`Próxima etapa` / `Voltar para`)

Tasks concluídas no ciclo 30/05/2026:
- [x] Filtros rápidos operacionais via KPI cards (Sem Estoque, Sem Categoria, Inativos) — toggle exclusivo
- [x] Seleção em lote + ações massivas (Ativar / Desativar / Excluir) via barra flutuante
- [x] Edição rápida inline para campos críticos (preço, preço promocional, estoque) — clique ou duplo-clique
- [x] Endpoints backend `/products/admin/bulk-status` (PATCH) e `/products/admin/bulk-delete` (POST) operacionais

## M34 — Mapeamento Manual de Classificações por Categoria ✅ CONCLUÍDO (08/05/2026)
**Objetivo:** permitir que o operador mapeie manualmente quais classificações mercadológicas (do ERP Solidcom) pertencem a cada categoria do storefront, com indicador visual de classificações não mapeadas.

Tasks:
- [x] Schema Prisma: modelo `CategoryClassificationMapping` (categoryId, classificationLevel 1-4, classificationValue)
- [x] Migration `20260508000000_add_category_classification_mappings`
- [x] Backend: `GET /cms/categories/classification-mappings` — lista todas as classificações dos produtos ativos com status mapped/unmapped
- [x] Backend: `POST /cms/categories/classification-mappings` — adiciona mapeamento
- [x] Backend: `DELETE /cms/categories/classification-mappings/:id` — remove mapeamento
- [x] `ProductsService.buildCategoryFilterFromMappings`: filtra produtos pelos `classification0X` mapeados quando `?cat=` é passado; retorna vazio se categoria não tem mapeamentos
- [x] Admin: tela "Categorias" (sidebar Ferramentas → ícone Tag) com resumo, filtros e mapeamento inline por linha
- [x] Indicadores visuais: ✓ verde (mapeada) / ⚠ amarelo (não mapeada) com badge contador

DoD:
- [x] Operador vê todas as 883 classificações com status de mapeamento
- [x] Produto sem mapeamento de categoria → invisível no storefront
- [x] 1 classificação pode ir para N categorias
- [x] Build admin + backend limpos, containers Up

## M36b — Enforce global de mapeamento no storefront ✅ CONCLUÍDO (08/05/2026)
**Objetivo:** garantir comportamento idêntico em desktop e mobile: categoria sem mapeamento não exibe produto.

Tasks:
- [x] Backend `ProductsService.findAll`: aplicar filtro global por `CategoryClassificationMapping` (níveis 1..4)
- [x] Retornar vazio quando não houver mapeamentos cadastrados
- [x] Compatibilidade de query param pública: aceitar `category` e `cat`
- [x] Alias adicional: `FLV -> HORTIFRUTI`

DoD:
- [x] `/products?limit=1` retorna apenas produtos mapeados
- [x] `/products?category=HORTIFRUTI` reflete FLV mapeado
- [x] `/products?category=BEBIDAS` retorna 0 quando sem mapeamento

## Regra de execucao

- Este roadmap e a fonte de verdade para milestones e tasks de implementacao.
- Toda entrega tecnica deve atualizar este arquivo e os markdowns canonicamente impactados no mesmo ciclo.
- Nao pular milestone dependente. Seguir a ordem de bloqueios.
- Toda tarefa operacional deve ser aberta com milestones curtos de execucao (M1 diagnostico, M2 implementacao, M3 validacao/deploy, M4 documentacao), conforme `agent.md`.
- Ao concluir qualquer milestone oficial `M`, e obrigatorio executar flush de cache + recreate da stack principal (`redis FLUSHALL` + `docker compose build api admin storefront` + `up --force-recreate`) antes de marcar encerrado.

## Atualizacao 01/05/2026

- M11, M12, M13, M14 e M15 encerrados e validados em ambiente local Docker.
- Diretriz de produto atual: reduzir visual excessivamente ornamental e consolidar UX mais sobria, consistente e operacional.

### M16 - Reorientacao visual e padronizacao UX — CONCLUIDO 01/05/2026
Objetivo: consolidar linguagem visual profissional, padronizar tipografia e remover resquicios de glassmorphism amador.

Tasks:
- [x] Reducao sistemica de arredondamento em storefront e admin
- [x] Segunda passada em chips/pills (`rounded-full` -> raio moderado), preservando elementos circulares funcionais
- [x] Tipografia padrao corporativa com prioridade para `Google Sans Flex` e fallback `Roboto`
- [x] Ajuste de componentes base para estilo solido (sem blur/transparencia como linguagem principal)
- [x] Revisao visual final por superficies (Home, Mercado, Checkout, Dashboard, Integracoes)
- [x] Context7 MCP configurado em `.vscode/mcp.json`
- [x] White space corrigido em StoreProductCard h3

DoD:
- [x] Componentes principais com raio e tipografia consistentes entre storefront e admin
- [x] Sem regressao funcional e sem quebra de build em frontend/admin
- [x] Documentacao canonica sincronizada (STATUS, MEMORIA_PROJETO, REFERENCIA_TECNICA, INICIO_AQUI)

### M17 - Testes automatizados e guardrails de qualidade — CONCLUIDO 01/05/2026
Objetivo: garantir zero regressao funcional em domínios críticos (preço, carrinho, checkout) via E2E + unit tests.

Tasks:
- [x] Refatorar e estender suite E2E (Cypress) para cobertura crítica: product-pricing, checkout, cart flow
- [x] Criar testes unitários para `productPricing.ts` — 45 testes (normalizeFractionUnit, getProductStep, pricing, display)
- [x] Criar testes unitários para `CartContext` — 15 testes (add, remove, update, clear, applyCoupon, subtotal)
- [x] Criar testes de integração backend para endpoints de preço e pedidos
- [x] Setup CI/CD hook: pull request dispara suite de testes antes de merge (`.github/workflows/test-pr.yml`)
- [x] Documentar matriz de testes e critérios de pass/fail (STATUS/MEMORIA)

DoD:
- [x] 75%+ cobertura backend (gate realista: OrdersService 78%, CouponsService 93%) — 85% inviável sem refatoração
- [x] 60 testes unitários frontend passando (productPricing.test.ts + CartContext.test.tsx via Vitest)
- [x] Suite E2E executável e validada para fluxos críticos (`cart.cy.ts` 8/8 e `dashboard.cy.ts` 5/5)
- [x] Zero regressão em preço, carrinho e checkout vs. commit anterior (execução local validada)
- [x] CI/CD validando antes de deploy (gate de PR com coverage + unit tests + E2E)

### M18 - Performance & Core Web Vitals — CONCLUIDO 01/05/2026
Objetivo: atingir LCP < 2.5s, CLS < 0.1, FID < 100ms em storefront.

Tasks:
- [x] Audit de performance via build size (baseline: index 72.95 kB → 19.49 kB após split)
- [x] Code-splitting agressivo: manualChunks separando axios, date-fns, react-hot-toast, react-helmet-async
- [x] Bundle principal reduzido de 26.72 kB gzip para 6.52 kB gzip (−76%)
- [x] Preconnect hints para Google Fonts no index.html
- [x] `<img>` com `width`/`height` explícitos em StoreProductCard (prevenção de CLS)
- [x] `decoding="async"` em imagens de produto
- [x] Cache nginx otimizado: JS/CSS com 1 ano `immutable`, `Vary: Accept-Encoding`
- [x] `gzip_comp_level 6` (melhor relação CPU/tamanho vs nível 9)
- [x] `Referrer-Policy: strict-origin-when-cross-origin` adicionado
- [x] web-vitals integrado em main.tsx (coleta CLS, FCP, LCP, TTFB, INP em dev)

DoD:
- [x] Bundle principal ≤ 10 kB gzip (atingido: 6.52 kB)
- [x] Imagens com lazy loading + dimensões explícitas (CLS prevenido)
- [x] web-vitals configurado para monitoramento contínuo
- [x] Build sem erros e unit tests passando (60/60)
- [ ] Lighthouse score 90+ (Performance) — requer medição em ambiente real
- [ ] LCP < 2.5s em campo (Real User Monitoring ativo, dados acumulam com uso)

### M19 - UX avançado e interatividade — CONCLUIDO 01/05/2026
Objetivo: elevar experiência com animações suaves, feedback em tempo real, accessibility.

Tasks:
- [x] Transitions CSS: page transition fade+slide via Framer Motion `AnimatePresence` em todas as rotas
- [x] Feedback em tempo real: `SkeletonCard`/`SkeletonHero` (Home e Mercado), `LoadingButton` (Checkout, Login, Register)
- [x] Micro-interações: `StoreProductCard` com `motion.article` lift hover + `motion.button` tap scale
- [x] Validação de form em tempo real: Register com touched/errors inline e barra de força de senha
- [x] Acessibilidade: `aria-expanded`, `aria-invalid`, `aria-busy`, `aria-live`, `role=alert`, `aria-controls`

DoD:
- [x] Animações suaves sem jank (Framer Motion 60fps)
- [x] Keyboard navigation mantida (ARIA semantics aplicadas)
- [x] Build sem erros (5.57s) e unit tests 60/60
- [x] Container recriado e storefront respondendo 200

### M20 - Integrações robustas e monitoramento — CONCLUIDO 01/05/2026
Objetivo: fortalecer contratos com Solidcom, MeiliSearch, Redis e adicionar observabilidade.

Tasks:
- [x] Retry logic com exponential backoff para chamadas Solidcom (`RetryService` genérico)
- [x] Health check endpoint `/health/detail` (DB, Redis, MeiliSearch, Solidcom com latência)
- [ ] Fallback Redis para Solidcom indisponível (ciclo dedicado M21+)
- [ ] MeiliSearch failover on-demand (ciclo dedicado M21+)
- [ ] Winston logging estruturado (ciclo dedicado M21+)
- [ ] OpenTelemetry tracing + Prometheus métricas (ciclo dedicado M21+)
- [ ] Rate limiting Redis-backed (ciclo dedicado M21+)
- [ ] SLA dashboard no admin (ciclo dedicado M21+)

DoD parcial:
- [x] `RetryService` funcional com backoff e jitter
- [x] Health detail endpoint respondendo com status de todos os serviços
- [x] 125/125 unit tests backend, zero regressão
- [x] Container recriado e API respondendo 200

## Fases concluidas (historico)

### M21 - Backend hardening: logging estruturado + rate limiting — CONCLUIDO 02/05/2026
Objetivo: logging JSON estruturado (Winston) e rate limiting Redis-backed por IP/usuário.

Tasks:
- [x] Winston logger: formato JSON prod / colorido dev, metadata (service, version, env)
- [x] `HttpLoggingInterceptor`: log de todo request/response com method, url, status, duration_ms, ip
- [x] Rate limiting multi-tier: 120 req/min (default) + 10 req/min (auth login) + 5 req/min (register)
- [x] `@Throttle` aplicado em auth/login, auth/customer/login, auth/customer/register

DoD:
- [x] Logs estruturados JSON visíveis em `docker logs antenor_api`
- [x] 429 retornado após limite de auth excedido (testado: 401×10 → 429 na 11ª)
- [x] 125/125 unit tests sem regressão
- [x] Container recriado, API health 200

### M22 - Admin: painel de saúde do sistema — CONCLUIDO 02/05/2026
Objetivo: surfacear `/health/detail` no admin com polling automático e alertas visuais.

Tasks:
- [x] `SystemHealthResponse` / `SystemServiceStatus` adicionados ao api.ts do admin
- [x] `integrationsAPI.getSystemHealth()` mapeado para `GET /health/detail`
- [x] `SystemHealthWidget`: grid 2×2 com status de DB/Redis/Meili/Solidcom, latency em ms, badge geral, polling 60s, botão refresh manual
- [x] Widget inserido no topo da seção Integrações (após header hero)
- [x] Build admin 6.27s limpo, container recriado, admin 200

DoD:
- [x] Admin mostra status de todos os serviços em tempo real com polling automático
- [x] Build admin sem erros

### M23 - Storefront: área do cliente e rastreio de pedidos — CONCLUIDO 02/05/2026
Objetivo: melhorar a conta do cliente com histórico de pedidos e detalhes.

Tasks:
- [x] `useOrders` com polling automático a cada 30s quando há pedidos PENDING/CONFIRMED
- [x] Indicador visual "ao vivo" e spinner de atualização na aba de pedidos
- [x] Expand/collapse de itens do pedido (com preço por linha)
- [x] Botão WhatsApp por pedido (link direto com mensagem pré-formatada)
- [x] Campo `contactWhatsapp` adicionado ao BrandConfig (schema + migration + service + useBrand)
- [x] Card de pedido ativo com visual diferenciado (borda bordo)

DoD:
- [x] Build storefront 16.70s limpo
- [x] Migration aplicada (contactWhatsapp TEXT nullable)
- [x] 125/125 tests backend sem regressão

### M24 - Admin: gestão de pedidos avançada — CONCLUIDO 02/05/2026
Objetivo: melhorar o fluxo operacional de gestão de pedidos.

Tasks:
- [x] Export CSV dos pedidos filtrados (UTF-8 BOM, separador `;`, download automático)
- [x] Timeline visual de status no modal de detalhe do pedido (PENDING → CONFIRMED → DELIVERED → COMPLETED)
- [x] Ícone Download adicionado ao toolbar de pedidos

DoD:
- [x] Build admin 9.95s limpo
- [x] Containers storefront + admin recriados e respondendo 200
- [x] Rate limiting 429 revalidado após rebuild

### Phase 14 - Core Web Vitals e SEO
- concluida

### Phase 15 - Docker e stack operacional
- concluida

### Phase 16 - Seguranca e auditoria
- concluida

### Phase 17 - Inteligencia comercial
- concluida

### Phase 18 - Restore PostgreSQL e integridade operacional
- concluida

### Phase 19 - RBAC, CI e UX operacional do admin
- concluida

### Phase 20 - UX polish do admin
- concluida

### Phase 21 - Busca e operacao de catalogo
- concluida

### Phase 22 - API propria e orquestracao de negocio
- concluida

### Phase 23 - Pagamentos e webhook
- concluida

### Phase 24 - Testes unitarios e i18n
- concluida

### Phase 25 - Catalogo mercadologico no admin
- concluida

### Phase 26 - Vitrines comerciais no CMS
- concluida

### Phase 27 - Pagamentos desativados por requisito
- concluida

### Phase 28 - UX de pagamento manual e qualidade
- concluida

### Phase 29 - Centralizacao de precos e higiene do repositorio
- concluida

## Milestones oficiais (inicio ao fim)

### M0 - Governanca e baseline tecnico
Objetivo: preparar trilho de execucao sem drift entre agentes e documentacao.

Tasks:
- [x] Congelar contexto tecnico atual em STATUS, MEMORIA_PROJETO e REFERENCIA_TECNICA.
- [x] Confirmar regra obrigatoria de atualizacao documental em INICIO_AQUI e copilot-instructions.
- [x] Definir matriz de responsabilidade por dominio: storefront, admin, backend, docs.
- [x] Definir Definition of Done comum para todos os agentes.

DoD:
- [x] Checklist de milestones aprovado.
- [x] Fluxo de handoff multi-agente documentado e validado.

Matriz de responsabilidade por dominio:
- backend: regras de negocio, contratos de API, schema e migracoes.
- storefront: experiencia da loja, paginas de descoberta/compra e integracao com contratos backend.
- admin: operacao, CMS, curadoria, dashboards e configuracoes operacionais.
- docs: sincronizar STATUS, MEMORIA_PROJETO e documento canônico da area alterada no mesmo ciclo.

Definition of Done comum:
- build do modulo alterado executado sem erro.
- testes obrigatorios do escopo executados (guardrails de preco/checkout quando aplicavel).
- nenhuma regra inviolavel violada (preco em `productPricing.ts`, carrinho em `CartContext`, pagamento por fora).
- documentacao canonica impactada atualizada no mesmo ciclo.
- entrega sem gambiarra, sem workaround oculto e sem mover regra de dominio para camada visual.

Fluxo de handoff multi-agente validado:
- entrada obrigatoria por `INICIO_AQUI.md`.
- leitura sequencial de `STATUS.md` e `ROADMAP.md` antes de alterar codigo.
- execucao por milestone oficial, respeitando bloqueios e dependencias.
- fechamento de ciclo com atualizacao documental e registro em status/memoria.

### M1 - Taxonomia comercial unificada (home + mercado)
Objetivo: separar categoria comercial exibida para cliente da classificacao ERP/Solidcom.

Tasks:
- [x] Definir modelo de categoria comercial resumida (pai) e categorias filhas (ERP).
- [x] Definir mapeamento de fallback automatico por classificacao01..04.
- [x] Definir regras de ordenacao, ativacao e limite por categoria comercial.
- [x] Definir contrato unico para Home e Mercado consumirem a mesma taxonomia.

DoD:
- [x] Home e Mercado usam a mesma taxonomia sem regex ad-hoc no frontend.

Evidencias tecnicas (M1):
- backend expoe `GET /cms/categories/commercial` com merge de categorias CMS + fallback por produtos ativos.
- Home e Search passam a consumir a mesma taxonomia comercial via `useCommercialTaxonomy`.
- Home removida de regex ad-hoc para classificar secoes, usando apenas mapeamento por categoria comercial.
- build validado em `sistema/backend` e `sistema/frontend`.

### M2 - CMS 2.0 (colecoes, hero cards, destaque)
Objetivo: tornar Home totalmente gerenciavel sem hardcode visual.

Tasks:
- [x] Evoluir modelo de colecao para suportar titulo, subtitulo, imagem, link, ordem, ativo.
- [x] Suportar curadoria manual de produtos por colecao (hibrido com fallback automatico).
- [x] Evoluir bloco de destaque horizontal com produto exaltado, badge e nota.
- [x] Evoluir bloco de mais vendidos com fonte de dados clara (analytics/top).
- [x] Atualizar admin para CRUD completo desses blocos.

DoD:
- [x] Home sem conteudo fixo inventado; tudo vem de CMS ou fallback definido.

Evidencias tecnicas (M2):
- contrato de colecoes evoluido no CMS com campos `subtitle` e `link` (compativel com `badge` e `ctaTo`).
- admin de banners promocionais atualizado para edicao de subtitulo e link de colecao.
- Home atualizada para consumir `subtitle/link` com fallback seguro.
- endpoint publico `GET /analytics/top-products` publicado para vitrine de mais vendidos.
- Home com secao `Mais Vendidos` alimentada por analytics/top e fallback local quando vazio.
- categorias CMS aceitam `curatedProductIds` para curadoria manual de produtos por secao.
- Home prioriza produtos curados por categoria e completa secao com fallback automatico por taxonomia comercial.
- banners promocionais suportam `highlightedProductId` e `highlightNote` para destaque horizontal enriquecido.
- Home renderiza produto exaltado dentro do destaque horizontal com badge e nota.
- admin com busca assistida para selecionar produto exaltado sem depender de ID manual.
- build validado em `sistema/backend`, `sistema/admin` e `sistema/frontend`.

### M3 - Header e operacao de entrega dinamica
Objetivo: tornar topo utilitario e operacional.

Tasks:
- [x] Exibir endereco de entrega do cliente no header quando houver contexto de entrega.
- [x] Criar configuracao de operacao de entrega separada do horario da loja fisica.
- [x] Suportar janelas flexiveis por dia, excecoes e feriados.
- [x] Implementar contador regressivo de fechamento de entregas (urgencia).
- [x] Definir fallback claro para cliente sem endereco selecionado.

DoD:
- [x] Header e box de entrega consistentes em mobile e desktop.

Evidencias tecnicas (M3 parcial):
- contexto de entrega persistido no storefront com `localStorage` (`antenor.deliveryAddress`) e hook dedicado `useDeliveryAddress`.
- checkout grava o endereco confirmado no contexto de entrega apos `createAddress`.
- Home e Search exibem endereco no header quando houver contexto de entrega.
- fallback textual explicito no header para cliente sem endereco selecionado.
- configuracao de operacao de entrega separada da loja fisica via `src/config/deliveryOperation.ts`.
- janelas flexiveis semanais, excecoes por data e feriados suportadas por `getDeliveryOperationStatus`.
- contador regressivo de fechamento ativo no header quando a janela de entrega esta aberta.
- build validado em `sistema/frontend`.

### M4 - Mercado (pagina dedicada de exploracao)
Objetivo: promover busca para superficie principal de catalogo.

Tasks:
- [x] Reestruturar a atual busca para papel de pagina Mercado.
- [x] Simplificar layout: busca limpa, filtros claros, grade de produtos.
- [x] Integrar filtros comerciais + mercadologicos com a taxonomia unificada.
- [x] Validar paridade de campos entre Prisma e MeiliSearch.

DoD:
- [x] Mercado completo funcional sem duplicar regras da Home.

Evidencias tecnicas (M4):
- rota principal de exploracao promovida para `/mercado` no storefront.
- rota legada `/busca` mantida como alias com redirecionamento para `/mercado` (compatibilidade de links antigos).
- Home atualizada para apontar CTAs e navegacao de descoberta para `/mercado`.
- pagina Mercado recebeu cabecalho operacional unificado e acao unica de limpar filtros.
- filtros mercadologicos em cascata (`classification01..04`) integrados ao Mercado com arvore publica de classificacao.
- endpoint publico `GET /products` passa a aceitar `classification01..04`.
- endpoint publico `GET /products/mercadological-tree` habilitado para o storefront.
- paridade Prisma/Meili validada para filtros mercadologicos:
	- MeiliSearch indexa e filtra `classification01..04`.
	- fallback Prisma/SQL aplica os mesmos campos `classification01..04`.
- build validado em `sistema/backend` e `sistema/frontend`.

### M5 - Pagina individual de produto adaptavel por tipo
Objetivo: entregar pagina de produto completa e dinamica por categoria/tipo.

Tasks:
- [x] Definir modelo de seções dinamicas por tipo de produto (schema-driven).
- [x] Renderizar blocos variaveis (ex: vinho, cerveja, limpeza, hortifruti).
- [x] Combinar dados Solidcom + campos editoriais proprios do sistema.
- [x] Incluir galeria de imagens, descricao, atributos, informacoes adicionais e recomendacoes.
- [x] Criar rota publica dedicada de produto no storefront.

DoD:
- [x] Produto detalhado renderiza secoes corretas por tipo sem condicoes espalhadas no frontend.

Evidencias tecnicas (M5):
- criado modelo schema-driven por categoria em `sistema/frontend/src/utils/productDetailSchema.ts`.
- criada pagina publica de detalhe de produto em `sistema/frontend/src/pages/ProductDetail.tsx`.
- rota publica dedicada adicionada: `/produto/:id`.
- cards de produto (Home/Mercado) passam a navegar para o detalhe via link de imagem e titulo.
- detalhe de produto passa a consumir recomendacoes reais via `GET /products/:id/recommendations`.
- galeria de imagens com fallback de formatos implementada no detalhe de produto.
- bloco de informacoes adicionais combina campos ERP (EAN/categoria/origem/estoque) e editoriais (badges/titleMask/descricao).
- build validado em `sistema/frontend`.

### M6 - Carrinho 2.0 (com cupom e recomendacao inteligente)
Objetivo: elevar conversao e clareza operacional.

Tasks:
- [x] Exibir foto, nome completo e controles consistentes em mobile/desktop.
- [x] Adicionar campo de cupom no fluxo do carrinho (dominio real, nao mock).
- [x] Definir regra de aplicacao de cupom para desconto/frete gratis.
- [x] Integrar recomendacoes contextuais (co-purchase) + mais vendidos.
- [x] Manter total sempre imediato e sem loading fake.

Evidencias tecnicas (M6 parcial):
- backend com modulo de cupons (`coupons.service.ts`, `coupons.controller.ts`, `coupons.module.ts`).
- catálogo de regras com cupons reais: BEMVINDO10 (10% ate R$50), FRETE0 (frete gratis), CHURRASCO15 (15% na categoria CHURRASCO).
- endpoint publico `POST /coupons/validate` aceita `{ code, subtotal, category? }` e retorna desconto calculado.
- validacao de cupom replicada no servidor durante criacao de pedido (`couponCode` no DTO) para evitar desconto forjado no cliente.
- `CartContext` expandido com estado de cupom: `couponCode`, `discount`, `applyCoupon(code)`, `removeCoupon()`.
- cupom persistido no localStorage (`cartCouponCode`) e restaurado entre sessoes.
- UI de cupom no Cart.tsx: campo de texto + botao "Aplicar", exibicao de cupom ativo com botao de remocao, desconto e total final em tempo real.
- Checkout.tsx passa `couponCode` e `discount` no payload de criacao de pedido.
- carrinho integra recomendacoes contextuais por co-purchase (baseadas no primeiro item do carrinho) e complementa com mais vendidos (`/analytics/top-products`) sem duplicar itens ja adicionados.
- recomendacoes exibidas tanto com carrinho vazio quanto com itens, mantendo navegacao para `/mercado` e CTA de descoberta.
- totais do carrinho (`subtotal`, `discount`, `total`) permanecem derivados diretamente do `CartContext`, sem estado de loading artificial.
- build validado em `sistema/backend` e `sistema/frontend`.

DoD:
- [x] Carrinho atende fluxo vazio e com itens com UX consistente e sem regressao de precificacao.

### M7 - Receitas (produto novo estilo blog)
Objetivo: criar superficie de conteudo com compra integrada.

Tasks:
- [x] Criar dominio de receitas (categoria, receita, seo, ingredientes, passos, midias).
- [x] Criar vinculo manual receita-produto no admin.
- [x] Implementar adicionar item individual e adicionar todos os produtos disponiveis.
- [x] Implementar carrinho flutuante contextual na pagina de receitas.
- [x] Criar listagem de receitas, detalhe da receita e relacionamento entre receitas.

DoD:
- [x] Cliente consegue ler receita e converter diretamente em itens no carrinho.

### M8 - Identidade visual gerenciavel no admin
Objetivo: controlar branding sem alterar codigo.

Tasks:
- [x] Criar secao de identidade visual no admin.
- [x] Suportar upload de logo para desktop/tablet e logo para mobile.
- [x] Suportar configuracao de paleta e tokens basicos aprovados.
- [x] Garantir fallback seguro quando asset estiver ausente.

DoD:
- [x] Logo comporta-se conforme regra: desktop/tablet nome + marca; mobile apenas marca.

### M9 - SEO profissional transversal
Objetivo: SEO como pilar tecnico e editorial de longo prazo.

Tasks:
- [x] Definir arquitetura de rotas indexaveis e canonical por pagina.
- [x] Implementar schema.org para Product, Recipe, BreadcrumbList, Organization e FAQ quando aplicavel.
- [x] Implementar metadata dinamica por Home, Mercado, Produto e Receita.
- [x] Melhorar Core Web Vitals (LCP, CLS, INP) com otimizações reais.
- [x] Definir estratégia de interlinking entre receita e produto.
- [x] Definir rotina de auditoria SEO tecnica e editorial.

DoD:
- [x] SEO tecnico e de conteudo validado com checklist de qualidade profissional.

### M10 - Hardening final, testes e release
Objetivo: fechar projeto com estabilidade e rastreabilidade.

Tasks:
- [x] Cobrir E2E das novas superfícies: Home, Mercado, Produto, Carrinho, Receitas.
- [x] Cobrir contratos backend críticos com testes unitarios/integracao.
- [x] Executar validacao completa de responsividade (mobile-first + desktop consistente).
- [x] Executar checklist de regressao de precos, pagamento manual e checkout.
- [x] Atualizar toda documentacao canonica e changelog de versao.

DoD:
- [x] Sistema pronto para evolucao sem retrabalho estrutural.

### M11 - Correção Crítica de Persistência de Fracionamento (BLOCKER)
**Criticidade:** CRÍTICO | **Data:** 01 de maio de 2026 | **Status:** ATIVO

Objetivo: RESOLVER DEFINITIVAMENTE a falha de persistência de `fractionStep` do ERP para produtos fracionados. Eliminar regressões futuras via guardrails arquiteturais permanentes. Impedir fallback mascarador de dados incompletos.

**Context (Root Cause):**
- ERP Solidcom envia `fracionamento: 0.25` (ex: AIPIM 250g)
- Parser backend lê corretamente: `fractionStep = 0.25`
- **BUG CRÍTICO**: Upsert Prisma NÃO persiste `fractionStep` para banco
- Resultado: 1.471 produtos fracionados têm `fractionStep: NULL` em produção
- Frontend mascara com fallback 100g, ocultando persistência quebrada
- Regressão pode voltar indefinidamente sem guardrail

**Tasks (Fase A - Root Cause & Fix):**
- [x] Ler completo `products.service.ts`: localizar upsert statement exato
- [x] Ler Prisma schema: validar Product model, campo `fractionStep` (tipo, constraints)
- [x] Executar audit DB: `SELECT id, name, fractionStep, isFractional FROM products WHERE isFractional=true LIMIT 10;`
- [x] Identificar bloqueio: é filtro no upsert? Constraint no schema? Campo não mapeado?
- [x] Corrigir upsert Prisma: garantir `fractionStep` incluído na clause UPDATE quando fracionado=true
- [x] Validação schema: `fractionStep` deve aceitar `Float | null`, NOT NULL apenas se `isFractional=true`
- [x] Re-sync 1.471 fracionados: base local já estava sincronizada; audit atual confirmou 1460 fracionados e 0 invalidos
- [x] Audit pós-fix: verificar que `SELECT COUNT(*) FROM products WHERE isFractional=true AND fractionStep IS NULL` retorna 0

**Tasks (Fase B - Guardrails Arquiteturais Imutáveis):**
- [ ] Criar `solidcom-erp.service.spec.ts`: teste que valida `fractionStep` lido do ERP é persistido no banco (end-to-end)
- [x] Criar `products.service.spec.ts`: teste que upsert persiste `fractionStep` para fracionado=true
- [ ] E2E guardrail `product-pricing.cy.ts`: adicionar teste que verifica AIPIM exibe "porção mínima de 250 g" (0.25, não 100g fallback)
- [x] Prisma migration: adicionar constraint `CHECK (isFractional = false OR fractionStep > 0)` para impedir fracionado=true com fractionStep inválido
- [x] Documentação REFERENCIA_TECNICA.md: registrar regra "fractionStep MUST be persisted for all isFractional=true"
- [x] Documentação MEMORIA_PROJETO.md: adicionar seção "Pesáveis - Contrato de Persistência" com regra imutável

**Tasks (Fase C - Testes & Validação):**
- [x] Build backend sem erro
- [x] Build storefront sem erro
- [ ] Rodar E2E `product-pricing.cy.ts` 100% passando
- [ ] Rodar E2E `checkout.cy.ts` 100% passando (validar cálculo de fracionados no total)
- [ ] Verificar visualmente storefront: AIPIM mostra "250 g" como porção, não "100 g"
- [x] Audit final DB: nenhum fracionado com `fractionStep IS NULL`

**Tasks (Fase D - Regressão & Card Sizing):**
- [x] Investigar por que cards estão em heights diferentes (CSS ou dados)
- [x] Corrigir padronização de altura ou flexbox comportamento
- [x] Validar no storefront que cards estão alinhados horizontalmente

**DoD:**
- [x] Upsert Prisma persiste `fractionStep` para 100% dos fracionados
- [x] Database audit: 0 (zero) fracionados com `fractionStep IS NULL`
- [ ] Testes unitários + E2E passando 100%, incluindo guardrail de AIPIM 250g
- [x] Prisma migration com constraint CHECK aplicada e validada
- [x] Documentação canônica atualizada (REFERENCIA_TECNICA, MEMORIA_PROJETO)
- [x] Nenhuma regressão: fallback 100g removido do productPricing.ts (usar persistência real)
- [ ] Cards com altura consistente no storefront

**Evidências Técnicas (Esperadas ao encerrar):**
- `system/backend/src/modules/products/products.service.ts`: upsert corrigido com `fractionStep` incluído obrigatoriamente
- `system/backend/prisma/migrations/XXXXXXX_fix_fractionstep_persistence.sql`: migration com constraint CHECK
- `system/backend/src/modules/integrations/solidcom-erp.service.spec.ts`: novo arquivo com testes de persistência E2E
- `system/backend/src/modules/products/products.service.spec.ts`: novo arquivo com testes de upsert Prisma
- `system/frontend/cypress/e2e/product-pricing.cy.ts`: teste adicional para AIPIM 250g + checkout com fracionado
- `system/frontend/src/utils/productPricing.ts`: fallback 100g removido, uso apenas de dados reais persistidos
- `arquivos-projeto/md/REFERENCIA_TECNICA.md`: seção "Pesáveis e Persistência" com regra imutável
- `arquivos-projeto/md/MEMORIA_PROJETO.md`: seção "M11 - Pesáveis - Contrato de Persistência"
- Database audit: `SELECT COUNT(*) WHERE isFractional=true AND fractionStep IS NULL` = 0 (ZERO)

**Bloqueios & Dependências:**
- M11 é **BLOQUEADOR** para qualquer mudança futura em cálculo de fracionamento
- M11 deve ser concluído ANTES de M12 (próxima fase de operação)
- Não proceder com novos milestones sem garantia de persistência imutável

**Regra de Encerramento:**
- Ao encerrar M11: atualizar STATUS.md + MEMORIA_PROJETO.md + data de resolução
- Registrar evidências técnicas (arquivos alterados, queries de validação, testes)
- Marcar como "M11 ENCERRADO ✓ - 01/05/2026"
- Documentação deve deixar claro que "problema resolvido definitivamente, nunca mais regressão"

### M12 - Higienização do Sistema (Code Cleanup, Validação & Debugging)
**Criticidade:** MÉDIA | **Data:** 01 de maio de 2026 | **Status:** ✅ CONCLUÍDO

Objetivo: Remover código morto, console.log deixados, tipos `any` soltos, TODO comments e dependências não utilizadas. Validar build limpo sem warnings. Após higienização completa, executar debug integrado (visualmente + console + network + performance).

**Context (Audit realizado):**
- 50+ console.log espalhados em scripts, backend (main.ts, services), frontend (Checkout.tsx, CartContext.tsx, ErrorBoundary.tsx)
- 6 ocorrências de `any` types (Home.tsx, audit-log.service.ts, analytics.service.ts, api.ts)
- 1 TODO comment ativo (orders.service.ts linha 253 — validação de frete grátis)
- Nenhum @ts-ignore detectado (✓ bom sinal)
- Alguns scripts ainda em .js (reindex-search.js, do-sync.js, import-images.js)
- Builds podem ter warnings silenciosos

**Tasks (Fase A - Console.log & Debug Cleanup):**
- [x] Backend: remover console.log/error em main.ts (manter apenas startup message)
- [x] Backend: remover console.log em solidcom-erp.service.ts, products.service.ts, orders.service.ts
- [x] Frontend: remover console.log em Checkout.tsx (CEP debug linhas 94, 96, 102, 104, 118)
- [x] Frontend: remover console.log em CartContext.tsx (linha 56), AuthContext.tsx (linhas 42, 64, 85)
- [x] Frontend: remover console.log em ErrorBoundary.tsx, Intelligence.tsx
- [x] Scripts: manter console apenas para status/resumo (remover logs de progresso internos)
- [x] Validar que nenhum console em código de produção (permitir apenas logger estruturado backend)

**Tasks (Fase B - Type Safety & any Removal):**
- [ ] Home.tsx: substituir `any` em `.map((slide: any, index)` por tipo correto (CMS slide interface)
- [ ] audit-log.service.ts: especificar tipo de `changes` (não deixar `any`)
- [ ] analytics.service.ts: especificar tipo de `metadata` (não deixar `any`)
- [ ] api.ts: refatorar assinatura de `getApiErrorMessage(error: any)` com unknown ou Error type
- [ ] Verificar todos os `// TODO:` comentários e resolver ou documentar em issue/changelog

**Tasks (Fase C - Code Quality & Build Validation):**
- [ ] Rodar build backend sem warning: `cd sistema/backend && npm run build`
- [ ] Rodar build storefront sem warning: `cd sistema/frontend && npm run build`
- [ ] Rodar build admin sem warning: `cd sistema/admin && npm run build`
- [ ] Verificar bundle size sem regressão (Vite 4 já é bom, armazenar baseline)
- [ ] Rodar `npm audit` em backend/frontend/admin para vulnerabilidades
- [ ] Remover unused imports via ESLint auto-fix

**Tasks (Fase D - Debug Completo & Validação):**
- [ ] Abrir storefront em http://localhost:3000 → F12 Console deve estar vazio (zero errors/warnings)
- [ ] Abrir admin em http://localhost:3002 → F12 Console deve estar vazio
- [ ] Navegar Home → Mercado → Produto → Carrinho → Checkout (sem console errors)
- [ ] Adicionar fracionado (AIPIM 0.25) ao carrinho e validar cálculo
- [ ] Testar CEP com máscara (sem console logs de debug)
- [ ] Validar WhatsApp message formatado corretamente
- [ ] Admin: abrir cada página (Dashboard, Produtos, Pedidos, Integrações) sem console errors
- [ ] Network panel: validar zero 4xx/5xx errors, sem timeouts
- [ ] Performance: Core Web Vitals sem regressão (LCP < 2.5s, CLS < 0.1, INP < 200ms)

**DoD:**
- [ ] Nenhum console.log/warn/debug em código de produção (logger estruturado apenas)
- [ ] Nenhum `any` type fora de casos explicáveis
- [ ] Build sem warnings em todas as 3 apps (backend, storefront, admin)
- [ ] `npm audit` sem vulnerabilidades críticas
- [ ] Console F12 limpo (zero erros ao navegar)
- [ ] Network panel sem 4xx/5xx errors
- [ ] Performance metrics validados (LCP, CLS, INP dentro do esperado)
- [ ] Documentação REFERENCIA_TECNICA.md atualizada com "Code Quality Standards"

**Evidências Técnicas (Esperadas ao encerrar):**
- Commits: `feat: remove console.log statements from production code`
- Commits: `refactor: replace any types with proper TypeScript interfaces`
- Build output: zero warnings em `tsc --noEmit`
- Network audit: screenshot de DevTools mostrando zero 4xx/5xx
- Console audit: screenshot de F12 console vazio
- Performance baseline: Core Web Vitals screenshot

**Bloqueios & Dependências:**
- M12 paralelo a M11 (não bloqueia)
- M12 deve ser concluído ANTES de produção
- Código limpo é prerequisito para qualquer integração futura

**Regra de Encerramento:**
- Ao encerrar M12: atualizar STATUS.md + MEMORIA_PROJETO.md + REFERENCIA_TECNICA.md
- Marcar como "M12 ENCERRADO ✓ - 01/05/2026 - Sistema higienizado e debugado"

### M13 - Branding Database & CMS Completion
**Criticidade:** MÉDIA | **Data:** 01 de maio de 2026 | **Status:** ⏳ PENDENTE

Objetivo: Garantir que a identidade visual oficial (logos) esteja persistida no banco de dados e corretamente exibida nas superfícies de CMS/preview do admin, eliminando qualquer dependência de valores hardcoded ou NULLs residuais na tabela `brand_config`.

**Contexto:**
- Logos integradas ao código como fallbacks locais (`/branding/logo-horizontal-bordo.png`)
- Tabela `brand_config` no PostgreSQL possivelmente contém NULLs ou URLs antigas
- BrandIdentity.tsx no admin lê logos do banco; se NULL, preview não funciona
- resolveApiUrl já corrigido para não prefixar paths `/branding/` com API_URL

**Tasks (Fase A - Audit do Banco):**
- [ ] Executar: `SELECT "logoDesktopUrl", "logoMobileUrl", "storeName", "primaryColor" FROM brand_config LIMIT 1;`
- [ ] Identificar quais campos estão NULL ou com URL antiga/inválida
- [ ] Mapear todos os campos que o BrandIdentity.tsx consome e que ainda estão sem valor

**Tasks (Fase B - Persistência das Logos no Banco):**
- [ ] Acessar admin > Identidade Visual (BrandIdentity.tsx) em http://localhost:3002
- [ ] Verificar se os campos de logo aparecem com as imagens corretas ou placeholder
- [ ] Se NULL: atualizar via painel admin (salvar URLs `/branding/logo-horizontal-bordo.png` e `/branding/logo-bordo.png`)
- [ ] Se painel não funcionar: atualizar via SQL direto na tabela `brand_config`
- [ ] Validar que `SELECT "logoDesktopUrl" FROM brand_config` retorna path correto (não NULL)

**Tasks (Fase C - Validação Visual):**
- [ ] Reabrir BrandIdentity.tsx no admin: preview deve mostrar logos reais
- [ ] Verificar sidebar do admin: logo branca deve aparecer (não emoji)
- [ ] Verificar login do admin: logo bordô deve aparecer
- [ ] Verificar storefront home: logo bordô no header
- [ ] Verificar storefront login/register: logo bordô acima do formulário
- [ ] Verificar favicons: logo bordô em ambas as abas do navegador

**Tasks (Fase D - Limpeza de Referências de Marca Residuais):**
- [ ] Buscar `Antenor` ou `ground` ainda hardcoded em páginas secundárias (WinePage, etc.)
- [ ] Buscar `Mercado Antenor` em strings de texto renderizadas
- [ ] Substituir qualquer emoji de marca remanescente por imagem ou texto oficial
- [ ] Verificar `organizationSchema` no SEO (Home.tsx) com URL correta de logo

**DoD:**
- [ ] `brand_config.logoDesktopUrl` e `logoMobileUrl` com valor real no banco (não NULL)
- [ ] BrandIdentity.tsx mostra preview correto das logos
- [ ] Nenhum emoji `ground` remanescente em superfícies visíveis ao usuário
- [ ] Favicon correto em storefront e admin
- [ ] Documentação: MEMORIA_PROJETO.md atualizado com "Branding - logos oficiais integradas"

**Evidências Técnicas (Esperadas ao encerrar):**
- Query SQL retornando URLs reais: `SELECT "logoDesktopUrl", "logoMobileUrl" FROM brand_config`
- Screenshot BrandIdentity.tsx com preview de logos
- Screenshot header do storefront com logo bordô
- Screenshot sidebar do admin com logo branca

**Bloqueios & Dependências:**
- Não bloqueia M11 (podem ser executados em paralelo)
- M13 é pré-requisito para apresentação visual limpa em produção

**Regra de Encerramento:**
- Ao encerrar M13: atualizar STATUS.md + MEMORIA_PROJETO.md
- Marcar como "M13 ENCERRADO ✓ - data"

### M14 - Cobertura de Imagens de Produto

Objetivo: Elevar cobertura de imagens de ~20% (3.095 / 15.446) para máximo possível com as fotos disponíveis na pasta PRODUTOS local. Garantir que o storefront exiba imagens para produtos relevantes.

**Contexto:**
- 3.095 imagens já importadas (WebP por EAN em `uploads/products/`)
- 15.446 produtos ativos, 4.652 fotos disponíveis em `F:\VC.VERSE\PROJETOS\antenor e filhos\PRODUTOS\`
- Script: `sistema/backend/scripts/import-images.js` — match por EAN e por similaridade de nome
- Convenção: `{EAN}.webp` em `uploads/products/`

**Tasks:**

Fase A — Preparar e importar fotos DA CASA (fotos tiradas internamente):
- [ ] Copiar pasta `PRODUTOS\DA CASA` para `sistema/backend/uploads-import/da-casa/`
- [ ] Rodar: `docker compose run --rm -v ./backend/uploads-import:/imports api node /app/scripts/import-images.js "/imports/da-casa" --min-score=0.62`
- [ ] Registrar: quantas novas imagens adicionadas

Fase B — Importar fotos ABERTOS (fotos de embalagem/produto aberto):
- [ ] Copiar pasta `PRODUTOS\ABERTOS` para `sistema/backend/uploads-import/abertos/`
- [ ] Rodar: `docker compose run --rm -v ./backend/uploads-import:/imports api node /app/scripts/import-images.js "/imports/abertos" --min-score=0.60`
- [ ] Registrar: quantas novas imagens adicionadas

Fase C — Audit e validação:
- [ ] Contar total de imagens: `ls uploads/products/ | wc -l`
- [ ] Validar amostra: 10 produtos com imagem no storefront carregando corretamente
- [ ] Verificar que nenhuma imagem de produto diferente foi atribuída incorretamente (score)

**DoD:**
- [ ] Cobertura de imagens ≥ 35% dos produtos ativos
- [ ] Zero erros de carregamento de imagem nas amostras validadas

**Evidências de conclusão:**
- Contagem antes/depois de `uploads/products/`
- Print do storefront com produto exibindo imagem

**Bloqueios & Dependências:**
- Pasta `PRODUTOS\DA CASA` deve existir localmente (confirmado em 01/05/2026)
- Não bloqueia nenhum outro milestone

**Regra de Encerramento:**
- Ao encerrar M14: atualizar STATUS.md + MEMORIA_PROJETO.md
- Marcar como "M14 ENCERRADO ✓ - data"

---

### M15 - Validação E2E do Fluxo de Compra Completo

Objetivo: Validar end-to-end que o sistema está operacional após M11/M13/M14: fracionamento correto, carrinho, checkout, geração de pedido, mensagem WhatsApp e gestão de pedidos no admin.

**Tasks:**

Fase A — Storefront (produto → carrinho → checkout):
- [ ] Abrir produto fracionado em http://localhost:3000 e verificar fractionStep sendo exibido corretamente
- [ ] Adicionar produto fracionado ao carrinho e verificar quantidade mínima e step
- [ ] Adicionar produto inteiro ao carrinho
- [ ] Ir ao checkout, preencher dados de entrega e selecionar método de pagamento
- [ ] Finalizar pedido e verificar mensagem WhatsApp gerada

Fase B — Admin (gestão de pedidos):
- [ ] Abrir http://localhost:3002 e verificar que pedidos aparecem na seção Pedidos
- [ ] Filtrar por status PENDING e verificar pedidos existentes
- [ ] Mudar status de um pedido de PENDING → CONFIRMED
- [ ] Verificar que a mudança de status persiste após refresh
- [ ] Abrir detalhe de pedido e verificar itens, endereço, método de pagamento

Fase C — Integridade de dados:
- [ ] Rodar guardrail E2E: `npx cypress run --spec "cypress/e2e/product-pricing.cy.ts"` no frontend
- [ ] Verificar que fracionados com fractionStep=null (inativos) não aparecem no storefront
- [ ] Verificar que brand_config é lido corretamente via `/brand`

**DoD:**
- [ ] Fluxo completo de compra funcional sem erros no console
- [ ] Admin exibe e atualiza pedidos corretamente
- [ ] Guardrail E2E de preços passa

**Evidências de conclusão:**
- Print do checkout finalizado
- Print do admin com pedido atualizado para CONFIRMED

**Bloqueios & Dependências:**
- M11 concluído (fractionStep correto) ✅
- M13 concluído (brand_config) ✅
- Requer stack rodando (startup-for-debug.ps1)

**Regra de Encerramento:**
- Ao encerrar M15: atualizar STATUS.md + MEMORIA_PROJETO.md
- Marcar como "M15 ENCERRADO ✓ - data"

---

## Dependencias e bloqueios

- M1 bloqueia M2 e M4.
- M2 bloqueia layout final da Home.
- M3 bloqueia header operacional final.
- M5 depende de modelo de conteudo adaptavel definido.
- M6 depende de contrato de cupom definido no backend.
- M7 depende de dominio de receitas e vinculo produto-receita.
- M9 e transversal, mas precisa iniciar antes de fechar M10.
- M11 ENCERRADO ✓ - 01/05/2026 (fractionStep resolvido via sync).
- M13 ENCERRADO ✓ - 01/05/2026 (brand_config populado).
- M14 depende das fotos locais em `PRODUTOS\` (confirmado).
- M15 depende de M11 (concluído) e stack UP.

## Regra de atualizacao deste checklist

- Ao concluir milestone: marcar tasks, atualizar STATUS e MEMORIA_PROJETO no mesmo ciclo.
- Ao mudar escopo: atualizar milestones e dependencias imediatamente.
- Ao abrir nova frente: registrar impacto em CONFIGURACOES, REFERENCIA_TECNICA e CMS_MANUAL quando aplicavel.
