import { CheckupService, looksRaw } from './checkup.service'

describe('check-up diario', () => {
  it('reconhece nome cru do ERP e ignora sigla/marca AeF', () => {
    expect(looksRaw('CERVEJA PILSEN ANTARCTICA LATA 473ML 12un')).toBe(true)
    expect(looksRaw('Cerveja Pilsen Antarctica Lata 473ml Pack 12 Unidades')).toBe(false)
    expect(looksRaw('Leite UHT Integral Piracanjuba 1L')).toBe(false)
    expect(looksRaw('Kit Churrasco Executivo 7 Pessoas AeF')).toBe(false)
  })

  it('resumo: tudo ok x lista de problemas', () => {
    const svc = new CheckupService({} as never, {} as never)
    expect(svc.format([{ name: 'A', ok: true, detail: 'x' }])).toMatch(/^✅ Check-up .*: tudo ok/)
    const msg = svc.format([{ name: 'A', ok: true, detail: 'x' }, { name: 'Pedido sem DAV', ok: false, detail: '1: #ABC' }])
    expect(msg).toMatch(/^⚠️ Check-up .*: 1 problema/)
    expect(msg).toContain('❌ Pedido sem DAV: 1: #ABC')
  })
})
