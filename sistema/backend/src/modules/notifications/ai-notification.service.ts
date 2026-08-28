import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from './notifications.service'

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions'
// meta/llama-3.1-8b-instruct foi descontinuado pela NVIDIA em 26/08/2026 e
// passou a responder 410 Gone -- ou seja, o ciclo inteiro parou de funcionar
// sozinho, sem ninguem mexer em nada. Modelo tem prazo de validade; tratar a
// escolha como permanente e o erro.
//
// gpt-oss-20b foi o escolhido depois de testar o que a conta realmente acessa:
// llama-3.2-11b-vision devolve `<|python_tag|>` em vez de JSON valido nos
// argumentos da tool, e gpt-oss-120b estoura o timeout de 15s desta chamada.
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'openai/gpt-oss-20b'

const SEND_NOTIFICATION_TOOL = {
  type: 'function',
  function: {
    name: 'send_notification',
    description: 'Decide se vale disparar uma notificacao push para este produto e, se sim, gera o texto.',
    parameters: {
      type: 'object',
      properties: {
        should_notify: {
          type: 'boolean',
          description: 'true somente se a oferta for boa o suficiente para incomodar o cliente com uma notificacao push',
        },
        title: {
          type: 'string',
          description: 'Titulo curto com 1 emoji no inicio, estilo app de delivery/mercado. Ex: "🥩 Picanha com desconto especial!"',
        },
        body: {
          type: 'string',
          description: 'Corpo de 1-2 linhas, ate 110 caracteres, com o detalhe concreto da oferta (preco, %, motivo). Sem emoji repetido do titulo.',
        },
      },
      required: ['should_notify'],
    },
  },
}

const SYSTEM_PROMPT = `Voce escreve notificacoes push para o Antenor & Filhos, um mercado online. O estilo e o de apps como Shopee e Mercado Livre: titulo curto com emoji + gancho chamativo, corpo de 1-2 linhas com o detalhe concreto da oferta (preco antes/depois, percentual, ou o que torna aquele produto especial agora). Tom direto, sem exagero de pontuacao, em portugues do Brasil. Nunca invente desconto ou informacao que nao foi dada. Se a oferta for fraca (queda de preco pequena, ja tinha sido notificada, ou nao ha nada realmente novo pra dizer), retorne should_notify=false -- e melhor nao notificar do que notificar sem motivo forte. Sempre responda chamando a funcao send_notification.`

type CandidateProduct = {
  id: string
  ean: string
  name: string
  price: number
  promotionalPrice: number | null
}

@Injectable()
export class AiNotificationService {
  private readonly logger = new Logger(AiNotificationService.name)
  private readonly apiKey = String(process.env.NVIDIA_API_KEY || '').trim()
  readonly enabled = Boolean(this.apiKey)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    if (!this.enabled) {
      this.logger.warn('NVIDIA_API_KEY nao configurada -- notificacoes automaticas por IA desativadas.')
    }
  }

  /**
   * Busca candidatos: produtos ativos com promocao ativa que mudaram de
   * preco recentemente e nao foram notificados nas ultimas `cooldownHours`.
   * Limitado a `limit` (maior desconto primeiro) pra nao gastar tokens/spam
   * em toda mudanca pequena do catalogo.
   */
  private async findCandidates(windowHours: number, cooldownHours: number, limit: number): Promise<CandidateProduct[]> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000)
    const cooldownSince = new Date(Date.now() - cooldownHours * 60 * 60 * 1000)

    const products = await this.prisma.product.findMany({
      where: {
        active: true,
        promotionalPrice: { not: null, gt: 0 },
        updatedAt: { gte: since },
        OR: [{ aiNotifiedAt: null }, { aiNotifiedAt: { lt: cooldownSince } }],
      },
      select: { id: true, ean: true, name: true, price: true, promotionalPrice: true },
    })

    return products
      .filter((p) => p.promotionalPrice != null && p.promotionalPrice < p.price)
      .sort((a, b) => {
        const discountA = 1 - (a.promotionalPrice as number) / a.price
        const discountB = 1 - (b.promotionalPrice as number) / b.price
        return discountB - discountA
      })
      .slice(0, limit)
  }

  private async askModel(product: CandidateProduct): Promise<{ should_notify: boolean; title?: string; body?: string } | null> {
    const discountPct = Math.round((1 - (product.promotionalPrice as number) / product.price) * 100)
    const userPrompt = `Produto: ${product.name}\nPreco normal: R$ ${product.price.toFixed(2)}\nPreco promocional: R$ ${(product.promotionalPrice as number).toFixed(2)}\nDesconto: ${discountPct}%`

    try {
      const response = await axios.post(
        NVIDIA_ENDPOINT,
        {
          model: NVIDIA_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          tools: [SEND_NOTIFICATION_TOOL],
          tool_choice: { type: 'function', function: { name: 'send_notification' } },
          temperature: 0.7,
          max_tokens: 300,
        },
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 15000 },
      )

      const toolCall = response.data?.choices?.[0]?.message?.tool_calls?.[0]
      if (!toolCall?.function?.arguments) return null
      return JSON.parse(toolCall.function.arguments)
    } catch (error) {
      this.logger.error(`Falha ao consultar NVIDIA NIM para produto ${product.id}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * Roda o ciclo completo: acha candidatos, pergunta pro modelo, dispara as
   * notificacoes aprovadas. Retorna um resumo pra log/observabilidade --
   * nunca lanca excecao (chamado direto pelo scheduler).
   */
  async runCycle(opts: { windowHours?: number; cooldownHours?: number; limit?: number } = {}) {
    if (!this.enabled) return { skipped: true, reason: 'NVIDIA_API_KEY nao configurada' }

    const windowHours = opts.windowHours ?? 6
    const cooldownHours = opts.cooldownHours ?? 20
    const limit = opts.limit ?? 5

    const candidates = await this.findCandidates(windowHours, cooldownHours, limit)
    let notified = 0
    let skipped = 0
    let failed = 0

    for (const product of candidates) {
      const decision = await this.askModel(product)

      // askModel devolve null quando a CHAMADA falhou (modelo fora do ar,
      // chave invalida, timeout) -- diferente do modelo responder que a oferta
      // e fraca. Contar os dois como "skipped" escondia falha de infra atras de
      // uma decisao editorial: quando o llama-3.1-8b foi descontinuado em
      // 26/08/2026 e passou a dar 410, o ciclo teria reportado "N descartados
      // pelo modelo" com o modelo sequer existindo.
      if (decision === null) {
        failed += 1
        continue
      }
      if (!decision.should_notify || !decision.title || !decision.body) {
        skipped += 1
        continue
      }

      const customerIds = await this.notificationsService.getAllCustomerIds()
      for (const customerId of customerIds) {
        await this.notificationsService.create({
          type: 'PROMO',
          title: decision.title,
          body: decision.body,
          imageUrl: `/uploads/products/${product.ean}.webp`,
          productId: product.id,
          customerId,
        })
      }

      await this.prisma.product.update({ where: { id: product.id }, data: { aiNotifiedAt: new Date() } })
      notified += 1
    }

    const resumo = `Ciclo de notificacao IA: ${candidates.length} candidatos, ${notified} notificados, ${skipped} descartados pelo modelo, ${failed} com falha na chamada.`
    if (failed > 0) this.logger.error(resumo)
    else this.logger.log(resumo)
    return { candidates: candidates.length, notified, skipped, failed }
  }
}
