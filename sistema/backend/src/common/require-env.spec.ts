import { requireEnv } from './require-env'

describe('requireEnv', () => {
  const original = { ...process.env }
  afterEach(() => {
    process.env = { ...original }
  })

  it('devolve o valor quando a variavel existe', () => {
    process.env.TESTE_VAR = '5147995000131'
    expect(requireEnv('TESTE_VAR')).toBe('5147995000131')
  })

  it('estoura quando a variavel nao existe', () => {
    delete process.env.TESTE_VAR
    expect(() => requireEnv('TESTE_VAR')).toThrow(/TESTE_VAR nao configurada/)
  })

  // String vazia era o buraco: `process.env.X || 'default'` ja tratava assim,
  // mas `process.env.X ?? 'default'` nao -- e `SOLIDCOM_CNPJ=` no .env e' um
  // erro de configuracao tao ruim quanto a variavel ausente.
  it('trata vazio e so-espaco como ausente', () => {
    process.env.TESTE_VAR = ''
    expect(() => requireEnv('TESTE_VAR')).toThrow()
    process.env.TESTE_VAR = '   '
    expect(() => requireEnv('TESTE_VAR')).toThrow()
  })

  it('usa o fallback de variavel legada quando a principal falta', () => {
    delete process.env.TESTE_VAR
    expect(requireEnv('TESTE_VAR', 'http://legado:5000')).toBe('http://legado:5000')
  })

  it('a principal vence o fallback legado', () => {
    process.env.TESTE_VAR = 'http://novo:5000'
    expect(requireEnv('TESTE_VAR', 'http://legado:5000')).toBe('http://novo:5000')
  })

  it('remove espaco em volta -- .env copiado com espaco sobrando e comum', () => {
    process.env.TESTE_VAR = '  19  '
    expect(requireEnv('TESTE_VAR')).toBe('19')
  })
})
