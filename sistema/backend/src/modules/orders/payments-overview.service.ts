import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

/**
 * Pagamentos no admin (30/09/2026). O site nao recebe dinheiro: o cliente so
 * informa a forma, e quem cobra e o caixa (PDV), depois da separacao. A tela
 * antiga mostrava o livro de um gateway que nunca existiu (zero registros).
 *
 * Tres valores por pedido: o que o cliente aprovou no site (evento
 * order.created), o valor depois da separacao (order.total, ja com peso real
 * e faltas) e o cupom do caixa (valorCupom, gravado pelo
 * reconcileInvoicedOrder a partir da AntenorApi).
 *
 * Nao usa a conferencia item a item: em 30/09/2026 o `itens-faturados` da
 * AntenorApi devolvia, em item de peso, o preco do kg no lugar do total da
 * linha (queijo 0,39 kg a R$ 86/kg vinha com vlTotal 86). O valorCupom vem
 * certo -- R$ 104,03 no DAV 102115, igual ao separado.
 */
type Meio = { descricao: string; valor: number; troco: number }
type Pagamento = { valorCupom: number | null; valorTroco: number | null; numeroCupom: number | null; caixaPDV: number | null; chaveNFCe: string | null; meios: Meio[] }
type Conciliacao = { pagamento?: Pagamento | null }

const VALIDO = (status: string) => !['CANCELLED', 'REFUNDED'].includes(status)
const JA_SAIU = ['DELIVERED', 'COMPLETED', 'PICKED_UP']
const round2 = (n: number) => Math.round(n * 100) / 100

/** Descricao livre do PDV ("Dinheiro", "Cartao Debito", "Pix"...) para a forma do site. */
export function formaDoCaixa(descricao: string): 'CASH' | 'PIX' | 'CARD' | 'VOUCHER' | 'OTHER' {
  const d = descricao.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (d.includes('dinheiro')) return 'CASH'
  if (d.includes('pix')) return 'PIX'
  if (/vale|ticket|alimenta|refei|sodexo|alelo|vr\b|ben\b/.test(d)) return 'VOUCHER'
  if (/cart|credito|debito|visa|master|elo\b|pos\b|tef/.test(d)) return 'CARD'
  return 'OTHER'
}

@Injectable()
export class PaymentsOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000)
    const orders = await this.prisma.order.findMany({
      where: { tenantId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        erpDav: true,
        status: true,
        fulfillmentType: true,
        paymentMethod: true,
        total: true,
        delivery: true,
        discount: true,
        notes: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    })
    const [events, firstInvoice] = await Promise.all([
      orders.length
        ? this.prisma.orderEvent.findMany({
            where: {
              orderId: { in: orders.map((o) => o.id) },
              type: { in: ['order.created', 'order.invoiced', 'order.invoice_reconciled', 'order.invoice_diverged', 'order.cancelled_in_erp'] },
            },
            orderBy: { createdAt: 'asc' },
            select: { orderId: true, type: true, payload: true, createdAt: true },
          })
        : [],
      // O aviso de faturamento (Notificador/AntenorApi) comecou em setembro;
      // pedido anterior a ele "sem cupom" e falta de registro, nao de venda.
      this.prisma.orderEvent.findFirst({ where: { type: 'order.invoiced' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ])
    const approvedAt = new Map<string, number>()
    const invoicedAt = new Map<string, Date>()
    const pagamento = new Map<string, Pagamento>()
    const cancelledInErp = new Set<string>()
    for (const e of events) {
      const payload = (e.payload || {}) as Record<string, unknown>
      if (e.type === 'order.created' && typeof payload.total === 'number') approvedAt.set(e.orderId, payload.total)
      else if (e.type === 'order.invoiced') invoicedAt.set(e.orderId, e.createdAt)
      else if (e.type === 'order.cancelled_in_erp') cancelledInErp.add(e.orderId)
      else if ((payload as Conciliacao).pagamento) pagamento.set(e.orderId, (payload as Conciliacao).pagamento as Pagamento)
    }

    const rows = orders.map((o) => {
      const pag = pagamento.get(o.id) || null
      const total = Number(o.total)
      const delivery = Number(o.delivery || 0)
      const approved = approvedAt.get(o.id) ?? total
      const invoiced = invoicedAt.has(o.id)
      // Cupom = produtos; o frete e cobrado a parte (no caixa aparece como "troco").
      const charged = pag?.valorCupom != null ? round2(pag.valorCupom + delivery) : null
      const cashierDiff = charged != null ? round2(charged - total) : null
      const formasCaixa = [...new Set((pag?.meios || []).map((m) => formaDoCaixa(m.descricao)))]
      const flags: string[] = []
      if (cashierDiff != null && Math.abs(cashierDiff) > 0.02) flags.push('CAIXA_DIFERENTE')
      if (JA_SAIU.includes(o.status) && !invoiced && firstInvoice && o.createdAt >= firstInvoice.createdAt) flags.push('SAIU_SEM_CUPOM')
      if (!VALIDO(o.status) && invoiced) flags.push('CANCELADO_APOS_FATURAR')
      return {
        id: o.id,
        dav: o.erpDav,
        customer: o.customer?.name || null,
        createdAt: o.createdAt,
        status: o.status,
        pickup: o.fulfillmentType === 'PICKUP',
        siteMethod: o.paymentMethod,
        changeFor: /Troco para:\s*([\d.,]+)/i.exec(o.notes || '')?.[1] || null,
        approved,
        total,
        delivery,
        discount: Number(o.discount || 0),
        pickingAdjust: round2(total - approved),
        invoicedAt: invoicedAt.get(o.id) || null,
        cancelledInErp: cancelledInErp.has(o.id),
        charged,
        cashierDiff,
        pdv: pag ? { cupom: pag.numeroCupom, valorCupom: pag.valorCupom, caixa: pag.caixaPDV, nfce: pag.chaveNFCe, meios: pag.meios, formas: formasCaixa } : null,
        methodMismatch: formasCaixa.length > 0 && !formasCaixa.includes(o.paymentMethod as never),
        flags,
      }
    })

    const valid = rows.filter((r) => VALIDO(r.status))
    const withCupom = valid.filter((r) => r.charged != null)
    const methods = ['CASH', 'PIX', 'CARD', 'VOUCHER', 'OTHER'] as const
    const byMethod = methods
      .map((m) => ({
        method: m,
        siteOrders: valid.filter((r) => r.siteMethod === m).length,
        siteValue: round2(valid.filter((r) => r.siteMethod === m).reduce((a, r) => a + r.total, 0)),
        pdvOrders: withCupom.filter((r) => r.pdv?.formas.includes(m)).length,
      }))
      .filter((m) => m.siteOrders || m.pdvOrders)

    return {
      days,
      summary: {
        orders: valid.length,
        approved: round2(valid.reduce((a, r) => a + r.approved, 0)),
        final: round2(valid.reduce((a, r) => a + r.total, 0)),
        pickingAdjust: round2(valid.reduce((a, r) => a + r.pickingAdjust, 0)),
        delivery: round2(valid.reduce((a, r) => a + r.delivery, 0)),
        invoiced: valid.filter((r) => r.invoicedAt).length,
        withCupom: withCupom.length,
        charged: round2(withCupom.reduce((a, r) => a + (r.charged || 0), 0)),
        cashierDiff: round2(withCupom.reduce((a, r) => a + (r.cashierDiff || 0), 0)),
        methodMismatch: withCupom.filter((r) => r.methodMismatch).length,
        awaitingCashier: valid.filter((r) => r.status === 'READY_FOR_CHECKOUT').length,
        cancelled: rows.length - valid.length,
      },
      byMethod,
      orders: rows,
    }
  }
}
