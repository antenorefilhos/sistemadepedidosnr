const { app, Tray, Menu, BrowserWindow, ipcMain, screen } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { WAITING_STATUS, LEVELS, levelOf, minutesSince, formatAge, planNotifications, codigoDoPedido } = require('./escalation')
const { conciliarFaturamento } = require('./faturamento')

const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.+?)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

const API_URL = process.env.NOTIFIER_API_URL || 'http://localhost:3001'
const EMAIL = process.env.NOTIFIER_EMAIL || ''
const PASSWORD = process.env.NOTIFIER_PASSWORD || ''
// 60s, nao 2min: os cortes de 5 e 10 minutos precisam de granularidade menor
// que o proprio degrau pra nao chegar atrasado.
const INTERVAL = 60 * 1000

if (!EMAIL || !PASSWORD) {
  console.error('[ERRO] Configure NOTIFIER_EMAIL e NOTIFIER_PASSWORD no .env')
  app.quit()
}

let token = null
let loginRetries = 0
const MAX_LOGIN_RETRIES = 5

let tray = null
let panel = null
let toastWin = null
let toastTimer = null
let toastShowing = false
const toastQueue = []
let lastOrders = []
// orderId -> { levelKey, at } — o que ja foi avisado e quando, pra so repetir
// quando o nivel sobe ou quando o nivel critico pede reforco.
const notified = new Map()

function log(msg) {
  const ts = new Date().toLocaleTimeString('pt-BR')
  console.log(`[${ts}] ${msg}`)
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

// Toca um .wav do proprio Windows. A Notification do Electron so aceita
// `sound` no macOS, entao no Windows o jeito de ter som distinto por nivel e
// silenciar o toast e tocar o wav na mao.
function playSound(file) {
  if (process.platform !== 'win32') return
  const wav = path.join(process.env.WINDIR || 'C:\\Windows', 'Media', file)
  if (!fs.existsSync(wav)) return log(`[som] arquivo nao encontrado: ${wav}`)

  const ps = spawn('powershell', ['-NoProfile', '-Command', `(New-Object Media.SoundPlayer '${wav}').PlaySync()`], {
    windowsHide: true,
    stdio: 'ignore',
  })
  ps.on('error', err => log(`[som] falhou: ${err.message}`))
  ps.on('exit', code => {
    if (code !== 0) log(`[som] powershell saiu com codigo ${code}`)
  })
}

const TOAST_W = 380
const TOAST_H = 104
// Quanto mais grave, mais tempo na tela.
const TOAST_MS = { novo: 6000, atencao: 9000, critico: 14000 }

function createToastWindow() {
  const win = new BrowserWindow({
    width: TOAST_W,
    height: TOAST_H,
    show: false,
    frame: false,
    // transparent:true renderiza janela em branco no Windows quando combinada
    // com focusable:false/showInactive. Opaca + roundedCorners do Win11 da o
    // mesmo visual sem o bug.
    backgroundColor: '#1e2129',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false, // nao rouba o foco de quem esta trabalhando
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.webContents.on('preload-error', (_e, _p, err) => log(`[toast:preload] ${err.message}`))
  win.webContents.on('did-fail-load', (_e, code, desc) => log(`[toast:load] ${code} ${desc}`))
  win.loadFile(path.join(__dirname, 'renderer', 'toast.html'))
  return win
}

function positionToast(win) {
  const work = screen.getPrimaryDisplay().workArea
  win.setBounds({
    x: work.x + work.width - TOAST_W - 12,
    y: work.y + work.height - TOAST_H - 12,
    width: TOAST_W,
    height: TOAST_H,
  })
}

// Uma notificacao por vez: as seguintes entram na fila em vez de se
// atropelarem (o toast nativo do Windows so mostrava a ultima).
function toast(level, title, body, age) {
  toastQueue.push({ level, title, body, age })
  if (!toastShowing) nextToast()
}

function nextToast() {
  const item = toastQueue.shift()
  if (!item) {
    toastShowing = false
    if (toastWin && !toastWin.isDestroyed()) toastWin.hide()
    return
  }

  toastShowing = true
  if (!toastWin || toastWin.isDestroyed()) toastWin = createToastWindow()

  const send = () => {
    positionToast(toastWin)
    toastWin.showInactive()
    toastWin.webContents.send('toast-show', {
      levelKey: item.level.key,
      levelLabel: item.level.label,
      title: item.title,
      body: item.body,
      age: item.age,
    })
    playSound(item.level.sound)

    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      if (toastWin && !toastWin.isDestroyed()) toastWin.webContents.send('toast-hide')
      setTimeout(nextToast, 300) // deixa a animacao de saida terminar
    }, TOAST_MS[item.level.key] || 8000)
  }

  if (toastWin.webContents.isLoading()) toastWin.webContents.once('did-finish-load', send)
  else send()
}

function updatePanel() {
  if (panel && !panel.isDestroyed()) panel.webContents.send('orders-updated', lastOrders)
}

function updateTrayTooltip(waiting) {
  if (!tray) return
  if (waiting.length === 0) {
    tray.setToolTip('Notificador Antenor e Filhos — sem pedidos aguardando separacao')
    return
  }
  const pior = LEVELS.find(l => waiting.some(o => levelOf(o).key === l.key))
  tray.setToolTip(
    `Notificador Antenor e Filhos — ${waiting.length} aguardando separacao (${pior.label})`,
  )
}

/**
 * Gatilho de faturamento do PDV (ver faturamento.js).
 *
 * Ligado só quando o .env tem as credenciais do DORSAL: sem elas o Notificador
 * segue avisando sobre separação normalmente, que é a função original dele.
 * Falhar em subir por causa de um recurso opcional seria trocar um problema
 * por outro maior.
 */
const FATURAMENTO_LIGADO = ['DORSAL_DB_HOST', 'DORSAL_DB_NAME', 'DORSAL_DB_USER', 'DORSAL_DB_PASSWORD']
  .every((chave) => String(process.env[chave] || '').trim())

let dorsal = null
let avisouDorsalIndisponivel = false

async function apiJson(caminho, opcoes = {}) {
  const res = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
  })
  if (res.status === 401) {
    token = null
    await login()
    return apiJson(caminho, opcoes)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${caminho}`)
  return res.status === 204 ? null : res.json()
}

async function conciliarPdv() {
  if (!FATURAMENTO_LIGADO) return

  if (!dorsal) dorsal = require('./dorsal')

  try {
    const resultado = await conciliarFaturamento({
      listarPendentes: () => apiJson('/integrations/solidcom/pending-invoice'),
      consultarFaturados: (davs) => dorsal.consultarFaturados(davs),
      marcarFaturado: (orderId, fiscal) =>
        apiJson(`/integrations/solidcom/orders/${orderId}/invoiced`, {
          method: 'POST',
          body: JSON.stringify(fiscal),
        }),
      log,
    })
    avisouDorsalIndisponivel = false
    if (resultado.liberados > 0) {
      log(`faturamento: ${resultado.liberados} pedido(s) liberado(s) pra entrega`)
    }
    if (resultado.semDav > 0) {
      // Não é falha deste agente: são pedidos que nunca chegaram ao Solidcom.
      // Aparece no log porque alguém precisa reenviar ou cancelar.
      log(`faturamento: ${resultado.semDav} pedido(s) aguardando o caixa SEM DAV -- nao existem no Solidcom`)
    }
  } catch (erro) {
    // Banco da loja fora do ar não pode derrubar o aviso de separação, que é a
    // função principal. Loga uma vez e volta a calar até normalizar, senão o
    // log vira uma parede de erro igual a cada minuto.
    if (!avisouDorsalIndisponivel) {
      log(`faturamento indisponivel: ${erro.message}`)
      avisouDorsalIndisponivel = true
    }
  }
}

async function check() {
  try {
    if (!token) await login()
    const orders = await fetchOrders()

    const { waiting, groups } = planNotifications(orders, notified)

    for (const { level, orders: doNivel } of groups) {
      // Codigo na frente do nome: sem ele o separador sabia QUE havia pedido
      // parado, mas nao qual digitar no PDV -- tinha que abrir o app e
      // procurar. O DAV e justamente o numero que ele digita.
      const nomes = doNivel
        .slice(0, 3)
        .map(o => [codigoDoPedido(o), o.customer?.name].filter(Boolean).join(' - '))
        .join(', ')
      const espera = Math.floor(Math.max(...doNivel.map(o => minutesSince(o.createdAt))))
      toast(
        level,
        level.title(doNivel.length, espera),
        level.body(doNivel.length, nomes, espera),
        formatAge(espera),
      )
      log(`[${level.label}] ${doNivel.length} pedido(s): ${nomes}`)
    }

    if (waiting.length === 0) log('Nenhum pedido aguardando separacao')

    lastOrders = orders.map(o => ({
      ...o,
      notifLevel: WAITING_STATUS.includes(o.status) ? levelOf(o).key : null,
    }))
    updateTrayTooltip(waiting)
    updatePanel()
    loginRetries = 0

    // Depois de avisar sobre separação: o pedido que já foi ao caixa pode ter
    // sido faturado no PDV, e é isso que o libera pro entregador.
    await conciliarPdv()
  } catch (err) {
    loginRetries++
    const msg = err.message || String(err)
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
      if (loginRetries <= 2) log(`API offline: ${msg}`)
      if (loginRetries >= MAX_LOGIN_RETRIES) log('API offline por muito tempo, continuando tentativas silenciosas...')
    } else {
      log(`Erro: ${msg}`)
    }
  }
}

function createPanel() {
  const win = new BrowserWindow({
    width: 380,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.on('blur', () => win.hide())
  return win
}

function positionPanelNearTray(win) {
  const trayBounds = tray.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const { width, height } = win.getBounds()
  const work = display.workArea

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2)
  let y = work.y + work.height - height - 8

  if (trayBounds.y < work.height / 2) y = trayBounds.y + trayBounds.height + 8

  x = Math.max(work.x + 8, Math.min(x, work.x + work.width - width - 8))
  win.setBounds({ x, y, width, height })
}

function togglePanel() {
  if (!panel || panel.isDestroyed()) panel = createPanel()
  if (panel.isVisible()) {
    panel.hide()
    return
  }
  positionPanelNearTray(panel)
  panel.show()
  panel.focus()
  updatePanel()
}

// Dispara os 3 niveis em sequencia pra conferir toast + som sem ter que
// esperar um pedido envelhecer 10 minutos.
function testarAlertas() {
  for (const level of [...LEVELS].reverse()) {
    const min = level.afterMinutes || 1
    log(`[teste] ${level.label}`)
    toast(level, level.title(1, min), level.body(1, 'Cliente Teste', min), `teste · ${formatAge(min)}`)
  }
}

ipcMain.handle('get-orders', () => lastOrders)
ipcMain.handle('check-now', () => check())
ipcMain.on('toast-clicked', () => {
  if (!panel || panel.isDestroyed() || !panel.isVisible()) togglePanel()
})

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('Antenor e Filhos')

  tray = new Tray(path.join(__dirname, 'icon.ico'))
  tray.setToolTip('Notificador Antenor e Filhos')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ver pedidos', click: togglePanel },
    { label: 'Verificar agora', click: check },
    { type: 'separator' },
    { label: 'Testar alertas (3 niveis)', click: testarAlertas },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]))
  tray.on('click', togglePanel)

  log(`Notificador iniciado — polling a cada ${INTERVAL / 1000}s em ${API_URL}`)
  check()
  setInterval(check, INTERVAL)
})

app.on('window-all-closed', (e) => e.preventDefault())
