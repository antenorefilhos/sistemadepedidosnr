# CONFIGURACOES.md - Ambientes e Parametros

Data: 6 de junho de 2026
Versao de referencia: 1.24.122-alpha

## Backend

Arquivo base: sistema/backend/.env

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db:5432/antenor_db?schema=public"
JWT_SECRET="[USE_STRONG_SECRET_32_CHARS]"
JWT_EXPIRES_IN="24h"
PORT=3001
NODE_ENV="production"
CORS_ORIGIN="http://localhost:3000,http://localhost:3002"
FRONTEND_URL="http://localhost:3000"
ADMIN_URL="http://localhost:3002"
WEB_PUSH_ORIGIN="http://localhost:3000"
DEFAULT_TENANT_ID="tenant_default"
DEFAULT_STORE_ID="store_default"
ALLOW_DEFAULT_TENANT_CONTEXT=false
REDIS_URL="redis://redis:6379"
MEILI_HOST="http://meili:7700"
MEILI_MASTER_KEY="[MASTER_KEY]"

SOLIDCOM_API_URL="http://[IP]:5000"
SOLIDCOM_API_KEY="[API_KEY]"
SOLIDCOM_CNPJ="[CNPJ]"
SOLIDCOM_CODECOM="[CODECOM]"
SOLIDCOM_BALCAO_CPF="[CPF]"

PAYMENTS_PROVIDER_NAME=""
PAYMENTS_PROVIDER_URL=""
PAYMENTS_API_KEY=""
PAYMENTS_WEBHOOK_SECRET=""
PIX_KEY=""

NFE_PROVIDER_NAME=""
NFE_PROVIDER_URL=""
NFE_API_KEY=""
NFE_CNPJ_EMITENTE=""
NFE_CERT_PATH=""

HUBSPOT_API_KEY=""
HUBSPOT_PORTAL_ID=""
HUBSPOT_DEFAULT_OWNER_ID=""

WHATSAPP_API_URL="https://graph.instagram.com/v18.0"
WHATSAPP_API_TOKEN=""
WHATSAPP_BUSINESS_ID=""
WHATSAPP_PHONE_ID=""
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:admin@antenor.com.br"
GOOGLE_MAP_API_KEY=""
ERP_SYNC_INTERVAL=300000
ALLOW_GUEST_CHECKOUT=true
ENABLE_PAYMENTS_INTEGRATION=false
ENABLE_LEGACY_CLASSIFICATION_MAPPINGS=false

# Modulos plugaveis de integracao (conectavel/desconectavel)
INTEGRATION_SOLIDCOM_ENABLED=true
INTEGRATION_HUBSPOT_ENABLED=false
INTEGRATION_RDSTATION_ENABLED=false
INTEGRATION_META_PIXEL_ENABLED=false
INTEGRATION_NFE_ENABLED=false
INTEGRATION_PAYMENTS_ENABLED=false
```

## Frontend

Arquivo base: sistema/frontend/.env

```env
VITE_API_URL="http://localhost:3001"
VITE_API_TIMEOUT=10000
VITE_GUEST_CHECKOUT_ENABLED=true
VITE_PAYMENTS_UI_ENABLED=false
VITE_VAPID_PUBLIC_KEY=""
VITE_MAPBOX_ACCESS_TOKEN=""
```

## Admin

Arquivo base: sistema/admin/.env

```env
VITE_API_URL="http://localhost:3001"
VITE_API_TIMEOUT=10000
```

## Observacoes importantes

- o provider atual do Prisma e postgresql
- Redis e MeiliSearch fazem parte do setup recomendado e do compose local
- o backend usa `MEILI_HOST` como URL do MeiliSearch; manter alinhado com `docker-compose.yml`
- a URL de banco para Docker usa host db; fora do Docker deve apontar para localhost ou ambiente equivalente
- no compose local, o PostgreSQL esta publicado em `localhost:5432` para comandos Prisma fora de container
- a Solidcom nao deve ser tratada como API primaria do dominio no roadmap futuro
- o modulo Solidcom pode ser desativado via `INTEGRATION_SOLIDCOM_ENABLED=false` sem apagar dados de produtos/clientes/pedidos ja persistidos
- modulos futuros (HubSpot, RD Station, Meta Pixel, NF-e, Pagamentos) seguem a mesma estrategia via flags `INTEGRATION_*_ENABLED`
- a partir do M40, o estado efetivo das extensoes e persistido em banco (`integration_module_configs`) e controlado pelo painel de Integracoes (toggle ativar/desativar)
- as flags `INTEGRATION_*_ENABLED` passam a funcionar como default inicial/fallback quando ainda nao existe override persistido no banco
- chaves de pagamentos/webhook devem ficar exclusivas no backend
- `JWT_SECRET` deve ter pelo menos 32 caracteres e nao pode usar placeholder (`change-me`, `secret`, etc.) fora de `development/test`
- `CORS_ORIGIN` ou `CORS_ORIGINS` deve listar origens permitidas separadas por virgula; em `production` a API falha boot se nenhuma origem for configurada
- `DEFAULT_TENANT_ID` e `DEFAULT_STORE_ID` preservam o modo single-store legado enquanto a UI multiloja completa nao existe
- `ALLOW_DEFAULT_TENANT_CONTEXT=false` em producao faz APIs privadas rejeitarem fallback default quando o JWT/header/subdominio nao resolveu tenant explicitamente
- APIs e integracoes podem enviar `x-tenant-id` e `x-store-id`; aliases internos `x-internal-tenant-id` e `x-internal-store-id` tambem sao aceitos
- se `ENABLE_PAYMENTS_INTEGRATION=true` ou `INTEGRATION_PAYMENTS_ENABLED=true`, `PAYMENTS_WEBHOOK_SECRET` precisa estar configurado; webhook sem segredo e recusado
- com gateway ativo, pedido online so deve ser confirmado apos pagamento `PAID`, `AUTHORIZED` ou `CAPTURED`; metodos na entrega continuam como fluxo offline
- ledger financeiro M09 fica disponivel mesmo com gateway desativado: `PaymentTransaction`, `PaymentEvent`, `Refund` e `PaymentReconciliationRun`
- integracoes resilientes M10 usam Postgres outbox como fila equivalente inicial: `IntegrationConnector`, `OutboxEvent`, `IntegrationJob`, `IntegrationAttempt` e `IntegrationDeadLetter`
- API publica/webhooks M11 usam `ApiClient`, `WebhookEndpoint`, `WebhookDelivery` e `ApiUsageLog`; cliente externo deve usar `x-api-key` ou Bearer no formato `clientId.secret`
- scopes iniciais da API publica: `orders.read`, `products.read`, `stock.read` ou `*`; cliente revogado/inativo deve ser bloqueado
- webhooks M11 assinam payload JSON com HMAC SHA-256 em `x-antenor-signature` e mantem retry/backoff/DLQ em banco
- BI/analytics M13 usa `MetricSnapshot` e `AnalyticsEvent` com tenant/store/canal/sessao; snapshots podem ser regenerados por `POST /api/analytics/admin/metric-snapshots/generate`
- dashboards operacionais M13 ficam em `GET /api/analytics/admin/operational-dashboard`; drill-down por loja/categoria/produto/canal fica em `GET /api/analytics/admin/drilldown`
- observabilidade M14 gera `x-request-id`, `x-correlation-id` e `x-order-trace-id`; ao reportar erro, registrar pelo menos o `x-request-id`
- metricas SRE ficam em `GET /api/observability/metrics` e `GET /api/observability/metrics/prometheus`; health detalhado fica em `GET /api/health/detail`
- alertas/status/runbooks M14 ficam em `POST /api/observability/alerts/check`, `GET /api/observability/status-page` e `GET /api/observability/runbooks`
- marketplace/multicanal M15 usa `SalesChannel`, `ChannelProduct`, `MarketplaceOrder`, `ChannelPricePolicy` e `ChannelStockPolicy`
- pedido externo entra por `POST /api/marketplace/channels/:channelId/orders`; se `config.webhookSecret` existir no canal, enviar `x-marketplace-secret`
- painel de dependencia/margem por canal fica em `GET /api/marketplace/panel`
- personalizacao/recomendacao M16 usa `RecommendationEvent` para medir impressao, clique, add-to-cart e compra originados por recomendacao
- endpoints M16 ficam em `/api/recommendations/rebuy`, `/api/recommendations/complementary/:productId`, `/api/recommendations/substitutes/:productId`, `/api/recommendations/showcase`, `/api/recommendations/events` e `/api/recommendations/operational-insights`
- recomendacoes M16 devem filtrar produto inativo, `syncOption=NUNCA` e item sem estoque quando dependente de estoque; substitutos tambem devem respeitar categoria/classificacao e faixa de preco
- seguranca/LGPD M17 usa `DataSubjectRequest` para registrar solicitacoes do titular e `AuditLog` para alteracoes sensiveis
- endpoints M17 ficam em `/api/data-privacy/customers/:customerId/consents`, `/api/data-privacy/customers/:customerId/export`, `/api/data-privacy/customers/:customerId/anonymize`, `/api/data-privacy/retention-policy` e `/api/data-privacy/requests`
- consentimentos LGPD formais: `TERMS`, `PRIVACY`, `WHATSAPP`, `EMAIL` e `SMS`; status validos: `OPT_IN`, `OPT_OUT`, `REVOKED`
- anonimizacao LGPD bloqueia cliente com pedido ativo sem `force=true` e deve ser usada com criterio operacional/fiscal
- falhas de ERP devem ser rastreadas pelo outbox/DLQ e reprocessadas via endpoints de replay, nao apenas por chamada direta ao provedor
- `ALLOW_GUEST_CHECKOUT` controla criacao de checkout convidado no backend
- `VITE_GUEST_CHECKOUT_ENABLED` controla se o storefront libera checkout sem login
- `ENABLE_PAYMENTS_INTEGRATION` deve permanecer `false` enquanto pagamento seguir operacionalmente por fora
- `ENABLE_LEGACY_CLASSIFICATION_MAPPINGS` deve permanecer `false` para priorizar a taxonomia nova (EAN -> N1/N2) no storefront
- `VITE_PAYMENTS_UI_ENABLED` deve permanecer `false` para ocultar UI de gateway no storefront
- `VITE_MAPBOX_ACCESS_TOKEN` habilita reverse/forward geocoding no checkout (fluxo GPS -> CEP fallback -> geocoding)
- para evitar ORB/CORS em imagens, o storefront usa `/uploads/...` via proxy Nginx local
- vitrines da Home usam configuracao de categorias CMS (`active`, `priority`, `limit`)
- admin local publica HTTP em `http://localhost:3002` e HTTPS em `https://localhost:3444`
- admin na rede local publica HTTP em `http://192.168.0.7:3002` e HTTPS em `https://192.168.0.7:3444`

## Prisma atual

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Comandos basicos

```bash
cd sistema/backend
npx prisma migrate dev --name nome_da_migracao
npx prisma generate
npm run prisma:seed
npm run tenant:validate-backfill
npm run catalog:validate-foundation
npm run inventory:validate-foundation
npm run pricing:validate-foundation
npm run checkout:validate-foundation
npm run oms:validate-foundation
npm run picking:validate-foundation
npm run integrations:validate-outbox
npm run fulfillment:validate-foundation
npm run payments:validate-foundation
npm run public-api:validate-foundation
npm run crm:validate-foundation
npm run bi:validate-foundation
npm run observability:validate-foundation
npm run marketplace:validate-foundation
```
