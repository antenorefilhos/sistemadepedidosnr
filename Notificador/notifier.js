const notifier = require('node-notifier')
const SysTray = require('systray2').default
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')

const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.+?)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

const API_URL = process.env.NOTIFIER_API_URL || 'http://localhost:3005'
const EMAIL = process.env.NOTIFIER_EMAIL || ''
const PASSWORD = process.env.NOTIFIER_PASSWORD || ''
const INTERVAL = 2 * 60 * 1000

let token = null
let loginRetries = 0
const MAX_LOGIN_RETRIES = 5

function getIconBase64() {
  const icoPath = path.join(__dirname, 'icon.ico')
  if (fs.existsSync(icoPath)) return fs.readFileSync(icoPath).toString('base64')
  const iconPath = path.join(__dirname, 'icon.png')
  if (fs.existsSync(iconPath)) return fs.readFileSync(iconPath).toString('base64')

  const w = 16, h = 16, raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 4) + 1 + x * 4
      const d = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2)
      if (d < 6) { raw[o] = 0x2E; raw[o + 1] = 0xCC; raw[o + 2] = 0x40; raw[o + 3] = 255 }
      else { raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 0; raw[o + 3] = 0 }
    }
  }
  const def = zlib.deflateSync(raw)
  function crc32(b) {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c }
    let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0
  }
  function chunk(type, data) {
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length)
    const tb = Buffer.from(type), cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([tb, data])))
    return Buffer.concat([l, tb, data, cr])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', def), chunk('IEND', Buffer.alloc(0))])
  fs.writeFileSync(iconPath, png)
  return png.toString('base64')
}

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login falhou: ${res.status}`)
  const data = await res.json()
  token = data.access_token
  loginRetries = 0
  log('Autenticado com sucesso')
}

async function fetchOrders() {
  const res = await fetch(`${API_URL}/picker/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    token = null
    await login()
    return fetchOrders()
  }
  if (!res.ok) throw new Error(`API erro: ${res.status}`)
  return res.json()
}

function toast(title, message) {
  notifier.notify({
    title,
    message,
    sound: true,
    wait: false,
    appID: 'Antenor e Filhos',
  })
}

function log(msg) {
  const ts = new Date().toLocaleTimeString('pt-BR')
  console.log(`[${ts}] ${msg}`)
}

async function check() {
  try {
    if (!token) await login()
    const orders = await fetchOrders()

    const novos = orders.filter(o => ['PENDING', 'CONFIRMED'].includes(o.status))
    const pendentes = orders.filter(o => o.status === 'PICKING_PENDING')

    if (novos.length > 0) {
      const nomes = novos.slice(0, 3).map(o => o.customer?.name || '#' + o.id.slice(-6)).join(', ')
      toast(
        `Novo Pedido (${novos.length})`,
        novos.length === 1
          ? `Pedido de ${nomes} aguardando`
          : `${novos.length} pedidos novos: ${nomes}`,
      )
      log(`${novos.length} pedido(s) novo(s)`)
    }

    if (pendentes.length > 0) {
      toast(
        `Pedido Pendente (${pendentes.length})`,
        `${pendentes.length} pedido(s) aguardando inicio de separacao`,
      )
      log(`${pendentes.length} pedido(s) pendente(s)`)
    }

    if (novos.length === 0 && pendentes.length === 0) {
      log('Nenhum pedido pendente')
    }

    loginRetries = 0
  } catch (err) {
    loginRetries++
    const msg = err.message || String(err)
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      if (loginRetries <= 2) log(`API offline: ${msg}`)
      if (loginRetries >= MAX_LOGIN_RETRIES) {
        log('API offline por muito tempo, continuando tentativas silenciosas...')
      }
    } else {
      log(`Erro: ${msg}`)
    }
  }
}

if (!EMAIL || !PASSWORD) {
  console.error('[ERRO] Configure NOTIFIER_EMAIL e NOTIFIER_PASSWORD no .env')
  process.exit(1)
}

const systray = new SysTray({
  menu: {
    icon: getIconBase64(),
    title: '',
    tooltip: 'Notificador Antenor e Filhos',
    items: [
      { title: 'Verificar agora', tooltip: 'Checa pedidos imediatamente', checked: false, enabled: true },
      { title: 'Sair', tooltip: 'Fechar notificador', checked: false, enabled: true },
    ],
  },
  debug: false,
  copyDir: false,
})

systray.onClick(action => {
  if (action.seq_id === 0) check()
  if (action.seq_id === 1) {
    log('Encerrando notificador...')
    systray.kill(false)
    process.exit(0)
  }
})

log(`Notificador iniciado — polling a cada ${INTERVAL / 1000}s em ${API_URL}`)
check()
setInterval(check, INTERVAL)
