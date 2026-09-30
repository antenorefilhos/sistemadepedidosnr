import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

/**
 * Pagamentos no admin (30/09/2026). O site nao recebe dinheiro: o cliente so
 * informa a forma, e quem cobra e o caixa (PDV), depois da separacao. A tela
 * antiga mostrava o livro de um gateway que nunca existiu (zero registros).
 *
 * Aqui cada pedido traz o que o cliente aprovou no site e o que o caixa
 * cobrou de fato -- gravado pelo reconcileInvoicedOrder a partir da AntenorApi
 * (itens, cupom, forma registrada).
 */
type Meio = { descricao: string; valor: number; troco: number }
type Pagamento = { valorCupom: number | null; valorTroco: number | null; numeroCupom: number | null; caixaPDV: number | null; chaveNFCe: string | null; meios: Meio[] }
type ItemReconciliado = { situacao: string; nome: string; qtdPedida: number | null; qtdFaturada: number | null; diferenca: number }
type Conciliacao = { totalPedido: number; totalFaturado: number; diferenca: number; itens: ItemReconciliado[]; pagamento?: Pagamento | null }

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
    const events = orders.length
      ? await this.prisma.orderEvent.findMany({
          where: { orderId: { in: orders.map((o) => o.id) }, type: { in: ['order.invoiced', 'order.invoice_reconciled', 'order.invoice_diverged', 'order.cancelled_in_erp'] } },
          orderBy: { createdAt: 'asc' },
          select: { orderId: true, type: true, payload: true, createdAt: true },
        })
      : []
    const invoicedAt = new Map<string, Date>()
    const conciliacao = new Map<string, Conciliacao>()
    const cancelledInErp = new Set<string>()
    for (const e of events) {
      if (e.type === 'order.invoiced') invoicedAt.set(e.orderId, e.createdAt)
      else if (e.type === 'order.cancelled_in_erp') cancelledInErp.add(e.orderId)
      else conciliacao.set(e.orderId, e.payload as unknown as Conciliacao)
    }

    const rows = orders.map((o) => {
      const c = conciliacao.get(o.id)
      const pag = c?.pagamento || null
      const total = Number(o.total)
      const delivery = Number(o.delivery || 0)
      const invoiced = invoicedAt.has(o.id)
      const formasCaixa = [...new Set((pag?.meios || []).map((m) => formaDoCaixa(m.descricao)))]
      const flags: string[] = []
      if (c && Math.abs(c.diferenca) >= 0.01) flags.push('VALOR_DIFERENTE')
      if (formasCaixa.length && !formasCaixa.includes(o.paymentMethod as never)) flags.push('FORMA_DIFERENTE')
      if (JA_SAIU.includes(o.status) && !invoiced) flags.push('SAIU_SEM_CUPOM')
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
        total,
        delivery,
        discount: Number(o.discount || 0),
        invoicedAt: invoicedAt.get(o.id) || null,
        cancelledInErp: cancelledInErp.has(o.id),
        charged: pag?.valorCupom ?? c?.totalFaturado ?? null,
        approvedItems: c?.totalPedido ?? null,
        difference: c ? c.diferenca : null,
        divergentItems: (c?.itens || []).filter((i) => i.situacao !== 'CONFERE'),
        pdv: pag ? { cupom: pag.numeroCupom, caixa: pag.caixaPDV, nfce: pag.chaveNFCe, meios: pag.meios, formas: formasCaixa } : null,
        flags,
      }
    })

    const valid = rows.filter((r) => VALIDO(r.status))
    const reconciled = valid.filter((r) => r.difference != null)
    const methods = ['CASH', 'PIX', 'CARD', 'VOUCHER', 'OTHER'] as const
    const byMethod = methods
      .map((m) => {
        const site = valid.filter((r) => r.siteMethod === m)
        const caixa = valid.flatMap((r) => (r.pdv?.meios || []).filter((x) => formaDoCaixa(x.descricao) === m))
        return {
          method: m,
          siteOrders: site.length,
          siteValue: round2(site.reduce((a, r) => a + r.total, 0)),
          pdvValue: round2(caixa.reduce((a, x) => a + x.valor - x.troco, 0)),
        }
      })
      .filter((m) => m.siteOrders || m.pdvValue)

    return {
      days,
      summary: {
        orders: valid.length,
        approved: round2(valid.reduce((a, r) => a + r.total, 0)),
        delivery: round2(valid.reduce((a, r) => a + r.delivery, 0)),
        invoiced: valid.filter((r) => r.invoicedAt).length,
        withPdvData: reconciled.length,
        charged: round2(reconciled.reduce((a, r) => a + (r.charged || 0), 0)),
        approvedReconciled: round2(reconciled.reduce((a, r) => a + (r.approvedItems || 0), 0)),
        difference: round2(reconciled.reduce((a, r) => a + (r.difference || 0), 0)),
        awaitingCashier: valid.filter((r) => r.status === 'READY_FOR_CHECKOUT').length,
        cancelled: rows.length - valid.length,
      },
      byMethod,
      orders: rows,
    }
  }
}
