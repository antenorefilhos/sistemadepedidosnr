import { BadRequestException } from '@nestjs/common'

/**
 * JON-140 (Auditoria 360, High): inscricao de Web Push aceitava qualquer
 * endpoint sem validar destino -- SSRF classico (servidor faz requisicao
 * de saida pra onde o cliente mandar). Cobre scheme, credenciais na URL,
 * IP literal privado e DNS resolvendo pra IP privado (rebinding).
 */
const mockLookup = jest.fn()
jest.mock('dns/promises', () => ({
  lookup: (...args: unknown[]) => mockLookup(...args),
}))

import { assertPublicHttpsEndpoint } from './assert-public-endpoint'

describe('assertPublicHttpsEndpoint (JON-140)', () => {
  afterEach(() => jest.clearAllMocks())

  it('aceita endpoint https com IP publico resolvido', async () => {
    mockLookup.mockResolvedValue([{ address: '142.250.190.14' }])
    await expect(assertPublicHttpsEndpoint('https://fcm.googleapis.com/fcm/send/abc')).resolves.toBeUndefined()
  })

  it('recusa scheme http (nao https)', async () => {
    await expect(assertPublicHttpsEndpoint('http://fcm.googleapis.com/fcm/send/abc')).rejects.toBeInstanceOf(BadRequestException)
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it('recusa URL invalida', async () => {
    await expect(assertPublicHttpsEndpoint('nao-e-uma-url')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa credenciais na URL', async () => {
    await expect(assertPublicHttpsEndpoint('https://user:pass@fcm.googleapis.com/x')).rejects.toBeInstanceOf(BadRequestException)
  })

  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.0.0.5', '10.0.0.0/8'],
    ['172.16.0.1', '172.16.0.0/12'],
    ['192.168.1.1', '192.168.0.0/16'],
    ['169.254.169.254', 'link-local / metadata da nuvem'],
    ['100.64.0.1', 'CGNAT 100.64.0.0/10'],
  ])('recusa IP literal privado na URL: %s (%s)', async (ip) => {
    await expect(assertPublicHttpsEndpoint(`https://${ip}/x`)).rejects.toBeInstanceOf(BadRequestException)
    expect(mockLookup).not.toHaveBeenCalled() // IP literal nem precisa de DNS
  })

  it('recusa dominio que resolve pra IP privado (DNS rebinding)', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1' }])
    await expect(assertPublicHttpsEndpoint('https://dominio-malicioso.example/x')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa quando QUALQUER endereco resolvido e privado (multiplos A/AAAA)', async () => {
    mockLookup.mockResolvedValue([{ address: '142.250.190.14' }, { address: '10.0.0.1' }])
    await expect(assertPublicHttpsEndpoint('https://dominio.example/x')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa IPv6 loopback e unique-local', async () => {
    await expect(assertPublicHttpsEndpoint('https://[::1]/x')).rejects.toBeInstanceOf(BadRequestException)
    await expect(assertPublicHttpsEndpoint('https://[fd00::1]/x')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('recusa quando o host nao resolve (ENOTFOUND)', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'))
    await expect(assertPublicHttpsEndpoint('https://nao-existe.invalid/x')).rejects.toBeInstanceOf(BadRequestException)
  })
})
