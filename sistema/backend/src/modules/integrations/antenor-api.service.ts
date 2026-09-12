import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosError, AxiosInstance } from 'axios'
import * as fs from 'fs'
import * as https from 'https'
import type { ERPProduct } from './solidcom-erp.service'

/**
 * Cliente da AntenorApi -- a API propria que le o SQL Server da loja
 * (DORSAL/Solidcon) direto e vai substituir a integracao com o Solidcom.
 *
 * Hoje cobre cancelamento, status no PDV e itens faturados -- as tres coisas
 * que a API do Solidcom nunca entregou. O sync de catalogo continua pelo
 * Solidcom ate a virada (ver JON-17).
 */

/** O pedido ja foi faturado no PDV -- cancelar geraria furo fiscal. */
export class OrderAlreadyInvoicedError extends Error {
  constructor(
    readonly cdEcomPedido: string,
    readonly detail?: unknown,
  ) {
    super(`Pedido ${cdEcomPedido} ja foi faturado no PDV e nao pode ser cancelado no ERP.`)
    this.name = 'OrderAlreadyInvoicedError'
  }
}

/** O pedido nunca chegou ao ERP -- nao ha o que cancelar la. */
export class OrderNotFoundInErpError extends Error {
  constructor(readonly cdEcomPedido: string) {
    super(`Pedido ${cdEcomPedido} nao existe no ERP.`)
    this.name = 'OrderNotFoundInErpError'
  }
}

export type AntenorApiOrderStatus = {
  cdPedido: string
  cdFilial: number
  numeroDAV: string
  cdEcomPedido: string
  cliente?: string
  valorPedido?: number
  statusGeral: 'AGUARDANDO_PDV' | 'FATURADO_NO_PDV' | 'CANCELADO_NA_RETAGUARDA' | string
  faturamento?: {
    faturadoEm: string
    caixaPDV?: number
    numeroCupom?: number
    coo?: number
    chaveNFCe?: string
    valorCupom?: number
    valorTroco?: number
  }
  cancelamento?: {
    canceladoEm: string
    motivo?: string
  }
}

export type FidelidadeMercafacil = {
  idCliente?: string
  cpf?: string
  nome?: string
  clubeFidelidade: boolean
  categoria?: { id?: number; descricao?: string }
  ativo?: boolean
}

export type NfeAntenorApi = {
  chaveAcesso: string
  numero?: number
  serie?: number
  protocolo?: string
  xml?: string
}

export type CreateAntenorApiOrderPayload = {
  cdEcomPedido: string
  valorTotal: number
  valorFrete: number
  formaPagamentoTexto: string
  observacao: string
  aceitaTroca: boolean
  // v1.9.0 (AEF-031/JON-106, 12/09/2026): ate aqui esses dois campos existiam
  // no conector Solidcom (desligado) e nunca foram carregados pro
  // AntenorApi -- regressao da migracao. "Hora Combinada" ficava sempre
  // vazia no PDV. retiraNaLoja tem fallback pelo endereco ausente do lado
  // deles, mas mandar explicito evita depender de inferencia.
  hrCombinada?: string
  retiraNaLoja?: boolean
  cliente: {
    documento: string
    nome: string
    telefone: string
    email?: string | null
    // A API rejeita `null` (Fastify JSON Schema: "must be object") -- pra
    // retirada na loja a CHAVE precisa ser omitida (undefined), verificado
    // ao vivo em 10/09/2026.
    endereco?: {
      logradouro: string
      numero: string
      complemento?: string
      bairro: string
      cidade: string
      cep: string
    }
  }
  itens: Array<{
    cdProduto: number
    cdEAN?: string
    quantidade: number
    precoUnitario: number
    precoTabelaNormal?: number
  }>
}

export type AntenorApiOrderCreatedResult = {
  sucesso: boolean
  cdPedido: string
  numeroDAV: string
  cdEcomPedido: string
  valorTotal: number
  instrucaoPDV?: string
  idempotente: boolean
}

export type ItemFaturadoAntenorApi = {
  nrItem?: number
  cdProduto?: number | null
  ean?: string | null
  descricao?: string | null
  qtdPedida?: number | null
  qtdFaturada: number
  vlUnitario: number
  vlTotal?: number | null
  vlDesconto?: number | null
  canceladoNoCaixa?: boolean | null
}

@Injectable()
export class AntenorApiService {
  private readonly logger = new Logger(AntenorApiService.name)

  /**
   * Resolvido sob demanda, nao no construtor.
   *
   * `requireEnv` num campo de classe estoura no boot -- correto pro Solidcom,
   * que sempre esteve ligado, e errado aqui: este modulo nasce desligado e a
   * VPS ainda nao tem rota ate a loja (JON-11). Derrubar a API inteira por uma
   * variavel de um conector desligado seria trocar um problema por outro maior.
   *
   * Mas tambem nao existe default: sem a variavel, a chamada falha dizendo
   * exatamente o que falta. O que nao pode acontecer -- e ja aconteceu nesta
   * base -- e apontar pro lugar errado em silencio.
   */
  private get baseUrl(): string {
    const url = process.env.ANTENOR_API_URL
    if (!url) {
      throw new Error(
        'ANTENOR_API_URL nao esta definida. O conector AntenorApi esta ligado mas nao sabe pra onde falar.',
      )
    }
    return url.replace(/\/+$/, '')
  }

  private get loja(): number {
    return Number(process.env.ANTENOR_API_LOJA || 1)
  }

  private get timeoutMs(): number {
    return Number(process.env.ANTENOR_API_TIMEOUT_MS || 30000)
  }

  private clienteCache: AxiosInstance | null = null

  /**
   * Cliente HTTP configurado: chave no header e certificado fixado.
   *
   * A API da loja e publicada em `https://45.239.193.56:5001` com certificado
   * AUTOASSINADO, de proposito. Ela tem um consumidor so -- este backend --,
   * entao confiar num certificado especifico e mais forte que confiar em
   * qualquer CA publica: um intermediario precisaria da chave privada deles,
   * nao bastaria uma CA comprometida.
   *
   * Isso significa que `ANTENOR_API_CA_PATH` e obrigatorio quando a URL e
   * `https`. Sem ele so haveria duas saidas, e as duas sao ruins: falhar todo
   * request, ou desligar a validacao com `rejectUnauthorized: false` -- que e
   * pior que HTTP puro, porque parece seguro e aceita qualquer certificado.
   */
  private get cliente(): AxiosInstance {
    if (this.clienteCache) return this.clienteCache

    const base = this.baseUrl
    const chave = process.env.ANTENOR_API_KEY
    if (!chave) {
      throw new Error(
        'ANTENOR_API_KEY nao esta definida. O conector AntenorApi esta ligado mas nao tem credencial.',
      )
    }

    let httpsAgent: https.Agent | undefined
    if (base.startsWith('https://')) {
      const caminhoCa = process.env.ANTENOR_API_CA_PATH
      if (!caminhoCa) {
        throw new Error(
          'ANTENOR_API_CA_PATH nao esta definida. A AntenorApi usa certificado autoassinado; ' +
            'sem o certificado publico nao ha como validar a conexao.',
        )
      }
      httpsAgent = new https.Agent({
        ca: fs.readFileSync(caminhoCa),
        rejectUnauthorized: true,
        keepAlive: true,
      })
    }

    this.clienteCache = axios.create({
      baseURL: base,
      timeout: this.timeoutMs,
      httpsAgent,
      headers: { Authorization: `Bearer ${chave}` },
    })
    return this.clienteCache
  }

  /**
   * Cancela o pedido no ERP pelo NOSSO numero (`orders.numero` = `cdEcomPedido`).
   *
   * Usa a rota com body de proposito, nao a rota com o identificador na URL.
   * A rota com parametro e polimorfica -- aceita `cdPedido`, DAV ou
   * `cdEcomPedido` e deduz qual e. Os tres espacos de numeracao podem se
   * sobrepor (o nosso numero sai de hash, nao e sequencial), e uma colisao ali
   * cancelaria o pedido errado devolvendo 200. O body diz qual chave e.
   */
  async cancelOrder(cdEcomPedido: string | number, motivo?: string): Promise<void> {
    const numero = String(cdEcomPedido)

    try {
      await this.cliente.post('/api/integracao/pedidos/cancelar', {
        cdEcomPedido: numero,
        motivo: motivo || 'Cancelado no e-commerce',
        loja: this.loja,
      })
      this.logger.log(`Pedido ${numero} cancelado no ERP via AntenorApi`)
    } catch (error) {
      const status = (error as AxiosError)?.response?.status

      // 409 e 404 sao respostas de negocio, nao falhas de comunicacao: repetir
      // nao muda o resultado. Viram erro tipado pra quem chamou decidir, em vez
      // de entrar na fila de retentativa e bater na mesma parede pra sempre.
      if (status === 409) {
        throw new OrderAlreadyInvoicedError(numero, (error as AxiosError)?.response?.data)
      }
      if (status === 404) {
        throw new OrderNotFoundInErpError(numero)
      }

      throw error
    }
  }

  /**
   * Sincroniza pesos ajustados e cortes da separacao de volta pro ERP (JON-29).
   *
   * Ate 08/09/2026 o app de separacao gravava o peso real e o corte so no
   * nosso banco: o Solidcom nunca ficava sabendo, e o operador do caixa
   * precisava reconferir/corrigir tudo na mao ao importar o DAV -- anulando
   * boa parte do ganho de ter separacao pelo celular.
   *
   * Chamado no fim da separacao (`sendToCashier`), antes do pedido ir pro
   * caixa. Best-effort de proposito: falha aqui nao pode bloquear o pedido de
   * seguir pro caixa fisico -- o operador so perde a comodidade de nao
   * reajustar na mao, nao perde a venda.
   */
  async updatePickedItems(
    identificador: string | number,
    itens: Array<{
      erpProductId: number
      quantidade: number
      cancelado?: boolean
      motivoCorte?: string
    }>,
  ): Promise<void> {
    try {
      await this.cliente.put(
        `/api/integracao/pedidos/${encodeURIComponent(String(identificador))}/itens`,
        {
          loja: this.loja,
          itens: itens.map((item) => ({
            cdProduto: item.erpProductId,
            quantidade: item.cancelado ? 0 : item.quantidade,
            cancelado: Boolean(item.cancelado),
            ...(item.motivoCorte ? { motivoCorte: item.motivoCorte } : {}),
          })),
        },
      )
      this.logger.log(`Itens do pedido ${identificador} sincronizados no ERP apos separacao`)
    } catch (error) {
      const status = (error as AxiosError)?.response?.status

      // Pedido ja faturado: o operador foi mais rapido que a sincronizacao, ou
      // o cutover ja fechou o caixa antes. Nao e falha -- so nao ha mais o que
      // atualizar na retaguarda.
      if (status === 409) {
        this.logger.warn(`Pedido ${identificador} ja faturado no PDV -- sync de itens ignorado.`)
        return
      }
      if (status === 404) {
        throw new OrderNotFoundInErpError(String(identificador))
      }

      throw error
    }
  }

  /** Consulta o estado do pedido no PDV. Aceita o nosso numero, o DAV ou o cdPedido. */
  async getOrderStatus(identificador: string | number): Promise<AntenorApiOrderStatus | null> {
    try {
      const { data } = await this.cliente.get<AntenorApiOrderStatus>(
        `/api/integracao/pedidos/${encodeURIComponent(String(identificador))}/status-pdv`,
      )
      return data
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 404) return null
      throw error
    }
  }

  /**
   * Itens que o PDV realmente faturou, para reconciliar contra o pedido.
   *
   * `null` quando o pedido ainda nao passou no caixa -- nao e erro, e o estado
   * normal de todo pedido antes do faturamento.
   */
  async getInvoicedItems(identificador: string | number): Promise<ItemFaturadoAntenorApi[] | null> {
    try {
      const { data } = await this.cliente.get<{ itens?: ItemFaturadoAntenorApi[] }>(
        `/api/integracao/pedidos/${encodeURIComponent(String(identificador))}/itens-faturados`,
      )
      return data?.itens ?? null
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 404) return null
      throw error
    }
  }

  /**
   * Status de fidelidade do cliente no CRM Mercafacil, via CPF (JON-34,
   * v1.8.0). `null` quando o CPF nao e cliente cadastrado -- nao e erro, a
   * maioria dos CPFs do storefront nunca fez cadastro fisico na loja.
   */
  async getFidelidade(cpf: string): Promise<FidelidadeMercafacil | null> {
    const cpfLimpo = String(cpf || '').replace(/\D/g, '')
    if (!cpfLimpo) return null

    try {
      const { data } = await this.cliente.get<{ sucesso?: boolean; cliente?: FidelidadeMercafacil }>(
        `/api/integracao/clientes/${encodeURIComponent(cpfLimpo)}/fidelidade`,
      )
      return data?.cliente ?? null
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 404) return null
      throw error
    }
  }

  /**
   * XML da NFC-e do pedido faturado (JON-34, v1.8.0). `null` cobre dois casos
   * distintos que o chamador nao precisa diferenciar pra decidir o que
   * mostrar ("ainda nao tem nota"): pedido nao faturado, OU faturado mas o
   * XML ainda nao chegou do transmissor fiscal -- confirmado em campo
   * (10/09/2026, DAV 102074 faturado sem XML sincronizado ainda).
   */
  async getNfe(identificador: string | number): Promise<NfeAntenorApi | null> {
    try {
      const { data } = await this.cliente.get<NfeAntenorApi>(
        `/api/integracao/pedidos/${encodeURIComponent(String(identificador))}/nfe`,
      )
      return data
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 404) return null
      throw error
    }
  }

  /**
   * Cria o pedido na retaguarda, gerando o DAV pra importar no PDV (JON-17,
   * cutover Solidcom -> AntenorApi).
   *
   * Idempotente por `cdEcomPedido` do lado deles: reenviar o mesmo pedido
   * (retry de rede, worker de outbox) nao duplica o DAV, devolve o mesmo
   * numero com `idempotente: true`. Espelha o `numero` que ja usamos pro
   * Solidcom (`toExternalOrderNumber`) -- mesmo identificador nos dois
   * conectores, o que mantem cancelamento/webhook funcionando sem trocar de
   * chave no meio da migracao.
   */
  async createOrder(payload: CreateAntenorApiOrderPayload): Promise<AntenorApiOrderCreatedResult> {
    const { data } = await this.cliente.post<AntenorApiOrderCreatedResult>('/api/integracao/pedidos', {
      filialId: this.loja,
      ...payload,
    })
    return data
  }

  /**
   * Catalogo completo (JON-17). `limite=20000` cobre o catalogo inteiro
   * (~15.9 mil produtos) numa chamada so -- medido em ~12,5s pelo `[A1-API]`,
   * mais rapido que o GetProdutos do Solidcom.
   */
  async syncProducts(): Promise<{ synced: number; failed: number; data: ERPProduct[] }> {
    try {
      const { data } = await this.cliente.get('/api/integracao/produtos', {
        params: { limite: 20000, pagina: 1, loja: this.loja },
      })
      const items = this.extractProducts(data)
      return { synced: items.length, failed: 0, data: items }
    } catch (error) {
      this.logger.error('Erro na sincronizacao de catalogo via AntenorApi:', error)
      throw new Error('Falha ao sincronizar catalogo com a AntenorApi')
    }
  }

  /** Sync incremental -- so o que mudou desde `hours` atras (~500ms medido). */
  async fetchRecentChanges(hours: number): Promise<ERPProduct[]> {
    const since = new Date(Date.now() - hours * 3600000).toISOString().slice(0, 19)
    try {
      const { data } = await this.cliente.get('/api/integracao/produtos/alterados', {
        params: { desde: since, loja: this.loja },
      })
      return this.extractProducts(data)
    } catch (error) {
      const reason = axios.isAxiosError(error) ? error.message : 'erro desconhecido'
      this.logger.warn(`Falha ao buscar alteracoes recentes da AntenorApi (${reason})`)
      return []
    }
  }

  // JON-17: testado ao vivo em 10/09/2026 -- `GET /api/integracao/produtos`
  // devolve `{ total, pagina, produtos: [...] }`, nao array puro nem
  // `{ data: [...] }` como a doc dava a entender. `/produtos/alterados`
  // ainda nao foi confirmado ao vivo com o mesmo rigor -- aceita as mesmas
  // variantes por seguranca, mas precisa reteste antes de confiar 100%.
  private extractProducts(rawData: unknown): ERPProduct[] {
    const row = rawData as Record<string, unknown>
    const items = Array.isArray(rawData)
      ? rawData
      : Array.isArray(row?.produtos)
        ? row.produtos
        : Array.isArray(row?.data)
          ? row.data
          : Array.isArray(row?.items)
            ? row.items
            : []

    return (items as unknown[])
      .map((item) => this.normalizeProduct(item as Record<string, unknown>))
      .filter((item): item is ERPProduct => item !== null)
  }

  /**
   * Mapeia a resposta de `GET /api/integracao/produtos` (campos ja tipados e
   * confirmados com o `[A1-API]` em 10/09/2026, ver braincoletivo) pro mesmo
   * formato `ERPProduct` que o sync do Solidcom produz -- e o que deixa
   * `applyErpProducts` (products.service.ts) source-agnostico, sem precisar
   * mudar nada la.
   */
  private normalizeProduct(row: Record<string, unknown>): ERPProduct | null {
    const ean = String(row.CODIGO_EAN ?? '').trim()
    const name = String(row.PRODUTO ?? '').trim()
    const erpProductIdRaw = Number(row.ID_PRODUTO)
    const erpProductId = Number.isFinite(erpProductIdRaw) ? erpProductIdRaw : undefined

    // VL_PRODUTO_NORMAL -> price, VL_PRODUTO -> promotionalPrice (so quando
    // menor que o normal) -- mapeamento validado com query real no banco em
    // 10/09/2026 (Arroz R$32,59 sem promo; Abacate R$6,99 -> R$4,99 com
    // promo), nao so na palavra do outro agente.
    const normalPrice = Number(row.VL_PRODUTO_NORMAL)
    const currentPrice = Number(row.VL_PRODUTO)
    const price = Number.isFinite(normalPrice) ? normalPrice : currentPrice
    const promotionalPrice =
      Number.isFinite(currentPrice) && Number.isFinite(normalPrice) && currentPrice < normalPrice
        ? currentPrice
        : undefined

    if (!ean || !name || !Number.isFinite(price)) return null

    const active = row.Ativo !== false
    const stock = Number(row.QTD_PRODUTO) || 0
    const isFractional = row.Fracionado === true
    const fractionStep = Number(row.Fracionamento)
    const unit = typeof row.Emb === 'string' && row.Emb ? row.Emb : undefined
    const alternativeDescription = typeof row.txtFracionamento === 'string' && row.txtFracionamento
      ? `Fracionamento: ${row.txtFracionamento}`
      : undefined
    const classification01 = typeof row.Classificacao01 === 'string' ? row.Classificacao01 : undefined
    const classification02 = typeof row.Classificacao02 === 'string' ? row.Classificacao02 : undefined
    const classification03 = typeof row.Classificacao03 === 'string' ? row.Classificacao03 : undefined
    const classification04 = typeof row.Classificacao04 === 'string' ? row.Classificacao04 : undefined
    // TipoIntegracao ja vem no enum exato (SEMPRE/ESTOQUE/NUNCA), sem precisar
    // de resolveSyncOption feito pro texto solto do Solidcom.
    const syncOptionRaw = String(row.TipoIntegracao ?? '').toUpperCase()
    const syncOption = (['SEMPRE', 'ESTOQUE', 'NUNCA'] as const).includes(syncOptionRaw as never)
      ? (syncOptionRaw as 'SEMPRE' | 'ESTOQUE' | 'NUNCA')
      : undefined
    const category = this.resolveCategory(classification01 || '', classification02 || '')

    const normalized: ERPProduct = {
      ean,
      erpProductId,
      name: name.substring(0, 100),
      active,
      price,
      stock,
      isFractional,
    }
    if (promotionalPrice !== undefined) normalized.promotionalPrice = promotionalPrice
    if (Number.isFinite(fractionStep) && fractionStep > 0) normalized.fractionStep = fractionStep
    if (unit) normalized.unit = unit
    if (alternativeDescription) normalized.alternativeDescription = alternativeDescription
    if (classification01) normalized.classification01 = classification01
    if (classification02) normalized.classification02 = classification02
    if (classification03) normalized.classification03 = classification03
    if (classification04) normalized.classification04 = classification04
    if (category) normalized.category = category
    if (syncOption) normalized.syncOption = syncOption

    return normalized
  }

  // Duplicado de proposito do resolveCategory em solidcom-erp.service.ts:
  // e uma funcao pura pequena e estavel, e evita mexer no arquivo do
  // Solidcom (que continua rodando em paralelo) so pra compartilhar 10
  // linhas de regex.
  private resolveCategory(classification01: string, classification02: string): string {
    const source = `${classification01} ${classification02}`.toUpperCase()

    if (/(VINHO|ADEGA|ESPUMANTE|WHISKY|GIN|LICOR)/.test(source)) return 'VINHOS'
    if (/(CHURRAS|ESPETO|CARVAO|ASSADO)/.test(source)) return 'CHURRASCO'
    if (/(ACOUGUE|BOVIN|SUIN|FRANG|AVE|CARNE|PEIXE)/.test(source)) return 'CARNES_DIA_A_DIA'
    if (/(PADAR|PANIFIC|PAES|BOLO|MASSA FRESCA)/.test(source)) return 'PADARIA'
    if (/(BEBID|REFRIGERANTE|SUCO|CERVEJA|AGUA|ENERGETICO)/.test(source)) return 'BEBIDAS'
    if (/(BISCOITO|DOCE|CHOCOL|BALA|BOMBON|CONFEIT|GULOSEIMA)/.test(source)) return 'GULOSEIMAS'
    if (/(CONGELAD|PRONTO|SNACK|LANCH|SANDUICHE|MARMITA)/.test(source)) return 'CONSUMO_RAPIDO'

    return 'GERAL'
  }

  /** `true` quando o conector tem endereco E credencial. Nao faz requisicao. */
  isConfigured(): boolean {
    const url = process.env.ANTENOR_API_URL
    if (!url || !process.env.ANTENOR_API_KEY) return false
    // Em https o certificado tambem e requisito, nao detalhe de configuracao.
    if (url.startsWith('https://') && !process.env.ANTENOR_API_CA_PATH) return false
    return true
  }
}
