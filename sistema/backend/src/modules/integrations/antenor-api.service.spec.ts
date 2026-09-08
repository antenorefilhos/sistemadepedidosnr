import { AntenorApiService } from './antenor-api.service'

/**
 * Cobre a CONFIGURACAO do cliente, nao as chamadas HTTP.
 *
 * O que pode dar errado aqui nao e a requisicao -- e subir com credencial
 * faltando ou sem o certificado e so descobrir quando o primeiro cancelamento
 * de cliente falhar em producao.
 */
describe('AntenorApiService — configuracao', () => {
  const envOriginal = { ...process.env }
  let service: AntenorApiService

  beforeEach(() => {
    service = new AntenorApiService()
    delete process.env.ANTENOR_API_URL
    delete process.env.ANTENOR_API_KEY
    delete process.env.ANTENOR_API_CA_PATH
  })

  afterAll(() => {
    process.env = envOriginal
  })

  // Acessa o getter privado sem expor a implementacao no tipo publico.
  const abrirCliente = () => (service as unknown as { cliente: unknown }).cliente

  it('sem URL: falha dizendo o que falta, em vez de chamar endereco errado', () => {
    process.env.ANTENOR_API_KEY = 'k'
    expect(abrirCliente).toThrow(/ANTENOR_API_URL/)
  })

  it('sem chave: falha em vez de chamar sem credencial', () => {
    process.env.ANTENOR_API_URL = 'https://10.0.0.1:5001'
    process.env.ANTENOR_API_CA_PATH = '/tmp/x.crt'
    expect(abrirCliente).toThrow(/ANTENOR_API_KEY/)
  })

  it('https sem certificado: RECUSA subir o cliente', () => {
    process.env.ANTENOR_API_URL = 'https://10.0.0.1:5001'
    process.env.ANTENOR_API_KEY = 'k'
    // A alternativa seria rejectUnauthorized:false, que e pior que HTTP puro:
    // parece seguro e aceita qualquer certificado. Falhar aqui e o correto.
    expect(abrirCliente).toThrow(/ANTENOR_API_CA_PATH/)
  })

  it('http nao exige certificado (util em teste local)', () => {
    process.env.ANTENOR_API_URL = 'http://localhost:3000'
    process.env.ANTENOR_API_KEY = 'k'
    expect(abrirCliente).not.toThrow()
  })

  it('manda a chave no header Authorization', () => {
    process.env.ANTENOR_API_URL = 'http://localhost:3000'
    process.env.ANTENOR_API_KEY = 'chave-de-teste'
    const c = abrirCliente() as { defaults: { headers: Record<string, string>; baseURL: string } }
    expect(c.defaults.headers.Authorization).toBe('Bearer chave-de-teste')
    expect(c.defaults.baseURL).toBe('http://localhost:3000')
  })

  it('barra final na URL nao gera caminho com barra dupla', () => {
    process.env.ANTENOR_API_URL = 'http://localhost:3000///'
    process.env.ANTENOR_API_KEY = 'k'
    const c = abrirCliente() as { defaults: { baseURL: string } }
    expect(c.defaults.baseURL).toBe('http://localhost:3000')
  })

  describe('isConfigured', () => {
    it('falso sem URL, sem chave, ou em https sem certificado', () => {
      expect(service.isConfigured()).toBe(false)

      process.env.ANTENOR_API_URL = 'https://10.0.0.1:5001'
      expect(service.isConfigured()).toBe(false)

      process.env.ANTENOR_API_KEY = 'k'
      // Em https o certificado e requisito, nao detalhe de configuracao.
      expect(service.isConfigured()).toBe(false)

      process.env.ANTENOR_API_CA_PATH = '/etc/antenor/antenorapi.crt'
      expect(service.isConfigured()).toBe(true)
    })
  })
})
