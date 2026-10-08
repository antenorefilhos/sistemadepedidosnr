import { cached, invalidateCached, resetMemoryCache } from './memory-cache'

describe('cache em memoria da vitrine', () => {
  beforeEach(() => {
    resetMemoryCache()
    jest.useFakeTimers({ now: new Date('2026-10-08T12:00:00Z') })
  })
  afterEach(() => jest.useRealTimers())

  it('chamadas simultaneas montam uma vez so', async () => {
    const loader = jest.fn().mockResolvedValue('dado')
    const [a, b] = await Promise.all([cached('k', 1000, loader), cached('k', 1000, loader)])
    expect([a, b]).toEqual(['dado', 'dado'])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('dentro do prazo responde da memoria; vencido responde o anterior e atualiza por tras', async () => {
    const loader = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    expect(await cached('k', 1000, loader)).toBe('v1')
    jest.setSystemTime(Date.now() + 500)
    expect(await cached('k', 1000, loader)).toBe('v1')
    expect(loader).toHaveBeenCalledTimes(1)
    jest.setSystemTime(Date.now() + 1000)
    expect(await cached('k', 1000, loader)).toBe('v1')
    await Promise.resolve()
    await Promise.resolve()
    expect(loader).toHaveBeenCalledTimes(2)
    expect(await cached('k', 1000, loader)).toBe('v2')
  })

  it('passou do prazo de reserva: espera o dado novo', async () => {
    const loader = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    await cached('k', 1000, loader, 1000)
    jest.setSystemTime(Date.now() + 5000)
    expect(await cached('k', 1000, loader, 1000)).toBe('v2')
  })

  it('erro nao fica guardado', async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error('fora')).mockResolvedValueOnce('ok')
    await expect(cached('k', 1000, loader)).rejects.toThrow('fora')
    expect(await cached('k', 1000, loader)).toBe('ok')
  })

  it('invalidar por prefixo', async () => {
    const loader = jest.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    await cached('cms:x', 60_000, loader)
    invalidateCached('cms:')
    expect(await cached('cms:x', 60_000, loader)).toBe('v2')
  })
})
