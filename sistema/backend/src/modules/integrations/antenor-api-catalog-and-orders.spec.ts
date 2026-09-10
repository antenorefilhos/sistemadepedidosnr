import { AntenorApiService } from './antenor-api.service'

/**
 * Cobre catalogo (syncProducts/fetchRecentChanges/normalizeProduct) e
 * createOrder (JON-17, cutover Solidcom -> AntenorApi).
 *
 * Os formatos testados aqui (`{ produtos: [...] }`, `endereco` omitido pra
 * retirada) foram confirmados AO VIVO contra a API real em 10/09/2026 --
 * a doc deles dizia `{ data: [...] }`/`endereco: null` e os dois estavam
 * errados. Esses testes existem pra nao regredir de volta pro que a doc
 * dizia.
 */
describe('AntenorApiService — catalogo e criacao de pedido', () => {
  let service: AntenorApiService
  const cliente = { get: jest.fn(), post: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AntenorApiService()
    // Bypassa o getter (que exige env/certificado) injetando o cliente HTTP
    // fake direto no cache privado.
    ;(service as unknown as { clienteCache: unknown }).clienteCache = cliente
  })

  describe('syncProducts', () => {
    it('le a lista de dentro de `produtos` (formato real confirmado 10/09/2026, nao `data`)', async () => {
      cliente.get.mockResolvedValue({
        data: {
          total: 1,
          pagina: 1,
          produtos: [
            {
              ID_LOJA: 1,
              ID_PRODUTO: 30039,
              CODIGO_EAN: '602883849181',
              PRODUTO: 'ARROZ ARBORIO DON RAVELLO CX 1kg',
              VL_PRODUTO: 37.9,
              VL_PRODUTO_NORMAL: 37.9,
              QTD_PRODUTO: 3,
              Ativo: true,
              Fracionado: false,
              Fracionamento: 1,
              Emb: 'UN',
              Classificacao01: '01-MERCEARIA SALGADA | 01-CEREAIS',
              Classificacao02: '01-ARROZ',
              TipoIntegracao: 'ESTOQUE',
            },
          ],
        },
      })

      const result = await service.syncProducts()

      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        ean: '602883849181',
        erpProductId: 30039,
        name: 'ARROZ ARBORIO DON RAVELLO CX 1kg',
        price: 37.9,
        stock: 3,
        isFractional: false,
        syncOption: 'ESTOQUE',
      })
      expect(result.data[0].promotionalPrice).toBeUndefined()
    })

    it('marca promotionalPrice so quando VL_PRODUTO < VL_PRODUTO_NORMAL (validado contra o banco em 10/09/2026)', async () => {
      cliente.get.mockResolvedValue({
        data: {
          produtos: [
            { ID_LOJA: 1, ID_PRODUTO: 1, CODIGO_EAN: '111', PRODUTO: 'ABACATE KG', VL_PRODUTO: 4.99, VL_PRODUTO_NORMAL: 6.99, QTD_PRODUTO: 10, Ativo: true, Fracionado: true, Fracionamento: 0.1, Emb: 'KG' },
          ],
        },
      })

      const result = await service.syncProducts()

      expect(result.data[0].price).toBe(6.99)
      expect(result.data[0].promotionalPrice).toBe(4.99)
      expect(result.data[0].isFractional).toBe(true)
      expect(result.data[0].fractionStep).toBe(0.1)
    })

    it('estoque negativo (QTD_PRODUTO: -1) e preservado, nao vira 0', async () => {
      cliente.get.mockResolvedValue({
        data: { produtos: [{ ID_LOJA: 1, ID_PRODUTO: 1, CODIGO_EAN: '111', PRODUTO: 'X', VL_PRODUTO: 1, VL_PRODUTO_NORMAL: 1, QTD_PRODUTO: -1, Ativo: true }] },
      })

      const result = await service.syncProducts()

      expect(result.data[0].stock).toBe(-1)
    })

    it('produto sem EAN ou nome e descartado', async () => {
      cliente.get.mockResolvedValue({
        data: { produtos: [{ ID_LOJA: 1, ID_PRODUTO: 1, CODIGO_EAN: '', PRODUTO: 'X', VL_PRODUTO: 1, VL_PRODUTO_NORMAL: 1 }] },
      })

      const result = await service.syncProducts()

      expect(result.data).toHaveLength(0)
    })

    it('tambem aceita `{ data: [...] }` e array puro, por seguranca', async () => {
      const item = { ID_LOJA: 1, ID_PRODUTO: 1, CODIGO_EAN: '111', PRODUTO: 'X', VL_PRODUTO: 1, VL_PRODUTO_NORMAL: 1 }
      cliente.get.mockResolvedValueOnce({ data: { data: [item] } })
      expect((await service.syncProducts()).data).toHaveLength(1)

      cliente.get.mockResolvedValueOnce({ data: [item] })
      expect((await service.syncProducts()).data).toHaveLength(1)
    })
  })

  describe('fetchRecentChanges', () => {
    it('le do mesmo formato `produtos` do endpoint incremental', async () => {
      cliente.get.mockResolvedValue({
        data: { total: 1, dataCorte: '2026-09-08T05:44:12', produtos: [{ ID_LOJA: 1, ID_PRODUTO: 350, CODIGO_EAN: '789', PRODUTO: 'ATUM', VL_PRODUTO: 8.25, VL_PRODUTO_NORMAL: 8.25, QTD_PRODUTO: 0, Ativo: true }] },
      })

      const result = await service.fetchRecentChanges(48)

      expect(result).toHaveLength(1)
      expect(result[0].ean).toBe('789')
    })

    it('banco fora do ar: devolve lista vazia, nao propaga erro', async () => {
      cliente.get.mockRejectedValue(new Error('timeout'))
      await expect(service.fetchRecentChanges(2)).resolves.toEqual([])
    })
  })

  describe('createOrder', () => {
    it('manda o payload exato pro endpoint, com filialId injetado', async () => {
      cliente.post.mockResolvedValue({
        data: { sucesso: true, cdPedido: '2080', numeroDAV: '102078', cdEcomPedido: '999888777', valorTotal: 37.9, idempotente: false },
      })

      const payload = {
        cdEcomPedido: '999888777',
        valorTotal: 37.9,
        valorFrete: 0,
        formaPagamentoTexto: 'Pix',
        observacao: 'teste',
        aceitaTroca: true,
        cliente: { documento: '14200744740', nome: 'Jonathan', telefone: '24992326277' },
        itens: [{ cdProduto: 30039, cdEAN: '602883849181', quantidade: 1, precoUnitario: 37.9 }],
      }

      const result = await service.createOrder(payload as never)

      expect(cliente.post).toHaveBeenCalledWith('/api/integracao/pedidos', expect.objectContaining({ filialId: 1, ...payload }))
      expect(result.numeroDAV).toBe('102078')
    })

    it('reenvio com o mesmo cdEcomPedido: devolve idempotente:true (comportamento real confirmado)', async () => {
      cliente.post.mockResolvedValue({
        data: { sucesso: true, cdPedido: '2080', numeroDAV: '102078', cdEcomPedido: '999888777', valorTotal: 37.9, idempotente: true },
      })

      const result = await service.createOrder({ cdEcomPedido: '999888777' } as never)

      expect(result.idempotente).toBe(true)
    })
  })
})
