import { isPrivateIp, realClientIp } from './real-client-ip'
import { isValidCpf } from './cpf'

const run = (headers: Record<string, string>) => {
  const req = { headers: { ...headers }, socket: { remoteAddress: '172.18.0.5' } } as never as { headers: Record<string, string> }
  realClientIp(req as never, {} as never, () => undefined)
  return req.headers['x-forwarded-for']
}

describe('realClientIp', () => {
  it('pelo tunel (peer interno) usa o CF-Connecting-IP', () => {
    expect(run({ 'x-forwarded-for': '172.18.0.12', 'cf-connecting-ip': '179.215.10.2' })).toBe('179.215.10.2')
  })
  it('direto na VPS (peer publico) ignora o cabecalho forjado', () => {
    expect(run({ 'x-forwarded-for': '200.1.2.3', 'cf-connecting-ip': '8.8.8.8' })).toBe('200.1.2.3')
  })
  it('cabecalho que nao e IP e ignorado', () => {
    expect(run({ 'x-forwarded-for': '172.18.0.12', 'cf-connecting-ip': 'abc' })).toBe('172.18.0.12')
  })
  it('reconhece rede interna', () => {
    expect(isPrivateIp('172.18.0.12')).toBe(true)
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true)
    expect(isPrivateIp('179.215.10.2')).toBe(false)
  })
})

describe('isValidCpf', () => {
  it('aceita CPF valido e recusa digito errado, repetido e curto', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224726')).toBe(false)
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('1234567890')).toBe(false)
  })
})
