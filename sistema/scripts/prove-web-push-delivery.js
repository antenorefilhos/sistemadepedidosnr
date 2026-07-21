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
  const options = {
    title: 'Antenor & Filhos - prova Web Push',
    body: `Notificacao real enviada em ${new Date().toISOString()}`,
    url: '/',
  }

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

function pickVapid(name) {
  return String(process.env[name] || process.env[`STAGING_${name}`] || '').trim()
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

function originFromEnv() {
  return String(process.env.WEB_PUSH_ORIGIN || process.env.FRONTEND_URL || '').trim() || null
}

function normalizeLimit(value) {
  const limit = Number(value || 1)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('--limit deve ser um inteiro entre 1 e 100.')
  }
  return limit
}

function isExpiredStatus(statusCode) {
  return statusCode === 404 || statusCode === 410
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

  const publicKey = pickVapid('VAPID_PUBLIC_KEY')
  const privateKey = pickVapid('VAPID_PRIVATE_KEY')
  const subject = String(process.env.VAPID_SUBJECT || process.env.STAGING_VAPID_SUBJECT || 'mailto:admin@antenor.com.br').trim()

  if (!publicKey) throw new Error('VAPID_PUBLIC_KEY/STAGING_VAPID_PUBLIC_KEY nao configurada.')
  if (!privateKey) throw new Error('VAPID_PRIVATE_KEY/STAGING_VAPID_PRIVATE_KEY nao configurada.')
  requireEnv('DATABASE_URL')

  const { PrismaClient } = requireFromBackend('@prisma/client')
  const webpush = requireFromBackend('web-push')
  const prisma = new PrismaClient()

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)

    const limit = normalizeLimit(options.limit)
    const dryRun = Boolean(options['dry-run'])
    const cleanupExpired = Boolean(options['cleanup-expired'])
    const cleanupIncomplete = Boolean(options['cleanup-incomplete'])

    const where = {}
    if (options['customer-id']) where.customerId = String(options['customer-id'])
    if (options.tenant) where.tenantId = String(options.tenant)
    if (options['endpoint-contains']) {
      where.endpoint = { contains: String(options['endpoint-contains']) }
    }

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

    const subscriptions = await prisma.pushSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    if (subscriptions.length === 0) {
      throw new Error('Nenhuma push subscription encontrada. Instale/abra o PWA em HTTPS, aceite notificacoes e registre a subscription antes da prova.')
    }

    const payload = JSON.stringify({
      title: String(options.title),
      body: String(options.body),
      icon: String(options.icon || '/branding/logo-branco.png'),
      url: String(options.url || '/'),
    })

    let sent = 0
    let failed = 0
    let dryRunTargets = 0
    let expiredRemoved = 0
    let incompleteRemoved = 0
    const failures = []
    const targetResults = []

    for (const subscription of subscriptions) {
      if (!subscription.endpoint || !subscription.auth || !subscription.p256dh) {
        failed += 1
        failures.push(`${subscription.id}: subscription incompleta`)
        if (cleanupIncomplete) {
          await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } })
          incompleteRemoved += 1
        }
        targetResults.push({
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          tenantId: subscription.tenantId,
          endpoint: compactEndpoint(subscription.endpoint),
          status: 'incomplete',
          removed: cleanupIncomplete,
        })
        continue
      }

      if (dryRun) {
        dryRunTargets += 1
        console.log(`DRY-RUN ${subscription.customerId} ${compactEndpoint(subscription.endpoint)}`)
        targetResults.push({
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          tenantId: subscription.tenantId,
          endpoint: compactEndpoint(subscription.endpoint),
          status: 'dry-run',
          removed: false,
        })
        continue
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh,
            },
          },
          payload,
        )
        sent += 1
        console.log(`OK ${subscription.customerId} ${compactEndpoint(subscription.endpoint)}`)
        targetResults.push({
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          tenantId: subscription.tenantId,
          endpoint: compactEndpoint(subscription.endpoint),
          status: 'sent',
          removed: false,
        })
      } catch (error) {
        failed += 1
        const statusCode = Number(error?.statusCode || 0)
        const expired = isExpiredStatus(statusCode)
        failures.push(`${subscription.id}: ${statusCode || 'sem-status'} ${error?.message || error}${expired ? ' (expirada)' : ''}`)
        if (expired && cleanupExpired) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } })
          expiredRemoved += 1
        }
        targetResults.push({
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          tenantId: subscription.tenantId,
          endpoint: compactEndpoint(subscription.endpoint),
          status: expired ? 'expired' : 'failed',
          statusCode: statusCode || null,
          removed: expired && cleanupExpired,
        })
      }
    }

    if (dryRun) {
      console.log(`Web Push proof dry-run: targets=${dryRunTargets} failed=${failed}`)
      console.log(`Payload: ${payload}`)
    } else {
      console.log(
        `Web Push proof result: sent=${sent} failed=${failed} expiredRemoved=${expiredRemoved} incompleteRemoved=${incompleteRemoved}`,
      )
    }

    if (failures.length) {
      console.error('Failures:')
      for (const failure of failures) console.error(`- ${failure}`)
    }

    writeJsonOutput(jsonOutput, {
      generatedAt: new Date().toISOString(),
      command: 'prove-web-push-delivery',
      origin: originFromEnv(),
      dryRun,
      filters: {
        customerId: options['customer-id'] ? String(options['customer-id']) : null,
        customerEmail: options['customer-email'] ? String(options['customer-email']) : null,
        endpointContains: options['endpoint-contains'] ? String(options['endpoint-contains']) : null,
        tenant: options.tenant ? String(options.tenant) : null,
        limit,
      },
      cleanup: {
        cleanupExpired,
        cleanupIncomplete,
      },
      payload: JSON.parse(payload),
      result: {
        sent,
        failed,
        dryRunTargets,
        expiredRemoved,
        incompleteRemoved,
      },
      failures,
      targets: targetResults,
    })

    if (dryRun) {
      if (dryRunTargets === 0 || failed > 0) process.exitCode = 1
    } else if (sent === 0 || failed > 0) {
      process.exitCode = 1
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`Web Push proof failed: ${error.message}`)
  process.exitCode = 1
})
