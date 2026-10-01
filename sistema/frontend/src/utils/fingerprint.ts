// Impressao digital do navegador (antifraude, 01/10/2026). Combina como o
// aparelho desenha (canvas, WebGL), processa audio e se descreve (tela, fuso,
// idioma, hardware). Sozinha colide em aparelhos iguais (iPhones do mesmo
// modelo); o servidor so liga contas com ela JUNTO da rede (ver
// backend/src/modules/fraud/fraud.util.ts, deviceKey). Calculada uma vez por
// sessao, sem atrasar a pagina: as chamadas antes de ficar pronta vao sem ela.

const SESSION_KEY = 'aef_fp'

async function sha256(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
  }
  let h = 0x811c9dc5 // FNV-1a, so se nao houver crypto.subtle
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

function canvasSignal(): string {
  try {
    const c = document.createElement('canvas')
    c.width = 240
    c.height = 60
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#5d082a'
    ctx.fillRect(10, 5, 120, 30)
    ctx.font = '16px Arial, sans-serif'
    ctx.fillStyle = '#d2bb8a'
    ctx.fillText('Antenor & Filhos 🛒 ção 0.1', 4, 40)
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = 'rgb(0,180,255)'
    ctx.beginPath()
    ctx.arc(180, 30, 22, 0, Math.PI * 2)
    ctx.fill()
    return c.toDataURL()
  } catch {
    return ''
  }
}

function webglSignal(): string {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return [
      ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      (gl.getSupportedExtensions() || []).length,
    ].join('|')
  } catch {
    return ''
  }
}

async function audioSignal(): Promise<string> {
  try {
    const Ctx = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext
    if (!Ctx) return ''
    const ctx = new Ctx(1, 5000, 44100)
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 10000
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -50
    comp.knee.value = 40
    comp.ratio.value = 12
    osc.connect(comp)
    comp.connect(ctx.destination)
    osc.start(0)
    const buffer = await Promise.race([
      ctx.startRendering(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
    ])
    if (!buffer) return ''
    const data = buffer.getChannelData(0)
    let sum = 0
    for (let i = 4500; i < 5000; i += 1) sum += Math.abs(data[i])
    return sum.toFixed(6)
  } catch {
    return ''
  }
}

/** Sinal de navegador controlado por robo (Selenium, Puppeteer, Playwright, headless). */
export function isAutomated(): boolean {
  try {
    const w = window as unknown as Record<string, unknown>
    return (
      navigator.webdriver === true ||
      /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Electron\//i.test(navigator.userAgent) ||
      Boolean(w.callPhantom || w._phantom || w.__nightmare || w.domAutomation || w.domAutomationController)
    )
  } catch {
    return false
  }
}

let cached: string | null = null
let pending: Promise<string> | null = null

export function getFingerprint(): string | null {
  if (cached) return cached
  try {
    cached = sessionStorage.getItem(SESSION_KEY)
  } catch {
    /* sem storage */
  }
  return cached
}

/** Calcula uma vez (fora do caminho critico) e guarda na sessao. */
export function computeFingerprint(): Promise<string> {
  if (getFingerprint()) return Promise.resolve(cached as string)
  if (pending) return pending
  pending = (async () => {
    const n = navigator as Navigator & { deviceMemory?: number }
    const parts = [
      canvasSignal(),
      webglSignal(),
      await audioSignal(),
      `${screen.width}x${screen.height}x${screen.colorDepth}@${Math.round((window.devicePixelRatio || 1) * 100)}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      (navigator.languages || [navigator.language]).join(','),
      navigator.platform,
      navigator.hardwareConcurrency,
      n.deviceMemory ?? '',
      navigator.maxTouchPoints,
    ]
    const fp = await sha256(parts.join('§'))
    cached = fp
    try {
      sessionStorage.setItem(SESSION_KEY, fp)
    } catch {
      /* idem */
    }
    return fp
  })()
  return pending
}
