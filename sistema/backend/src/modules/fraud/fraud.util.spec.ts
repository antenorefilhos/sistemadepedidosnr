import { addressKey, deviceContextFrom, deviceKey, ipNetwork, isDisposableEmail, normalizeEmail } from './fraud.util'

describe('fraud.util', () => {
  it('e-mail: gmail ignora ponto e +sufixo; outros so o +sufixo', () => {
    expect(normalizeEmail('Jo.Ao+promo@Gmail.com')).toBe('joao@gmail.com')
    expect(normalizeEmail('joao+x@googlemail.com')).toBe('joao@gmail.com')
    expect(normalizeEmail('jo.ao+x@hotmail.com')).toBe('jo.ao@hotmail.com')
    expect(normalizeEmail('sem-arroba')).toBeNull()
  })
  it('endereco: mesmo lugar escrito de jeitos diferentes da a mesma chave', () => {
    const a = addressKey({ zipCode: '25750-222', street: 'R. São João', number: '10' })
    expect(a).toBe(addressKey({ zipCode: '25750222', street: 'Rua Sao Joao', number: 'nº 10' }))
    expect(addressKey({ zipCode: '25750', street: 'Rua X', number: '1' })).toBeNull()
  })
  it('rede e chave do aparelho', () => {
    expect(ipNetwork('179.215.10.2')).toBe('179.215.10')
    expect(deviceKey({ fingerprint: 'abc', ip: '179.215.10.2' })).toBe('abc@179.215.10')
    expect(deviceKey({ fingerprint: 'abc', ip: null })).toBeNull()
  })
  it('le os cabecalhos do aparelho e descarta IP interno e lixo', () => {
    const ctx = deviceContextFrom({ ip: '172.18.0.12', headers: { 'x-device-id': 'd-1', 'x-device-fp': 'f'.repeat(32), 'x-device-bot': '1', 'cf-ipcountry': 'br' } })
    expect(ctx).toEqual({ deviceId: 'd-1', fingerprint: 'f'.repeat(32), automation: true, ip: null, country: 'BR' })
    expect(deviceContextFrom({ ip: '179.1.2.3', headers: { 'x-device-id': '<script>' } }, 'body-id').deviceId).toBe('body-id')
  })
  it('e-mail descartavel', () => {
    expect(isDisposableEmail('a@yopmail.com')).toBe(true)
    expect(isDisposableEmail('a@gmail.com')).toBe(false)
  })
})
