import { existsSync } from 'fs'
import { join } from 'path'
import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { isProductSellable } from '../../common/product-availability'
import { winstonLogger } from '../../common/logger'
import { AntenorApiService } from '../integrations/antenor-api.service'

// Check-up diario (pedido do Jonathan, 28/09/2026): "sempre tem um problema
// que ninguem viu". Cada verificacao aqui e um erro real que ja aconteceu e
// so foi achado no olho -- vira regra para nao voltar sem aviso. Resultado vai
// para o Telegram (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).
// Para acrescentar uma regra: um item a mais em runChecks(), com o motivo.

export type CheckResult = { name: string; ok: boolean; detail: string }

const SAMPLE = 5
const sample = (items: string[]) => items.slice(0, SAMPLE).join('; ') + (items.length > SAMPLE ? ` (+${items.length - SAMPLE})` : '')

// Palavra toda em maiuscula com 4+ letras (siglas conhecidas de fora):
// sinal de nome cru do ERP ("CERVEJA PILSEN ANTARCTICA LATA").
const SIGLAS = new Set(['AEF', 'UHT', 'IPA', 'APA', 'PET', 'KIDS', 'ZERO', 'MAX', 'PLUS', 'GOLD', 'LIGHT', 'DIET', 'BRUT', 'IGT', 'DOC', 'DOCG', 'VSOP', 'LED'])
export const looksRaw = (name: string) =>
  name.split(/\s+/).filter((w) => /^[A-ZÀ-Ú]{4,}$/.test(w) && !SIGLAS.has(w)).length >= 2

@Injectable()
export class CheckupService {
  /** Ultimo resultado, para o rodape do painel do admin (em memoria; some a cada deploy). */
  private last: { at: string; results: CheckResult[] } | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly antenorApi: AntenorApiService,
  ) {}

  @Cron(process.env.CHECKUP_CRON || '30 6 * * *', { name: 'checkup-diario', timeZone: 'America/Sao_Paulo' })
  async scheduled() {
    try {
      await this.runAndNotify()
    } catch (error) {
      winstonLogger.error('checkup_falhou', { error: error instanceof Error ? error.stack : String(error) })
    }
  }

  async runAndNotify() {
    const results = await this.runChecks()
    const sent = await this.sendTelegram(this.format(results))
    winstonLogger.info('checkup_executado', { falhas: results.filter((r) => !r.ok).length, telegram: sent })
    return { results, telegram: sent }
  }

  async runChecks(): Promise<CheckResult[]> {
    const results: CheckResult[] = []
    const run = async (name: string, fn: () => Promise<Omit<CheckResult, 'name'>>) => {
      try {
        results.push({ name, ...(await fn()) })
      } catch (error) {
        results.push({ name, ok: false, detail: `verificacao falhou: ${error instanceof Error ? error.message : error}` })
      }
    }

    const active = await this.prisma.product.findMany({
      where: { active: true },
      select: { id: true, ean: true, name: true, price: true, erpProductId: true, syncOption: true, stock: true, active: true },
    })

    let feed: Awaited<ReturnType<AntenorApiService['syncProducts']>>['data'] = []

    // 1) 25/09: tomate/batata/cebola vendiam na loja e sumiram do site.
    await run('Produto do feed escondido no site', async () => {
      feed = (await this.antenorApi.syncProducts()).data
      const activeIds = new Set(active.map((p) => p.erpProductId))
      const hidden = feed.filter((f) => f.erpProductId && isProductSellable(f) && !activeIds.has(f.erpProductId))
      return { ok: hidden.length === 0, detail: hidden.length ? `${hidden.length}: ${sample(hidden.map((h) => h.name))}` : `feed com ${feed.length} linhas, nada escondido` }
    })

    // 1b) 27/09: /alterados divergia do feed completo (nome cru) e o sync de
    // hora em hora desfazia o sync completo. Mesmo SKU tem de vir igual nos dois.
    await run('Simetria feed completo x atualização de hora em hora', async () => {
      if (feed.length === 0) return { ok: false, detail: 'feed completo indisponível' }
      const recent = await this.antenorApi.fetchRecentChanges(24)
      const byId = new Map(feed.map((f) => [f.erpProductId, f]))
      const diffs: string[] = []
      for (const r of recent) {
        const f = byId.get(r.erpProductId)
        if (!f) continue
        const fields = (['name', 'price', 'promotionalPrice', 'syncOption', 'active'] as const).filter((k) => (r[k] ?? null) !== (f[k] ?? null))
        if (fields.length) diffs.push(`${r.erpProductId} (${fields.join(', ')})`)
      }
      return { ok: diffs.length === 0, detail: diffs.length ? `${diffs.length}: ${sample(diffs)}` : `${recent.length} alterados, todos iguais ao feed` }
    })

    // 2) 27/09: o sync de hora em hora trazia nome cru em caixa alta.
    await run('Nome fora do padrão (caixa alta)', async () => {
      const raw = active.filter((p) => looksRaw(p.name))
      return { ok: raw.length === 0, detail: raw.length ? `${raw.length}: ${sample(raw.map((p) => p.name))}` : 'nenhum' }
    })

    await run('Produto ativo com preço zero', async () => {
      const zero = active.filter((p) => !(p.price > 0))
      return { ok: zero.length === 0, detail: zero.length ? `${zero.length}: ${sample(zero.map((p) => p.name))}` : 'nenhum' }
    })

    // 3) 26/09: as 10 "Taxa Entrega" ficaram a venda como produto.
    await run('Item interno à venda (taxa/sacola)', async () => {
      const internal = active.filter((p) => /^(taxa\s+entrega|sacola|saco\s+farinha\s+vazio)/i.test(p.name))
      return { ok: internal.length === 0, detail: internal.length ? sample(internal.map((p) => p.name)) : 'nenhum' }
    })

    // 4) Pedido sem DAV nao existe no PDV: o separador nao consegue puxar.
    await run('Pedido sem DAV (últimas 24 h)', async () => {
      const since = new Date(Date.now() - 24 * 3600_000)
      const limit = new Date(Date.now() - 15 * 60_000)
      const orders = await this.prisma.order.findMany({
        where: { createdAt: { gte: since, lte: limit }, erpDav: null, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        select: { id: true, createdAt: true },
      })
      return { ok: orders.length === 0, detail: orders.length ? `${orders.length}: ${sample(orders.map((o) => `#${o.id.slice(-8).toUpperCase()}`))}` : 'nenhum' }
    })

    // 5) Faturamento: pedido faturado no caixa que nao avancou no site.
    await run('Pedido parado aguardando o caixa (> 3 h)', async () => {
      const orders = await this.prisma.order.findMany({
        where: { status: 'READY_FOR_CHECKOUT', updatedAt: { lte: new Date(Date.now() - 3 * 3600_000) } },
        select: { id: true, erpDav: true },
      })
      return { ok: orders.length === 0, detail: orders.length ? sample(orders.map((o) => `DAV ${o.erpDav ?? '?'}`)) : 'nenhum' }
    })

    // 6) Google: sitemap dinamico e pagina de produto renderizada no servidor.
    await run('Google (sitemap e página de produto)', async () => {
      const site = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '')
      const xml = await (await fetch(`${site}/sitemap.xml`)).text()
      const urls = (xml.match(/<url>/g) || []).length
      const withErp = active.filter((p) => p.erpProductId).length
      const firstProduct = (xml.match(/<loc>([^<]*\/p\/[^<]*)<\/loc>/) || [])[1]
      const page = firstProduct ? await fetch(firstProduct) : null
      const html = page ? await page.text() : ''
      const pageOk = Boolean(page?.ok && /og:title/.test(html) && /application\/ld\+json/.test(html))
      const ok = urls >= withErp * 0.9 && pageOk
      return { ok, detail: `sitemap com ${urls} URLs (${withErp} produtos ativos); página de produto ${pageOk ? 'ok' : 'SEM conteúdo para o Google'}` }
    })

    // 7) Compre-junto: cesta do PDV respondendo.
    await run('Compre junto (cesta do caixa)', async () => {
      const ref = active.find((p) => p.erpProductId === 6065) || active.find((p) => p.erpProductId)
      const cesta = await this.antenorApi.getCesta(ref!.erpProductId!, 6)
      // A tarefa da cesta roda 23:30; se falhar, a API segue servindo a versao
      // anterior sem erro -- so a idade denuncia (sugestao do ORQ-API, 28/09).
      const hours = cesta.geradoEm ? (Date.now() - new Date(cesta.geradoEm).getTime()) / 3_600_000 : Infinity
      const fresh = hours < 26
      return {
        ok: (cesta.itens || []).length > 0 && fresh,
        detail: `versão ${cesta.versao} gerada há ${Number.isFinite(hours) ? Math.round(hours) + ' h' : '?'}${fresh ? '' : ' (DESATUALIZADA)'}, ${cesta.itens?.length ?? 0} sugestões para ${ref!.name}`,
      }
    })

    // 8) Foto: produto a venda sem nenhuma imagem (mostra "sem foto").
    await run('Produto à venda sem foto', async () => {
      const dir = join(process.cwd(), 'uploads', 'products')
      const noPhoto = active.filter((p) => !['webp', 'jpg', 'jpeg', 'png'].some((ext) => existsSync(join(dir, `${p.ean}.${ext}`))))
      // Informativo: sem foto nao quebra a venda, entao nao marca falha.
      return { ok: true, detail: noPhoto.length ? `${noPhoto.length} de ${active.length} (ex.: ${sample(noPhoto.map((p) => p.name))})` : 'todos com foto' }
    })

    this.last = { at: new Date().toISOString(), results }
    return results
  }

  /** Ultimo check-up; sem nenhum desde o boot, roda agora (sem Telegram). */
  async getLast() {
    if (!this.last) await this.runChecks()
    return this.last
  }

  format(results: CheckResult[]) {
    const failures = results.filter((r) => !r.ok)
    const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const head = failures.length === 0 ? `✅ Check-up ${today}: tudo ok` : `⚠️ Check-up ${today}: ${failures.length} problema(s)`
    const lines = results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.detail}`)
    return [head, '', ...lines].join('\n')
  }

  private async resolveChatId(token: string) {
    if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID
    // Sem chat configurado, usa a ultima conversa que mandou /start ao robo.
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
    const body = (await res.json()) as { result?: Array<{ message?: { chat?: { id: number } } }> }
    const last = [...(body.result || [])].reverse().find((u) => u.message?.chat?.id)
    return last?.message?.chat?.id ? String(last.message.chat.id) : null
  }

  async sendTelegram(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      winstonLogger.warn('checkup_sem_telegram', { motivo: 'TELEGRAM_BOT_TOKEN vazio' })
      return false
    }
    const chatId = await this.resolveChatId(token)
    if (!chatId) {
      winstonLogger.warn('checkup_sem_telegram', { motivo: 'nenhum chat: mande /start ao robo' })
      return false
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    })
    return res.ok
  }
}
