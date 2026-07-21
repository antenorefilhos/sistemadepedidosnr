const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    'evidence-dir': 'artifacts/web-push-homologation',
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

function resolveInsideRoot(label, value) {
  const resolved = path.resolve(rootDir, String(value || ''))
  if (!resolved.startsWith(`${rootDir}${path.sep}`) && resolved !== rootDir) {
    throw new Error(`${label} deve apontar para dentro de sistema/.`)
  }
  return resolved
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Evidencia ausente: ${path.relative(rootDir, filePath).replace(/\\/g, '/')}`)
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Evidencia JSON invalida em ${path.basename(filePath)}: ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function normalizeOrigin(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    return new URL(text).origin.toLowerCase()
  } catch {
    return text.replace(/\/+$/, '').toLowerCase()
  }
}

function parseTimestamp(payload, fileName, field = 'generatedAt') {
  const value = String(payload?.[field] || '').trim()
  assert(value, `${fileName} deve registrar ${field}.`)
  const timestamp = Date.parse(value)
  assert(Number.isFinite(timestamp), `${fileName} tem ${field} invalido.`)
  return timestamp
}

function validateInspect(payload) {
  assert(payload.command === 'inspect-web-push-subscriptions', 'web-push-inspect.json tem command inesperado.')
  assert(payload.result && typeof payload.result === 'object', 'web-push-inspect.json sem result.')
  assert(Number(payload.result.total) >= 1, 'Inspecao deve ter total>=1.')
  assert(Number(payload.result.complete) >= 1, 'Inspecao deve ter complete>=1.')
  assert(payload.result.ready === true, 'Inspecao deve ter ready=true.')
  assert(Array.isArray(payload.subscriptions) && payload.subscriptions.length >= 1, 'Inspecao deve listar pelo menos uma subscription.')
  assert(
    payload.subscriptions.some((item) => item.status === 'complete'),
    'Inspecao deve listar pelo menos uma subscription completa.',
  )
}

function validateReadiness(payload, requireExternalLive) {
  assert(payload.command === 'validate-web-push-readiness', 'web-push-readiness.json tem command inesperado.')
  assert(payload.result && typeof payload.result === 'object', 'web-push-readiness.json sem result.')
  assert(payload.result.ok === true, 'Readiness deve ter result.ok=true.')
  assert(Number(payload.result.failures) === 0, 'Readiness deve ter failures=0.')
  assert(payload.origin && typeof payload.origin === 'string', 'Readiness deve registrar origin.')
  if (requireExternalLive) {
    assert(payload.modes?.external === true, 'Readiness final deve ter modes.external=true.')
    assert(payload.modes?.live === true, 'Readiness final deve ter modes.live=true.')
  }
  assert(payload.vapid && typeof payload.vapid === 'object', 'Readiness deve registrar metadados VAPID.')
  assert(payload.vapid.publicKeySha256, 'Readiness deve registrar hash da chave publica VAPID.')
  assert(payload.vapid.publicKeyMatchesFrontend === true, 'Readiness deve confirmar paridade VAPID public/frontend.')
  if (payload.modes?.live) {
    assert(Array.isArray(payload.liveChecks) && payload.liveChecks.length >= 1, 'Readiness live deve registrar liveChecks.')
    assert(payload.liveChecks.every((item) => item.ok === true), 'Todos os liveChecks devem ter ok=true.')
  }
}

function validateDryRun(payload) {
  assert(payload.command === 'prove-web-push-delivery', 'web-push-dry-run.json tem command inesperado.')
  assert(payload.dryRun === true, 'web-push-dry-run.json deve ter dryRun=true.')
  assert(payload.result && typeof payload.result === 'object', 'web-push-dry-run.json sem result.')
  assert(Number(payload.result.dryRunTargets) >= 1, 'Dry-run deve ter dryRunTargets>=1.')
  assert(Number(payload.result.failed) === 0, 'Dry-run deve ter failed=0.')
  assert(Array.isArray(payload.targets) && payload.targets.length >= 1, 'Dry-run deve listar pelo menos um alvo.')
  assert(payload.targets.every((item) => item.status === 'dry-run'), 'Todos os alvos do dry-run devem ter status=dry-run.')
}

function validateSend(payload) {
  assert(payload.command === 'prove-web-push-delivery', 'web-push-send.json tem command inesperado.')
  assert(payload.dryRun === false, 'web-push-send.json deve ter dryRun=false.')
  assert(payload.result && typeof payload.result === 'object', 'web-push-send.json sem result.')
  assert(Number(payload.result.sent) >= 1, 'Envio real deve ter sent>=1.')
  assert(Number(payload.result.failed) === 0, 'Envio real deve ter failed=0.')
  assert(Array.isArray(payload.targets) && payload.targets.length >= 1, 'Envio real deve listar pelo menos um alvo.')
  assert(payload.targets.some((item) => item.status === 'sent'), 'Envio real deve listar pelo menos um alvo sent.')
}

function validateVisualConfirmation(payload, requireOrigin) {
  assert(payload.command === 'confirm-web-push-visual', 'web-push-visual-confirmation.json tem command inesperado.')
  assert(payload.confirmed === true, 'Confirmacao visual deve ter confirmed=true.')
  assert(String(payload.confirmedAt || '').trim(), 'Confirmacao visual deve ter confirmedAt.')
  assert(String(payload.confirmedBy || '').trim(), 'Confirmacao visual deve ter confirmedBy.')
  assert(String(payload.device || '').trim(), 'Confirmacao visual deve ter device.')
  assert(String(payload.browser || '').trim(), 'Confirmacao visual deve ter browser.')
  if (requireOrigin) {
    assert(String(payload.origin || '').trim(), 'Confirmacao visual final deve registrar origin.')
  }
}

function validateNoSecrets(payload, fileName) {
  const serialized = JSON.stringify(payload)
  const forbiddenPatterns = [
    /VAPID_PRIVATE_KEY/i,
    /STAGING_VAPID_PRIVATE_KEY/i,
    /privateKey/i,
    /p256dh/i,
    /"auth"\s*:/i,
  ]

  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(serialized), `${fileName} contem campo sensivel inesperado.`)
  }
}

function validateOriginConsistency({
  readiness,
  inspect,
  dryRun,
  send,
  visualConfirmation,
  requireReadiness,
  requireSend,
  requireVisualConfirmation,
}) {
  if (requireReadiness) {
    assert(String(inspect.origin || '').trim(), 'Inspecao final deve registrar origin.')
    assert(String(dryRun.origin || '').trim(), 'Dry-run final deve registrar origin.')
  }
  if (requireSend) {
    assert(String(send?.origin || '').trim(), 'Envio real final deve registrar origin.')
  }
  if (requireVisualConfirmation) {
    assert(String(visualConfirmation?.origin || '').trim(), 'Confirmacao visual final deve registrar origin.')
  }

  const origins = [
    ['readiness', readiness?.origin],
    ['inspect', inspect.origin],
    ['dry-run', dryRun.origin],
    ['send', send?.origin],
    ['visual confirmation', visualConfirmation?.origin],
  ]
    .map(([label, origin]) => [label, normalizeOrigin(origin)])
    .filter(([, origin]) => origin)

  const uniqueOrigins = [...new Set(origins.map(([, origin]) => origin))]
  assert(
    uniqueOrigins.length <= 1,
    `Origens inconsistentes no pacote de evidencias: ${origins.map(([label, origin]) => `${label}=${origin}`).join(', ')}.`,
  )
}

function validateChronology({
  readiness,
  inspect,
  dryRun,
  send,
  visualConfirmation,
  requireReadiness,
  requireSend,
  requireVisualConfirmation,
}) {
  const events = []
  if (readiness) events.push(['readiness', parseTimestamp(readiness, 'web-push-readiness.json')])
  events.push(['inspect', parseTimestamp(inspect, 'web-push-inspect.json')])
  events.push(['dry-run', parseTimestamp(dryRun, 'web-push-dry-run.json')])
  if (send) events.push(['send', parseTimestamp(send, 'web-push-send.json')])
  if (visualConfirmation) {
    parseTimestamp(visualConfirmation, 'web-push-visual-confirmation.json')
    events.push([
      'visual confirmation',
      parseTimestamp(visualConfirmation, 'web-push-visual-confirmation.json', 'confirmedAt'),
    ])
  }

  for (let index = 1; index < events.length; index += 1) {
    const [previousLabel, previousTimestamp] = events[index - 1]
    const [currentLabel, currentTimestamp] = events[index]
    assert(
      currentTimestamp >= previousTimestamp,
      `Cronologia invalida no pacote de evidencias: ${currentLabel} ocorreu antes de ${previousLabel}.`,
    )
  }

  if (requireReadiness) {
    assert(readiness, 'Cronologia final exige readiness.')
  }
  if (requireSend) {
    assert(send, 'Cronologia final exige envio real.')
  }
  if (requireVisualConfirmation) {
    assert(visualConfirmation, 'Cronologia final exige confirmacao visual.')
  }
}

function targetKey(item) {
  const subscriptionId = String(item?.subscriptionId || item?.id || '').trim()
  const customerId = String(item?.customerId || '').trim()
  const tenantId = String(item?.tenantId || '').trim()
  return `${subscriptionId}|${customerId}|${tenantId}`
}

function labelTarget(item) {
  return `subscription=${item?.subscriptionId || item?.id || 'sem-id'} customer=${item?.customerId || 'sem-customer'} tenant=${item?.tenantId || 'sem-tenant'}`
}

function validateTargetConsistency({ inspect, dryRun, send }) {
  const inspectedTargets = new Set(
    (inspect.subscriptions || [])
      .filter((item) => item.status === 'complete')
      .map(targetKey)
      .filter((key) => !key.startsWith('|')),
  )
  const dryRunTargets = (dryRun.targets || []).filter((item) => item.status === 'dry-run')
  const dryRunKeys = new Set(dryRunTargets.map(targetKey))

  for (const target of dryRunTargets) {
    assert(
      inspectedTargets.has(targetKey(target)),
      `Alvo do dry-run nao apareceu como subscription completa na inspecao: ${labelTarget(target)}.`,
    )
  }

  if (!send) return

  const sentTargets = (send.targets || []).filter((item) => item.status === 'sent')
  const sentKeys = new Set(sentTargets.map(targetKey))
  for (const target of sentTargets) {
    assert(
      dryRunKeys.has(targetKey(target)),
      `Alvo enviado nao apareceu no dry-run do pacote: ${labelTarget(target)}.`,
    )
  }
  for (const target of dryRunTargets) {
    assert(
      sentKeys.has(targetKey(target)),
      `Alvo do dry-run nao apareceu no envio real do pacote: ${labelTarget(target)}.`,
    )
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const evidenceDir = resolveInsideRoot('--evidence-dir', options['evidence-dir'])
  const requireReadiness = Boolean(options['require-readiness'])
  const requireSend = Boolean(options['require-send'])
  const requireVisualConfirmation = Boolean(options['require-visual-confirmation'])

  let readiness = null
  const readinessPath = path.join(evidenceDir, 'web-push-readiness.json')
  if (requireReadiness || fs.existsSync(readinessPath)) {
    readiness = readJson(readinessPath)
    validateReadiness(readiness, requireReadiness)
    validateNoSecrets(readiness, 'web-push-readiness.json')
  }

  const inspect = readJson(path.join(evidenceDir, 'web-push-inspect.json'))
  const dryRun = readJson(path.join(evidenceDir, 'web-push-dry-run.json'))

  validateInspect(inspect)
  validateDryRun(dryRun)
  validateNoSecrets(inspect, 'web-push-inspect.json')
  validateNoSecrets(dryRun, 'web-push-dry-run.json')

  let send = null
  const sendPath = path.join(evidenceDir, 'web-push-send.json')
  if (requireSend || fs.existsSync(sendPath)) {
    send = readJson(sendPath)
    validateSend(send)
    validateNoSecrets(send, 'web-push-send.json')
  }

  let visualConfirmation = null
  const visualConfirmationPath = path.join(evidenceDir, 'web-push-visual-confirmation.json')
  if (requireVisualConfirmation || fs.existsSync(visualConfirmationPath)) {
    visualConfirmation = readJson(visualConfirmationPath)
    validateVisualConfirmation(visualConfirmation, requireVisualConfirmation)
    validateNoSecrets(visualConfirmation, 'web-push-visual-confirmation.json')
  }

  validateOriginConsistency({
    readiness,
    inspect,
    dryRun,
    send,
    visualConfirmation,
    requireReadiness,
    requireSend,
    requireVisualConfirmation,
  })
  validateChronology({
    readiness,
    inspect,
    dryRun,
    send,
    visualConfirmation,
    requireReadiness,
    requireSend,
    requireVisualConfirmation,
  })
  validateTargetConsistency({ inspect, dryRun, send })

  console.log('Web Push evidence OK.')
  if (readiness) console.log(`- readiness: origin=${readiness.origin} live=${Boolean(readiness.modes?.live)}`)
  if (!readiness && !requireReadiness) console.log('- readiness: not required')
  console.log(`- inspect: total=${inspect.result.total} complete=${inspect.result.complete}`)
  console.log(`- dry-run: targets=${dryRun.result.dryRunTargets} failed=${dryRun.result.failed}`)
  if (send) console.log(`- send: sent=${send.result.sent} failed=${send.result.failed}`)
  if (!send && !requireSend) console.log('- send: not required')
  if (visualConfirmation) console.log(`- visual confirmation: confirmed by ${visualConfirmation.confirmedBy}`)
  if (!visualConfirmation && !requireVisualConfirmation) console.log('- visual confirmation: not required')
}

try {
  main()
} catch (error) {
  console.error(`Web Push evidence validation failed: ${error.message}`)
  process.exitCode = 1
}
