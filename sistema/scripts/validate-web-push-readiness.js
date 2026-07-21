const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const frontendDir = path.join(rootDir, 'frontend')
const publicDir = path.join(frontendDir, 'public')
const indexPath = path.join(frontendDir, 'index.html')
const manifestPath = path.join(publicDir, 'manifest.webmanifest')
const serviceWorkerPath = path.join(publicDir, 'service-worker.js')

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

const options = parseArgs(process.argv.slice(2))
const externalMode = Boolean(options.external)
const liveMode = Boolean(options.live)

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

loadEnvFile(path.join(rootDir, '.env'))
loadEnvFile(path.join(rootDir, '.env.local'))
loadEnvFile(path.join(rootDir, '.env.staging'))

if (options['env-file']) {
  loadEnvFile(path.resolve(rootDir, String(options['env-file'])), { override: true })
}

if (options.origin) {
  const origin = String(options.origin).trim().replace(/\/+$/, '')
  try {
    const normalizedOrigin = new URL(origin).origin
    process.env.WEB_PUSH_ORIGIN = normalizedOrigin
    process.env.FRONTEND_URL = normalizedOrigin
  } catch {
    process.env.WEB_PUSH_ORIGIN = origin
    process.env.FRONTEND_URL = origin
  }
}

const failures = []
const warnings = []
const liveChecks = []

function fail(message) {
  failures.push(message)
}

function warn(message) {
  warnings.push(message)
}

function outputPath(value) {
  if (!value) return null
  const resolved = path.resolve(rootDir, String(value))
  if (!resolved.startsWith(`${rootDir}${path.sep}`) && resolved !== rootDir) {
    throw new Error('--json-output deve apontar para um arquivo dentro de sistema/.')
  }
  return resolved
}

function relative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function hashValue(value) {
  return value ? crypto.createHash('sha256').update(value).digest('hex') : null
}

function writeJsonOutput(filePath, ok) {
  if (!filePath) return
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || process.env.STAGING_VAPID_PUBLIC_KEY || '').trim()
  const frontendKey = String(process.env.VITE_VAPID_PUBLIC_KEY || process.env.STAGING_VAPID_PUBLIC_KEY || '').trim()
  const subject = String(process.env.VAPID_SUBJECT || process.env.STAGING_VAPID_SUBJECT || 'mailto:admin@antenor.com.br').trim()
  const origin = storefrontOrigin() || null
  const payload = {
    generatedAt: new Date().toISOString(),
    command: 'validate-web-push-readiness',
    modes: {
      external: externalMode,
      live: liveMode,
    },
    origin,
    subject,
    vapid: {
      publicKeySha256: hashValue(publicKey),
      frontendKeySha256: hashValue(frontendKey),
      publicKeyMatchesFrontend: Boolean(publicKey && frontendKey && publicKey === frontendKey),
    },
    result: {
      ok,
      warnings: warnings.length,
      failures: failures.length,
    },
    warnings,
    failures,
    liveChecks,
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Evidence written: ${relative(filePath)}`)
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(`${normalized}${padding}`, 'base64')
}

function isLocalhost(origin) {
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function isSecureOrigin(origin) {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalhost(origin))
  } catch {
    return false
  }
}

function validateVapid() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || process.env.STAGING_VAPID_PUBLIC_KEY || '').trim()
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || process.env.STAGING_VAPID_PRIVATE_KEY || '').trim()
  const frontendKey = String(process.env.VITE_VAPID_PUBLIC_KEY || process.env.STAGING_VAPID_PUBLIC_KEY || '').trim()
  const subject = String(process.env.VAPID_SUBJECT || process.env.STAGING_VAPID_SUBJECT || 'mailto:admin@antenor.com.br').trim()

  if (!publicKey) fail('VAPID public key is missing.')
  if (!privateKey) fail('VAPID private key is missing.')
  if (!frontendKey) fail('VITE_VAPID_PUBLIC_KEY is missing for the storefront build.')
  if (publicKey && frontendKey && publicKey !== frontendKey) {
    fail('VITE_VAPID_PUBLIC_KEY must match VAPID_PUBLIC_KEY/STAGING_VAPID_PUBLIC_KEY.')
  }

  if (publicKey) {
    try {
      const decoded = decodeBase64Url(publicKey)
      if (decoded.length !== 65 || decoded[0] !== 4) {
        fail('VAPID public key must decode to a 65-byte uncompressed P-256 public key.')
      }
    } catch {
      fail('VAPID public key is not valid base64url.')
    }
  }

  if (privateKey) {
    try {
      const decoded = decodeBase64Url(privateKey)
      if (decoded.length !== 32) {
        fail('VAPID private key must decode to 32 bytes.')
      }
    } catch {
      fail('VAPID private key is not valid base64url.')
    }
  }

  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    fail('VAPID_SUBJECT must start with mailto: or https://.')
  }

  const webPushPath = path.join(rootDir, 'backend', 'node_modules', 'web-push')
  if (publicKey && privateKey && fs.existsSync(webPushPath)) {
    try {
      const webpush = require(webPushPath)
      webpush.setVapidDetails(subject, publicKey, privateKey)
    } catch (error) {
      fail(`web-push rejected the VAPID configuration: ${error.message}`)
    }
  } else if (!fs.existsSync(webPushPath)) {
    warn('backend/node_modules/web-push is not installed; package-level VAPID validation was skipped.')
  }
}

function validateOrigins() {
  const origin = String(process.env.WEB_PUSH_ORIGIN || process.env.FRONTEND_URL || '').trim()
  if (!origin) {
    fail('WEB_PUSH_ORIGIN or FRONTEND_URL must be set to the storefront origin.')
    return
  }

  if (!isSecureOrigin(origin)) {
    fail('Storefront origin must be HTTPS, except localhost/127.0.0.1 for local development.')
  }

  if (externalMode) {
    try {
      const url = new URL(origin)
      if (url.protocol !== 'https:') {
        fail('External Web Push validation requires an HTTPS storefront origin.')
      }
      if (isLocalhost(origin)) {
        fail('External Web Push validation requires a non-localhost storefront origin.')
      }
    } catch {
      fail('Storefront origin is not a valid URL.')
    }
  }

  const cors = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '').trim()
  if (cors && !cors.split(',').map((item) => item.trim()).includes(origin)) {
    warn('CORS_ORIGIN/CORS_ORIGINS does not list the storefront origin exactly.')
  }
}

function validatePwaFiles() {
  if (!fs.existsSync(indexPath)) fail('frontend/index.html is missing.')
  if (!fs.existsSync(manifestPath)) fail('frontend/public/manifest.webmanifest is missing.')
  if (!fs.existsSync(serviceWorkerPath)) fail('frontend/public/service-worker.js is missing.')

  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8')
    if (!html.includes('rel="manifest"') || !html.includes('/manifest.webmanifest')) {
      fail('index.html must link /manifest.webmanifest.')
    }
    if (!html.includes('name="theme-color"')) {
      fail('index.html must define theme-color.')
    }
  }

  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      for (const field of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']) {
        if (!manifest[field]) fail(`manifest.webmanifest is missing ${field}.`)
      }
      if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) {
        fail('manifest.webmanifest display must be standalone, fullscreen, or minimal-ui.')
      }
      const icons = Array.isArray(manifest.icons) ? manifest.icons : []
      const has192 = icons.some((icon) => String(icon.sizes || '').includes('192x192'))
      const has512 = icons.some((icon) => String(icon.sizes || '').includes('512x512'))
      const hasMaskable = icons.some((icon) => String(icon.purpose || '').includes('maskable'))
      if (!has192) fail('manifest.webmanifest must include a 192x192 icon.')
      if (!has512) fail('manifest.webmanifest must include a 512x512 icon.')
      if (!hasMaskable) warn('manifest.webmanifest has no maskable icon purpose.')
      for (const icon of icons) {
        const iconPath = path.join(publicDir, String(icon.src || '').replace(/^\//, ''))
        if (!fs.existsSync(iconPath)) fail(`manifest icon is missing: ${icon.src}`)
      }
    } catch (error) {
      fail(`manifest.webmanifest is invalid JSON: ${error.message}`)
    }
  }

  if (fs.existsSync(serviceWorkerPath)) {
    const worker = fs.readFileSync(serviceWorkerPath, 'utf8')
    if (!worker.includes("addEventListener('push'")) fail('service-worker.js must handle push events.')
    if (!worker.includes("addEventListener('notificationclick'")) fail('service-worker.js must handle notification clicks.')
    if (!worker.includes('showNotification')) fail('service-worker.js must call showNotification.')
  }
}

function validateNginx() {
  for (const fileName of ['nginx.conf', 'nginx.staging.conf']) {
    const filePath = path.join(frontendDir, fileName)
    if (!fs.existsSync(filePath)) continue
    const config = fs.readFileSync(filePath, 'utf8')
    if (!config.includes('location = /service-worker.js')) {
      fail(`${fileName} must set explicit no-cache handling for /service-worker.js.`)
    }
    if (!config.includes('location = /manifest.webmanifest')) {
      fail(`${fileName} must set explicit no-cache handling for /manifest.webmanifest.`)
    }
  }
}

function storefrontOrigin() {
  return String(process.env.WEB_PUSH_ORIGIN || process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '')
}

function joinUrl(origin, pathname) {
  return `${origin}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

async function fetchText(url, label) {
  try {
    const response = await fetch(url, { redirect: 'follow' })
    const text = await response.text()
    liveChecks.push({
      label,
      url,
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') || null,
      cacheControl: response.headers.get('cache-control') || null,
    })
    if (!response.ok) {
      fail(`${label} returned HTTP ${response.status}: ${url}`)
      return null
    }
    return { response, text }
  } catch (error) {
    liveChecks.push({
      label,
      url,
      status: null,
      ok: false,
      error: error.message,
    })
    fail(`${label} could not be fetched from ${url}: ${error.message}`)
    return null
  }
}

async function validateLiveOrigin() {
  const origin = storefrontOrigin()
  if (!origin) return

  if (typeof fetch !== 'function') {
    fail('Live validation requires Node.js with global fetch support.')
    return
  }

  const home = await fetchText(joinUrl(origin, '/'), 'Storefront home')
  if (home && !home.text.includes('/manifest.webmanifest')) {
    fail('Live storefront HTML must link /manifest.webmanifest.')
  }

  const manifest = await fetchText(joinUrl(origin, '/manifest.webmanifest'), 'Live manifest.webmanifest')
  if (manifest) {
    const contentType = String(manifest.response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('application/manifest+json') && !contentType.includes('application/json')) {
      fail(`Live manifest.webmanifest returned unexpected Content-Type: ${contentType || 'missing'}.`)
    }

    try {
      const parsed = JSON.parse(manifest.text)
      for (const field of ['name', 'short_name', 'start_url', 'display', 'icons']) {
        if (!parsed[field]) fail(`Live manifest.webmanifest is missing ${field}.`)
      }
    } catch (error) {
      fail(`Live manifest.webmanifest is invalid JSON: ${error.message}`)
    }
  }

  const worker = await fetchText(joinUrl(origin, '/service-worker.js'), 'Live service-worker.js')
  if (worker) {
    const cacheControl = String(worker.response.headers.get('cache-control') || '').toLowerCase()
    if (!cacheControl.includes('no-store') && !cacheControl.includes('no-cache') && !cacheControl.includes('max-age=0')) {
      fail(`Live service-worker.js must be served without long-lived cache; Cache-Control was ${cacheControl || 'missing'}.`)
    }
    if (!worker.text.includes('push')) fail('Live service-worker.js must include push handling.')
    if (!worker.text.includes('notificationclick')) fail('Live service-worker.js must include notification click handling.')
    if (!worker.text.includes('showNotification')) fail('Live service-worker.js must call showNotification.')
  }
}

async function main() {
  const jsonOutput = outputPath(options['json-output'])

  validateVapid()
  validateOrigins()
  validatePwaFiles()
  validateNginx()

  if (liveMode && failures.length === 0) {
    await validateLiveOrigin()
  }

  if (warnings.length) {
    console.warn('Web Push readiness warnings:')
    for (const item of warnings) console.warn(`- ${item}`)
  }

  if (failures.length) {
    console.error('Web Push readiness failed:')
    for (const item of failures) console.error(`- ${item}`)
    writeJsonOutput(jsonOutput, false)
    process.exitCode = 1
    return
  }

  const modes = [
    externalMode ? 'external mode' : null,
    liveMode ? 'live origin checked' : null,
  ].filter(Boolean)
  writeJsonOutput(jsonOutput, true)
  console.log(`Web Push readiness OK${modes.length ? ` (${modes.join(', ')})` : ''}.`)
}

main().catch((error) => {
  console.error(`Web Push readiness failed: ${error.message}`)
  process.exitCode = 1
})
