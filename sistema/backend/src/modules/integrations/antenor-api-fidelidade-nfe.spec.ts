import { AntenorApiService } from './antenor-api.service'

/**
 * Cobre getFidelidade e getNfe (JON-34/35, v1.8.0).
 *
 * Confirmado ao vivo em 11/09/2026: fidelidade responde 200 real via WAN com
 * a nossa chave Bearer de sempre (o `x-api-key` de exemplo do A1 era so pro
 * sandbox local dele). NF-e pode dar 404 pra pedido faturado de verdade
 * quando o transmissor fiscal ainda nao sincronizou o XML -- nao e erro.
 */
describe('AntenorApiService — fidelidade e NFC-e (v1.8.0)', () => {
  let service: AntenorApiService
  const cliente = { get: jest.fn(), post: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AntenorApiService()
    ;(service as unknown as { clienteCache: unknown }).clienteCache = cliente
  })

  describe('getFidelidade', () => {
    it('CPF cadastrado: devolve o cliente', async () => {
      cliente.get.mockResolvedValue({
        data: { sucesso: true, cliente: { cpf: '93193939749', nome: 'HELENA RODRIGUES', clubeFidelidade: true, categoria: { id: 1, descricao: 'padrão' } } },
      })
      const resultado = await service.getFidelidade('931.939.397-49')
      expect(cliente.get).toHaveBeenCalledWith('/api/integracao/clientes/93193939749/fidelidade')
      expect(resultado).toMatchObject({ clubeFidelidade: true, nome: 'HELENA RODRIGUES' })
    })

    it('CPF sem cadastro fisico (404): devolve null, nao propaga erro', async () => {
      cliente.get.mockRejectedValue({ response: { status: 404 } })
      await expect(service.getFidelidade('11111111111')).resolves.toBeNull()
    })

    it('CPF vazio: nem chama a API', async () => {
      const resultado = await service.getFidelidade('')
      expect(resultado).toBeNull()
      expect(cliente.get).not.toHaveBeenCalled()
    })
  })

  describe('getNfe', () => {
    it('pedido faturado com XML disponivel: devolve chave e XML', async () => {
      cliente.get.mockResolvedValue({
        data: { chaveAcesso: '33260905147995000131651020002044881002057237', numero: 204488, xml: '<nfeProc/>' },
      })
      const resultado = await service.getNfe('102074')
      expect(cliente.get).toHaveBeenCalledWith('/api/integracao/pedidos/102074/nfe')
      expect(resultado?.chaveAcesso).toBe('33260905147995000131651020002044881002057237')
    })

    it('pedido faturado mas XML ainda nao sincronizado (404): devolve null', async () => {
      cliente.get.mockRejectedValue({ response: { status: 404 } })
      await expect(service.getNfe('102074')).resolves.toBeNull()
    })
  })
})
