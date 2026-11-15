import { createHash } from 'crypto'
import {
  MetaConversionsService,
  MetaPurchaseOrder,
  buildContents,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  sha256,
  splitName,
} from './meta-conversions.service'

jest.mock('../../common/logger', () => ({
  winstonLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const sha = (v: string) => createHash('sha256').update(v).digest('hex')

const order: MetaPurchaseOrder = {
  id: 'cmorder123',
  total: 87.9,
  createdAt: '2026-11-14T15:30:00.000Z',
  customerId: 'cmcust1',
  customer: { name: 'João da Silva Júnior', email: '  Joao.Silva@Example.COM ', whatsapp: '(24) 99999-8888' },
  items: [
    { productId: 'p1', quantity: 2, unitPrice: 10.5 },
    { productId: 'p2', quantity: 0.8, unitPrice: 59.9, subtotal: 47.92 },
  ],
}

describe('normalizacao (regras da Meta antes do SHA-256)', () => {
  it('e-mail: minusculas e sem espacos; sem @ vira null', () => {
    expect(normalizeEmail('  Joao.Silva@Example.COM ')).toBe('joao.silva@example.com')
    expect(normalizeEmail('semarroba')).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
  })

  it('telefone: so digitos com DDI 55, sem zeros a esquerda', () => {
    expect(normalizePhone('(24) 99999-8888')).toBe('5524999998888')
    expect(normalizePhone('024 3333-4444')).toBe('552433334444')
    expect(normalizePhone('+55 24 99999-8888')).toBe('5524999998888')
    expect(normalizePhone('123')).toBeNull()
  })

  it('nome: sem acento nem pontuacao; primeiro e ultimo', () => {
    expect(normalizeName("  João D'Ávila-Silva ")).toBe('joao d avila silva')
    expect(splitName('João da Silva Júnior')).toEqual({ first: 'joao', last: 'junior' })
    expect(splitName('Maria')).toEqual({ first: 'maria', last: null })
    expect(splitName('')).toEqual({ first: null, last: null })
  })
})

describe('buildContents', () => {
  it('quantidade inteira vai como esta; peso fracionado vira 1 unidade pelo valor da linha', () => {
    const c = buildContents(order.items)
    expect(c.content_ids).toEqual(['p1', 'p2'])
    expect(c.contents).toEqual([
      { id: 'p1', quantity: 2, item_price: 10.5 },
      { id: 'p2', quantity: 1, item_price: 47.92 },
    ])
    expect(c.num_items).toBe(3)
  })
})

describe('MetaConversionsService.buildPurchaseEvent', () => {
  const svc = new MetaConversionsService()
  const ctx = { fbp: 'fb.1.111.222', fbc: 'fb.1.333.AbC', eventSourceUrl: 'https://mercado.antenorefilhos.com.br/checkout', clientIp: '203.0.113.9', userAgent: 'Mozilla/5.0 Test' }

  it('usa o id do pedido como event_id e os campos fixos do Purchase', () => {
    const ev = svc.buildPurchaseEvent(order, ctx)
    expect(ev.event_name).toBe('Purchase')
    expect(ev.event_id).toBe('cmorder123')
    expect(ev.action_source).toBe('website')
    expect(ev.event_source_url).toBe(ctx.eventSourceUrl)
    expect(ev.event_time).toBe(Math.floor(new Date('2026-11-14T15:30:00.000Z').getTime() / 1000))
  })

  it('dados do cliente em SHA-256 normalizado; IP, user agent, fbp e fbc em claro', () => {
    const u = svc.buildPurchaseEvent(order, ctx).user_data as Record<string, unknown>
    expect(u.em).toEqual([sha('joao.silva@example.com')])
    expect(u.ph).toEqual([sha('5524999998888')])
    expect(u.fn).toEqual([sha('joao')])
    expect(u.ln).toEqual([sha('junior')])
    expect(u.external_id).toEqual([sha('cmcust1')])
    expect(u.country).toEqual([sha('br')])
    expect(u.client_ip_address).toBe('203.0.113.9')
    expect(u.client_user_agent).toBe('Mozilla/5.0 Test')
    expect(u.fbp).toBe('fb.1.111.222')
    expect(u.fbc).toBe('fb.1.333.AbC')
    // nada de dado pessoal em claro
    expect(JSON.stringify(u)).not.toContain('joao.silva')
    expect(JSON.stringify(u)).not.toContain('99999')
  })

  it('custom_data: BRL, valor do pedido, content_type product, itens e num_items', () => {
    const c = svc.buildPurchaseEvent(order, ctx).custom_data
    expect(c).toMatchObject({ currency: 'BRL', value: 87.9, content_type: 'product', order_id: 'cmorder123', num_items: 3, content_ids: ['p1', 'p2'] })
    expect(c.contents).toHaveLength(2)
  })

  it('cliente sem e-mail/telefone: manda so o que tem, sem chave vazia', () => {
    const u = svc.buildPurchaseEvent({ ...order, customer: { name: null, email: null, whatsapp: null }, customerId: null }, {}).user_data as Record<string, unknown>
    expect(u).not.toHaveProperty('em')
    expect(u).not.toHaveProperty('ph')
    expect(u).not.toHaveProperty('fn')
    expect(u).not.toHaveProperty('external_id')
    expect(u.country).toEqual([sha('br')])
  })
})

describe('MetaConversionsService.sendPurchase', () => {
  const OLD = { ...process.env }
  let fetchMock: jest.Mock

  beforeEach(() => {
    delete process.env.META_CAPI_ACCESS_TOKEN
    delete process.env.META_PIXEL_ID
    delete process.env.META_CAPI_TEST_EVENT_CODE
    delete process.env.META_GRAPH_VERSION
    fetchMock = jest.fn()
    ;(global as unknown as { fetch: unknown }).fetch = fetchMock
  })
  afterAll(() => {
    process.env = OLD
  })

  it('sem token: nao chama a Meta e nao lanca', async () => {
    const r = await new MetaConversionsService().sendPurchase(order)
    expect(r).toEqual({ sent: false, reason: 'sem_token' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('com token: POST no pixel certo, token so no corpo, test_event_code quando definido', async () => {
    process.env.META_CAPI_ACCESS_TOKEN = 'SEGREDO-TOKEN'
    process.env.META_CAPI_TEST_EVENT_CODE = 'TEST123'
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ events_received: 1, fbtrace_id: 'abc' }) })
    const r = await new MetaConversionsService().sendPurchase(order, { clientIp: '203.0.113.9' })
    expect(r).toEqual({ sent: true, eventsReceived: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://graph.facebook.com/v25.0/2308084703100170/events')
    expect(String(url)).not.toContain('SEGREDO-TOKEN')
    const body = JSON.parse(init.body)
    expect(body.access_token).toBe('SEGREDO-TOKEN')
    expect(body.test_event_code).toBe('TEST123')
    expect(body.data).toHaveLength(1)
    expect(body.data[0].event_id).toBe('cmorder123')
  })

  it('resposta de erro da Meta: devolve sent=false e nao lanca', async () => {
    process.env.META_CAPI_ACCESS_TOKEN = 'x'
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid parameter', code: 100 } }) })
    await expect(new MetaConversionsService().sendPurchase(order)).resolves.toEqual({ sent: false, reason: 'http_400' })
  })

  it('falha de rede/timeout: devolve sent=false e nao lanca', async () => {
    process.env.META_CAPI_ACCESS_TOKEN = 'x'
    fetchMock.mockRejectedValue(new Error('fetch failed'))
    await expect(new MetaConversionsService().sendPurchase(order)).resolves.toEqual({ sent: false, reason: 'erro' })
  })

  it('sha256 exportado bate com o crypto padrao', () => {
    expect(sha256('abc')).toBe(sha('abc'))
  })
})
