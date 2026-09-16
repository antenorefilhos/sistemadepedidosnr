---
title: Auditoria 360 - APIs, integracoes e banco
tags: [auditoria, api, integracoes, banco, prisma]
created: 2026-09-13
updated: 2026-09-13
status: consolidado-com-limitacoes
type: relatorio
---

# Auditoria 360 - Fase 3: APIs, integracoes e banco

## Snapshot e limites

- Snapshot auditado: branch `main`, HEAD `1ad50ea31862dc0fb1ba35b2de95d54bee1b2bbf`, workspace `F:\VC.VERSE\PROJETOS\antenor e filhos\pedidos nr`.
- Data da auditoria: 2026-09-13, sem acesso a VPS, producao, banco real ou servicos externos.
- Arquivos de referencia lidos antes da varredura: `AGENTS.md`, `CLAUDE.md`, `docs/auditoria-360/01-analise-estatica-arquitetura.md` e `docs/auditoria-360/02-seguranca-autenticacao-sessoes.md`.
- Worktree ja estava sujo antes desta fase; esta fase criou somente este arquivo e escreveu/confirmou issues Linear.
- Metodologia: leitura estatica, inventario por AST/regex, inspecao manual de controllers/services/DTOs/guards, Prisma schema/migrations, Notificador e buscas de deduplicacao no Linear incluindo resultados arquivados/encerrados retornados pela busca.
- Limitacao assumida: nao houve execucao de integracoes reais, migrations, seed, servidores, filas, jobs ou chamadas HTTP externas; os testes citados sao checagens locais/sinteticas e comandos reproduziveis sem efeitos externos.

## Resultado executivo

Foram inventariadas 398 operacoes REST em 38 controllers, nenhum GraphQL real, 111 models Prisma, 75 migrations SQL, Notificador desktop e os servicos de integracao Solidcom/AntenorApi, marketplace, pagamentos, webhooks de entrada/saida, notificacoes e public API.

A Fase 3 confirmou 11 achados rastreaveis: 5 High e 6 Medium. Desses, 8 ja tinham issue equivalente de fases anteriores e 3 geraram novas issues: JON-157, JON-158 e JON-159.

Resumo por prioridade:

| Prioridade | Quantidade | Issues |
|---|---:|---|
| High | 5 | JON-48, JON-49, JON-115, JON-134, JON-157 |
| Medium | 6 | JON-50, JON-59, JON-60, JON-118, JON-158, JON-159 |
| Low | 0 | - |

## Inventario de APIs

### REST controllers

| Controller | Operacoes | Observacoes de cobertura |
|---|---:|---|
| `uploads.controller.ts` | 3 | Uploads e multipart; ja ha ticket de concorrencia de temporarios na Fase 1. |
| `recommendations.controller.ts` | 6 | Corpo flexivel em alguns fluxos; revisar DTOs antes de endurecer contrato. |
| `recipes.controller.ts` | 9 | API publica/admin de receitas; sem GraphQL. |
| `observability.controller.ts` | 5 | Health/diagnosticos; riscos publicos ja rastreados na Fase 2. |
| `marketplace.controller.ts` | 7 | Gestao, ingestao e painel marketplace; achados A3-04, A3-05 e A3-06. |
| `customers.controller.ts` | 8 | CRUD e operacoes de cliente; riscos de exposicao ja em JON-71. |
| `analytics.controller.ts` | 22 | Muitas agregacoes; risco principal e custo de queries e falta de paginacao em painels. |
| `picking.controller.ts` | 15 | Separacao; concorrencia de tarefas ja rastreada em JON-73. |
| `picker.controller.ts` | 17 | Operacao mobile/worker de separacao; requer manter claims atomicos. |
| `public-api.controller.ts` | 12 | API clients e webhooks de saida; isolamento/SSRF ja em JON-142/JON-141. |
| `integrations.controller.ts` | 48 | Solidcom/AntenorApi/outbox/jobs/sync; achados A3-01 e A3-02. |
| `health.controller.ts` | 1 | Health simples. |
| `data-privacy.controller.ts` | 5 | LGPD/exportacao/anonimizacao; achados previos JON-119 a JON-122. |
| `delivery.controller.ts` | 25 | Entrega/admin; depende de guards e escopo por loja. |
| `driver.controller.ts` | 8 | App motorista; sem achado novo nesta fase. |
| `inventory.controller.ts` | 10 | Reservas/estoque; achado A3-03. |
| `notifications.controller.ts` | 17 | Push/campanhas; achado A3-07. |
| `addresses.controller.ts` | 6 | Enderecos e geocoding; sem achado novo nesta fase. |
| `crm.controller.ts` | 12 | CRM/consentimentos; achados previos JON-129 e relacionados. |
| `business.controller.ts` | 13 | B2B; achados previos JON-123 a JON-130. |
| `orders.controller.ts` | 20 | Pedidos/status/checkout operacional; depende de idempotencia e transacoes. |
| `products.controller.ts` | 25 | Catalogo/admin; DTOs mais estruturados que integracoes. |
| `promotions.controller.ts` | 7 | Promocoes; sem achado novo nesta fase. |
| `admin-products.controller.ts` | 5 | Admin catalogo; escopo e uploads ja cobertos em fases anteriores. |
| `auth.controller.ts` | 14 | Auth; seguranca detalhada na Fase 2. |
| `brand.controller.ts` | 2 | Branding. |
| `categories.controller.ts` | 8 | Categorias storefront/admin. |
| `admin-categories.controller.ts` | 16 | CRUD admin detalhado. |
| `cart.controller.ts` | 5 | Carrinho. |
| `checkout.controller.ts` | 5 | Checkout; PRICE_DIVERGED e falha pos-criacao ja rastreados. |
| `coupons.controller.ts` | 3 | Cupons. |
| `pricing.controller.ts` | 7 | Precos; parte B2B ja em JON-124. |
| `cms/categories.controller.ts` | 8 | CMS categorias. |
| `store-banners.controller.ts` | 8 | CMS banners. |
| `hero-slides.controller.ts` | 4 | CMS hero. |
| `promo-banners.controller.ts` | 5 | CMS banners promocionais. |
| `app.module.ts` | 2 | Rotas auxiliares registradas no modulo raiz. |

### GraphQL

Busca por `@nestjs/graphql`, `GraphQLModule`, `@Resolver`, `@Mutation`, `@Subscription`, `gql`, `typeDefs` e `Apollo` em `sistema/backend/src` nao encontrou implementacao GraphQL. Ocorrencias de `@Query()` sao decoradores HTTP do Nest e nao GraphQL.

### Padroes de resposta, validacao e erro

- A camada usa exceptions Nest (`BadRequestException`, `NotFoundException`, `UnauthorizedException`, `ConflictException`) em parte dos fluxos, mas integracoes e controllers legados ainda recebem `@Body() body: any` e fazem validacao manual.
- Endpoints de marketplace, integracoes e notificacoes misturam respostas operacionais (`{ ok: true }`, `{ duplicate: true }`, payloads de dominio) com erros implicitos de Prisma/HTTP 500 quando a corrida acontece fora de blocos tratados.
- As rotas publicas e de integracao mais sensiveis ja tinham achados de autenticacao/tenant na Fase 2; nesta fase o foco adicional foi idempotencia, concorrencia e atomia.

## Inventario de integracoes e comunicacao entre servicos

| Integracao | Arquivos principais | Status da auditoria |
|---|---|---|
| Solidcom ERP | `solidcom.service.ts`, `integrations.controller.ts`, `integration-outbox.service.ts`, Prisma `Integration*`/`OutboxEvent` | Outbox e jobs tem ids/indices, mas claims/retry ainda nao sao totalmente atomicos. |
| AntenorApi | `antenor-api.service.ts`, `integrations.service.ts`, `integrations.controller.ts` | Fluxo administrativo exposto em endpoints de integracao; sem chamada real executada. |
| Marketplace | `marketplace.controller.ts`, `marketplace.service.ts`, Prisma `SalesChannel`, `MarketplaceOrder`, politicas | Ingestao idempotente parcial, painel carrega dados demais e receita por tipo ja duplicava. |
| Pagamentos/webhooks | `payments-webhook.service.ts`, controllers relacionados, Prisma `PaymentTransaction`, `PaymentEvent` | Falhas de assinatura/valor/transicao ja registradas; confirmadas na leitura. |
| Public API e webhooks de saida | `public-api.controller.ts`, servicos de API clients/webhook delivery | Riscos de tenant/SSRF ja registrados; sem mutacao externa executada. |
| Notificador | `Notificador/main.js`, `Notificador/api.js`, `Notificador/sql.js`, `Notificador/config.js` | Fetch sem timeout/AbortController e polling sobreposto ja registrados. |
| Push/notificacoes | `notifications.service.ts`, `notifications.controller.ts`, Prisma `ScheduledNotification`, `PushSubscription` | Scheduler de campanhas sem claim atomico gerou JON-158. |

## Inventario de banco e migrations

- Prisma schema: 111 models, 0 enums.
- Migrations SQL: 75 diretorios entre `20260418180000_init_postgresql` e `20260912020000_campaign_notified_at`.
- Arquivos de banco inspecionados: `sistema/backend/prisma/schema.prisma`, `sistema/backend/prisma/migrations/**/migration.sql`, `sistema/backend/prisma/seed.ts`.
- Constraints/indices relevantes:
  - `OutboxEvent`: unique composto por tenant/loja/conector/idempotencyKey e indices por status/proxima tentativa.
  - `IntegrationJob`: unique composto por tenant/loja/conector/idempotencyKey.
  - `ScheduledNotification`: indice por tenant/sentAt/sendAt, mas sem coluna de claim/processamento.
  - `MarketplaceOrder`: unique `channelId_externalId`, usado de forma nao atomica no servico.
  - `PaymentEvent`/`PaymentTransaction`: uniques ajudam dedupe de evento/transacao, mas a validacao de valor/transicao ainda e logica de servico.
  - `StockReservation`/`Inventory`: modelos permitem rastrear reservas, mas o consumo atual nao faz claim condicional por status.
- Padrao das migrations: varias usam `IF NOT EXISTS`, indices adicionais e tabelas historicas, mas a auditoria nao aplicou ou reverteu migrations.

## Matriz de cobertura

| Area | Cobertura nesta fase | Resultado |
|---|---|---|
| Operacoes REST | 398 operacoes inventariadas por controller | Completo no snapshot. |
| GraphQL | Busca por dependencias/decorators/graphql strings | Nenhum GraphQL real encontrado. |
| Controllers/DTOs/guards | Leitura dos controllers e servicos principais; foco em `any`, guards, exceptions e respostas | Contratos inconsistentes em integracoes/marketplace, sem ticket novo generico para evitar duplicar Fase 2. |
| Solidcom/outbox/jobs | `integrations.*`, `integration-outbox.service.ts`, models Prisma | Reutiliza JON-48, JON-49 e JON-50. |
| Marketplace | Controller, service, schema e searches Linear | JON-118 reutilizado; JON-159 novo. |
| Pagamentos/webhooks | Service de webhooks e models de pagamento | JON-134 reutilizado. |
| Notificador | JS desktop e API helper | JON-59 e JON-60 reutilizados. |
| Banco/Prisma/migrations | Schema completo, migrations SQL e indices | JON-157 novo; sem execucao de banco real. |
| Concorrencia/idempotencia | Outbox, estoque, notificacoes, marketplace, pagamentos | Tres novas falhas confirmadas e oito equivalentes deduplicadas. |
| Timeouts/retries | Notificador, webhooks/outbox, integracoes | Achados reutilizados; sem teste de rede real. |

## Achados

### A3-01 - Outbox marca `SENT` sem executar integracao externa

- Prioridade: High.
- Linear: JON-48.
- Evidencia: `sistema/backend/src/modules/integrations/integration-outbox.service.ts:514` a `:522` retorna sucesso aceito por `postgres-outbox`, e o fluxo posterior marca o evento como enviado sem chamar Solidcom/endpoint externo real.
- Impacto e condicao: pedidos/eventos podem ser considerados entregues mesmo sem sair do sistema, ocultando perda de integracao.
- Correcao sugerida: substituir stub por dispatch real com timeout, retries idempotentes e persistencia de resposta externa; somente marcar `SENT` apos ack valido.
- Aceite: teste local com conector falso deve comprovar chamada externa, falha nao marca `SENT` e retry preserva idempotency key.
- Comando: `rg -n "dispatchEvent|queuedBy|SENT|FAILED" sistema/backend/src/modules/integrations/integration-outbox.service.ts`.

### A3-02 - Outbox worker nao reivindica eventos de forma atomica

- Prioridade: Medium.
- Linear: JON-50.
- Evidencia: `integration-outbox.service.ts:239` a `:255` faz `findMany` de eventos pendentes; `:263` a `:304` processa e so depois atualiza para `PROCESSING`.
- Impacto e condicao: dois workers podem selecionar o mesmo evento antes da mudanca de status, duplicando job/envio ou disputando constraints.
- Correcao sugerida: usar claim atomico (`UPDATE ... WHERE status IN (...) RETURNING`, `FOR UPDATE SKIP LOCKED` ou `updateMany` condicional por id/status) antes de criar job.
- Aceite: dois workers concorrentes processam cada evento uma unica vez.
- Comando: `rg -n "runDueOutboxBatch|processOutboxEvent|PROCESSING|findMany|updateMany" sistema/backend/src/modules/integrations/integration-outbox.service.ts`.

### A3-03 - Retry da outbox reutiliza chave unica de job

- Prioridade: High.
- Linear: JON-49.
- Evidencia: `IntegrationJob` tem unique tenant/loja/conector/idempotencyKey e o retry reaproveita a chave do evento ao criar novo job.
- Impacto e condicao: segunda tentativa pode falhar por constraint unica antes de executar a integracao, prendendo eventos recuperaveis.
- Correcao sugerida: modelar tentativa separada de job, permitir upsert por idempotencyKey com attempt incrementavel, ou criar chave unica por evento+attempt mantendo idempotencia externa no payload.
- Aceite: evento com primeira falha executa segunda tentativa sem violar unique e preserva dedupe externo.
- Comando: `rg -n "IntegrationJob|idempotencyKey|attempt|create\\(" sistema/backend/src/modules/integrations sistema/backend/prisma/schema.prisma`.

### A3-04 - Marketplace aceita webhook de pedido sem segredo configurado

- Prioridade: High.
- Linear: JON-115.
- Evidencia: `marketplace.controller.ts` e service aceitam ingestao quando canal/segredo nao exigem assinatura valida; Fase 2 ja registrou o detalhe de seguranca.
- Impacto e condicao: origem nao confiavel pode criar pedidos de marketplace quando segredo esta ausente/desabilitado.
- Correcao sugerida: negar por padrao quando segredo estiver ausente, permitir apenas modo sandbox explicitamente marcado e auditado.
- Aceite: chamada sem assinatura/segredo em canal produtivo retorna 401/403 e nao cria `MarketplaceOrder`.
- Comando: `rg -n "webhook|secret|signature|ingestMarketplaceOrder|isActive" sistema/backend/src/modules/marketplace`.

### A3-05 - Painel marketplace duplica receita e carrega dados em excesso

- Prioridade: Medium.
- Linear: JON-118.
- Evidencia: `marketplace.service.ts:236` a `:283` carrega canais com produtos/pedidos/politicas, depois faz `order.findMany` por `channel.type`; provedores do mesmo tipo podem compartilhar a mesma receita e o painel faz N+1/full load.
- Impacto e condicao: dashboard incorreto e caro quando ha muitos canais, pedidos e produtos.
- Correcao sugerida: agregar por `channelId`/provedor real no banco, limitar janelas, usar `groupBy`/counts e evitar includes completos no painel.
- Aceite: dois canais do mesmo tipo nao duplicam receita; painel executa numero fixo de queries com volume alto.
- Comando: `rg -n "getMarketplacePanel|marketplaceOrders|order\\.findMany|channel\\.type" sistema/backend/src/modules/marketplace/marketplace.service.ts`.

### A3-06 - Ingestao de pedido marketplace falha com 500 em corrida do mesmo `externalId`

- Prioridade: Medium.
- Linear: JON-159.
- Evidencia: endpoint `POST /api/v1/marketplace/channels/:channelId/orders`; `marketplace.service.ts:181` consulta unique antes de criar, `:186` cria `MarketplaceOrder`, e o `try/catch` com tratamento comeca apenas em `:198`.
- Impacto e condicao: duas requisicoes paralelas com o mesmo `channelId/externalId` podem passar pelo `findUnique`; uma cria e a outra estoura P2002 como erro interno em vez de resposta idempotente.
- Correcao sugerida: usar `upsert` por `channelId_externalId` ou capturar P2002 antes de responder; consolidar criacao/conversao em transacao curta com estado `PROCESSING`.
- Aceite: duas chamadas concorrentes retornam uma criacao e uma resposta idempotente/duplicate, sem 500 e sem pedido duplicado.
- Comando: `rg -n "ingestMarketplaceOrder|channelId_externalId|marketplaceOrder\\.create|catch \\(error\\)" sistema/backend/src/modules/marketplace/marketplace.service.ts`.

### A3-07 - Consumo concorrente de reserva pode decrementar estoque duas vezes

- Prioridade: High.
- Linear: JON-157.
- Evidencia: `inventory.service.ts:194` busca reservas `ACTIVE`, `:199` atualiza a reserva por id sem condicionar status, e `:204` em diante decrementa `onHand`/`reserved`.
- Impacto e condicao: duas chamadas concorrentes de confirmacao/consumo para o mesmo pedido podem ler a mesma reserva e aplicar decremento duplicado.
- Correcao sugerida: trocar `update` por `updateMany` condicional (`id` + `status: ACTIVE`) e pular decrementos quando `count !== 1`; adicionar idempotencia no ledger.
- Aceite: duas execucoes paralelas consomem cada reserva no maximo uma vez e mantem `Inventory`/`StockLedger` consistentes.
- Comando: `rg -n "consumeOrderReservations|stockReservation\\.update|onHand.*decrement|reserved.*decrement" sistema/backend/src/modules/inventory/inventory.service.ts`.

### A3-08 - Notificacoes agendadas podem disparar mais de uma vez

- Prioridade: Medium.
- Linear: JON-158.
- Evidencia: `notifications.service.ts:363` busca `ScheduledNotification` com `sentAt: null`, `:374` envia broadcast e `:382` marca `sentAt` somente depois.
- Impacto e condicao: dois schedulers/processos ou um disparo manual concorrente podem enviar a mesma campanha para os mesmos clientes.
- Correcao sugerida: adicionar claim atomico (`processingAt`/status ou `UPDATE ... RETURNING`) antes do envio, com retry controlado para falhas.
- Aceite: duas execucoes paralelas de `runDueScheduledBroadcasts` chamam `broadcastToCustomers` uma vez por campanha.
- Comando: `rg -n "runDueScheduledBroadcasts|scheduledNotification\\.findMany|broadcastToCustomers|sentAt" sistema/backend/src/modules/notifications/notifications.service.ts`.

### A3-09 - Webhook de pagamento nao vincula cobranca, valor e transicao ao pedido

- Prioridade: High.
- Linear: JON-134.
- Evidencia: `payments-webhook.service.ts:197` a `:249` resolve pedido pelo payload, normaliza valor com fallback e atualiza transacao/pedido sem provar cobranca esperada, valor exato e transicao permitida.
- Impacto e condicao: payload valido no formato, mas incorreto no dominio, pode mover pedido para estado pago/cancelado indevido.
- Correcao sugerida: validar `chargeId`/transacao esperada, valor total, moeda, gateway, tenant/loja e maquina de estados antes de atualizar pedido.
- Aceite: webhook de valor divergente, charge desconhecida ou transicao regressiva e rejeitado sem alterar pedido.
- Comando: `rg -n "processWebhook|recordEvent|updateTransactionStatus|order\\.update|amount" sistema/backend/src/modules/payments`.

### A3-10 - Notificador sobrepoe polling e consultas manuais sem timeout HTTP

- Prioridade: Medium.
- Linear: JON-59.
- Evidencia: `Notificador/main.js:55`, `:68` e `:219` usam `fetch` sem `AbortController`/timeout; `:436` usa `setInterval(check, INTERVAL)` sem guarda de execucao em andamento.
- Impacto e condicao: API lenta pode acumular chamadas, travar UI/loop e repetir consultas/efeitos quando operador aciona refresh manual.
- Correcao sugerida: encapsular fetch com timeout, `AbortController`, backoff e flag/mutex de polling.
- Aceite: uma chamada pendurada expira, libera nova tentativa controlada e nao sobrepoe `check`.
- Comando: `rg -n "fetch\\(|setInterval|check\\(" Notificador/main.js`.

### A3-11 - Notificador pode reautenticar indefinidamente em falha persistente

- Prioridade: Medium.
- Linear: JON-60.
- Evidencia: fluxo de login/fetch do Notificador nao aplica teto de tentativas/backoff duravel para falhas persistentes de autenticacao ou API.
- Impacto e condicao: credencial invalida ou API instavel gera loop de reautenticacao e ruido operacional.
- Correcao sugerida: limitar tentativas por janela, expor estado degradado na UI e exigir acao manual apos falhas consecutivas.
- Aceite: depois de N falhas o Notificador para retry agressivo, exibe erro claro e so volta por acao manual ou backoff longo.
- Comando: `rg -n "login|token|reauth|fetchOrders|apiJson" Notificador`.

## Validacao Linear

| Achado | Issue | Acao nesta fase | Readback |
|---|---|---|---|
| A3-01 | JON-48 | Reutilizada apos busca por outbox/dispatch/SENT | Confirmada em Backlog no projeto correto pela busca Linear. |
| A3-02 | JON-50 | Reutilizada apos busca por claim atomico/outbox | Confirmada em Backlog no projeto correto pela busca Linear. |
| A3-03 | JON-49 | Reutilizada apos busca por retry/idempotencyKey | Confirmada em Backlog no projeto correto pela busca Linear. |
| A3-04 | JON-115 | Reutilizada apos busca por marketplace/secret/webhook | Confirmada em Backlog no projeto correto pela busca Linear. |
| A3-05 | JON-118 | Reutilizada apos busca por painel marketplace/receita | Confirmada em Backlog no projeto correto pela busca Linear. |
| A3-06 | JON-159 | Criada nesta fase com label `Melhoria` e `Etiqueta obrigatoria pendente: api` | Readback confirmou Backlog, prioridade Medium, projeto `cbf36eac-35bc-4e05-937a-13b3aee7d61a`. |
| A3-07 | JON-157 | Criada nesta fase com label `Melhoria` e `Etiqueta obrigatoria pendente: database` | Readback confirmou Backlog, prioridade High, projeto `cbf36eac-35bc-4e05-937a-13b3aee7d61a`. |
| A3-08 | JON-158 | Criada nesta fase com label `Melhoria` e `Etiqueta obrigatoria pendente: backend` | Readback confirmou Backlog, prioridade Medium, projeto `cbf36eac-35bc-4e05-937a-13b3aee7d61a`. |
| A3-09 | JON-134 | Reutilizada apos busca por webhook pagamento/valor/transicao | Confirmada em Backlog no projeto correto pela busca Linear. |
| A3-10 | JON-59 | Reutilizada apos busca por Notificador/timeout/polling | Confirmada em Backlog no projeto correto pela busca Linear. |
| A3-11 | JON-60 | Reutilizada apos busca por Notificador/reauth | Confirmada em Backlog no projeto correto pela busca Linear. |

As labels `backend`, `api` e `database` nao existem no workspace consultado e a CLI nao cria labels; por isso as novas issues usam `Melhoria`, prefixo no titulo e a linha `Etiqueta obrigatoria pendente: <label>` no corpo, conforme regra da tarefa.

## Checagens executadas

| Checagem | Resultado | Limitacao |
|---|---|---|
| `git status --short` e `git rev-parse HEAD` | Snapshot congelado em `1ad50ea...`; worktree sujo preexistente identificado. | Nao houve limpeza nem revert. |
| Inventario AST de controllers Nest | 38 controllers e 398 operacoes REST. | Nao executa servidor; depende da sintaxe TypeScript presente. |
| Busca GraphQL | Nenhum GraphQL real encontrado. | Busca estatica por dependencias/decorators/strings. |
| `rg --files sistema/backend/src sistema/backend/prisma Notificador` | Camada backend, Prisma e Notificador cobertas. | Nao inclui frontend exceto contratos indiretamente chamados. |
| Prisma schema scan | 111 models, 0 enums, indices/uniques revisados. | Nao aplicou migrations nem consultou banco real. |
| Migrations scan | 75 migrations SQL listadas e amostradas por constraints/indices. | Nao reexecutou `prisma migrate`. |
| Buscas Linear por cada falha confirmada | Equivalentes reaproveitados; 3 lacunas criaram JON-157/JON-158/JON-159. | A deduplicacao depende dos resultados retornados pela CLI/search do Linear. |
| Readback Linear das novas issues | JON-157, JON-158 e JON-159 confirmadas com estado/projeto/prioridade/label/corpo. | Nao alterei issues antigas para evitar sobrescrever descricoes de fases anteriores. |

## Pendencias e proximos passos

- Implementar primeiro os High ligados a perda de integracao/estoque/pagamento: JON-48, JON-49, JON-134 e JON-157.
- Em seguida fechar idempotencia/concorrencia de marketplace e notificacoes: JON-159 e JON-158.
- Antes de qualquer correcao, adicionar testes sinteticos de concorrencia com promises paralelas e mocks de Prisma/HTTP; so depois validar com banco local descartavel.
- Manter issues antigas como fonte dos detalhes de fases anteriores e usar este relatorio como trilha da Fase 3.
