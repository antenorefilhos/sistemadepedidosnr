import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosError, AxiosInstance } from 'axios'
import * as fs from 'fs'
import * as https from 'https'

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

  /** `true` quando o conector tem endereco E credencial. Nao faz requisicao. */
  isConfigured(): boolean {
    const url = process.env.ANTENOR_API_URL
    if (!url || !process.env.ANTENOR_API_KEY) return false
    // Em https o certificado tambem e requisito, nao detalhe de configuracao.
    if (url.startsWith('https://') && !process.env.ANTENOR_API_CA_PATH) return false
    return true
  }
}
