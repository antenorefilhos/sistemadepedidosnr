# REFERENCIA_TECNICA.md - Stack e Superficies Reais

Data: 6 de junho de 2026
Versao de referencia: 1.24.138-alpha

## Stack atual

- backend: NestJS 10, TypeScript, Prisma 5.22.0, PostgreSQL 15, Redis 7
- storefront: React 18, TypeScript, Vite 4, Tailwind CSS, React Query, react-helmet-async
- admin: React 18, TypeScript, Vite 4, Tailwind CSS, React Query, ApexCharts
- infraestrutura: Docker Compose, Nginx Alpine, volumes persistentes, rede antenor_network e MeiliSearch

## Storefront Receitas / Seed Editorial Staging

- Script: `cd sistema/backend && npm run seed:staging-recipes`.
- Gate: `cd sistema/backend && npm run validate:staging-recipes`.
- Banco staging host: `postgresql://postgres:antenor_staging_2026@localhost:5433/antenor_staging?schema=public`.
- Categorias publicadas pelo seed: `jantar-pratico`, `churrasco-completo`, `lanches-e-praticos` e `adega-e-harmonizacao`.
- Receitas publicadas pelo seed: `picadinho-de-acem-da-casa`, `churrasco-de-familia-antenor`, `noite-de-pizza-crocante`, `lanche-quente-da-padaria` e `tabua-de-vinhos-e-snacks`.
- Capas finais usam WebP locais do storefront em `/recipes/*.webp`.
- Assets finais:
  - `/recipes/picadinho-de-acem-da-casa.webp`
  - `/recipes/churrasco-de-familia-antenor.webp`
  - `/recipes/noite-de-pizza-crocante.webp`
  - `/recipes/lanche-quente-da-padaria.webp`
  - `/recipes/tabua-de-vinhos-e-snacks.webp`
- Originais gerados com `imagegen`: `C:\Users\eojon\.codex\generated_images\019e63db-307e-7a81-801a-27810f3c2dd0`.
- Cada receita deve sair do seed com `imageUrl` e 2 receitas relacionadas.
- Invariante: o seed deve falhar quando um produto obrigatorio nao existir ativo no staging, em vez de criar receita com link quebrado.
- Invariante: o gate deve falhar se categoria/receita esperada estiver ausente/inativa, se `imageUrl` nao for o esperado por slug, se apontar para arquivo inexistente em `frontend/public`, se contagens editoriais mudarem ou se produto/relacionada estiver inativo.

## M33 Web Push / Prova Externa

### Snapshot operacional de 6 de junho de 2026

- `.env.staging` local existe, esta ignorado pelo Git e possui VAPID persistente aplicado ao backend e ao build do storefront.
- SHA-256 da chave publica VAPID configurada: `731b17e98595efdc448c045fdc67f34f13405500f982cdd90f3f0308565b54e0`.
- `api_staging` e `storefront_staging` foram reconstruidos com o arquivo; API health e storefront responderam corretamente.
- `npm run validate:web-push-readiness -- --live --env-file .env.staging` passou contra `http://localhost:4000`.
- O banco staging possui `total=0 complete=0 incomplete=0` subscriptions; portanto ainda nao existe alvo para envio real.
- No navegador interno, o cliente QA abriu o sino, mas a UI retornou `Permissão bloqueada no navegador.` e nenhuma subscription foi criada.
- `npm run validate:web-push-readiness -- --external --live --env-file .env.staging` falha de forma limpa porque a origem local nao usa HTTPS e e localhost. Essa falha e esperada ate existir uma origem publicada.
- Origem HTTPS externa usada depois: `https://jonathan.tailf56692.ts.net` via Tailscale Funnel para `storefront_staging`.
- `npm run validate:web-push-readiness -- --external --live --env-file .env.staging`: OK contra a origem externa.
- Subscription real registrada por Chrome/Cypress: `total=1 complete=1 incomplete=0`.
- Pacote com envio real: `sistema/artifacts/web-push-homologation/20260606T080939Z`, com `sent=1 failed=0`.
- Helper Chrome/CDP: `cd sistema && npm run register:web-push-cdp-chrome -- --env-file .env.staging --origin https://jonathan.tailf56692.ts.net`.
- Pacote final candidato com Chrome/CDP: `sistema/artifacts/web-push-homologation/20260606T085300Z-final`, com `total=6 complete=6`, dry-run `targets=1 failed=0` e envio `sent=1 failed=0`.
- Pacote final homologado: `sistema/artifacts/web-push-homologation/20260606T085300Z-final`, com `web-push-visual-confirmation.json`, `web-push-windows-notification-history.json`, relatório e manifesto SHA-256 verificado.
- Confirmação visual: histórico de notificações do Windows contém payload XML do toast Chrome com `Antenor Filhos`, `Prova Web Push visual final`, `jonathan.tailf56692.ts.net` e `displayTimestamp=2026-06-06T08:29:47Z`.
- Pendencia restante: nenhuma para homologação externa Web Push.

- Gerar VAPID: `cd sistema && npm run generate:web-push-vapid -- --subject mailto:admin@antenor.com.br`.
- Gerar VAPID para `.env.staging`: `cd sistema && npm run generate:web-push-vapid -- --staging --env --subject mailto:admin@antenor.com.br`.
- Preparar env completo local: `cd sistema && npm run prepare:web-push-env -- --output .env.web-push --staging --force`.
- Preparar env completo HTTPS: `cd sistema && npm run prepare:web-push-env -- --output .env.staging --staging --origin https://loja.example.com --admin-origin https://admin.example.com --subject mailto:admin@antenor.com.br`.
- Preparar env completo com banco: adicionar `--database-url "postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"`.
- Preparar env usando VAPID existente: adicionar `--vapid-public-key CHAVE_PUBLICA --vapid-private-key CHAVE_PRIVADA`.
- Preparar env reutilizando VAPID de arquivo/env sem passar segredo por argumento: adicionar `--vapid-from-env --env-file .env.staging`.
- Atualizar `.env.staging` preservando outras variaveis: adicionar `--merge-existing`.
- Gate de tooling Web Push: `cd sistema && npm run validate:web-push-tooling`.
- Staging via helper: `cd sistema && .\staging-ops.ps1 up` carrega `.env.staging` automaticamente quando o arquivo existir.
- Staging via Compose direto com `.env.staging`: `cd sistema && docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build`.
- Preflight de configuracao: `cd sistema && npm run validate:web-push-readiness -- --external`.
- Preflight de origem publicada: `cd sistema && npm run validate:web-push-readiness -- --external --live`.
- Preflight de origem publicada com override: `cd sistema && npm run validate:web-push-readiness -- --external --live --env-file .env.staging --origin https://loja.example.com`.
- Preflight com evidencia JSON: `cd sistema && npm run validate:web-push-readiness -- --external --live --env-file .env.staging --json-output artifacts/web-push-homologation/ID_DA_PROVA/web-push-readiness.json`.
- Preflight com arquivo especifico: `cd sistema && npm run validate:web-push-readiness -- --external --live --env-file .env.web-push`.
- Cypress de inscrição: `cd sistema/frontend && npx cypress run --spec cypress/e2e/web-push-subscribe.cy.ts --config baseUrl=http://127.0.0.1:5174` com dev server iniciado usando `VITE_VAPID_PUBLIC_KEY`.
- Inspecao de subscriptions: `cd sistema && npm run inspect:web-push-subscriptions -- --env-file .env.staging`.
- Inspecao de subscriptions com origem explicita: `cd sistema && npm run inspect:web-push-subscriptions -- --env-file .env.staging --origin https://loja.example.com`.
- Prova real: `cd sistema && npm run prove:web-push-delivery -- --env-file .env.staging`.
- Homologacao orquestrada sem envio real: `cd sistema && npm run homologate:web-push -- --external --live --env-file .env.staging`.
- Homologacao orquestrada com envio real: `cd sistema && npm run homologate:web-push -- --external --live --env-file .env.staging --send`.
- Homologacao integrada com envio, evidencias automaticas, validação e relatorio: `cd sistema && npm run homologate:web-push -- --external --live --env-file .env.staging --evidence-dir-auto --require-empty-evidence-dir --send --validate-evidence --report`.
- Homologacao integrada com origem explicita: adicionar `--origin https://loja.example.com`.
- Homologacao com pacote de evidencias automatico, sem validar/relatar no mesmo comando: `cd sistema && npm run homologate:web-push -- --external --live --env-file .env.staging --evidence-dir-auto --require-empty-evidence-dir --send`.
- Validar pacote de evidencias seco: `cd sistema && npm run validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation`.
- Validar pacote de evidencias com envio real: `cd sistema && npm run validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation --require-send`.
- Registrar confirmacao visual apos receber a notificacao e finalizar o pacote: `cd sistema && npm run confirm:web-push-visual -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA --confirmed-by "NOME" --device "DISPOSITIVO" --browser "NAVEGADOR/PWA" --origin https://loja.example.com --note "Notificacao recebida visualmente." --finalize`.
- Validar pacote final com preflight, envio e confirmacao visual: `cd sistema && npm run validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA --require-readiness --require-send --require-visual-confirmation`.
- Finalizar pacote final com validacao obrigatoria, relatorio, manifesto SHA-256 e verificação automática de integridade: `cd sistema && npm run finalize:web-push-homologation -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA`.
- Verificar novamente a integridade do manifesto final, se o pacote for auditado ou enviado depois: `cd sistema && npm run verify:web-push-evidence-manifest -- --evidence-dir artifacts/web-push-homologation/ID_DA_PROVA`.
- Regra do pacote final: `web-push-readiness.json`, `web-push-inspect.json`, `web-push-dry-run.json`, `web-push-send.json` e `web-push-visual-confirmation.json` devem registrar a mesma origem.
- Regra de alvo: o envio real deve usar os mesmos `subscriptionId`, `customerId` e `tenantId` validados no dry-run, e o dry-run deve estar presente como subscription completa na inspeção.
- Regra de cronologia: os timestamps devem seguir readiness -> inspeção -> dry-run -> envio real -> confirmação visual.
- Regra de manifesto: `finalize:web-push-homologation` deve gerar `web-push-evidence-manifest.json` com hashes SHA-256 e tamanho dos artefatos finais; `verify:web-push-evidence-manifest` deve passar antes de aceitar o pacote como íntegro.
- Gerar relatorio de homologacao: `cd sistema && npm run report:web-push-homologation -- --evidence-dir artifacts/web-push-homologation --require-send`.
- Evidencia avulsa de inspeção: adicionar `--json-output artifacts/web-push-homologation/web-push-inspect.json`.
- Evidencia avulsa de prova/dry-run: adicionar `--json-output artifacts/web-push-homologation/web-push-send.json`.
- Runbook externo: `arquivos-projeto/md/02 - Contexto/RUNBOOK_WEB_PUSH.md`.
- Entrada no storefront: cliente logado abre o sino de notificacoes e aciona "Ativar notificações" no bloco "Avisos no navegador".
- Variaveis obrigatorias da prova: `DATABASE_URL`, `WEB_PUSH_ORIGIN`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` ou `STAGING_VAPID_PUBLIC_KEY`/`STAGING_VAPID_PRIVATE_KEY`, e `VAPID_SUBJECT`/`STAGING_VAPID_SUBJECT`.
- Filtros da prova: `--customer-id`, `--customer-email`, `--endpoint-contains`, `--limit`.
- Filtro adicional da prova: `--tenant`.
- Limpeza opcional da prova: `--cleanup-expired` remove 404/410 do provider; `--cleanup-incomplete` remove registros sem `endpoint`, `auth` ou `p256dh`.
- Dry-run da prova: `--dry-run` valida filtros, alvo e payload sem enviar Web Push nem executar limpezas.
- Payload da prova: `--title`, `--body`, `--icon`, `--url`.
- Filtros da inspecao: `--customer-id`, `--customer-email`, `--endpoint-contains`, `--tenant`, `--limit`.
- Gate da inspecao: `--require-ready` falha quando nao existe subscription completa para envio.
- Invariante: a prova so deve ser considerada concluida quando `validate:web-push-readiness -- --external --live` passar contra o dominio publicado, `web-push-readiness.json` estiver no pacote com `modes.external=true` e `modes.live=true`, `web-push-inspect.json` registrar a mesma origem operacional, existir subscription real em `push_subscriptions` inspecionada nessa origem HTTPS nao-local, dry-run e envio real apontarem para o mesmo alvo, o script retornar `sent>=1` sem falhas, `web-push-visual-confirmation.json` confirmar recebimento visual na mesma origem e depois do envio real, `confirm:web-push-visual -- --finalize` ou `finalize:web-push-homologation` passar contra a pasta de evidencias gerando relatório e manifesto, e `verify:web-push-evidence-manifest` confirmar a integridade dos artefatos.

## Wiki Obsidian / Validação de Links

- Script: `node scripts/validate-obsidian-links.js`.
- Comando raiz: `npm run validate:obsidian-links`.
- Escopo padrão: arquivos operacionais em `arquivos-projeto/md`, ignorando `06 - Sessões` para preservar transcrições históricas brutas.
- Auditoria rígida opcional: `node scripts/validate-obsidian-links.js --include-sessions`.
- Invariante: o comando padrão deve retornar `Obsidian links OK.` antes de marcar a organização da wiki como concluída.

## Seguranca / LGPD / Governanca

- Entidade M17:
  - `DataSubjectRequest`: solicitacao LGPD por tenant/store/customer, tipo, status, solicitante, payload, resultado e execucao.
- Endpoints admin:
  - `POST /api/data-privacy/customers/:customerId/consents`
  - `GET /api/data-privacy/customers/:customerId/export`
  - `POST /api/data-privacy/customers/:customerId/anonymize`
  - `GET /api/data-privacy/retention-policy`
  - `GET /api/data-privacy/requests`
- Consentimentos formais:
  - `TERMS`, `PRIVACY`, `WHATSAPP`, `EMAIL`, `SMS`.
- Regras:
  - exportacao LGPD cria `DataSubjectRequest` concluida e audit log.
  - anonimizacao bloqueia cliente com pedido ativo, salvo override operacional `force=true`.
  - anonimizar revoga consentimentos e remove PII de cliente/endereco/perfil, preservando rastreabilidade operacional/fiscal em pedidos.
  - alteracoes LGPD sensiveis devem chamar `AuditLogService.log` com tenant/store/actor.
- Persistencia:
  - Migration `20260530010000_add_lgpd_governance_foundation`.
  - Script de validacao: `cd sistema/backend && npm run lgpd:validate-foundation`.

## Personalizacao / Recomendacao

- Entidade M16:
  - `RecommendationEvent`: ledger de recomendacao por tenant/store, cliente/sessao/dispositivo, contexto, origem, evento, produto recomendado, score, pedido/carrinho e conversao.
- Endpoints:
  - `GET /api/recommendations/rebuy?customerId=:customerId`
  - `GET /api/recommendations/complementary/:productId`
  - `GET /api/recommendations/substitutes/:productId`
  - `GET /api/recommendations/showcase?segmentKey=:key`
  - `POST /api/recommendations/events`
  - `GET /api/recommendations/operational-insights`
- Fontes de sinal:
  - historico de `Order`/`OrderItem` para recompra, cesta complementar e vitrine por segmento.
  - `ProductSubstitution`/`ProductMaster` para substitutos configurados.
  - `AnalyticsEvent` e `RecommendationEvent` para BI de conversao.
  - `OrderEvent` de substituicao/falta para taxa de aceitacao operacional.
- Invariantes:
  - produto inativo, `syncOption=NUNCA` ou sem estoque quando dependente de estoque nao deve ser recomendado.
  - substituto precisa respeitar categoria/classificacao, faixa de preco e disponibilidade.
  - add-to-cart/compra de recomendacao deve gravar `convertedAt` e evento BI `RECOMMENDATION_*`.
- Persistencia:
  - Migration `20260527003000_add_recommendation_intelligence_foundation`.
  - Script de validacao: `cd sistema/backend && npm run recommendations:validate-foundation`.

## Marketplace / Multicanal

- Entidades M15:
  - `SalesChannel`: canal por tenant/store/tipo/provedor, com status e config JSON.
  - `ChannelProduct`: mapeamento produto interno -> produto/SKU externo por canal.
  - `MarketplaceOrder`: pedido externo recebido, payload bruto, status, pedido OMS vinculado e falha.
  - `ChannelPricePolicy`: politica de preco por canal, markup, margem minima e arredondamento.
  - `ChannelStockPolicy`: politica de estoque por canal, buffer, modo de estoque e oversell.
- Canais previstos:
  - `STOREFRONT`, `IFOOD`, `RAPPI`, `MERCADO_LIVRE`, `WHATSAPP` e B2B futuro.
- Endpoints:
  - `POST /api/marketplace/channels`
  - `GET /api/marketplace/channels`
  - `POST /api/marketplace/channels/:channelId/products`
  - `POST /api/marketplace/channels/:channelId/price-policy`
  - `POST /api/marketplace/channels/:channelId/stock-policy`
  - `POST /api/marketplace/channels/:channelId/orders`
  - `GET /api/marketplace/panel`
- Invariantes:
  - pedido externo deve entrar no mesmo `OrdersService`/OMS.
  - idempotencia usa `marketplace:{channelId}:{externalId}`.
  - SKU externo deve mapear para produto interno via `ChannelProduct`, salvo quando o payload ja enviar `productId`.
  - venda externa reaproveita reserva/consumo de estoque do pedido existente.
  - painel deve mostrar falhas por canal e margem estimada por canal.
- Persistencia:
  - Migration `20260526233000_add_marketplace_multichannel_foundation`.
  - Script de validacao: `cd sistema/backend && npm run marketplace:validate-foundation`.

## Observabilidade / SRE / Performance

- Request context M14:
  - `RequestContextMiddleware` gera/propaga `x-request-id`, `x-correlation-id` e `x-order-trace-id`.
  - logs HTTP incluem `request_id`, `correlation_id`, `order_trace_id`, `tenant_id`, `store_id`, metodo, URL, status, duracao, IP e user agent.
- Metricas M14:
  - `MetricsRegistry` calcula p95 por endpoint, taxa de 5xx e taxa de 4xx critico em janela recente.
  - `GET /api/observability/metrics/prometheus` expõe formato Prometheus.
  - `GET /api/observability/metrics` consolida HTTP, fila, jobs, pedidos sem sync, webhooks, reservas expiradas e pagamentos pendentes acima do SLA.
- Health checks:
  - `GET /api/health/detail` cobre DB, Redis, MeiliSearch, ERP/Solidcom, gateway de pagamento, fila/outbox e storage/uploads.
- Alertas e status:
  - `POST /api/observability/alerts/check` avalia 5xx, checkout error rate, fila acumulada, integracao falhando, pedido sem sync, pagamento pendente, webhooks falhos e reservas expiradas.
  - `GET /api/observability/status-page` retorna status interno consolidado.
  - `GET /api/observability/runbooks` lista runbooks operacionais iniciais.
- Performance targets de referencia da auditoria:
  - busca p95 menor que 250 ms.
  - `GET /products` p95 menor que 300 ms.
  - checkout quote p95 menor que 800 ms.
  - criacao de pedido p95 menor que 1200 ms sem gateway externo.
  - admin pedidos p95 menor que 500 ms.
- Persistencia:
  - M14 nao adicionou migration; usa metricas em memoria, outbox/jobs/webhooks/reservas/pagamentos existentes e logs JSON.
  - Script de validacao: `cd sistema/backend && npm run observability:validate-foundation`.

## BI operacional / Analytics

- Entidades M13:
  - `AnalyticsEvent`: evento padronizado por tenant/store, tipo, entidade, canal, origem, sessao, cliente, dispositivo e metadata.
  - `MetricSnapshot`: snapshot por periodo, dashboard, metrica, dimensao, canal, produto, categoria, valor, unidade e metadata.
- Dashboards cobertos:
  - executivo, funil, operacional, catalogo, ruptura, picking, integracoes, CRM e pagamentos.
- Metricas iniciais:
  - GMV, pedidos, ticket medio, receita por loja/canal/categoria, margem estimada.
  - sessoes, busca, PDP view, add to cart, checkout iniciado/concluido, abandono e busca sem resultado.
  - ruptura por produto/categoria, itens cortados, substituicoes aceitas/rejeitadas.
  - atraso/SLA e produtividade de picking.
  - falhas de integracao, DLQ aberta, clientes inativos/churn, LTV e falhas de pagamento.
- Endpoints admin:
  - `POST /api/analytics/admin/metric-snapshots/generate`
  - `GET /api/analytics/admin/operational-dashboard`
  - `GET /api/analytics/admin/drilldown`
- Invariantes:
  - gestor deve conseguir ver venda perdida por ruptura.
  - operador deve conseguir ver tarefa/pedido atrasado.
  - tecnico deve conseguir ver integracao falhando.
  - marketing deve conseguir ver clientes inativos e risco de churn.
  - drill-down deve aceitar loja, categoria, produto, canal, metrica e dimensao.
- Persistencia:
  - Migration `20260526223000_add_bi_operational_analytics_foundation`.
  - Script de validacao: `cd sistema/backend && npm run bi:validate-foundation`.

## Integracoes resilientes / Outbox / DLQ

- Entidades M10:
  - `IntegrationConnector`: conector por tenant/store/tipo/provedor, com status e config JSON.
  - `OutboxEvent`: mensagem idempotente por agregado, payload, status, tentativas, `nextRetryAt`, lock e erro.
  - `IntegrationJob`: execucao gerada pelo worker para um evento.
  - `IntegrationAttempt`: historico de cada tentativa com request/response, erro e duracao.
  - `IntegrationDeadLetter`: DLQ para mensagens que excederam retry, com replay manual.
- Serviço principal:
  - `IntegrationOutboxService` (`sistema/backend/src/modules/integrations/integration-outbox.service.ts`).
  - usa Postgres como fila equivalente inicial, com retry/backoff e replay, sem depender de BullMQ para a fundacao.
- APIs admin:
  - `GET /api/integrations/operations/panel`
  - `GET /api/integrations/connectors`
  - `POST /api/integrations/connectors`
  - `GET /api/integrations/outbox/events`
  - `POST /api/integrations/outbox/events`
  - `POST /api/integrations/outbox/events/:eventId/replay`
  - `POST /api/integrations/outbox/worker/run`
  - `GET /api/integrations/jobs`
  - `GET /api/integrations/dead-letters`
  - `POST /api/integrations/dead-letters/:deadLetterId/replay`
- Solidcom:
  - falhas de pedido e cancelamento passam a gravar payload e erro em `OutboxEvent`, preservando reprocessamento se o ERP cair.
- Invariantes:
  - mensagem duplicada com mesma idempotency key nao cria novo evento.
  - evento com falhas sucessivas vai para DLQ ao exceder `maxAttempts`.
  - replay manual cria novo evento rastreavel.
- Persistencia:
  - Migration `20260526193000_add_integration_outbox_foundation`.
  - Script de validacao: `cd sistema/backend && npm run integrations:validate-outbox`.

## API publica v1 / Webhooks externos

- Entidades M11:
  - `ApiClient`: cliente externo por tenant/store, `clientId`, hash de segredo, scopes, status, rate limit e ultimo uso.
  - `WebhookEndpoint`: URL, segredo, eventos inscritos e status.
  - `WebhookDelivery`: entrega persistida com payload, status, tentativas, erro, proximo retry e entrega.
  - `ApiUsageLog`: trilha de uso da API publica por cliente, rota, metodo, scope, decisao e erro.
- Autenticacao:
  - `PublicApiKeyGuard` aceita `x-api-key` ou `Authorization: Bearer`.
  - formato da chave: `clientId.secret`.
  - o segredo bruto so e retornado na criacao; persistencia guarda hash SHA-256.
  - scopes por rota: `orders.read`, `products.read`, `stock.read` ou wildcard `*`.
- Endpoints publicos versionados:
  - `GET /v1/orders`
  - `GET /v1/orders/:id`
  - `GET /v1/products`
  - `GET /v1/stock?productIds=...`
- Endpoints admin do portal:
  - `GET /api/integrations/public-api/clients`
  - `POST /api/integrations/public-api/clients`
  - `GET /api/integrations/public-api/webhook-endpoints`
  - `POST /api/integrations/public-api/webhook-endpoints`
  - `POST /api/integrations/public-api/webhook-events`
  - `GET /api/integrations/public-api/webhook-deliveries`
  - `POST /api/integrations/public-api/webhook-deliveries/run`
  - `POST /api/integrations/public-api/webhook-deliveries/:deliveryId/replay`
- Eventos emitidos:
  - `order.created`
  - `order.status_changed`
  - `stock.changed`
  - `payment.updated`
- Webhook:
  - payload e envelope persistidos em `webhook_deliveries`.
  - assinatura HMAC SHA-256 no header `x-antenor-signature`.
  - headers auxiliares: `x-antenor-event` e `x-antenor-delivery`.
  - retry com backoff e status `DEAD` ao exceder `maxAttempts`.
- Persistencia:
  - Migration `20260526203000_add_public_api_webhooks_foundation`.
  - Script de validacao: `cd sistema/backend && npm run public-api:validate-foundation`.

## CRM / Fidelidade / Retencao

- Entidades M12:
  - `CustomerProfile`: perfil CRM, preferencias, tags, LTV, quantidade de pedidos, ticket medio, ultima compra e risco de churn.
  - `CustomerConsent`: consentimento por canal (`EMAIL`, `SMS`, `WHATSAPP`, `PUSH`, etc.) com status `OPT_IN`, `OPT_OUT` ou `REVOKED`.
  - `CustomerSegment` e `CustomerSegmentMember`: segmentos automaticos e membros calculados.
  - `LoyaltyAccount` e `LoyaltyLedger`: saldo de pontos/cashback, tier e extrato auditavel com saldo resultante.
  - `Campaign` e `CampaignDelivery`: campanhas transacionais/promocionais com entregas geradas somente para clientes com consentimento.
  - `ShoppingList` e `ShoppingListItem`: listas de compra e recompra baseada em pedido anterior.
- Endpoints principais:
  - `GET /crm/customers/:customerId/relationship`
  - `POST /crm/customers/:customerId/profile`
  - `POST /crm/customers/:customerId/consents`
  - `POST /crm/segments/refresh`
  - `GET /crm/customers/:customerId/loyalty`
  - `POST /crm/customers/:customerId/loyalty/credit`
  - `POST /crm/customers/:customerId/loyalty/redeem`
  - `POST /crm/campaigns`
  - `POST /crm/campaigns/:campaignId/dispatch`
  - `POST /crm/customers/:customerId/shopping-lists`
  - `POST /crm/customers/:customerId/shopping-lists/from-order`
  - `GET /crm/customers/:customerId/reorder/:orderId`
- Invariantes:
  - campanha promocional nao cria delivery para cliente sem `OPT_IN` no canal.
  - resgate de pontos/cashback nao pode deixar saldo negativo.
  - todo movimento de fidelidade grava `LoyaltyLedger` com delta e saldo resultante.
  - recompra usa itens reais de pedido anterior e cria lista editavel.
- Persistencia:
  - Migration `20260526213000_add_crm_loyalty_foundation`.
  - Script de validacao: `cd sistema/backend && npm run crm:validate-foundation`.

## Fundacao SaaS / Tenant / Store / RBAC

- Tenant/store default para legado:
  - `tenant_default`
  - `store_default`
- Contexto HTTP:
  - `TenantContextMiddleware` resolve por `x-tenant-id`/`x-store-id`, headers internos equivalentes, subdominio ou fallback default.
  - `TenantAccessGuard` exige tenant resolvido em rotas privadas; em producao, fallback default sem tenant de sessao pode ser bloqueado.
  - JWT de admin e cliente inclui `tenantId` e `storeId`.
- Decorators disponiveis:
  - `@CurrentTenant()`
  - `@CurrentStore()`
  - `@RequirePermission()`
- RBAC:
  - `PermissionGuard` valida permissoes vindas do token ou de `user_store_access -> role_permissions -> permissions`.
  - Permissoes iniciais incluem `orders.*`, `picking.*`, `catalog.*`, `pricing.*`, `inventory.*`, `promotions.*`, `customers.*`, `crm.write`, `integrations.*`, `settings.write`, `reports.read`, `users.manage`, `audit.read`.
- Persistencia:
  - Migration `20260526100000_add_tenant_store_rbac_foundation`.
  - Script de validacao: `cd sistema/backend && npm run tenant:validate-backfill`.
- Servicos ja escopados nesta base:
  - pedidos: listagem, leitura, criacao, antifraude e idempotencia por tenant/store.
  - produtos: listagem publica/admin, leitura e edicao com tenant/store quando contexto existe.
  - edicao principal de produto exige `pricing.write`.

## Catalogo Top-Tier / Produto Mestre / Qualidade

- Produto legado continua existindo como superficie de compatibilidade com ERP, storefront e admin atual.
- Produto mestre novo:
  - `ProductMaster`: EAN, SKU, nome normalizado, marca, unidade, pacote, regras de pesavel, perecibilidade, idade minima e status.
  - `Brand`: marcas normalizadas por tenant.
  - `ProductMedia`: imagens/video com `type`, `url`, `alt`, `sortOrder` e `isPrimary`.
  - `ProductAttribute`: atributos chave/valor para busca e filtros futuros.
  - `ProductSubstitution`: substitutos priorizados para ruptura.
- Categorias de catalogo:
  - `CategoryNode`: arvore de catalogo por tenant/store, com vinculo legado opcional para `categories_cms`.
  - `ProductCategoryAssignment`: vinculo produto mestre -> categoria.
- Qualidade:
  - `CatalogQualityIssue` guarda fila de pendencias por tenant/store/produto/categoria.
  - Issues automaticas cobrem imagem ausente, categoria ausente, regra de pesavel incompleta, preco zero, estoque negativo, nome ruim, EAN duplicado e categoria incompativel.
- APIs admin:
  - `GET /api/admin/products`
  - `POST /api/admin/products`
  - `PATCH /api/admin/products/:id`
  - `POST /api/admin/products/:id/media`
  - `POST /api/admin/products/:id/substitutes`
  - `GET /api/admin/catalog/quality`
  - `GET /api/admin/catalog/issues`
  - `POST /api/admin/catalog/issues/:id/resolve`
  - `POST /api/admin/categories/rebuild-tree`
  - `POST /api/admin/search/reindex`
- API publica:
  - `GET /api/products/:id/substitutes`
- Busca:
  - indice Meili inclui `tenantId`, `storeId`, `productId`, `name`, `normalizedName`, categoria, preco, promocional, disponibilidade e sinais comerciais.
  - filtros de busca devem enviar tenant/store quando contexto existir.
- Persistencia:
  - Migration `20260526113000_add_catalog_top_tier_foundation`.
  - Script de validacao: `cd sistema/backend && npm run catalog:validate-foundation`.

## Estoque / Disponibilidade / Reserva

- Entidades de estoque:
  - `StockPosition`: posicao por tenant/store/produto com `onHand`, `reserved`, `available`, `safetyStock` e `source`.
  - `StockLedger`: historico auditavel de `SYNC`, `RESERVE`, `RELEASE`, `EXPIRE`, `SALE`, `MANUAL_ADJUST` e `PICK_ADJUST`.
  - `StockReservation`: reserva ativa/liberada/consumida/expirada por pedido ou carrinho.
  - `StockPolicy`: politica por produto/categoria/loja, incluindo backorder explicito e TTL de reserva.
  - `StockReconciliationRun`: relatorio de divergencia ERP x plataforma.
- Invariante obrigatorio:
  - `available = onHand - reserved - safetyStock`.
  - estoque negativo pode existir como estado auditavel, mas nunca deve virar disponibilidade positiva artificial.
- Pedido:
  - `OrdersService.create` cria reserva antes de persistir o pedido.
  - falha de reserva impede criacao do pedido.
  - `CONFIRMED` exige reserva ativa e consome reserva.
  - `CANCELLED` libera reservas ativas.
- Ruptura:
  - `POST /api/admin/stock/picking-ruptures` ajusta item do pedido, subtotal/total, posicao de estoque, reserva ativa, ledger e evento BI `RUPTURE`.
- APIs:
  - `GET /api/availability?storeId=&productIds=`
  - `POST /api/stock/reservations`
  - `POST /api/stock/reservations/:id/release`
  - `POST /api/admin/stock/adjustments`
  - `GET /api/admin/stock/negative`
  - `GET /api/admin/stock/reconciliation`
  - `POST /api/admin/stock/jobs/sync-from-erp`
  - `POST /api/admin/stock/jobs/recalculate-available`
  - `POST /api/admin/stock/jobs/expire-reservations`
- Persistencia:
  - Migration `20260526123000_add_inventory_reservations_foundation`.
  - Migration `20260526124500_fix_stock_available_formula`.
  - Script de validacao: `cd sistema/backend && npm run inventory:validate-foundation`.

## Pricing / Listas de Preco / Promocoes

- Entidades comerciais:
  - `PriceList`: lista por tenant, loja opcional, canal, segmento/cliente opcional e janela de validade.
  - `PriceListItem`: preco, custo, margem e validade por produto.
  - `Promotion`: campanha com tipo, prioridade, regra de empilhamento e validade.
  - `PromotionRule`: `condition` e `effect` em JSON para regras comerciais.
  - `Coupon`: codigo vinculado a promocao, com limite global e por cliente.
  - `PromotionUsage`: registro de uso por pedido/cliente.
  - `PriceAuditLog`: auditoria de criacao/alteracao de listas e itens.
- Checkout:
  - `OrdersService.create` usa `PricingService.quote`.
  - desconto/preco vindo do frontend nao define total final.
  - `priceSnapshot` guarda canal, frete original, promocoes aplicadas, margem estimada e origem de preco por item.
- Regras atuais do motor:
  - preco por loja/canal com fallback para preco legado.
  - cupom percentual/fixo.
  - frete gratis via efeito `FREE_SHIPPING`.
  - desconto progressivo basico via tiers.
  - conflito de promocoes por prioridade; promocao nao empilhavel bloqueia inferiores.
  - limite global e limite por cliente para cupom.
- APIs:
  - `POST /api/pricing/quote`
  - `GET /api/admin/price-lists`
  - `POST /api/admin/price-lists`
  - `POST /api/admin/price-lists/:id/items/bulk`
  - `GET /api/admin/promotions`
  - `POST /api/admin/promotions`
  - `POST /api/admin/promotions/:id/simulate`
  - `POST /api/coupons/validate`
  - `GET /api/coupons/validate` permanece como compatibilidade.
- Persistencia:
  - Migration `20260526133000_add_pricing_promotions_foundation`.
  - Script de validacao: `cd sistema/backend && npm run pricing:validate-foundation`.

## Checkout Operacional / Carrinho / Sessoes

- Entidades:
  - `Cart`: carrinho persistido por tenant/store, cliente opcional e deviceId.
  - `CartItem`: item com quantidade decimal, notas e `allowSubstitution`.
  - `CheckoutSession`: sessao idempotente com `priceSnapshot`, `deliverySnapshot`, `stockSnapshot`, `paymentSnapshot`, `orderId`, reserva de fulfillment slot e expiracao.
  - `CheckoutEvent`: trilha de `CART_CREATED`, `CART_ITEM_*`, `SESSION_*`, `ORDER_CREATED` e `CART_ABANDONED`.
- Contrato operacional:
  - storefront espelha carrinho local para `/cart` antes da finalizacao.
  - `POST /checkout/sessions/:id/quote` recalcula estoque, preco/promocao e entrega no backend.
  - `POST /checkout/sessions/:id/confirm` chama `OrdersService.create` com idempotencia derivada da sessao.
  - confirmacao bloqueia estoque insuficiente, endereco fora de area e ausencia de janela valida.
  - confirmacao tambem bloqueia slot cheio/cutoff e grava `fulfillmentType`, slot, area e snapshot logistico no pedido.
  - frontend nao envia total final; total/frete/desconto exibidos no checkout vem do quote server-side.
  - retries/refresh retornam pedido existente quando a sessao ja esta `COMPLETED`.
  - carrinhos antigos podem virar evento CRM/BI por `POST /api/admin/checkout/jobs/abandon-carts`.
- APIs:
  - `POST /api/cart`
  - `GET /api/cart/:id`
  - `POST /api/cart/:id/items`
  - `PATCH /api/cart/:id/items/:itemId`
  - `DELETE /api/cart/:id/items/:itemId`
  - `POST /api/checkout/sessions`
  - `POST /api/checkout/sessions/:id/quote`
  - `POST /api/checkout/sessions/:id/confirm`
  - `POST /api/checkout/sessions/:id/cancel`
  - `POST /api/admin/checkout/jobs/abandon-carts`
- Persistencia:
  - Migration `20260526143000_add_checkout_cart_contract`.
  - Script de validacao: `cd sistema/backend && npm run checkout:validate-foundation`.

## OMS / Pedidos por Evento e por Item

- Entidades:
  - `Order` inclui `channel`, `fulfillmentType`, snapshots comerciais/logisticos e totais de referencia/finais.
  - `Order` tambem guarda `deliveryAreaId`, `fulfillmentSlotId` e `fulfillmentSlotItemCount` para cancelamento e rastreio logistico.
  - `OrderItem` inclui quantidade pedida/final, preco/subtotal final, status operacional, politica de substituicao, vinculo de item substituto, motivo de corte e notas de separacao.
  - `OrderEvent` registra historico auditavel por tenant/store/pedido com `type`, `payload`, `actorType`, `actorId` e timestamp.
- Status macro suportados no admin:
  - `PENDING`, `PAYMENT_PENDING`, `CONFIRMED`, `PICKING_PENDING`, `PICKING`, `WAITING_CUSTOMER_SUBSTITUTION`, `CONFERENCE_PENDING`, `PACKING`, `READY_FOR_PICKUP`, `READY_FOR_DELIVERY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `COMPLETED`, `PARTIALLY_CANCELLED`, `CANCELLED`, `REFUNDED`, `FAILED_SYNC`.
- Eventos usados pela fundacao:
  - `order.created`, `order.updated`, `order.confirmed`, `order.cancelled`, `order.status_updated`, `order.item_cancelled`, `order.substitution_accepted`, `order.recalculated` e equivalentes por status macro.
- Invariantes:
  - toda mutacao operacional relevante deve gravar `OrderEvent`.
  - corte de item nao cancela automaticamente o pedido inteiro.
  - substituicao cria novo item, preserva o item original como `SUBSTITUTED` e vincula `substitutedByItemId`.
  - total final deve ser recalculado a partir de `finalSubtotal` dos itens ativos, ignorando itens `CANCELLED` e `SUBSTITUTED`.
- APIs admin:
  - `GET /api/admin/orders`
  - `GET /api/admin/orders/:id`
  - `POST /api/admin/orders/:id/events`
  - `POST /api/admin/orders/:id/cancel`
  - `POST /api/admin/orders/:id/items/:itemId/cancel`
  - `POST /api/admin/orders/:id/items/:itemId/substitute`
  - `POST /api/admin/orders/:id/recalculate`
- Persistencia:
  - Migration `20260526153000_add_order_oms_events_foundation`.
  - Script de validacao: `cd sistema/backend && npm run oms:validate-foundation`.

## Picking / Separacao / Conferencia / Embalagem

- Entidades:
  - `PickingBatch`: agrupamento futuro de tarefas por loja/separador.
  - `PickingTask`: tarefa operacional por pedido, com prioridade, SLA, separador, status, inicio e conclusao.
  - `PickingTaskItem`: item operacional vinculado ao item do pedido, com quantidade pedida, quantidade separada, peso final, barcode, status e notas.
  - `PackingChecklist`: checklist gerado na conferencia e concluido na embalagem.
  - `PickerPerformanceSnapshot`: produtividade por separador para fechamento operacional.
- Fluxo:
  - pedidos confirmados entram na fila por `POST /api/admin/picking/tasks` ou `/api/admin/picking/tasks/from-order/:orderId`.
  - atribuicao manual usa `POST /api/admin/picking/tasks/:id/assign`.
  - separador inicia em `POST /api/admin/picking/tasks/:id/start`.
  - item separado usa `POST /api/admin/picking/tasks/:id/items/:itemId/pick`; produto por peso exige `finalWeight`.
  - item faltante usa `POST /api/admin/picking/tasks/:id/items/:itemId/missing` e pode acionar substituicao.
  - substituicao usa `POST /api/admin/picking/tasks/:id/items/:itemId/substitute`.
  - finalizacao usa `POST /api/admin/picking/tasks/:id/finish` e move pedido para `CONFERENCE_PENDING`.
  - conferencia usa `POST /api/admin/picking/tasks/:id/conference`; divergencia sem justificativa e bloqueada.
  - embalagem usa `POST /api/admin/picking/tasks/:id/packing-checklist` e libera `READY_FOR_PICKUP` ou `READY_FOR_DELIVERY`.
- Eventos OMS:
  - `order.picking_task_created`
  - `order.picking_assigned`
  - `order.picking_started`
  - `order.item_picked`
  - `order.item_missing`
  - `order.substitution_accepted`
  - `order.picking_completed`
  - `order.conference_completed`
  - `order.packing_completed`
- APIs:
  - `GET /api/admin/picking/eligible-orders`
  - `GET /api/admin/picking/tasks`
  - `POST /api/admin/picking/tasks`
  - `POST /api/admin/picking/tasks/from-order/:orderId`
  - `GET /api/admin/picking/tasks/:id`
  - `POST /api/admin/picking/tasks/:id/assign`
  - `POST /api/admin/picking/tasks/:id/start`
  - `POST /api/admin/picking/tasks/:id/items/:itemId/pick`
  - `POST /api/admin/picking/tasks/:id/items/:itemId/missing`
  - `POST /api/admin/picking/tasks/:id/items/:itemId/substitute`
  - `POST /api/admin/picking/tasks/:id/finish`
  - `POST /api/admin/picking/tasks/:id/conference`
  - `POST /api/admin/picking/tasks/:id/packing-checklist`
  - `GET /api/admin/picking/performance`
- Admin:
  - nova secao `Separacao` no painel admin, com fila responsiva, operacao item a item e KPIs de produtividade.
- Persistencia:
  - Migration `20260526163000_add_picking_foundation`.
  - Script de validacao: `cd sistema/backend && npm run picking:validate-foundation`.

## Fulfillment / Entrega / Retirada / Logistica

- Entidades:
  - `DeliveryArea`: area server-side por tenant/store, tipo `CEP_RANGE` ou `POLYGON`, regra JSON, taxa, pedido minimo, frete gratis por area, prioridade e status.
  - `FulfillmentSlot`: janela de `DELIVERY` ou `PICKUP` com inicio/fim, capacidade por pedidos, capacidade opcional por itens, reservas, cutoff e status.
  - `Driver`: motorista por tenant/store.
  - `DeliveryRoute`: rota manual com motorista opcional, status, inicio e conclusao.
  - `DeliveryStop`: parada por pedido, sequencia, status, ETA e entrega.
  - `FulfillmentEvent`: trilha logistica por pedido/rota/parada.
- Regras:
  - frete e area sao calculados no backend; o frontend nao define taxa final.
  - `DeliveryArea` tem prioridade sobre `DeliveryZone`; `DeliveryZone` permanece como fallback legado.
  - checkout exige `FulfillmentSlot` valido para entrega e retirada.
  - slot cheio por pedidos ou itens bloqueia checkout.
  - cutoff expirado bloqueia checkout.
  - reserva de slot e feita durante quote persistente e liberada em cancelamento/falha.
  - pedido cancelado libera a capacidade do slot.
  - pedido `PICKUP` nao entra em rota de entrega e e enviado ao Solidcom com `retiraNaLoja=true`.
- Status/eventos:
  - saida de rota atualiza pedidos para `OUT_FOR_DELIVERY` e grava `order.out_for_delivery`.
  - parada entregue atualiza pedido para `DELIVERED` e grava `order.delivered`.
  - falha de parada grava `order.delivery_failed`.
  - eventos logisticos incluem `slot.reserved`, `slot.released`, `route.created`, `route.stop_added`, `route.out_for_delivery`, `stop.delivered` e `route.completed`.
- APIs publicas/admin:
  - `GET /api/delivery/calculate`
  - `GET /api/delivery/slots`
  - `GET /api/admin/fulfillment/areas`
  - `POST /api/admin/fulfillment/areas`
  - `PATCH /api/admin/fulfillment/areas/:id`
  - `DELETE /api/admin/fulfillment/areas/:id`
  - `GET /api/admin/fulfillment/slots`
  - `POST /api/admin/fulfillment/slots`
  - `PATCH /api/admin/fulfillment/slots/:id`
  - `DELETE /api/admin/fulfillment/slots/:id`
  - `GET /api/admin/fulfillment/drivers`
  - `POST /api/admin/fulfillment/drivers`
  - `GET /api/admin/fulfillment/routes`
  - `POST /api/admin/fulfillment/routes`
  - `POST /api/admin/fulfillment/routes/:id/stops`
  - `POST /api/admin/fulfillment/routes/:id/start`
  - `POST /api/admin/fulfillment/routes/:id/stops/:stopId/status`
  - `POST /api/admin/fulfillment/routes/:id/complete`
- Admin:
  - `Taxas de Entrega` mostra ocupacao de janelas, capacidade reservada/total, cutoff e criacao rapida de janela.
- Persistencia:
  - Migration `20260526173000_add_fulfillment_delivery_foundation`.
  - Script de validacao: `cd sistema/backend && npm run fulfillment:validate-foundation`.

## Diretriz visual atual (storefront e admin)

- linguagem visual prioriza legibilidade e consistencia operacional
- tipografia padrao: prioridade para `Google Sans Flex`, fallback em `Roboto` e familias sans-serif seguras
- glassmorphism nao e mais linguagem principal do produto
- bordas e cantos com raio moderado, evitando excesso de elementos pill
- elementos funcionalmente circulares (avatares, icones de acao circular, badges de contador com largura/altura iguais) permanecem circulares

## Utilitarios criticos do storefront

### sistema/frontend/src/utils/productPricing.ts ⭐ FONTE UNICA DE PRECO
- `getProductPricePresentation(product)` → objeto com currencySymbol, value, suffix, referenceText, fullLabel
- `getProductLineTotal(product, quantity)` → total em reais considerando fractionStep
- `formatProductQuantity(product, quantity)` → string amigavel ("1 kg", "300 g", "3 un")
- contrato de pesáveis (ERP): `fracionado` define se o item é pesável; `fracionamento` define step e preço exibido; `emb` define unidade de exibição; `txtfracionamento` é texto informativo
- sem inferência por nome/descrição para definir fracionamento
- `fractionStep` MUST estar persistido e ser maior que zero para todo produto `isFractional=true`
- fracionado sem `fractionStep` positivo é tratado como dado operacional incompleto: storefront nao inventa porcao de 100g, card fica indisponivel e backend rejeita adicao ao carrinho
- fallback operacional permitido apenas para unidade visual: item `fracionado=true` com `emb` inválido/codificado pode exibir unidade visual `kg`, mas nunca pode criar step/porcao sem dado persistido
- TODOS os componentes que exibem preco DEVEM usar este modulo. Nao calcular inline.

### sistema/frontend/src/utils/format.ts
- `formatPrice(value)` → "R$ 12,99"
- `formatPriceParts(value)` → `{ currencySymbol: "R$", value: "12,99" }`
- `formatProductTitle(title)` → normalizacao de titulo

### sistema/frontend/src/utils/productCard.ts
- `getProductCardViewModel(product)` → ViewModel para card da Home e Busca
- Internamente usa productPricing.ts

### sistema/frontend/src/utils/changeOptions.ts
- `getChangeOptions(total)` → array de 3 opcoes validas de troco
- Regra: pedido >= R$200 → incremento R$50; menor → incremento R$20

### sistema/frontend/src/utils/deliveryAddress.ts
- `saveDeliveryAddress(address)` → persiste contexto de entrega no `localStorage` (`antenor.deliveryAddress`)
- `readDeliveryAddress()` → recupera endereco persistido de forma tipada e segura
- `formatDeliveryAddressLabel(address)` → formata endereco curto para header

### sistema/frontend/src/hooks/useDeliveryAddress.ts
- hook de leitura reativa do contexto de entrega (eventos locais + `storage`)
- usado no header da Home e da Search para exibicao do destino atual e fallback sem endereco

### sistema/frontend/src/config/deliveryOperation.ts
- configuracao separada da operacao de entrega com timezone, janelas semanais, excecoes por data e feriados
- `storeHoursLabel` explicita o horario da loja fisica sem misturar com disponibilidade de entrega

### sistema/frontend/src/utils/deliveryOperation.ts
- calculo operacional de entrega com base na configuracao: aberto/fechado, proxima janela e nota de excecao
- contador regressivo de fechamento quando a janela atual esta ativa

### sistema/frontend/src/hooks/useDeliveryOperation.ts
- hook reativo para status operacional de entrega com atualizacao por segundo
- consumido nos headers da Home e da Search para sinalizacao de urgencia e disponibilidade

### Contrato de calculo de entrega
- `deliveryAPI.calculate` retorna `fee: number | null` e `outOfArea?: boolean`
- fora da area de entrega deve retornar `fee: null` e `outOfArea: true`
- checkout deve bloquear criacao de pedido quando a taxa estiver ausente ou fora de area
- nunca converter fora de area para frete zero no frontend

### sistema/frontend/src/utils/productDetailSchema.ts
- schema de secoes dinamicas por categoria para pagina de produto detalhado
- centraliza composicao de blocos (resumo, atributos, conservacao, harmonizacao, preparo)

### sistema/frontend/src/pages/ProductDetail.tsx
- pagina publica de detalhe com galeria de imagem (fallback por formato), blocos schema-driven e recomendacoes
- combinacao de dados ERP e editoriais em secoes de descricao e informacoes adicionais

### sistema/frontend/src/contexts/CartContext.tsx
- estado global do carrinho com persistencia em localStorage
- fluxo de cupom real integrado ao backend com `applyCoupon/removeCoupon`
- totais separados em `subtotal`, `discount` e `total` (liquido)

## Estrutura real do repositorio

## Ambiente de staging

- Compose: `sistema/docker-compose.staging.yml`
- Script operacional: `sistema/staging-ops.ps1 [up|down|reset|seed|smoke|status]`
- Portas staging vs local:
  - loja:  4000 (local: 3000)
  - api:   4001 (local: 3001)
  - admin: 4002 (local: 3002)
  - banco: 5433 (local: 5432)
  - meili: 7701 (local: 7700)
- Banco isolado: `antenor_staging` — nunca compartilha dados com `antenor_db`.
- Credencial admin staging: `admin@antenor.com.br` / `admin2026`.
- Seed recomendado do staging: `.\staging-ops.ps1 seed` ou, manualmente, `npm run prisma:seed` + `npm run seed:qa` em `sistema/backend` apontando `DATABASE_URL` para a porta `5433`.
- Nginx de staging usa `nginx.staging.conf` (aponta para `api_staging`, não `api`).
- Subir: `docker compose -f docker-compose.staging.yml up -d --build`
- Depois de subir, sempre rodar migrations: `docker compose -f docker-compose.staging.yml exec api_staging npx prisma migrate deploy`

## Categorias N1/N2 (M-CAT)

- A categorizacao do ecommerce agora usa hierarquia real N1 -> N2 no banco (`categories_cms.parentId`).
- O mapeamento de produto para vitrine usa EAN como chave principal via `product_category_mappings`.
- Fonte de verdade do mapeamento EAN/N1/N2: handoff externo (`handoff_ecommerce_v3_n1_n2.csv/.json/.md`).
- Ordem de precedencia obrigatoria:
  1) handoff externo (upsert com `source='handoff'` e prioridade alta)
  2) pendencia para revisao (`category_mapping_pending`) quando regra de publicacao exigir revisao
  3) fallback mercadologico (`classification01..04`) apenas para assistencia operacional
- Novos produtos sem mapeamento confirmado entram em `category_mapping_pending` para revisao no admin.
- Pendencias automáticas gravam `reason` com a política de publicação do handoff quando aplicavel e `notes` com o contexto da origem; a auto-resolucao confere ambos antes de aprovar/rejeitar, preservando a politica do handoff mesmo em reprocessamentos.
- Regras de auto-classificacao por categoria de entrada ficam em `classification_rules`.
- Guardrail anti-alucinacao: nao inferir categoria final por heuristica quando o EAN existir no handoff.

### Endpoints publicos de categorias

- `GET /api/categories/hierarchy` -> lista N1 com filhos N2
- `GET /api/categories/:categoryId/subcategories` -> lista N2 de uma N1
- `GET /api/categories/:categoryId/products?subcategoryId=&limit=&offset=` -> produtos mapeados por EAN
- `GET /api/categories/:categoryId/mappings` -> mapeamentos (EAN) da categoria
- `GET /api/categories/stats/mapping` -> cobertura de mapeamento (mapped/pending/unmapped)
- `GET /api/categories/pending/list` -> pendencias paginadas

### Endpoints admin de categorias

- `POST /api/admin/categories` -> cria categoria N1
- `POST /api/admin/categories/:parentId/subcategories` -> cria N2
- `PUT /api/admin/categories/:categoryId` -> edita categoria
- `DELETE /api/admin/categories/:categoryId` -> remove (soft/hard)
- `POST /api/admin/categories/mappings/create` -> cria mapeamento EAN
- `PUT /api/admin/categories/mappings/:ean` -> atualiza mapeamento EAN
- `DELETE /api/admin/categories/mappings/:ean` -> remove mapeamento EAN
- `POST /api/admin/categories/pending/:id/approve` -> aprova pendencia
- `POST /api/admin/categories/pending/:id/reject` -> rejeita pendencia
- `POST /api/admin/categories/apply` -> safe mode (dry-run/commit com validacao)
- `GET /api/admin/categories/mappings/suggestions` -> sugestoes EAN -> categoria
- `POST /api/admin/categories/mappings/apply-suggestions` -> aplica sugestoes (dry-run/apply)
- `POST /api/admin/categories/subcategories/populate` -> popula N2 automaticamente (dry-run/apply)
- `POST /api/admin/categories/pending/generate` -> gera pendencias para nao mapeados
- `POST /api/admin/categories/pending/resolve-auto` -> resolve pendencias em lote (dry-run/apply)

### Fila de pendências

- `GET /api/categories/pending/list` -> lista pendencias com `reason`, `notes` e sugestao N1/N2 para a revisao manual no admin
- `POST /api/admin/categories/pending/:id/approve` -> aprova uma pendencia com a categoria sugerida
- `POST /api/admin/categories/pending/:id/reject` -> rejeita uma pendencia com anotacao de auditoria

```
raiz/
  .git/
  .github/
    copilot-instructions.md
    workflows/ci.yml
  .gitignore
  .vscode/
    settings.json          # config minima do editor
  arquivos-projeto/
    archives/              # snapshots antigos
    md/                    # documentacao canonica ativa
      INICIO_AQUI.md       # ⭐ LEIA PRIMEIRO - entry point para IAs
      STATUS.md
      MEMORIA_PROJETO.md
      REFERENCIA_TECNICA.md
      CONFIGURACOES.md
      ROADMAP.md
      CMS_MANUAL.md
      SOLIDCOM_API_DORSAL.md
  artifacts/
    final-desktop/         # screenshots desktop
    final-mobile/          # screenshots mobile
  config.json
  package.json
  README.md
  sistema/
    admin/
      .dockerignore
      Dockerfile
      nginx.conf
      src/
    backend/
      .dockerignore          # (em backend/ ja existia)
      Dockerfile
      src/
      prisma/
      scripts/
    frontend/
      .dockerignore
      Dockerfile
      nginx.conf
      cypress/
        e2e/
          checkout.cy.ts     # E2E checkout (5/5 passando)
          product-pricing.cy.ts  # guardrail de precos (1/1 passando)
      src/
        components/
        contexts/
          CartContext.tsx     # ⭐ estado global do carrinho
        hooks/
          useCart.ts         # re-exporta CartContext
        pages/
        services/
        types/
        utils/
          format.ts
          productCard.ts
          productPricing.ts  # ⭐ fonte unica de calculo de preco
          analytics.ts
          apiError.ts
          changeOptions.ts
          device.ts
          validators.ts
    docker-compose.yml
    ecosystem.config.js
    package.json
    README.md
    setup.sh
    stack-ops.ps1          # script de operacao Docker (subir/parar/rebuild)
    start-all.sh
    STATUS.json
    update_slides.sql
```
- auth
- products
- customers
- orders
- addresses
- integrations
- notifications
- uploads
- cms
- audit-log
- analytics

Arquivos do modulo notifications:
- notifications.controller.ts (`POST /notifications/push-subscribe` aceita payload interno e `PushSubscriptionJSON` do navegador)
- notifications.service.ts (cria notificacoes in-app e dispara Web Push para `customerId` quando aplicavel)
- push-notification.service.ts (`web-push`, VAPID configuravel, envio para subscriptions ativas e limpeza de endpoints expirados 404/410)
- push-notification.service.spec.ts
- notifications.service.spec.ts

Variaveis Web Push:
- Backend: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Frontend build: `VITE_VAPID_PUBLIC_KEY`
- Sem VAPID configurado, o backend nao envia push externo e o frontend nao registra subscription; notificacoes in-app continuam operando.

Arquivos PWA/Web Push no storefront:
- `frontend/public/manifest.webmanifest`: manifesto PWA com `display: standalone`, escopo `/`, tema bordô e icones 192/512.
- `frontend/public/service-worker.js`: handlers `push` e `notificationclick`.
- `frontend/index.html`: declara `rel="manifest"` e `apple-touch-icon`.
- `frontend/nginx.conf` e `frontend/nginx.staging.conf`: `service-worker.js` e `manifest.webmanifest` com cache no-store; manifesto com `application/manifest+json`.

Preflight operacional:
- Script: `sistema/scripts/validate-web-push-readiness.js`.
- Comando: `cd sistema && npm run validate:web-push-readiness`.
- Modo externo: `cd sistema && npm run validate:web-push-readiness -- --external`.
- O modo externo exige VAPID configurado, `VITE_VAPID_PUBLIC_KEY` igual ao public key do backend, origem HTTPS nao-local, manifesto PWA, service worker e cache Nginx correto.

Gate da tooling Web Push:
- Script: `sistema/scripts/validate-web-push-tooling.js`.
- Comando: `cd sistema && npm run validate:web-push-tooling`.
- Cobre geração de env staging, readiness, reutilização de VAPID por `--vapid-from-env` e merge preservando variaveis não-WebPush.

Inspecao de subscriptions Web Push:
- Script: `sistema/scripts/inspect-web-push-subscriptions.js`.
- Comando: `cd sistema && npm run inspect:web-push-subscriptions`.
- Gate: `cd sistema && npm run inspect:web-push-subscriptions -- --require-ready`.
- Evidencia JSON: adicionar `--json-output artifacts/web-push-homologation/web-push-inspect.json`.
- O comando lista total, completas, incompletas, provedores dos endpoints exibidos, clientes e endpoints mascarados. Use antes de `prove:web-push-delivery` para confirmar se ja existe subscription real gravada.

Prova de entrega Web Push:
- Script: `sistema/scripts/prove-web-push-delivery.js`.
- Dry-run: `cd sistema && npm run prove:web-push-delivery -- --dry-run`.
- Evidencia JSON: adicionar `--json-output artifacts/web-push-homologation/web-push-dry-run.json` ou `web-push-send.json`.
- Invariante: evidencias nao devem conter VAPID privado; endpoints ficam mascarados.

Validacao de pacote de evidencias Web Push:
- Script: `sistema/scripts/validate-web-push-evidence.js`.
- Comando sem envio real: `cd sistema && npm run validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation`.
- Comando apos envio real: `cd sistema && npm run validate:web-push-evidence -- --evidence-dir artifacts/web-push-homologation --require-send`.
- Invariante: `--require-send` falha quando `web-push-send.json` esta ausente.

Relatorio de homologacao Web Push:
- Script: `sistema/scripts/generate-web-push-homologation-report.js`.
- Comando sem envio real: `cd sistema && npm run report:web-push-homologation -- --evidence-dir artifacts/web-push-homologation`.
- Comando apos envio real: `cd sistema && npm run report:web-push-homologation -- --evidence-dir artifacts/web-push-homologation --require-send`.
- Saida padrao: `artifacts/web-push-homologation/web-push-homologation-report.md`.

Homologacao integrada:
- `homologate:web-push -- --validate-evidence` valida o pacote gerado ao final do fluxo.
- `homologate:web-push -- --report` gera o relatorio ao final do fluxo.
- Ambas as flags exigem `--evidence-dir`.
- Quando `--send` esta presente, o orquestrador exige `web-push-send.json` ao validar/relatar.
- `--require-empty-evidence-dir` falha se a pasta de evidencias ja tiver arquivos.
- `--force-evidence-overwrite` permite reaproveitar conscientemente uma pasta ocupada.
- `--evidence-dir-auto` cria uma subpasta automatica dentro de `artifacts/web-push-homologation` ou dentro da base informada em `--evidence-dir`.
- `--evidence-run-id` permite nomear explicitamente a subpasta automatica.

UI kit do storefront:
- Primitives atuais: `Button`, `buttonVariants`, `Badge`, `Input`, `Select`, `Checkbox`, `Radio`, `surfaceClasses` e `cn`.
- Superficies ja migradas: Receitas, Mercado/Search, Mercado/cards, detalhe de produto, carrinho, checkout, Adega, Home, Login, Cadastro, Conta, NotFound, Forbidden, ErrorBoundary, DeliveryVerificationModal, NotificationBell e Promocoes.
- `LoadingButton` reutiliza `buttonVariants` e continua sendo usado em Checkout/Login/Register.
- Varredura de controles: `rg -n '<button|<input|<select|<textarea|btn-burgundy|btn-gold|window\.alert|window\.confirm|alert\(|confirm\(' sistema/frontend/src/components sistema/frontend/src/pages -g '*.tsx'`.
- Resultado esperado: controles nativos diretos apenas nos wrappers `components/ui/*` e no compat layer `LoadingButton`.
- Cobertura visual principal: `cd sistema/frontend && npx cypress run --spec cypress/e2e/mobile-visual-smoke.cy.ts --config baseUrl=http://127.0.0.1:4000`.
- Cobertura visual secundaria: `cd sistema/frontend && npx cypress run --spec cypress/e2e/secondary-routes-visual.cy.ts --config baseUrl=http://127.0.0.1:4000`.
- Cobertura focada de auth: `cd sistema/frontend && npx cypress run --spec cypress/e2e/auth-ui-kit.cy.ts --config baseUrl=http://127.0.0.1:4000`.
- Cobertura focada de conta/fallbacks: `cd sistema/frontend && npx cypress run --spec cypress/e2e/account-fallback-ui-kit.cy.ts --config baseUrl=http://127.0.0.1:4000`.

Arquivos do modulo integrations:
- integration-modules.service.ts (catalogo de modulos plugaveis e flags `INTEGRATION_*_ENABLED`)
- solidcom-erp.service.ts
- order-orchestration.service.ts
- payments-ledger.service.ts
- payments-webhook.service.ts
- webhook.guard.ts
- integrations.controller.ts
- integrations.module.ts

Diretriz de arquitetura de integracoes:
- integracao externa e tratada como modulo conectavel/desconectavel
- desligar um modulo nao remove dados de dominio (products, customers, orders)
- fluxo de dominio permanece interno; adaptadores externos sao opcionais e removiveis
- sessao `Integracoes` no admin centraliza operacao e evolucao desses modulos

Testes unitarios:
- payments-ledger.service.spec.ts
- payments-webhook.service.spec.ts

## Modelos Prisma atuais

- Tenant
- Store
- TenantUser
- Role
- Permission
- RolePermission
- UserStoreAccess
- Admin
- Customer
- Address
- Product
- Order
- OrderItem
- OrderEvent
- Cart
- CartItem
- CheckoutSession
- CheckoutEvent
- StockPosition
- StockLedger
- StockReservation
- StockPolicy
- StockReconciliationRun
- PriceList
- PriceListItem
- Promotion
- PromotionRule
- Coupon
- PromotionUsage
- PriceAuditLog
- PaymentTransaction
- PaymentEvent
- Refund
- PaymentReconciliationRun
- Category
- HeroSlide
- PushSubscription
- AuditLog

Campos relevantes de `Category` para vitrines:
- `name` (codigo comercial da categoria)
- `active` (habilita/desabilita secao na Home)
- `priority` (ordem de exibicao, crescente)
- `limit` (quantidade maxima de produtos por secao)
- `bannerUrl` (imagem associada quando aplicavel)

## Paginas do storefront

- Home
- Mercado (arquivo `pages/Search.tsx`)
- ProductDetail (arquivo `pages/ProductDetail.tsx`, rota `/produto/:id`)
- Cart
- Checkout
- Account
- Login
- Register
- WinePage
- Forbidden
- NotFound

Observacao de roteamento:
- rota principal de exploracao de catalogo: `/mercado`
- alias legado de compatibilidade: `/busca` (redireciona para `/mercado`)

## Paginas do admin

- Login
- Dashboard
- Integrations
- Intelligence
- Forbidden
- NotFound

Superficies internas do Dashboard:
- dashboard
- products
- orders
- picking
- customers
- layout
- intelligence

Superficies do painel Integrations:
- Solidcom ERP (status, sync, falhas, retry)
- CRM (health e preview de sync)
- Fiscal (health)
- Pagamentos: **manual por requisito** (UI real oculta por padrao; habilitavel por flag apenas quando aprovado)

## Rotas principais da API

### Autenticacao
- POST /auth/login
- POST /auth/customer/login
- POST /auth/customer/register
- POST /auth/customer/guest-checkout
- POST /auth/register

### Produtos
- GET /products
- GET /products/mercadological-tree
- GET /products/admin
- GET /products/suggest
- GET /products/analytics/top
- GET /products/:id
- GET /products/:id/recommendations
- POST /products
- POST /products/admin
- POST /products/sync
- PUT /products/:id
- DELETE /products/:id

Observacoes de filtro no endpoint publico `GET /products`:
- filtros comerciais: `category`, `minPrice`, `maxPrice`
- filtros mercadologicos: `classification01`, `classification02`, `classification03`, `classification04`
- os mesmos campos mercadologicos sao aplicados tanto na busca MeiliSearch quanto no fallback Prisma/SQL

### Clientes
- GET /customers
- GET /customers/:id
- GET /customers/analytics/origin
- POST /customers
- PUT /customers/:id
- DELETE /customers/:id

### Pedidos
- GET /orders
- GET /orders/:id
- GET /orders/analytics/sales
- GET /orders/analytics/status
- GET /orders/analytics/revenue
- POST /orders
- PUT /orders/:id
- PUT /orders/:id/status
- DELETE /orders/:id
- GET /admin/orders
- GET /admin/orders/:id
- POST /admin/orders/:id/events
- POST /admin/orders/:id/cancel
- POST /admin/orders/:id/items/:itemId/cancel
- POST /admin/orders/:id/items/:itemId/substitute
- POST /admin/orders/:id/recalculate

### Picking
- GET /admin/picking/eligible-orders
- GET /admin/picking/tasks
- POST /admin/picking/tasks
- POST /admin/picking/tasks/from-order/:orderId
- GET /admin/picking/tasks/:id
- POST /admin/picking/tasks/:id/assign
- POST /admin/picking/tasks/:id/start
- POST /admin/picking/tasks/:id/items/:itemId/pick
- POST /admin/picking/tasks/:id/items/:itemId/missing
- POST /admin/picking/tasks/:id/items/:itemId/substitute
- POST /admin/picking/tasks/:id/finish
- POST /admin/picking/tasks/:id/conference
- POST /admin/picking/tasks/:id/packing-checklist
- GET /admin/picking/performance

Observacoes de contrato no `POST /orders`:
- requer autenticacao JWT
- requer `idempotencyKey` obrigatoria por tentativa de criacao
- o escopo da idempotencia e `orders:create:{customerId}`
- retry legitimo com mesma chave e mesmo payload retorna o pedido ja criado; mesma chave com payload diferente retorna erro
- cliente comum so pode criar pedido para o proprio `customerId`; admin preserva acesso operacional
- aceita `couponCode` opcional para aplicar cupom no servidor
- campos financeiros (`subtotal`, `discount`, `total`) sao recalculados no backend; o cliente nao e fonte de verdade
- itens sao validados no backend: produto existente, ativo, nao `NUNCA`, quantidade positiva, preco valido e estoque suficiente quando aplicavel
- `clientIp` e derivado de `x-forwarded-for`/`req.ip` pelo controller para trilha antifraude
- `deliveryAddressId` e enviado pelo checkout quando o endereco e salvo antes do pedido
- `Order` persiste snapshots JSON: `customerSnapshot`, `addressSnapshot`, `deliverySnapshot`, `priceSnapshot`
- `OrderEvent` e a trilha oficial de auditoria do OMS; mudancas relevantes de pedido/item devem gerar evento
- `OrderItem` guarda status e valores finais para permitir corte, substituicao e recalc sem perder o pedido original

### Cupons
- GET /coupons/validate?code={CODE}&subtotal={VALUE}

Resposta esperada:
- `valid` (boolean)
- `code` (string)
- `message` (string)
- `discountAmount` (number)

### Enderecos
- GET /addresses/search/:cep
- POST /addresses/:customerId

### Integracoes
- GET /integrations/solidcom/status
- GET /integrations/solidcom/orders/failures?limit=&action=&from=&to=
- GET /integrations/solidcom/orders/:orderId/failure
- POST /integrations/solidcom/orders/:orderId/retry

- GET /integrations/crm/health
- GET /integrations/crm/sync-preview
- GET /integrations/fiscal/health

- GET /integrations/payments/health
- GET /integrations/payments/transactions?orderId=&status=&provider=&limit=
- POST /integrations/payments/orders/:orderId/transaction
- POST /integrations/payments/refunds
- POST /integrations/payments/chargebacks
- POST /integrations/payments/reconciliation
- GET /integrations/payments/webhook/events?limit=
- POST /integrations/payments/webhook (protegido por WebhookGuard, nao usa JWT)

- GET /integrations/replay/health
- GET /integrations/replay/order/:orderId

Seguranca do webhook:
- header: x-webhook-signature
- algoritmo: HMAC-SHA256 com prefixo sha256=
- comparacao: crypto.timingSafeEqual para prevenir timing attacks
- idempotencia financeira: `PaymentEvent.providerEventId` por transacao; `AuditLog` permanece apenas como trilha operacional
- payload persistido no ledger e sanitizado para mascarar campos sensiveis de cartao/token
- se o gateway estiver ativo (`ENABLE_PAYMENTS_INTEGRATION=true` ou `INTEGRATION_PAYMENTS_ENABLED=true`), webhook sem `PAYMENTS_WEBHOOK_SECRET` valido nao e aceito
- endpoint de webhook usa throttle nomeado `webhook`; criacao de pedido usa throttle `checkout`

Ledger financeiro M09:
- `PaymentTransaction`: transacao por pedido, provedor, metodo, status, valor, `providerRef` e `idempotencyKey`
- `PaymentEvent`: evento assinado/idempotente do gateway com `signatureOk`, `providerEventId` e payload sanitizado
- `Refund`: reembolso total ou parcial associado ao pedido/transacao
- `PaymentReconciliationRun`: relatorio de conciliacao com matched, missing provider/local e divergencia de valor
- Confirmacao manual de pedido online com gateway ativo exige status financeiro `PAID`, `AUTHORIZED` ou `CAPTURED`; pagamentos na entrega seguem offline

Operacao do produto (pagamento por fora):
- o checkout registra apenas `paymentMethod` (PIX/CASH/CARD) e, quando CASH, o troco selecionado
- flags de seguranca para manter pagamentos reais desativados:
	- `ENABLE_PAYMENTS_INTEGRATION=false` (backend: nao gera cobranca automaticamente ao confirmar pedido)
	- `VITE_PAYMENTS_UI_ENABLED=false` (admin: oculta superficies de cobranca/webhook)

Servicos internos da camada de integracao:
- SolidcomERPService para a integracao ERP externa
- OrderOrchestrationService como primeira camada interna do fluxo de pedidos
- PaymentsWebhookService para processamento de eventos de gateway de pagamento
- parser de etiqueta de balanca (codigo iniciando com 2) dentro da orquestracao de pedidos

### Analytics
- POST /analytics/track
- GET /analytics/top-products
- GET /analytics/admin/insights
- GET /analytics/funnel
- GET /analytics/events
- GET /analytics/admin/search-insights
- GET /analytics/funnel-compare?days=7 (M33.1: comparativo de período, autorizado admin)
- GET /analytics/insights-compare?days=7 (M33.1: comparativo receita/pedidos, autorizado admin)
- POST /analytics/alert-rules (M33.2: criar regra de alerta)
- GET /analytics/alert-rules (M33.2: listar regras)
- PATCH /analytics/alert-rules/:ruleId (M33.2: atualizar regra)
- DELETE /analytics/alert-rules/:ruleId (M33.2: deletar regra)
- GET /analytics/alerts/unseen (M33.2: alertas não vistos)
- GET /analytics/alerts/history (M33.2: histórico de alertas)
- PATCH /analytics/alerts/:alertId/seen (M33.2: marcar como visto)
- POST /analytics/alerts/check-and-trigger (M33.2: executar verificação de regras)
- GET /analytics/report-executive?week=<date>&format=csv|json (M33.3: relatório executivo semanal)
- GET /analytics/report-executive/download?week=<date> (M33.3: download CSV)

## Componentes de Inteligência (M33+)

### PeriodComparison.tsx
Componente reutilizável para exibir métricas com delta (comparativo período anterior).

**Localização:** sistema/admin/src/components/PeriodComparison.tsx

**Props:**
```typescript
interface DeltaMetric {
  current: number
  previous: number
  delta: number
  deltaPercent: number
}

interface PeriodComparisonProps {
  metric: DeltaMetric
  label: string
  isCurrency?: boolean
  isPercentage?: boolean
}
```

**Comportamento:**
- Renderiza valor atual em grande destaque
- Mostra valor anterior em tamanho menor
- Sinalização visual de delta:
  - **Verde (✓)**: delta positivo (crescimento desejável)
  - **Vermelho (✗)**: delta negativo (queda ou risco)
  - **Cinza (—)**: delta zero ou baseline inválido (conversão anterior = 0)
- Formatação:
  - `isCurrency=true`: prefixo "R$" (ex.: "R$ 1.234,56")
  - `isPercentage=true`: sufixo "%" (ex.: "43.86%")

**Uso no Intelligence.tsx:**
```tsx
<PeriodComparison
  metric={funnelComparison.metrics.conversionRate}
  label="Conversão (7 dias)"
  isPercentage
/>
```

**Exemplo de resposta do backend:**
```json
{
  "metrics": {
    "conversionRate": {
      "current": 0.00,
      "previous": 0.00,
      "delta": 0,
      "deltaPercent": 0
    },
    "cartAbandonRate": {
      "current": 43.86,
      "previous": 0,
      "delta": 43.86,
      "deltaPercent": 0
    }
  }
}
```

### AlertRulesManager.tsx (M33.2)
Componente para gerenciar regras de alerta automático no painel admin.

**Localização:** sistema/admin/src/components/AlertRulesManager.tsx

**Props:**
```typescript
interface AlertRulesManagerProps {
  apiUrl: string
  token: string
}
```

**Funcionalidades:**
- CRUD de regras de alerta (criar, listar, editar, deletar)
- Seleção de métrica: conversionRate, cartAbandonRate, revenue, orders, noResultRate
- Tipo de comparação: absolute (valor fixo) | percentChange (% vs período anterior)
- Operadores: below (abaixo de), above (acima de), equals (igual a)
- Status: ativo/inativo com toggle
- Descrição opcional para cada regra
- Listagem com filtros e busca
- Indicadores visuais: ✓ verde (ativo) | ✗ cinza (inativo)
- Severity automático: warning (delta < 10) | critical (delta >= 10)

**Exemplo de uso:**
```tsx
<AlertRulesManager apiUrl="http://localhost:3001" token={token} />
```

**Fluxo de dados:**
1. Componente fetch `GET /analytics/alert-rules`
2. Renderiza tabela com regras ativas
3. Formulário de criação com validação
4. POST/PATCH para `/analytics/alert-rules` com dados
5. `POST /analytics/alerts/check-and-trigger` dispara verificação manual

### ExecutiveReport.tsx (M33.3)
Componente para gerar e baixar o relatório executivo semanal em CSV ou visualizar o resumo em JSON.

**Localização:** sistema/admin/src/components/ExecutiveReport.tsx

**Props:**
```typescript
interface ExecutiveReportProps {
  apiUrl: string
  token: string
}
```

**Funcionalidades:**
- Seleção da semana por data inicial
- Busca `GET /analytics/report-executive` para carregar o resumo
- Download CSV via `GET /analytics/report-executive?format=csv` ou endpoint dedicado de download
- Exibição de resumo geral, top categorias, termos de busca, gaps e recomendações

**Uso no Intelligence.tsx:**
```tsx
<ExecutiveReport apiUrl={API_URL} token={token} />
```

### CMS e uploads
- rotas CMS de hero slides e categorias em sistema/backend/src/modules/cms
- categorias CMS:
	- GET /cms/categories
  - GET /cms/categories/commercial
	- POST /cms/categories
	- PATCH /cms/categories/:id
	- DELETE /cms/categories/:id
- uploads em /uploads via sistema/backend/src/modules/uploads/uploads.controller.ts
- imagens de catalogo em /uploads/products/{ean}.webp
- no storefront, o Nginx publica `/uploads/` como proxy para `api:3001/uploads/`
- quando a imagem nao existe no backend, o Nginx retorna `placeholder-product.svg`
- script de cobertura de imagens em lote: sistema/backend/scripts/import-images.js

Regras de vitrines da Home via CMS:
- somente categorias `active=true` entram no conjunto de secoes
- ordenacao pela coluna `priority`
- corte de produtos por secao pela coluna `limit`
- curadoria manual opcional por categoria via `curatedProductIds`
- composicao hibrida: produtos curados primeiro + fallback automatico por categoria para completar `limit`
- persistencia de curadoria em `category_product_curations_cms` (migration `20260425065729_add_category_product_curations_cms`)

Taxonomia comercial unificada (M1):
- endpoint `GET /cms/categories/commercial` retorna taxonomia unica para Home e Mercado
- o backend mescla categorias do CMS com fallback por categorias de produtos ativos
- cada item comercial inclui `code`, `name`, `active`, `priority`, `limit`, `productCount`, `curatedProductIds`, `curatedProducts` e `source`
- no storefront, Home e Search consomem a mesma fonte via `useCommercialTaxonomy`
- classificacao de secoes da Home usa mapeamento por `product.category` (sem regex ad-hoc)

Colecoes comerciais (M2 parcial):
- endpoint de promo banners retorna contrato evoluido com `subtitle` e `link`
- compatibilidade mantida com campos legados `badge` e `ctaTo`
- admin opera colecoes com foco em `title`, `subtitle`, `imageUrl`, `link`, `order`, `active`
- Home consome `subtitle/link` com fallback para `badge/ctaTo`
- secao `Mais Vendidos` da Home usa fonte publica `GET /analytics/top-products` com fallback local
- destaque horizontal suporta `highlightedProductId` e `highlightNote`
- Home renderiza produto exaltado no banner quando `highlightedProduct` estiver definido
- admin oferece busca assistida para selecionar `highlightedProductId` sem edicao manual de ID

## Regras de visibilidade de catalogo (ERP)

- origem da regra: campo de integracao da Solidcom mapeado para `syncOption`
- `NUNCA`: nao exibe no storefront
- `SEMPRE`: exibe independentemente de estoque
- `ESTOQUE` e `ESTQOUE`: exibe somente com estoque > 0
- regra aplicada nas consultas Prisma e na busca MeiliSearch

## Regras de acesso no storefront

- Home (`/`) e Carrinho (`/cart`) sao publicos
- Checkout (`/checkout`) aceita convidado quando `VITE_GUEST_CHECKOUT_ENABLED=true`
- endpoint de criacao de convidado no backend depende de `ALLOW_GUEST_CHECKOUT=true`
- Conta (`/account`) continua protegida por autenticacao

## Observacao de schema

- a consulta de produtos depende da coluna `products.fractionStep`
- em ambiente novo, a coluna deve existir via migration Prisma (nao apenas ajuste manual)

## Busca no storefront

- pagina dedicada de busca com filtros visuais
- suporte a operadores na query (`preco<`, `preco>`, `categoria:` e exclusao por `-termo`)
- parametros suportados no backend:
	- `search`
	- `category`
	- `minPrice`
	- `maxPrice`
- sugestoes de termo via `/products/suggest`

### Observabilidade
- GET /health
- Swagger em /api

## Banco de dados e integracao ERP

- provider atual do Prisma: postgresql
- API Solidcom continua sendo integracao externa secundaria
- direcao futura: camada propria de API da Antenor & Filhos como frente de negocio, com adaptador para a Solidcom em segundo plano

## Arquivos operacionais relevantes

- [../../../sistema/docker-compose.yml](../../../sistema/docker-compose.yml)
- [../../../sistema/backend/prisma/schema.prisma](../../../sistema/backend/prisma/schema.prisma)
- [./CONFIGURACOES.md](./CONFIGURACOES.md)
- [../01%20-%20Projeto/STATUS.md](../01%20-%20Projeto/STATUS.md)
