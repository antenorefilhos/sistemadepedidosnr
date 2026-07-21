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
    if (override || process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const options = {
    subject: 'mailto:admin@antenor.com.br',
    output: '.env.web-push',
    origin: 'http://localhost:4000',
    adminOrigin: 'http://localhost:4002',
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

  if (options['admin-origin']) {
    options.adminOrigin = options['admin-origin']
  }

  return options
}

function requireFromBackend(packageName) {
  return require(path.join(rootDir, 'backend', 'node_modules', packageName))
}

function validateSubject(subject) {
  const value = String(subject || '').trim()
  if (!value.startsWith('mailto:') && !value.startsWith('https://')) {
    throw new Error('--subject deve comecar com mailto: ou https://.')
  }
  return value
}

function validateOrigin(label, origin) {
  const value = String(origin || '').trim().replace(/\/+$/, '')
  if (!value) throw new Error(`${label} deve ser informado.`)
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} deve ser uma URL valida.`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} deve usar http:// ou https://.`)
  }
  return value
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(`${normalized}${padding}`, 'base64')
}

function validateVapidKeys(keys, subject, webpush) {
  if (!keys.publicKey || !keys.privateKey) {
    throw new Error('Informe --vapid-public-key e --vapid-private-key juntos, ou omita ambos para gerar um par novo.')
  }

  const decodedPublicKey = decodeBase64Url(keys.publicKey)
  if (decodedPublicKey.length !== 65 || decodedPublicKey[0] !== 4) {
    throw new Error('--vapid-public-key deve decodificar para uma chave P-256 publica de 65 bytes.')
  }

  const decodedPrivateKey = decodeBase64Url(keys.privateKey)
  if (decodedPrivateKey.length !== 32) {
    throw new Error('--vapid-private-key deve decodificar para 32 bytes.')
  }

  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey)
}

function resolveVapidKeys(options, subject, webpush) {
  const providedPublicKey = String(options['vapid-public-key'] || '').trim()
  const providedPrivateKey = String(options['vapid-private-key'] || '').trim()

  if (options['vapid-from-env']) {
    if (providedPublicKey || providedPrivateKey) {
      throw new Error('Use --vapid-from-env ou --vapid-public-key/--vapid-private-key, nao ambos.')
    }

    const publicKeyNames = options.staging
      ? ['STAGING_VAPID_PUBLIC_KEY', 'VAPID_PUBLIC_KEY']
      : ['VAPID_PUBLIC_KEY', 'STAGING_VAPID_PUBLIC_KEY']
    const privateKeyNames = options.staging
      ? ['STAGING_VAPID_PRIVATE_KEY', 'VAPID_PRIVATE_KEY']
      : ['VAPID_PRIVATE_KEY', 'STAGING_VAPID_PRIVATE_KEY']

    const keys = {
      publicKey: pickEnv(publicKeyNames),
      privateKey: pickEnv(privateKeyNames),
    }
    validateVapidKeys(keys, subject, webpush)
    return { keys, generated: false, source: 'env' }
  }

  if (providedPublicKey || providedPrivateKey) {
    const keys = {
      publicKey: providedPublicKey,
      privateKey: providedPrivateKey,
    }
    validateVapidKeys(keys, subject, webpush)
    return { keys, generated: false, source: 'args' }
  }

  const keys = webpush.generateVAPIDKeys()
  validateVapidKeys(keys, subject, webpush)
  return { keys, generated: true, source: 'generated' }
}

function pickEnv(names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()
    if (value) return value
  }
  return ''
}

function outputPath(value) {
  const resolved = path.resolve(rootDir, String(value || '').trim())
  if (!resolved.startsWith(`${rootDir}${path.sep}`) && resolved !== rootDir) {
    throw new Error('--output deve apontar para um arquivo dentro de sistema/.')
  }
  return resolved
}

function envLine(key, value) {
  return `${key}=${value}`
}

function buildEnvContent({ keys, subject, origin, adminOrigin, staging, databaseUrl }) {
  const corsOrigin = `${origin},${adminOrigin}`
  const lines = [
    '# Web Push homologation env',
    '# Gerado por: npm run prepare:web-push-env',
  ]

  if (databaseUrl) {
    lines.push(envLine('DATABASE_URL', databaseUrl))
  }

  lines.push(
    envLine('WEB_PUSH_ORIGIN', origin),
    envLine('FRONTEND_URL', origin),
    envLine('CORS_ORIGIN', corsOrigin),
  )

  if (staging) {
    lines.push(
      envLine('STAGING_FRONTEND_URL', origin),
      envLine('STAGING_ADMIN_URL', adminOrigin),
      envLine('STAGING_CORS_ORIGIN', corsOrigin),
      envLine('STAGING_VAPID_PUBLIC_KEY', keys.publicKey),
      envLine('STAGING_VAPID_PRIVATE_KEY', keys.privateKey),
      envLine('STAGING_VAPID_SUBJECT', subject),
    )
  } else {
    lines.push(
      envLine('VAPID_PUBLIC_KEY', keys.publicKey),
      envLine('VAPID_PRIVATE_KEY', keys.privateKey),
      envLine('VAPID_SUBJECT', subject),
    )
  }

  lines.push(envLine('VITE_VAPID_PUBLIC_KEY', keys.publicKey))

  return `${lines.join('\n')}\n`
}

function envContentToMap(content) {
  const values = new Map()
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) values.set(match[1], match[2])
  }
  return values
}

function mergeEnvContent(existingContent, generatedContent) {
  const generated = envContentToMap(generatedContent)
  const seen = new Set()
  const lines = existingContent.replace(/\s+$/, '').split(/\r?\n/)

  const mergedLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) return line
    const key = match[1]
    if (!generated.has(key)) return line
    seen.add(key)
    return envLine(key, generated.get(key))
  })

  const missingLines = []
  for (const [key, value] of generated.entries()) {
    if (!seen.has(key)) missingLines.push(envLine(key, value))
  }

  if (missingLines.length) {
    if (mergedLines.length && mergedLines[mergedLines.length - 1] !== '') {
      mergedLines.push('')
    }
    mergedLines.push('# Web Push homologation env')
    mergedLines.push(...missingLines)
  }

  return `${mergedLines.join('\n')}\n`
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  loadEnvFile(path.join(rootDir, '.env'))
  loadEnvFile(path.join(rootDir, '.env.local'))
  loadEnvFile(path.join(rootDir, '.env.staging'))
  if (options['env-file']) {
    loadEnvFile(path.resolve(rootDir, String(options['env-file'])), { override: true })
  }

  const subject = validateSubject(options.subject)
  const origin = validateOrigin('--origin', options.origin)
  const adminOrigin = validateOrigin('--admin-origin', options.adminOrigin)
  const target = outputPath(options.output)

  if (fs.existsSync(target) && !options.force && !options['merge-existing']) {
    throw new Error(`${path.relative(rootDir, target)} ja existe. Use --force para sobrescrever ou --merge-existing para preservar chaves existentes.`)
  }

  fs.mkdirSync(path.dirname(target), { recursive: true })

  const webpush = requireFromBackend('web-push')
  const { keys, generated, source } = resolveVapidKeys(options, subject, webpush)
  const staging = Boolean(options.staging)
  const databaseUrl = String(options['database-url'] || '').trim()
  const content = buildEnvContent({ keys, subject, origin, adminOrigin, staging, databaseUrl })
  const shouldMerge = Boolean(options['merge-existing'] && fs.existsSync(target))
  const finalContent = shouldMerge ? mergeEnvContent(fs.readFileSync(target, 'utf8'), content) : content

  fs.writeFileSync(target, finalContent, 'utf8')

  console.log(`Web Push env written: ${path.relative(rootDir, target)}`)
  console.log(`Origin: ${origin}`)
  console.log(`Mode: ${staging ? 'staging' : 'default'}`)
  console.log(`VAPID: ${generated ? 'generated' : `provided (${source})`}`)
  console.log(`Write mode: ${shouldMerge ? 'merge-existing' : 'replace'}`)
  const relativeTarget = path.relative(rootDir, target).replace(/\\/g, '/')
  const externalFlag = origin.startsWith('https://') ? ' --external' : ''
  console.log(`Next: npm run validate:web-push-readiness --${externalFlag} --env-file ${relativeTarget}`)
}

try {
  main()
} catch (error) {
  console.error(`Web Push env preparation failed: ${error.message}`)
  process.exitCode = 1
}
