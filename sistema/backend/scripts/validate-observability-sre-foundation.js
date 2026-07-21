const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const requiredFiles = [
  'src/common/observability/request-context.middleware.ts',
  'src/common/observability/metrics-registry.ts',
  'src/modules/observability/observability.module.ts',
  'src/modules/observability/observability.controller.ts',
  'src/modules/observability/observability.service.ts',
  'src/modules/observability/observability.service.spec.ts',
]

const requiredSnippets = [
  ['src/common/interceptors/http-logging.interceptor.ts', ['request_id', 'correlation_id', 'order_trace_id', 'tenant_id', 'store_id', 'MetricsRegistry.observeHttp']],
  ['src/modules/integrations/health.controller.ts', ['paymentsGateway', 'queue', 'storage', 'checkDatabase', 'checkRedis', 'checkMeilisearch', 'checkSolidcom']],
  ['src/modules/observability/observability.controller.ts', ['metrics/prometheus', 'alerts/check', 'status-page', 'runbooks']],
  ['src/modules/observability/observability.service.ts', ['withoutErpSyncAboveSla', 'failedWebhooks', 'expiredReservations', 'pendingAboveSla', 'getRunbooks']],
  ['src/app.module.ts', ['RequestContextMiddleware', 'ObservabilityModule']],
]

for (const file of requiredFiles) {
  const absolute = path.join(root, file)
  if (!fs.existsSync(absolute)) {
    throw new Error(`missing observability file: ${file}`)
  }
}

for (const [file, snippets] of requiredSnippets) {
  const absolute = path.join(root, file)
  const content = fs.readFileSync(absolute, 'utf8')
  const missing = snippets.filter((snippet) => !content.includes(snippet))
  if (missing.length > 0) {
    throw new Error(`${file} missing snippets: ${missing.join(', ')}`)
  }
}

console.log('Observability SRE foundation valid')
