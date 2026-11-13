import { CheckupService, looksRaw } from './checkup.service'

describe('check-up diario', () => {
  it('reconhece nome cru do ERP e ignora sigla/marca AeF', () => {
    expect(looksRaw('CERVEJA PILSEN ANTARCTICA LATA 473ML 12un')).toBe(true)
    expect(looksRaw('Cerveja Pilsen Antarctica Lata 473ml Pack 12 Unidades')).toBe(false)
    expect(looksRaw('Leite UHT Integral Piracanjuba 1L')).toBe(false)
    expect(looksRaw('Kit Churrasco Executivo 7 Pessoas AeF')).toBe(false)
  })

  describe('resumo do Telegram', () => {
    const svc = new CheckupService({} as never, {} as never, {} as never)
    // 09:30 UTC = 06:30 em Sao Paulo (a hora do cron do check-up).
    const manha = new Date('2026-11-13T09:30:00Z')

    it('tudo certo: cumprimenta e diz de cara que esta tudo certo', () => {
      const msg = svc.format([{ name: 'A', ok: true, detail: 'x' }], manha)
      expect(msg).toMatch(/^☀️ Bom dia! Check-up de 13\/11\/2026: está tudo certo com a loja\. 🎉/)
      expect(msg).toContain('✅ A: x')
      expect(msg).not.toContain('❌')
    })

    it('com problema: avisa quantos, poe os problemas antes do que esta em ordem', () => {
      const msg = svc.format([{ name: 'A', ok: true, detail: 'x' }, { name: 'Pedido sem DAV', ok: false, detail: '1: #ABC' }], manha)
      expect(msg).toMatch(/^☀️ Bom dia! Check-up de 13\/11\/2026: tem 1 coisa para a gente olhar\. 👀/)
      expect(msg).toContain('❌ Pedido sem DAV: 1: #ABC')
      expect(msg).toContain('O resto está em ordem:')
      expect(msg.indexOf('❌ Pedido sem DAV')).toBeLessThan(msg.indexOf('✅ A: x'))
    })

    it('varios problemas: plural; todos com problema: sem a secao "o resto"', () => {
      const dois = svc.format([{ name: 'A', ok: false, detail: '1' }, { name: 'B', ok: false, detail: '2' }], manha)
      expect(dois).toContain('tem 2 coisas para a gente olhar')
      expect(dois).not.toContain('O resto está em ordem')
    })

    it('cumprimenta pela hora de Sao Paulo (tarde e noite)', () => {
      const ok = [{ name: 'A', ok: true, detail: 'x' }]
      expect(svc.format(ok, new Date('2026-11-13T18:00:00Z'))).toMatch(/^🌤️ Boa tarde!/) // 15:00 BRT
      expect(svc.format(ok, new Date('2026-11-14T01:00:00Z'))).toMatch(/^🌙 Boa noite!/) // 22:00 BRT
      expect(svc.format(ok, new Date('2026-11-13T03:00:00Z'))).toMatch(/^🌙 Boa noite!/) // 00:00 BRT, nao "24h"
    })
  })
})
