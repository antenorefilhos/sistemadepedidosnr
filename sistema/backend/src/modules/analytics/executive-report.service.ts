import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

export interface ExecutiveReportData {
  period: {
    weekStart: string
    weekEnd: string
  }
  summary: {
    totalRevenue: number
    totalOrders: number
    conversionRate: number
    cartAbandonRate: number
    averageOrderValue: number
  }
  topCategories: Array<{
    category: string
    revenue: number
    orders: number
    percentage: number
  }>
  topSearchTerms: Array<{
    term: string
    count: number
    results: number
    noResultRate: number
  }>
  catalogGaps: Array<{
    term: string
    searchCount: number
    noResultsCount: number
  }>
  recommendations: string[]
}

@Injectable()
export class ExecutiveReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * M33.3: Gera relatório executivo semanal
   * @param weekStartDate data de início da semana (segunda-feira)
   */
  async generateWeeklyReport(weekStartDate?: Date): Promise<ExecutiveReportData> {
    // Calcular período (segunda-feira a domingo)
    const start = weekStartDate ? new Date(weekStartDate) : this.getLastMondayStart()
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    // 1. Receita e Pedidos
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        total: true,
      },
    })

    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    const totalOrders = orders.length
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // 2. Funil de Conversão
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        type: true,
        metadata: true,
      },
    })

    const eventCounts = {
      views: events.filter((e) => e.type === 'VIEW_PRODUCT').length,
      addedToCart: events.filter((e) => e.type === 'ADD_TO_CART').length,
      checkoutStarted: events.filter((e) => e.type === 'CHECKOUT_STARTED').length,
      purchased: totalOrders,
    }

    const conversionRate =
      eventCounts.views > 0
        ? (eventCounts.purchased / eventCounts.views) * 100
        : 0
    const cartAbandonRate =
      eventCounts.addedToCart > 0
        ? ((eventCounts.addedToCart - eventCounts.purchased) / eventCounts.addedToCart) * 100
        : 0

    // 3. Top Categorias (via OrderItem e Product.category string)
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: {
            gte: start,
            lte: end,
          },
          status: { not: 'CANCELLED' },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            category: true,
          },
        },
      },
    })

    const categoryRevenue = new Map<string, { name: string; revenue: number; orders: number }>()
    for (const item of orderItems) {
      const catName = item.product?.category || 'Sem Categoria'
      const itemRevenue = Number(item.unitPrice || 0) * Number(item.quantity || 0)

      if (!categoryRevenue.has(catName)) {
        categoryRevenue.set(catName, { name: catName, revenue: 0, orders: 0 })
      }
      const curr = categoryRevenue.get(catName)!
      curr.revenue += itemRevenue
      curr.orders += 1
    }

    const topCategories = Array.from(categoryRevenue.entries())
      .map(([_, data]) => ({
        category: data.name,
        revenue: data.revenue,
        orders: data.orders,
        percentage: totalOrders > 0 ? (data.orders / totalOrders) * 100 : 0,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)

    // 4. Top Termos de Busca
    const searchEvents = events.filter((e) => e.type === 'SEARCH')
    const termCounts = new Map<string, { count: number; results: number }>()
    for (const event of searchEvents) {
      const metadata = event.metadata ? JSON.parse(event.metadata) : {}
      const term = metadata.query || 'unknown'
      const resultCount = metadata.resultCount || 0

      if (!termCounts.has(term)) {
        termCounts.set(term, { count: 0, results: 0 })
      }
      const curr = termCounts.get(term)!
      curr.count += 1
      curr.results = Math.max(curr.results, resultCount)
    }

    const topSearchTerms = Array.from(termCounts.entries())
      .map(([term, data]) => ({
        term,
        count: data.count,
        results: data.results,
        noResultRate: data.results === 0 ? 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // 5. Gaps de Catálogo (buscas sem resultado)
    const noResultTerms = topSearchTerms.filter((t) => t.noResultRate > 0)
    const catalogGaps = noResultTerms.map((t) => ({
      term: t.term,
      searchCount: t.count,
      noResultsCount: t.count,
    }))

    // 6. Recomendações
    const recommendations: string[] = []
    if (conversionRate < 2) {
      recommendations.push('⚠️ Taxa de conversão muito baixa. Revisar fluxo de checkout.')
    }
    if (cartAbandonRate > 50) {
      recommendations.push('⚠️ Alto abandono de carrinho. Considerar estratégia de recovery.')
    }
    if (catalogGaps.length > 0) {
      recommendations.push(`💡 ${catalogGaps.length} termos com zero resultados. Expandir catálogo.`)
    }
    if (topCategories.length === 0) {
      recommendations.push('ℹ️ Sem dados de vendas. Aguardar mais pedidos.')
    } else if (topCategories[0].percentage > 60) {
      recommendations.push('💡 Catálogo concentrado. Diversificar produto.')
    }

    return {
      period: {
        weekStart: start.toISOString().split('T')[0],
        weekEnd: end.toISOString().split('T')[0],
      },
      summary: {
        totalRevenue,
        totalOrders,
        conversionRate: Math.round(conversionRate * 100) / 100,
        cartAbandonRate: Math.round(cartAbandonRate * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      },
      topCategories,
      topSearchTerms,
      catalogGaps,
      recommendations,
    }
  }

  /**
   * Formata relatório para CSV
   */
  formatAsCSV(report: ExecutiveReportData): string {
    const lines: string[] = []

    // Header
    lines.push('RELATÓRIO EXECUTIVO SEMANAL')
    lines.push(`Período: ${report.period.weekStart} a ${report.period.weekEnd}`)
    lines.push('')

    // Summary
    lines.push('RESUMO GERAL')
    lines.push('Métrica,Valor')
    lines.push(`Receita Total,R$ ${report.summary.totalRevenue.toFixed(2)}`)
    lines.push(`Quantidade de Pedidos,${report.summary.totalOrders}`)
    lines.push(`Taxa de Conversão,${report.summary.conversionRate}%`)
    lines.push(`Abandono de Carrinho,${report.summary.cartAbandonRate}%`)
    lines.push(`Ticket Médio,R$ ${report.summary.averageOrderValue.toFixed(2)}`)
    lines.push('')

    // Top Categories
    lines.push('TOP 5 CATEGORIAS')
    lines.push('Categoria,Receita,Pedidos,Percentual')
    for (const cat of report.topCategories) {
      lines.push(
        `"${cat.category}",R$ ${cat.revenue.toFixed(2)},${cat.orders},${cat.percentage.toFixed(1)}%`
      )
    }
    lines.push('')

    // Top Search Terms
    lines.push('TOP 8 TERMOS DE BUSCA')
    lines.push('Termo,Buscas,Resultados,Taxa Sem Resultado')
    for (const term of report.topSearchTerms) {
      lines.push(
        `"${term.term}",${term.count},${term.results},${term.noResultRate.toFixed(1)}%`
      )
    }
    lines.push('')

    // Catalog Gaps
    if (report.catalogGaps.length > 0) {
      lines.push('GAPS DE CATÁLOGO')
      lines.push('Termo,Buscas,Sem Resultado')
      for (const gap of report.catalogGaps) {
        lines.push(`"${gap.term}",${gap.searchCount},${gap.noResultsCount}`)
      }
      lines.push('')
    }

    // Recommendations
    lines.push('RECOMENDAÇÕES')
    for (const rec of report.recommendations) {
      lines.push(`"${rec}"`)
    }

    return lines.join('\n')
  }

  /**
   * Obtém a segunda-feira do início da semana atual
   */
  private getLastMondayStart(): Date {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Ajustar domingo
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  }
}
