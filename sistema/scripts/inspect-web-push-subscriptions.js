const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (override || process.env[key] === undefined) process.env[key] = value
  }
}

function parseArgs(argv) {
  const options = { limit: 20 }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
    } else {
      options[key] = next
      index += 1
    }
  }

  return options
}

function requireFromBackend(packageName) {
  return require(path.join(rootDir, 'backend', 'node_modules', packageName))
}

function requireEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} nao configurado.`)
  return value
}

function compactEndpoint(endpoint) {
  if (!endpoint || endpoint.length <= 72) return endpoint
  return `${endpoint.slice(0, 44)}...${endpoint.slice(-24)}`
}

function outputPath(value) {
  if (!value) return null
  const resolved = path.resolve(rootDir, String(value))
  if (!resolved.startsWith(`${rootDir}${path.sep}`) && resolved !== rootDir) {
    throw new Error('--json-output deve apontar para um arquivo dentro de sistema/.')
  }
  return resolved
}

function writeJsonOutput(filePath, payload) {
  if (!filePath) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Evidence written: ${path.relative(rootDir, filePath).replace(/\\/g, '/')}`)
}

function originFromOptions(options) {
  return String(options.origin || process.env.WEB_PUSH_ORIGIN || process.env.FRONTEND_URL || '').trim() || null
}

function providerFromEndpoint(endpoint) {
  try {
    return new URL(endpoint).hostname
  } catch {
    return 'endpoint-invalido'
  }
}

function isComplete(subscription) {
  return Boolean(subscription.endpoint && subscription.auth && subscription.p256dh)
}

function ageInDays(createdAt) {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return null
  return Math.max(0, Math.floor((Date.now() - created) / 86400000))
}

function normalizeLimit(value) {
  const limit = Number(value || 20)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('--limit deve ser um inteiro entre 1 e 100.')
  }
  return limit
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const jsonOutput = outputPath(options['json-output'])

  loadEnvFile(path.join(rootDir, '.env'))
  loadEnvFile(path.join(rootDir, '.env.local'))
  loadEnvFile(path.join(rootDir, '.env.staging'))
  if (options['env-file']) {
    loadEnvFile(path.resolve(rootDir, String(options['env-file'])), { override: true })
  }

  const limit = normalizeLimit(options.limit)
  requireEnv('DATABASE_URL')

  const { PrismaClient } = requireFromBackend('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const where = {}
    if (options['customer-id']) where.customerId = String(options['customer-id'])
    if (options['endpoint-contains']) where.endpoint = { contains: String(options['endpoint-contains']) }
    if (options.tenant) where.tenantId = String(options.tenant)

    if (options['customer-email']) {
      const customer = await prisma.customer.findUnique({
        where: { email: String(options['customer-email']) },
        select: { id: true, email: true },
      })
      if (!customer) throw new Error(`Cliente nao encontrado para email ${options['customer-email']}.`)
      if (where.customerId && where.customerId !== customer.id) {
        throw new Error('Filtros --customer-id e --customer-email apontam para clientes diferentes.')
      }
      where.customerId = customer.id
    }

    const completeWhere = {
      AND: [
        where,
        { endpoint: { not: '' } },
        { auth: { not: '' } },
        { p256dh: { not: '' } },
      ],
    }
    const incompleteWhere = {
      AND: [
        where,
        { OR: [{ endpoint: '' }, { auth: '' }, { p256dh: '' }] },
      ],
    }

    const [total, complete, incomplete, subscriptions] = await Promise.all([
      prisma.pushSubscription.count({ where }),
      prisma.pushSubscription.count({
        where: completeWhere,
      }),
      prisma.pushSubscription.count({
        where: incompleteWhere,
      }),
      prisma.pushSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    const byCustomer = new Map()
    const byProvider = new Map()
    const evidenceRows = []

    for (const item of subscriptions) {
      byCustomer.set(item.customerId, (byCustomer.get(item.customerId) || 0) + 1)
      const provider = providerFromEndpoint(item.endpoint)
      byProvider.set(provider, (byProvider.get(provider) || 0) + 1)
      const age = ageInDays(item.createdAt)
      evidenceRows.push({
        id: item.id,
        customerId: item.customerId,
        tenantId: item.tenantId,
        status: isComplete(item) ? 'complete' : 'incomplete',
        provider,
        ageDays: age,
        endpoint: compactEndpoint(item.endpoint),
      })
    }

    console.log(`Web Push subscriptions: total=${total} complete=${complete} incomplete=${incomplete}`)
    console.log(`Showing ${subscriptions.length} most recent subscription(s).`)

    if (subscriptions.length > 0) {
      console.log('By provider in shown rows:')
      for (const [provider, count] of [...byProvider.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`- ${provider}: ${count}`)
      }

      console.log('By customer in shown rows:')
      for (const [customerId, count] of [...byCustomer.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`- ${customerId}: ${count}`)
      }

      console.log('Recent subscriptions:')
      for (const item of subscriptions) {
        const age = ageInDays(item.createdAt)
        const ageLabel = age === null ? 'idade-desconhecida' : `${age}d`
        console.log(
          `- ${item.id} customer=${item.customerId} tenant=${item.tenantId} status=${
            isComplete(item) ? 'complete' : 'incomplete'
          } age=${ageLabel} endpoint=${compactEndpoint(item.endpoint)}`,
        )
      }
    }

    if (total === 0) {
      console.log('Next: abra o storefront em HTTPS, entre como cliente, clique no sino e ative notificacoes.')
    } else if (complete === 0) {
      console.log('Next: existe registro, mas nenhuma subscription completa para envio Web Push.')
    } else {
      console.log('Next: rode npm run prove:web-push-delivery para disparar a prova real.')
    }

    if (options['require-ready'] && complete === 0) {
      process.exitCode = 1
    }

    writeJsonOutput(jsonOutput, {
      generatedAt: new Date().toISOString(),
      command: 'inspect-web-push-subscriptions',
      origin: originFromOptions(options),
      filters: {
        customerId: options['customer-id'] ? String(options['customer-id']) : null,
        customerEmail: options['customer-email'] ? String(options['customer-email']) : null,
        endpointContains: options['endpoint-contains'] ? String(options['endpoint-contains']) : null,
        tenant: options.tenant ? String(options.tenant) : null,
        limit,
        requireReady: Boolean(options['require-ready']),
      },
      result: {
        total,
        complete,
        incomplete,
        shown: subscriptions.length,
        ready: complete > 0,
      },
      providers: Object.fromEntries([...byProvider.entries()].sort((a, b) => b[1] - a[1])),
      customers: Object.fromEntries([...byCustomer.entries()].sort((a, b) => b[1] - a[1])),
      subscriptions: evidenceRows,
    })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`Web Push subscription inspection failed: ${error.message}`)
  process.exitCode = 1
})
