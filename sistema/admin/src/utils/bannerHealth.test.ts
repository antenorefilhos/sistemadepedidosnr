import { describe, expect, it } from 'vitest'
import { bannerStatus, checkDestination, type HealthContext } from './bannerHealth'
import type { StoreBanner } from './bannerTemplates'

const now = new Date('2026-09-30T12:00:00Z').getTime()
const ctx: HealthContext = {
  offers: 0,
  departments: [
    { id: '1', name: 'Açougue & Churrasco', shortName: 'Açougue', active: true, priority: 1, onSite: 91, offSite: 0, noPhoto: 0, promo: 0, orders: 0, revenue: 0 },
    { id: '2', name: 'Bebês & Infantil', shortName: null, active: true, priority: 2, onSite: 0, offSite: 3, noPhoto: 0, promo: 0, orders: 0, revenue: 0 },
  ],
  campaigns: [{ erpCampaignId: 372, name: 'Encarte Final Semana', active: true, startDate: '2026-10-03T03:00:00Z', endDate: '2026-10-05T02:59:59Z' }],
}
const banner = (over: Partial<StoreBanner>): StoreBanner =>
  ({ id: 'b', name: 'B', slot: 'hero', active: true, linkType: 'url', linkTarget: '_self', desktopImageUrl: 'x.webp', pages: 'home', order: 0, impressionsCount: 0, clicksCount: 0, ...over }) as StoreBanner

describe('bannerStatus', () => {
  it('banner do topo marcado para departamento nao aparece em lugar nenhum', () => {
    expect(bannerStatus(banner({ pages: 'category' }), ctx, now)).toMatchObject({ tone: 'warn', live: false })
  })
  it('vinculado a encarte futuro espera a data do encarte', () => {
    expect(bannerStatus(banner({ campaignErpId: 372, campaignFound: true }), ctx, now)).toMatchObject({ tone: 'info', live: false, text: 'Entra com o encarte em 03/10' })
  })
  it('agendado, encerrado, desligado e no ar', () => {
    expect(bannerStatus(banner({ startDate: '2026-10-01T11:00:00Z' }), ctx, now)).toMatchObject({ live: false, text: 'Agendado para 01/10, 08:00' })
    expect(bannerStatus(banner({ endDate: '2026-09-29T11:00:00Z' }), ctx, now)).toMatchObject({ live: false, tone: 'off' })
    expect(bannerStatus(banner({ active: false }), ctx, now)).toMatchObject({ live: false, text: 'Desligado' })
    expect(bannerStatus(banner({}), ctx, now)).toMatchObject({ live: true, text: 'No ar' })
  })
})

describe('checkDestination (sem rede)', () => {
  it('categoria por nome ou por slug casa com o departamento', async () => {
    expect(await checkDestination(banner({ linkType: 'category', linkValue: 'Açougue & Churrasco' }), ctx)).toEqual({ tone: 'ok', text: 'Açougue (91 produtos)' })
    expect(await checkDestination(banner({ linkValue: '/mercado?cat=acougue-churrasco' }), ctx)).toEqual({ tone: 'ok', text: 'Açougue (91 produtos)' })
  })
  it('departamento vazio, inexistente e promocoes sem oferta viram alerta', async () => {
    expect((await checkDestination(banner({ linkType: 'category', linkValue: 'Bebês & Infantil' }), ctx)).tone).toBe('warn')
    expect((await checkDestination(banner({ linkType: 'category', linkValue: 'Pet Shop' }), ctx)).tone).toBe('warn')
    expect((await checkDestination(banner({ linkValue: '/promocoes' }), ctx)).tone).toBe('warn')
  })
  it('vinho vai pra Adega; externo e loja inteira so informam', async () => {
    expect(await checkDestination(banner({ linkType: 'category', linkValue: 'Vinhos' }), ctx)).toEqual({ tone: 'ok', text: 'Adega' })
    expect((await checkDestination(banner({ linkValue: 'https://fornecedor.com' }), ctx)).tone).toBe('info')
    expect((await checkDestination(banner({ linkValue: '/mercado' }), ctx)).tone).toBe('info')
  })
})
