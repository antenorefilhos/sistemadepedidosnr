import * as fs from 'fs'
import * as path from 'path'

/**
 * Os limites de recurso do upload de imagem.
 *
 * O canvas de saida chegou a ser `Math.max(800, largura, altura)` -- ou seja,
 * ditado pelo arquivo enviado. Um TIFF de camera (8000x6000, e TIFF e formato
 * aceito aqui) geraria canvas 8000x8000: ~256 MB so no buffer de saida,
 * derrubando o container da API, que e o backend inteiro.
 *
 * O teste le o fonte em vez de exercitar o controller porque o que importa aqui
 * e a EXISTENCIA do teto, nao o resultado de uma conversao: um `Math.max` sem
 * `Math.min` em volta compila, roda e so falha em producao, com o arquivo certo.
 */
const fonte = fs.readFileSync(
  path.join(__dirname, 'uploads.controller.ts'),
  'utf-8',
)

describe('limites de recurso do upload', () => {
  it('o canvas de saida tem teto, nao so piso', () => {
    expect(fonte).toMatch(/Math\.min\(\s*MAX_CANVAS_PX/)
  })

  it('o sharp recebe limitInputPixels nas duas chamadas', () => {
    // Limite de bytes nao cobre decompression bomb: um PNG de poucos KB pode
    // descomprimir pra centenas de megapixels.
    const ocorrencias = fonte.match(/limitInputPixels:\s*MAX_INPUT_PIXELS/g) ?? []
    expect(ocorrencias.length).toBeGreaterThanOrEqual(2)
  })

  it('todo FileInterceptor limita tamanho de arquivo', () => {
    const interceptors = fonte.match(/FileInterceptor\('file',\s*\{/g) ?? []
    const comLimite = fonte.match(/limits:\s*\{\s*fileSize:\s*MAX_UPLOAD_BYTES/g) ?? []
    expect(interceptors.length).toBeGreaterThan(0)
    expect(comLimite.length).toBe(interceptors.length)
  })

  it('os tetos ficam em faixa sensata', () => {
    const canvas = Number(/const MAX_CANVAS_PX = (\d+)/.exec(fonte)?.[1])
    const pixels = Number(/const MAX_INPUT_PIXELS = ([\d_]+)/.exec(fonte)?.[1].replace(/_/g, ''))
    // Teto alto demais nao protege; baixo demais estraga foto de produto.
    expect(canvas).toBeGreaterThanOrEqual(800)
    expect(canvas).toBeLessThanOrEqual(4000)
    expect(pixels).toBeLessThanOrEqual(100_000_000)
  })
})
