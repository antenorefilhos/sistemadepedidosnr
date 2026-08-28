import { MissingProductsMonitor } from './missing-products.monitor'

/**
 * A logica que importa aqui e o cruzamento: "o ERP diz SEMPRE" x "o banco
 * esconde". Errar o lado da comparacao faz o monitor rodar todo dia sem nunca
 * achar nada -- exatamente o modo de falha silencioso que ele existe pra pegar.
 */
const build = (erpData: any[], hiddenInDb: any[]) => {
  const prisma = { product: { findMany: jest.fn().mockResolvedValue(hiddenInDb) } }
  const erp = { syncProducts: jest.fn().mockResolvedValue({ synced: erpData.length, failed: 0, data: erpData }) }
  const email = { send: jest.fn().mockResolvedValue(true) }
  return new MissingProductsMonitor(prisma as any, erp as any, email as any)
}

const LIMAO = { ean: '7891', name: 'Limao kg', syncOption: 'ESTOQUE', stock: 0 }
// Produto SEMPRE nao relacionado, so pra a guarda de "o ERP nao mandou nenhum
// SEMPRE" nao curto-circuitar e mascarar o filtro que o teste quer exercitar.
const OUTRO_SEMPRE = { ean: '0001', active: true, syncOption: 'SEMPRE' }

describe('MissingProductsMonitor.findWronglyHidden', () => {
  it('acha o produto que o ERP marca SEMPRE e o banco esconde', async () => {
    const monitor = build([{ ean: '7891', active: true, syncOption: 'SEMPRE' }], [LIMAO])
    await expect(monitor.findWronglyHidden()).resolves.toEqual([
      { ean: '7891', name: 'Limao kg', syncOption: 'ESTOQUE', stock: 0 },
    ])
  })

  it('ignora produto escondido que o ERP tambem nao quer na vitrine', async () => {
    const monitor = build([OUTRO_SEMPRE, { ean: '7891', active: true, syncOption: 'ESTOQUE' }], [LIMAO])
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })

  it('ignora SEMPRE que esta inativo no ERP', async () => {
    const monitor = build([OUTRO_SEMPRE, { ean: '7891', active: false, syncOption: 'SEMPRE' }], [LIMAO])
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })

  it('nao alerta quando o ERP nao mandou nenhum SEMPRE (campo sumiu)', async () => {
    // Sem essa guarda, um retorno sem `tipoIntegracao` viraria "zero SEMPRE",
    // o cruzamento daria vazio e o monitor diria "tudo certo" justamente na
    // falha que ele monitora.
    const monitor = build([{ ean: '7891', active: true, syncOption: undefined }], [LIMAO])
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })
})
