import { MissingProductsMonitor } from './missing-products.monitor'

/**
 * A logica que importa aqui e o cruzamento: "o ERP diz SEMPRE, validado pelo
 * Mostruario" x "o banco esconde". Errar o lado da comparacao faz o monitor
 * rodar todo dia sem nunca achar nada (falso negativo) ou alertar todo dia
 * pra produto que o sync ja rebaixa de proposito (falso positivo) --
 * exatamente os dois modos de falha que ele existe pra evitar.
 */
const build = (erpData: any[], hiddenInDb: any[], opts: { antenorApiEnabled?: boolean; salvos?: any[] } = {}) => {
  const { antenorApiEnabled = true, salvos = [] } = opts
  const prisma = { product: { findMany: jest.fn().mockResolvedValue(hiddenInDb) } }
  const erp = {
    syncProducts: jest.fn().mockResolvedValue({ synced: erpData.length, failed: 0, data: erpData }),
    getMostruarioProdutosSalvos: jest.fn().mockResolvedValue(salvos),
  }
  const integrationModules = { isEnabled: jest.fn().mockResolvedValue(antenorApiEnabled) }
  const email = { send: jest.fn().mockResolvedValue(true) }
  return new MissingProductsMonitor(prisma as any, erp as any, integrationModules as any, email as any)
}

const LIMAO = { ean: '7891', name: 'Limao kg', syncOption: 'ESTOQUE', stock: 0 }
const LIMAO_SEMPRE_VALIDADO = { ean: '7891', erpProductId: 501, active: true, syncOption: 'SEMPRE' }
// Produto SEMPRE nao relacionado, so pra a guarda de "o ERP nao mandou nenhum
// SEMPRE" nao curto-circuitar e mascarar o filtro que o teste quer exercitar.
const OUTRO_SEMPRE = { ean: '0001', erpProductId: 999, active: true, syncOption: 'SEMPRE' }
const SALVOS_COM_LIMAO = [{ cdProduto: 501 }]

describe('MissingProductsMonitor.findWronglyHidden', () => {
  it('acha o produto que o ERP marca SEMPRE validado pelo Mostruario e o banco esconde', async () => {
    const monitor = build([LIMAO_SEMPRE_VALIDADO], [LIMAO], { salvos: SALVOS_COM_LIMAO })
    await expect(monitor.findWronglyHidden()).resolves.toEqual([
      { ean: '7891', name: 'Limao kg', syncOption: 'ESTOQUE', stock: 0 },
    ])
  })

  it('ignora produto escondido que o ERP tambem nao quer na vitrine', async () => {
    const monitor = build([OUTRO_SEMPRE, { ean: '7891', erpProductId: 501, active: true, syncOption: 'ESTOQUE' }], [LIMAO], {
      salvos: SALVOS_COM_LIMAO,
    })
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })

  it('ignora SEMPRE que esta inativo no ERP', async () => {
    const monitor = build([OUTRO_SEMPRE, { ean: '7891', erpProductId: 501, active: false, syncOption: 'SEMPRE' }], [LIMAO], {
      salvos: SALVOS_COM_LIMAO,
    })
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })

  it('nao alerta quando o ERP nao mandou nenhum SEMPRE (campo sumiu)', async () => {
    // Sem essa guarda, um retorno sem `tipoIntegracao` viraria "zero SEMPRE",
    // o cruzamento daria vazio e o monitor diria "tudo certo" justamente na
    // falha que ele monitora.
    const monitor = build([{ ean: '7891', erpProductId: 501, active: true, syncOption: undefined }], [LIMAO])
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })

  it('nao chama o ERP quando o modulo AntenorApi esta desligado', async () => {
    const monitor = build([LIMAO_SEMPRE_VALIDADO], [LIMAO], { antenorApiEnabled: false, salvos: SALVOS_COM_LIMAO })
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })

  it('ignora SEMPRE cru que o Motor de Presenca Real nao validou (23/09/2026)', async () => {
    // O mesmo caso que motivou downgradeUnvalidatedSempre: SEMPRE gravado
    // direto no cadastro, sem venda real recente -- o sync ja rebaixa isso
    // de proposito, nao e um bug pra alertar.
    const monitor = build([LIMAO_SEMPRE_VALIDADO], [LIMAO], { salvos: [{ cdProduto: 999 }] })
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })

  it('nao alerta quando o Mostruario esta indisponivel', async () => {
    const monitor = build([LIMAO_SEMPRE_VALIDADO], [LIMAO])
    const erp = (monitor as any).erp
    erp.getMostruarioProdutosSalvos.mockRejectedValueOnce(new Error('timeout'))
    await expect(monitor.findWronglyHidden()).resolves.toEqual([])
  })
})
