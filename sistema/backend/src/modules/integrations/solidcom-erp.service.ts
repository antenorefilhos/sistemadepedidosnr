import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { SolidcomPedidoDto } from './dto/solidcom-order.dto'
import { RetryService } from '../../common/services/retry.service'

export interface ERPProduct {
  ean: string
  // id_produto do ERP Solidcom -- varias linhas (varios EANs) podem
  // compartilhar o mesmo id_produto; usado pra agrupar em applyErpProducts.
  erpProductId?: number
  name: string
  active: boolean
  alternativeDescription?: string
  classification01?: string
  classification02?: string
  classification03?: string
  classification04?: string
  price: number
  stock: number
  promotionalPrice?: number
  isFractional?: boolean
  fractionStep?: number
  unit?: string
  badges?: string
  origin?: string
  category?: string
  syncOption?: 'ESTOQUE' | 'SEMPRE' | 'NUNCA'
}

export interface ERPCampaignItem {
  ean: string
  regularPrice: number
  promotionalPrice: number
}

export interface ERPCampaign {
  erpCampaignId: number
  name: string
  startDate: string
  endDate: string
  items: ERPCampaignItem[]
}

@Injectable()
export class SolidcomERPService {
  private readonly logger = new Logger(SolidcomERPService.name)
  private readonly SOLIDCOM_API_URL =
    process.env.SOLIDCOM_API_URL || process.env.ERP_API_URL || 'http://45.239.193.56:5000'
  private readonly SOLIDCOM_API_KEY =
    process.env.SOLIDCOM_API_KEY || process.env.ERP_API_KEY || ''
  private readonly defaultCnpj = Number(process.env.SOLIDCOM_CNPJ || '5147995000131')
  private readonly defaultCodEcom = Number(process.env.SOLIDCOM_CODECOM || '19')

  constructor(private readonly retryService: RetryService) {}

  /**
   * Sincroniza produtos do ERP Solidcom
   * ~17.000 produtos armazenados no ERP
   */
  async syncProducts(): Promise<{ synced: number; failed: number; data: ERPProduct[] }> {
    try {
      this.logger.log('Iniciando sincronização com ERP Solidcom...')

      const data = await this.getProductsFromERP()

      return {
        synced: data.length,
        failed: 0,
        data,
      }
    } catch (error) {
      this.logger.error('Erro na sincronização ERP:', error)
      throw new Error('Falha ao sincronizar com ERP')
    }
  }

  /**
   * Obtém produtos do ERP
   */
  private async getProductsFromERP(): Promise<ERPProduct[]> {
    try {
      this.logger.log('Buscando produtos completos da API Dorsal (Sem Auth)')
      const response = await this.retryService.execute(
        () => axios.get(`${this.SOLIDCOM_API_URL}/api/Produto/GetProdutos?ativo=true`, { timeout: 30000 }),
        'SolidcomERPService.getProducts',
        { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8000 },
      )

      return this.extractProducts(response.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.warn(`Falha ao buscar produtos da Dorsal (${error.code || 'erro_http'}): ${error.message}`)
      } else {
        this.logger.warn('Falha ao buscar produtos da Dorsal')
      }
      return []
    }
  }

  /**
   * Busca so o que mudou nas ultimas `hours` horas.
   *
   * Muito mais barato que o catalogo completo: a janela de 1 hora custa ~2s e
   * ~60 KB (contra ~190s e 10,5 MB do GetProdutos), e ja devolve todas as
   * promocoes ativas. E o caminho para detectar produto novo e promocao nova
   * sem pagar o sync inteiro. Ver docs/solidcom-api.md.
   */
  async fetchRecentChanges(hours: number): Promise<ERPProduct[]> {
    const since = new Date(Date.now() - hours * 3600000).toISOString().slice(0, 19)

    try {
      const response = await axios.get(
        `${this.SOLIDCOM_API_URL}/api/Produto/GetProdutosAlterados`,
        { params: { data: since }, timeout: 30000 },
      )

      const products = this.extractProducts(response.data)
      this.logger.log(`Dorsal: ${products.length} produtos alterados nas ultimas ${hours}h`)
      return products
    } catch (error) {
      const reason = axios.isAxiosError(error) ? error.message : 'erro desconhecido'
      this.logger.warn(`Falha ao buscar alteracoes recentes da Dorsal (${reason})`)
      return []
    }
  }

  /**
   * Consulta um produto especifico. E a fonte mais confiavel de preco e promocao:
   * o GetProdutos em massa serve dado velho, esta aqui bate com a realidade do PDV.
   * Caro para o catalogo inteiro (1 chamada por EAN), bom para reconciliar poucos.
   */
  async fetchByEan(ean: string): Promise<ERPProduct | null> {
    try {
      const response = await axios.get(`${this.SOLIDCOM_API_URL}/api/Produto/GetProdutosEAN`, {
        params: { EAN: ean },
        timeout: 15000,
      })
      const [product] = this.extractProducts(response.data)
      return product ?? null
    } catch {
      return null
    }
  }

  /**
   * Encartes/campanhas promocionais do ERP (ex.: "SEGUNDA DA CARNE NV",
   * codigo 375, filial Nova Real com flag ecommerce=true).
   *
   * NAO CONFIRMADO: o Solidcom ainda nao nos passou o contrato real desse
   * endpoint (rota, formato do payload, autenticacao). Segue o mesmo padrao
   * de stub ja usado em getProductStock/updateProductPrice acima -- devolve
   * lista vazia (no-op seguro) ate alguem confirmar com o suporte deles e
   * preencher a chamada real. PromotionsService ja consome o formato
   * ERPCampaign abaixo, entao so esta funcao precisa mudar quando o
   * endpoint for confirmado.
   */
  async fetchActivePromotionCampaigns(): Promise<ERPCampaign[]> {
    try {
      // Implementacao real chamaria algo como:
      // const response = await axios.get(
      //   `${this.SOLIDCOM_API_URL}/api/Campanha/GetCampanhasAtivas`,
      //   { params: { filial: 'NOVA REAL', ecommerce: true }, timeout: 30000 },
      // )
      // return this.extractCampaigns(response.data)

      return []
    } catch (error) {
      const reason = axios.isAxiosError(error) ? error.message : 'erro desconhecido'
      this.logger.warn(`Falha ao buscar encartes/campanhas da Dorsal (${reason})`)
      return []
    }
  }

  private extractProducts(rawData: unknown): ERPProduct[] {
    const items = this.toArray(rawData)
    const normalized = items
      .map((item) => this.normalizeProduct(item))
      .filter((item): item is ERPProduct => item !== null)
      .filter((item) => item.active)

    return normalized
  }

  private toArray(rawData: unknown): unknown[] {
    if (Array.isArray(rawData)) return rawData
    if (!rawData || typeof rawData !== 'object') return []
    const data = rawData as Record<string, unknown>
    if (Array.isArray(data.products)) return data.products
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    return []
  }

  private normalizeProduct(item: unknown): ERPProduct | null {
    if (!item || typeof item !== 'object') return null

    const row = item as Record<string, unknown>
    // Correção dos mapeamentos para o padrão Solidcom Dorsal v1
    const eanRaw = row['codigo_ean'] || row['ean'] || row['EAN'] || row['codigo_barras']
    const ean = eanRaw ? String(eanRaw).trim() : ''
    
    const nameRaw = row['produto'] || row['descricaoecommerce'] || row['nome'] || row['name']
    const name = nameRaw ? String(nameRaw).trim() : ''

    const erpProductIdRaw = this.readNumber(row, ['id_produto', 'idProduto', 'idproduto'], NaN)
    const erpProductId = Number.isFinite(erpProductIdRaw) ? Math.trunc(erpProductIdRaw) : undefined
    
    const commercialPrices = this.resolveCommercialPrices(row)
    const price = commercialPrices.price
    const stock = this.readNumber(row, ['qtd_produto', 'estoque', 'stock'], 0)
    const active = this.readBoolean(row, ['ativo', 'active'])
    const promotionalPrice = commercialPrices.promotionalPrice
    const unit = this.readString(row, ['emb'])
    const fractionLabel = this.readValueAsString(row, ['txtfracionamento'])
    const isFractional = this.resolveFractional(row)
    const fractionDescription = this.buildFractionDescription(fractionLabel)
    const fractionStep = this.readNumber(row, ['fracionamento'], NaN)
    const classification01 = this.readString(row, ['classificacao01'])
    const classification02 = this.readString(row, ['classificacao02'])
    const classification03 = this.readString(row, ['classificacao03'])
    const classification04 = this.readString(row, ['classificacao04'])
    const rawCategory = this.readString(row, ['categoria', 'category', 'categoria_ecommerce', 'departamento', 'secao'])
    const category = this.resolveCategory(classification01, classification02, rawCategory)
    const syncOption = this.resolveSyncOption(this.readString(row, ['tipoIntegracao', 'internet']))
    const origin = this.readString(row, ['origem', 'origin', 'procedencia', 'pais_origem'])

    if (!ean || !name || Number.isNaN(price)) {
      return null
    }

    const normalized: ERPProduct = {
      ean,
      erpProductId,
      name: name.substring(0, 100), // Proteção
      active: active !== false,
      price,
      stock,
      isFractional,
    }

    if (!Number.isNaN(promotionalPrice)) normalized.promotionalPrice = promotionalPrice
    // M11-fix: persiste fractionStep sempre que for um número finito e positivo.
    // Antes exigia > 0 mas não protegia contra undefined no upsert — o ?? null
    // do products.service.ts já lida com o caso undefined/null.
    if (Number.isFinite(fractionStep) && fractionStep > 0) normalized.fractionStep = fractionStep
    if (unit) normalized.unit = unit
    if (fractionDescription) normalized.alternativeDescription = fractionDescription
    if (classification01) normalized.classification01 = classification01
    if (classification02) normalized.classification02 = classification02
    if (classification03) normalized.classification03 = classification03
    if (classification04) normalized.classification04 = classification04
    if (category) normalized.category = category
    normalized.syncOption = syncOption
    if (origin) normalized.origin = origin

    return normalized
  }

  private readString(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }

    return ''
  }

  private readValueAsString(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value)
      }
    }

    return ''
  }

  private readBoolean(row: Record<string, unknown>, keys: string[]): boolean | null {
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') {
        if (value === 1) return true
        if (value === 0) return false
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['1', 's', 'sim', 'true', 'yes'].includes(normalized)) return true
        if (['0', 'n', 'nao', 'não', 'false', 'no'].includes(normalized)) return false
      }
    }

    return null
  }

  private resolveCommercialPrices(row: Record<string, unknown>) {
    const currentPrice = this.readNumber(row, ['vl_produto', 'preco', 'valor', 'price'], NaN)
    const normalPrice = this.readNumber(row, ['vl_produto_normal', 'preco_normal', 'normalPrice'], NaN)
    const clubPrice = this.readNumber(
      row,
      ['preco_fidelidade_promocao', 'preco_clube_promocao', 'promotionalPrice'],
      NaN,
    )

    let resolvedPrice = currentPrice
    let resolvedPromotionalPrice = NaN

    if (!Number.isNaN(normalPrice) && !Number.isNaN(currentPrice) && normalPrice > currentPrice) {
      resolvedPrice = normalPrice
      resolvedPromotionalPrice = currentPrice
    } else if (!Number.isNaN(clubPrice) && !Number.isNaN(currentPrice) && clubPrice > 0 && clubPrice < currentPrice) {
      resolvedPrice = currentPrice
      resolvedPromotionalPrice = clubPrice
    } else if (Number.isNaN(resolvedPrice) && !Number.isNaN(normalPrice)) {
      resolvedPrice = normalPrice
    }

    return {
      price: resolvedPrice,
      promotionalPrice: resolvedPromotionalPrice,
    }
  }

  // INVARIANTE: fonte de verdade exclusiva para fracionado é o campo booleano `fracionado` do ERP.
  // NUNCA inferir por nome, unidade ou label — isso cria falsos positivos que corrompem precificação.
  private resolveFractional(row: Record<string, unknown>): boolean {
    const explicitFlag = this.readBoolean(row, ['fracionado'])
    return explicitFlag === true
  }

  private buildFractionDescription(fractionLabel: string): string | undefined {
    if (!fractionLabel) return undefined
    return `Fracionamento: ${fractionLabel}`
  }

  private readNumber(row: Record<string, unknown>, keys: string[], fallback = NaN): number {
    for (const key of keys) {
      const value = row[key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value
      }

      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.replace(',', '.'))
        if (Number.isFinite(parsed)) {
          return parsed
        }
      }
    }

    return fallback
  }

  private resolveSyncOption(rawValue: string): 'ESTOQUE' | 'SEMPRE' | 'NUNCA' {
    const value = rawValue.toUpperCase().trim()
    if (value === 'SEMPRE') return 'SEMPRE'
    if (value === 'NUNCA') return 'NUNCA'
    return 'ESTOQUE'
  }

  private resolveCategory(classification01: string, classification02: string, rawCategory = ''): string {
    const source = `${classification01} ${classification02} ${rawCategory}`.toUpperCase()

    if (/(VINHO|ADEGA|ESPUMANTE|WHISKY|GIN|LICOR)/.test(source)) return 'VINHOS'
    if (/(CHURRAS|ESPETO|CARVAO|ASSADO)/.test(source)) return 'CHURRASCO'
    if (/(ACOUGUE|BOVIN|SUIN|FRANG|AVE|CARNE|PEIXE)/.test(source)) return 'CARNES_DIA_A_DIA'
    if (/(PADAR|PANIFIC|PAES|BOLO|MASSA FRESCA)/.test(source)) return 'PADARIA'
    if (/(BEBID|REFRIGERANTE|SUCO|CERVEJA|AGUA|ENERGETICO)/.test(source)) return 'BEBIDAS'
    if (/(BISCOITO|DOCE|CHOCOL|BALA|BOMBON|CONFEIT|GULOSEIMA)/.test(source)) return 'GULOSEIMAS'
    if (/(CONGELAD|PRONTO|SNACK|LANCH|SANDUICHE|MARMITA)/.test(source)) return 'CONSUMO_RAPIDO'

    return 'GERAL'
  }

  /**
   * Obtém estoque de um produto específico
   */
  async getProductStock(ean: string): Promise<number> {
    try {
      // Implementação real chamaria Solidcom
      // const response = await axios.get(
      //   `${this.SOLIDCOM_API_URL}/products/${ean}/stock`,
      //   { headers: { 'Authorization': `Bearer ${this.SOLIDCOM_API_KEY}` } }
      // )
      // return response.data.stock

      return 0
    } catch (error) {
      this.logger.error('Erro ao buscar estoque:', error)
      throw error
    }
  }

  /**
   * Atualiza preço de um produto
   */
  async updateProductPrice(ean: string, price: number): Promise<void> {
    try {
      this.logger.log(`Atualizando preço do produto ${ean} para R$ ${price}`)

      // Implementação real:
      // await axios.put(
      //   `${this.SOLIDCOM_API_URL}/products/${ean}/price`,
      //   { price },
      //   { headers: { 'Authorization': `Bearer ${this.SOLIDCOM_API_KEY}` } }
      // )
    } catch (error) {
      this.logger.error('Erro ao atualizar preço:', error)
      throw error
    }
  }

  /**
   * Sincroniza pedido para o ERP
   */
  /**
   * Devolve o DAV que o ERP gera pro pedido (resposta e texto puro, tipo
   * "Pedido 123 inserido com sucesso.\nDAV:102022"). E o numero que o
   * separador digita no PDV pra puxar o pedido -- sem ele, so sobraria o
   * nosso id interno, que tem letra e o PDV nao aceita.
   */
  async syncOrder(orderId: string, orderData: SolidcomPedidoDto): Promise<string | null> {
    try {
      this.logger.log(`Sincronizando pedido ${orderId} para ERP`)

      const response = await axios.post(`${this.SOLIDCOM_API_URL}/api/Pedido/PostPedido`, orderData, {
        timeout: 30000,
      })

      const dav = String(response.data ?? '').match(/DAV:\s*(\d+)/i)?.[1]
      return dav || null
    } catch (error) {
      this.logger.error('Erro ao sincronizar pedido:', error)
      throw error
    }
  }

  async cancelOrder(orderNumber: number, reason?: string): Promise<void> {
    try {
      this.logger.log(`Cancelando pedido externo ${orderNumber} no ERP`)

      await axios.put(
        `${this.SOLIDCOM_API_URL}/api/Pedido/${orderNumber}/Ecom/${process.env.SOLIDCOM_CODECOM || '19'}/PutCancelamentoPedido`,
        {
          motivo: reason || 'Cancelado no sistema',
        },
        {
          timeout: 30000,
        },
      )
    } catch (error) {
      this.logger.error('Erro ao cancelar pedido no ERP:', error)
      throw error
    }
  }

  async getOrder(orderNumber: number): Promise<unknown> {
    try {
      this.logger.log(`Consultando pedido externo ${orderNumber} no ERP`)

      const response = await axios.get(
        `${this.SOLIDCOM_API_URL}/api/Pedido/${orderNumber}/CNPJ/${this.defaultCnpj}/Ecom/${this.defaultCodEcom}/GetPedido`,
        {
          timeout: 30000,
        },
      )

      return response.data
    } catch (error) {
      this.logger.error('Erro ao consultar pedido no ERP:', error)
      throw error
    }
  }

  async getOrdersByPeriod(from: string, to: string): Promise<unknown[]> {
    try {
      this.logger.log(`Consultando pedidos do ERP no período ${from} a ${to}`)

      const response = await axios.get(
        `${this.SOLIDCOM_API_URL}/api/Pedido/CNPJ/${this.defaultCnpj}/Ecom/${this.defaultCodEcom}/GetPedidoPeriodo`,
        {
          params: { dataInicio: from, dataFim: to },
          timeout: 30000,
        },
      )

      const data = response.data
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.data)) return data.data as unknown[]
      if (data && Array.isArray(data.items)) return data.items as unknown[]
      return []
    } catch (error) {
      this.logger.error('Erro ao consultar pedidos por período no ERP:', error)
      throw error
    }
  }
}
