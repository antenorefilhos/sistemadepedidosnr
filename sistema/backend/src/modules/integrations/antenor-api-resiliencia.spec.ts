import * as http from 'http'
import type { AddressInfo, Socket } from 'net'
import { AntenorApiService } from './antenor-api.service'

/**
 * 15/11 15:05 a 16/11 13:56: a AntenorApi ficou inalcancavel e o sync completo
 * ficou preso 23 h (o `timeout` do axios e de inatividade, nao de tempo total).
 * Estes testes usam um servidor HTTP de verdade para reproduzir os dois modos de
 * falha que um mock nao reproduz: resposta que nunca chega e resposta que chega a
 * conta-gotas (o timeout de inatividade nunca dispara).
 */
describe('AntenorApiService — resiliencia a API fora do ar', () => {
  const CHAVE = 'chave-secreta-de-teste-123'
  const envOriginal = { ...process.env }

  let server: http.Server
  const sockets = new Set<Socket>()
  let modo: 'ok' | 'pendurado' | 'gotejando' | 'erro500' = 'ok'
  let ultimaAutorizacao: string | undefined
  let service: AntenorApiService

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      ultimaAutorizacao = req.headers.authorization
      if (modo === 'pendurado') return // nunca responde
      if (modo === 'gotejando') {
        res.writeHead(200, { 'content-type': 'application/json' })
        const t = setInterval(() => res.write(' '), 40)
        res.on('close', () => clearInterval(t))
        return
      }
      if (modo === 'erro500') {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end('{"erro":"quebrou"}')
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
    server.on('connection', (s) => {
      sockets.add(s)
      s.on('close', () => sockets.delete(s))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    process.env.ANTENOR_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    process.env.ANTENOR_API_KEY = CHAVE
    process.env.ANTENOR_API_TIMEOUT_MS = '5000' // inatividade longa de proposito
    process.env.ANTENOR_API_DEADLINE_MS = '300' // prazo total curto
  })

  afterAll(async () => {
    process.env = envOriginal
    sockets.forEach((s) => s.destroy())
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  beforeEach(() => {
    modo = 'ok'
    ultimaAutorizacao = undefined
    service = new AntenorApiService()
  })

  const cliente = () => (service as unknown as { cliente: { get: (u: string, c?: object) => Promise<unknown>; post: (u: string, d?: unknown) => Promise<unknown> } }).cliente

  it('resposta que chega a conta-gotas NAO prende a chamada: o prazo total corta', async () => {
    modo = 'gotejando'
    const inicio = Date.now()
    await expect(cliente().get('/x')).rejects.toMatchObject({ code: 'EPRAZOTOTAL' })
    // Sem o prazo total, o timeout de inatividade (5 s) nunca dispararia: chega byte a cada 40 ms.
    expect(Date.now() - inicio).toBeLessThan(2000)
  })

  it('o erro de prazo diz o que estourou', async () => {
    modo = 'pendurado'
    await expect(cliente().get('/produtos')).rejects.toThrow(/prazo total estourado \(GET \/produtos\)/)
  })

  it('3 falhas de rede seguidas abrem o circuito: a leitura seguinte falha na hora', async () => {
    modo = 'pendurado'
    for (let i = 0; i < 3; i++) {
      await expect(cliente().get('/x')).rejects.toMatchObject({ code: 'EPRAZOTOTAL' })
    }
    const inicio = Date.now()
    await expect(cliente().get('/x')).rejects.toMatchObject({ code: 'ECIRCUITOABERTO' })
    expect(Date.now() - inicio).toBeLessThan(100)
  })

  it('circuito aberto NAO barra escrita; resposta da API fecha o circuito', async () => {
    modo = 'pendurado'
    for (let i = 0; i < 3; i++) await expect(cliente().get('/x')).rejects.toBeDefined()
    await expect(cliente().get('/x')).rejects.toMatchObject({ code: 'ECIRCUITOABERTO' })

    modo = 'ok'
    await expect(cliente().post('/api/integracao/pedidos', { a: 1 })).resolves.toBeDefined()
    await expect(cliente().get('/x')).resolves.toBeDefined()
  })

  it('erro HTTP (500) prova que a API esta de pe: nao conta como falha de rede', async () => {
    modo = 'erro500'
    for (let i = 0; i < 5; i++) {
      await expect(cliente().get('/x')).rejects.toMatchObject({ response: { status: 500 } })
    }
    modo = 'ok'
    await expect(cliente().get('/x')).resolves.toBeDefined()
  })

  it('o erro devolvido nao carrega a chave, mas a requisicao seguinte continua autenticada', async () => {
    modo = 'erro500'
    const erro = await cliente().get('/x').catch((e: unknown) => e)
    expect(JSON.stringify(erro)).not.toContain(CHAVE)

    modo = 'ok'
    await cliente().get('/x')
    expect(ultimaAutorizacao).toBe(`Bearer ${CHAVE}`)
  })

  it('cesta desiste cedo (6 s de inatividade, 8 s no total) em vez de esperar 30 s', async () => {
    const get = jest.fn().mockResolvedValue({ data: { versao: 1, itens: [] } })
    ;(service as unknown as { clienteCache: unknown }).clienteCache = { get }
    await service.getCesta(123, 12)
    const opcoes = get.mock.calls[0][1]
    expect(opcoes.timeout).toBe(6000)
    expect(opcoes.signal).toBeInstanceOf(AbortSignal)
  })
})
