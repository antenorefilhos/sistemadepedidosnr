import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

// Corrida real (panetones AeF, 11/11/2026): a miniatura saiu da foto antiga
// DEPOIS de o original novo ser gravado, ficou com data mais nova que ele e
// nunca mais foi refeita.
describe('ThumbsController: miniatura acompanha o original', () => {
  const cwd = process.cwd()
  let dir: string

  const solid = (r: number, g: number, b: number) =>
    sharp({ create: { width: 600, height: 600, channels: 3, background: { r, g, b } } }).webp().toBuffer()

  const pixel = async (path: string) => {
    const { data } = await sharp(path).raw().toBuffer({ resolveWithObject: true })
    return [data[0], data[1], data[2]]
  }

  const load = () => {
    let ctrl: any
    jest.isolateModules(() => {
      const { ThumbsController } = require('./thumbs.controller')
      ctrl = new ThumbsController()
    })
    return ctrl
  }

  const request = async (ctrl: any) => {
    let sent = ''
    await ctrl.thumb('123.webp', { set: () => undefined, sendFile: (p: string) => { sent = p } })
    return sent
  }

  // Windows: com o cache do libvips ligado o arquivo fica aberto e nao da para sobrescrever.
  beforeAll(() => {
    sharp.cache(false)
  })

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'thumbs-'))
    mkdirSync(join(dir, 'uploads', 'products'), { recursive: true })
    process.chdir(dir)
  })

  afterEach(() => {
    process.chdir(cwd)
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* Windows: o sharp ainda segura o arquivo; a pasta e temporaria do SO. */
    }
  })

  it('refaz a miniatura que ficou mais nova que o original com o conteudo antigo', async () => {
    const products = join(dir, 'uploads', 'products')
    mkdirSync(join(products, 'thumb'), { recursive: true })
    // Estado do bug: miniatura da foto ANTIGA (vermelha), com data de agora...
    const stale = join(products, 'thumb', '123.webp')
    writeFileSync(stale, await solid(255, 0, 0))
    // ...e o original NOVO (azul), com data anterior a da miniatura.
    const original = join(products, '123.webp')
    writeFileSync(original, await solid(0, 0, 255))
    const past = new Date(Date.now() - 60_000)
    utimesSync(original, past, past)

    const sent = await request(load())
    const [r, , b] = await pixel(sent)
    expect(b).toBeGreaterThan(200)
    expect(r).toBeLessThan(60)
  })

  it('nao refaz a miniatura quando o original nao mudou', async () => {
    const original = join(dir, 'uploads', 'products', '123.webp')
    writeFileSync(original, await solid(10, 200, 10))
    const ctrl = load()
    const first = await request(ctrl)
    const { mtimeMs } = require('fs').statSync(first)
    await request(ctrl)
    expect(require('fs').statSync(first).mtimeMs).toBe(mtimeMs)
  })
})
