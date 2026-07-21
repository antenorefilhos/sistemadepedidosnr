const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const rootDir = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    origin: process.env.WEB_PUSH_ORIGIN || process.env.FRONTEND_URL || '',
    profile: path.join(rootDir, 'artifacts', 'web-push-cdp-chrome-profile'),
    port: '9224',
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

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getJson(port, endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`)
  if (!response.ok) throw new Error(`${endpoint} retornou ${response.status}`)
  return response.json()
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl
    this.ws = new WebSocket(webSocketUrl)
    this.id = 0
    this.pending = new Map()
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id || !this.pending.has(message.id)) return
      const { resolve, reject } = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    })
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
  }

  async send(method, params = {}) {
    await this.ready()
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.has(id)) return
        this.pending.delete(id)
        reject(new Error(`Timeout em CDP ${method}`))
      }, 30000)
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
      })
    })
  }

  close() {
    try {
      this.ws.close()
    } catch {
      // ignore close failures
    }
  }
}

function chromeCandidates() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = process.env.LocalAppData || ''
  return [
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
  ].filter(Boolean)
}

function findChrome(explicitPath) {
  const candidates = explicitPath ? [explicitPath] : chromeCandidates()
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Chrome nao encontrado.')
  return found
}

function pageEvalCode({ vapidPublicKey }) {
  return `
(async () => {
  const vapidPublicKey = ${JSON.stringify(vapidPublicKey)};
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }
  function timeoutAfter(label, ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms));
  }
  async function withTimeout(label, promise, ms = 20000) {
    return Promise.race([promise, timeoutAfter(label, ms)]);
  }
  const loginRes = await fetch('/api/auth/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'qa.cliente@antenor.com.br', password: 'qa2026' }),
  });
  if (!loginRes.ok) throw new Error('login ' + loginRes.status);
  const login = await loginRes.json();
  localStorage.setItem('token', login.access_token);
  localStorage.setItem('user', JSON.stringify(login.user));
  if (!('Notification' in window)) throw new Error('Notification unsupported');
  if (!('serviceWorker' in navigator)) throw new Error('serviceWorker unsupported');
  if (!('PushManager' in window)) throw new Error('PushManager unsupported');
  const permission = await withTimeout('Notification.requestPermission', Notification.requestPermission(), 15000);
  if (permission !== 'granted') throw new Error('permission ' + permission);
  await withTimeout('serviceWorker.register', navigator.serviceWorker.register('/service-worker.js'));
  const registration = await withTimeout('navigator.serviceWorker.ready', navigator.serviceWorker.ready);
  let subscription = await withTimeout('pushManager.getSubscription', registration.pushManager.getSubscription());
  if (!subscription) {
    subscription = await withTimeout('pushManager.subscribe', registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }), 30000);
  }
  const subscriptionJson = subscription.toJSON();
  const saveRes = await fetch('/api/notifications/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.access_token },
    body: JSON.stringify(subscriptionJson),
  });
  const saveText = await saveRes.text();
  if (!saveRes.ok) throw new Error('save ' + saveRes.status + ' ' + saveText);
  return {
    permission,
    endpoint: subscriptionJson.endpoint,
    auth: Boolean(subscriptionJson.keys && subscriptionJson.keys.auth),
    p256dh: Boolean(subscriptionJson.keys && subscriptionJson.keys.p256dh),
    user: login.user.email,
    saveStatus: saveRes.status,
  };
})()
`
}

async function waitForVersion(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await getJson(port, '/json/version')
    } catch {
      await sleep(500)
    }
  }
  throw new Error('Chrome CDP nao ficou disponivel.')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  loadEnvFile(options['env-file'] ? path.resolve(rootDir, options['env-file']) : path.join(rootDir, '.env.staging'))

  const origin = String(options.origin || '').replace(/\/$/, '')
  if (!/^https:\/\//i.test(origin)) throw new Error('--origin HTTPS e obrigatorio.')

  const vapidPublicKey = process.env.STAGING_VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
  if (!vapidPublicKey) throw new Error('VAPID public key ausente.')

  const port = Number(options.port || 9224)
  const profile = path.resolve(rootDir, options.profile)
  const chrome = findChrome(options.chrome)
  fs.mkdirSync(profile, { recursive: true })

  const chromeArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-popup-blocking',
    `--app=${origin}`,
  ]
  const chromeProcess = spawn(chrome, chromeArgs, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  chromeProcess.unref()

  let browser = null
  let page = null
  try {
    const version = await waitForVersion(port)
    browser = new CdpClient(version.webSocketDebuggerUrl)
    await browser.send('Browser.grantPermissions', { origin, permissions: ['notifications'] })

    const targets = await getJson(port, '/json/list')
    const pageInfo = targets.find((target) => target.type === 'page' && String(target.url || '').startsWith(origin))
      || targets.find((target) => target.type === 'page')
    if (!pageInfo) throw new Error('Nenhuma aba CDP encontrada.')

    page = new CdpClient(pageInfo.webSocketDebuggerUrl)
    await page.send('Runtime.enable')
    await page.send('Page.enable')
    await page.send('Page.bringToFront')
    await page.send('Page.navigate', { url: `${origin}/` })
    await sleep(5000)

    const result = await page.send('Runtime.evaluate', {
      expression: pageEvalCode({ vapidPublicKey }),
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))

    console.log(JSON.stringify({
      chromePid: chromeProcess.pid,
      profile,
      origin,
      subscription: result.result.value,
    }, null, 2))
  } finally {
    if (page) page.close()
    if (browser) browser.close()
  }
}

main().catch((error) => {
  console.error(`Chrome Web Push registration failed: ${error.message}`)
  process.exitCode = 1
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 50)
})
