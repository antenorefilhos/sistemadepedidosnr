const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {}

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
    if (override || process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function optionArgs(options, keys) {
  const args = []
  for (const key of keys) {
    if (options[key] === undefined) continue
    args.push(`--${key}`)
    if (options[key] !== true) args.push(String(options[key]))
  }
  return args
}

function outputDir(value, label = '--evidence-dir') {
  if (!value) return null
  const resolved = path.resolve(rootDir, String(value))
  if (!resolved.startsWith(`${rootDir}${path.sep}`) && resolved !== rootDir) {
    throw new Error(`${label} deve apontar para um diretorio dentro de sistema/.`)
  }
  fs.mkdirSync(resolved, { recursive: true })
  return resolved
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function sanitizeRunId(value) {
  const runId = String(value || '').trim()
  if (!runId) return timestampSlug()
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) {
    throw new Error('--evidence-run-id deve conter apenas letras, numeros, ponto, hifen ou underscore.')
  }
  return runId
}

function resolveEvidenceDirectory(options) {
  if (!options['evidence-dir-auto']) return outputDir(options['evidence-dir'])

  const baseDir = outputDir(options['evidence-dir'] || 'artifacts/web-push-homologation')
  const runId = sanitizeRunId(options['evidence-run-id'])
  const runDir = outputDir(path.join(relative(baseDir), runId), '--evidence-dir-auto')
  console.log(`Web Push evidence directory: ${relative(runDir)}`)
  return runDir
}

function evidenceArgs(directory, fileName) {
  if (!directory) return []
  return ['--json-output', path.relative(rootDir, path.join(directory, fileName)).replace(/\\/g, '/')]
}

function relative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function normalizeOrigin(value) {
  const text = String(value || '').trim().replace(/\/+$/, '')
  if (!text) return null
  try {
    return new URL(text).origin
  } catch {
    throw new Error('--origin deve ser uma URL valida.')
  }
}

function applyOriginOverride(options) {
  const origin = normalizeOrigin(options.origin)
  if (!origin) return null
  process.env.WEB_PUSH_ORIGIN = origin
  process.env.FRONTEND_URL = origin
  return origin
}

function runStep(label, scriptName, args) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(process.execPath, [path.join('scripts', scriptName), ...args], {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${label} falhou com exit code ${result.status}.`)
  }
}

function requireEvidenceDirectory(evidenceDirectory, optionName) {
  if (!evidenceDirectory) {
    throw new Error(`${optionName} exige --evidence-dir.`)
  }
}

function requireEmptyEvidenceDirectory(evidenceDirectory, options) {
  if (!options['require-empty-evidence-dir']) return
  requireEvidenceDirectory(evidenceDirectory, '--require-empty-evidence-dir')

  const entries = fs.readdirSync(evidenceDirectory)
  if (entries.length > 0 && !options['force-evidence-overwrite']) {
    throw new Error(
      `--require-empty-evidence-dir encontrou arquivos em ${relative(evidenceDirectory)}. Use outra pasta, limpe os arquivos existentes ou informe --force-evidence-overwrite.`,
    )
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const evidenceDirectory = resolveEvidenceDirectory(options)
  requireEmptyEvidenceDirectory(evidenceDirectory, options)

  loadEnvFile(path.join(rootDir, '.env'))
  loadEnvFile(path.join(rootDir, '.env.local'))
  loadEnvFile(path.join(rootDir, '.env.staging'))

  const envFile = options['env-file']
  if (envFile) {
    loadEnvFile(path.resolve(rootDir, String(envFile)), { override: true })
  }
  const originOverride = applyOriginOverride(options)

  const readinessArgs = []
  if (options.external) readinessArgs.push('--external')
  if (options.live) readinessArgs.push('--live')
  if (envFile) readinessArgs.push('--env-file', String(envFile))
  if (originOverride) readinessArgs.push('--origin', originOverride)
  readinessArgs.push(...evidenceArgs(evidenceDirectory, 'web-push-readiness.json'))

  runStep('Preflight Web Push', 'validate-web-push-readiness.js', readinessArgs)

  if (options['readiness-only']) {
    console.log('\nWeb Push homologation stopped after readiness (--readiness-only).')
    return
  }

  if (options['validate-evidence']) {
    requireEvidenceDirectory(evidenceDirectory, '--validate-evidence')
  }
  if (options.report) {
    requireEvidenceDirectory(evidenceDirectory, '--report')
  }
  if (options['require-visual-confirmation']) {
    requireEvidenceDirectory(evidenceDirectory, '--require-visual-confirmation')
  }

  const filterKeys = ['customer-id', 'customer-email', 'endpoint-contains', 'tenant', 'limit']
  const filterArgs = optionArgs(options, filterKeys)

  runStep('Inspecao de subscriptions', 'inspect-web-push-subscriptions.js', [
    '--require-ready',
    ...(originOverride ? ['--origin', originOverride] : []),
    ...filterArgs,
    ...evidenceArgs(evidenceDirectory, 'web-push-inspect.json'),
  ])

  const payloadKeys = ['title', 'body', 'icon', 'url']
  const payloadArgs = optionArgs(options, payloadKeys)
  const proveArgs = [...filterArgs, ...payloadArgs]

  runStep('Dry-run da prova Web Push', 'prove-web-push-delivery.js', [
    '--dry-run',
    ...proveArgs,
    ...evidenceArgs(evidenceDirectory, 'web-push-dry-run.json'),
  ])

  if (!options.send) {
    if (options['validate-evidence']) {
      const validateArgs = [
        '--evidence-dir',
        relative(evidenceDirectory),
      ]
      if (evidenceDirectory) validateArgs.push('--require-readiness')
      if (options['require-visual-confirmation']) validateArgs.push('--require-visual-confirmation')
      runStep('Validacao do pacote de evidencias', 'validate-web-push-evidence.js', validateArgs)
    }

    if (options.report) {
      const reportArgs = [
        '--evidence-dir',
        relative(evidenceDirectory),
      ]
      if (evidenceDirectory) reportArgs.push('--require-readiness')
      if (options['require-visual-confirmation']) reportArgs.push('--require-visual-confirmation')
      runStep('Relatorio de homologacao Web Push', 'generate-web-push-homologation-report.js', reportArgs)
    }

    console.log('\nWeb Push homologation ready for real send. Reexecute with --send to dispatch the notification.')
    return
  }

  runStep('Envio real Web Push', 'prove-web-push-delivery.js', [
    ...proveArgs,
    ...evidenceArgs(evidenceDirectory, 'web-push-send.json'),
  ])

  if (options['validate-evidence']) {
    const validateArgs = [
      '--evidence-dir',
      relative(evidenceDirectory),
      '--require-send',
    ]
    if (evidenceDirectory) validateArgs.push('--require-readiness')
    if (options['require-visual-confirmation']) validateArgs.push('--require-visual-confirmation')
    runStep('Validacao do pacote de evidencias', 'validate-web-push-evidence.js', validateArgs)
  }

  if (options.report) {
    const reportArgs = [
      '--evidence-dir',
      relative(evidenceDirectory),
      '--require-send',
    ]
    if (evidenceDirectory) reportArgs.push('--require-readiness')
    if (options['require-visual-confirmation']) reportArgs.push('--require-visual-confirmation')
    runStep('Relatorio de homologacao Web Push', 'generate-web-push-homologation-report.js', reportArgs)
  }

  console.log('\nWeb Push homologation completed.')
}

try {
  main()
} catch (error) {
  console.error(`Web Push homologation failed: ${error.message}`)
  process.exitCode = 1
}
