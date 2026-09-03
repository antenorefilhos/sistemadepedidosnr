import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { InternalOrderAddressContract, InternalOrderContract } from './dto/order-contract.dto'
import { SolidcomPedidoDto } from './dto/solidcom-order.dto'
import { SolidcomERPService } from './solidcom-erp.service'
import { IntegrationModulesService } from './integration-modules.service'
import { IntegrationOutboxService } from './integration-outbox.service'
import { requireEnv } from '../../common/require-env'
import { NotificationsService } from '../notifications/notifications.service'
import { TenantContext, tenantStoreWhere } from '../../common/tenant/tenant-context'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'

interface ScaleBarcodeParsingResult {
  productCode: number
  totalValue: number
}

@Injectable()
export class OrderOrchestrationService {
  private readonly logger = new Logger(OrderOrchestrationService.name)
  private readonly defaultCnpj = Number(requireEnv('SOLIDCOM_CNPJ'))
  private readonly defaultCodEcom = Number(requireEnv('SOLIDCOM_CODECOM'))
  // CPF de balcao usado no pedido enviado ao ERP. Tinha o valor hardcoded aqui
  // -- CPF e' dado pessoal, e a regra do projeto proibe commitar (CLAUDE.md).
  // Sem default: faltando a variavel, estoura no boot em vez de mandar pedido
  // com o CPF de outra pessoa.
  private readonly defaultBalcaoCpf = Number(requireEnv('SOLIDCOM_BALCAO_CPF'))

  constructor(
    private readonly solidcomERPService: SolidcomERPService,
    private readonly prisma: PrismaService,
    private readonly integrationModules: IntegrationModulesService,
    private readonly integrationOutbox: IntegrationOutboxService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async syncCreatedOrder(payload: InternalOrderContract): Promise<void> {
    if (!(await this.integrationModules.isEnabled('solidcom'))) {
      await this.logSyncEvent('SYNC_ORDER_SKIPPED_MODULE_DISABLED', payload.orderId, {
        reason: 'Modulo Solidcom desativado',
      })
      return
    }

    const externalPayload = this.mapToSolidcomPedido(payload)

    await this.logSyncEvent('INTERNAL_ORDER_CONTRACT_SNAPSHOT', payload.orderId, {
      contract: payload,
      externalPreview: externalPayload,
    })

    try {
      const dav = await this.solidcomERPService.syncOrder(payload.orderId, externalPayload)
      await this.persistErpDav(payload.orderId, dav)
      await this.logSyncEvent('SYNC_ORDER_SUCCESS', payload.orderId, {
        externalNumero: externalPayload.numero,
        codEcom: externalPayload.codEcom,
        dav,
      })
    } catch (error) {
      const reason = this.stringifyError(error)
      await this.logSyncEvent('SYNC_ORDER_FAILED', payload.orderId, {
        reason,
        payload: externalPayload,
      })
      await this.integrationOutbox.enqueueSolidcomOrderFailure(payload.orderId, externalPayload as unknown as Record<string, unknown>, reason)
      this.logger.warn(`Falha ao encaminhar pedido ${payload.orderId} para integracao ERP`, error)
    }
  }

  async getOrderContract(orderId: string) {
    const snapshot = await this.prisma.auditLog.findFirst({
      where: {
        entity: 'ORDER_SYNC_SOLIDCOM',
        entityId: orderId,
        action: 'INTERNAL_ORDER_CONTRACT_SNAPSHOT',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (snapshot?.changes) {
      try {
        const parsed = JSON.parse(snapshot.changes) as {
          contract?: InternalOrderContract
          externalPreview?: SolidcomPedidoDto
        }

        if (parsed.contract) {
          return {
            found: true,
            orderId,
            source: 'snapshot',
            contract: parsed.contract,
            externalPreview: parsed.externalPreview || this.mapToSolidcomPedido(parsed.contract),
          }
        }
      } catch {
        // fallback para reconstrucao ao vivo abaixo
      }
    }

    const contract = await this.buildLiveOrderContract(orderId)

    if (!contract) {
      return {
        found: false,
        orderId,
      }
    }

    return {
      found: true,
      orderId,
      source: 'live',
      contract,
      externalPreview: this.mapToSolidcomPedido(contract),
    }
  }

  /** Monta o contrato a partir do estado atual do pedido, ignorando snapshots. */
  private async buildLiveOrderContract(orderId: string): Promise<InternalOrderContract | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return null
    }

    return {
      orderId: order.id,
      customerId: order.customerId,
      fulfillmentType: order.fulfillmentType,
      fulfillmentSlotId: order.fulfillmentSlotId,
      deliveryAreaId: order.deliveryAreaId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      delivery: order.delivery,
      discount: order.discount,
      total: order.total,
      notes: order.notes,
      customer: {
        id: order.customer.id,
        cpf: order.customer.cpf,
        name: order.customer.name,
        whatsapp: order.customer.whatsapp,
        email: order.customer.email,
      },
      deliveryAddress: (order.addressSnapshot as InternalOrderAddressContract | null) ?? null,
      scheduledFor: order.scheduledFor ? order.scheduledFor.toISOString() : null,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || null,
        ean: item.product?.ean || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        scannedCode: null,
        substitutionPolicy: item.substitutionPolicy || 'ALLOW',
      })),
    }
  }

  async listOrderContractSnapshots(orderId: string, limit = 10) {
    const take = Math.max(1, Math.min(limit, 30))
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity: 'ORDER_SYNC_SOLIDCOM',
        entityId: orderId,
        action: {
          in: ['INTERNAL_ORDER_CONTRACT_SNAPSHOT', 'INTERNAL_ORDER_CANCELLATION_SNAPSHOT'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    })

    return {
      orderId,
      total: logs.length,
      items: logs
        .map((log) => {
          const parsed = this.parseAuditChanges<{
            contract?: InternalOrderContract
            externalPreview?: SolidcomPedidoDto
            externalOrderNumber?: number
            reason?: string
          }>(log.changes)

          if (!parsed.contract && !parsed.externalPreview) {
            return null
          }

          return {
            id: log.id,
            action: log.action,
            createdAt: log.createdAt,
            contract: parsed.contract || null,
            externalPreview: parsed.externalPreview || null,
            externalOrderNumber: parsed.externalOrderNumber || parsed.externalPreview?.numero || null,
            reason: parsed.reason || null,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    }
  }

  async getRemoteOrder(orderId: string) {
    if (!(await this.integrationModules.isEnabled('solidcom'))) {
      return {
        found: false,
        orderId,
        reason: 'Modulo Solidcom desativado',
      }
    }

    const externalOrderNumber = await this.resolveExternalOrderNumber(orderId)
    const remoteOrder = await this.solidcomERPService.getOrder(externalOrderNumber)

    return {
      found: true,
      orderId,
      externalOrderNumber,
      remoteOrder,
    }
  }

  async reconcileOrdersByPeriod(from: string, to: string) {
    if (!(await this.integrationModules.isEnabled('solidcom'))) {
      return {
        period: { from, to },
        summary: { total: 0, matched: 0, localOnly: 0, remoteOnly: 0 },
        items: [],
        note: 'Modulo Solidcom desativado',
      }
    }

    const remoteOrders = await this.solidcomERPService.getOrdersByPeriod(from, to)

    const remoteByNumber = new Map<number, unknown>()
    for (const ro of remoteOrders) {
      const row = ro as Record<string, unknown>
      const num = Number(row['numero'] ?? row['cdPedido'] ?? row['numero_pedido'] ?? 0)
      if (num > 0) remoteByNumber.set(num, ro)
    }

    const snapshots = await this.prisma.auditLog.findMany({
      where: {
        entity: 'ORDER_SYNC_SOLIDCOM',
        action: 'INTERNAL_ORDER_CONTRACT_SNAPSHOT',
        createdAt: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const reconciled: Array<{
      orderId: string
      externalOrderNumber: number | null
      status: 'matched' | 'local_only' | 'remote_only'
      localSnapshot: unknown
      remoteOrder: unknown | null
    }> = []

    const matchedExternalNumbers = new Set<number>()

    for (const snap of snapshots) {
      const parsed = this.parseAuditChanges<{ externalPreview?: { numero?: number } }>(snap.changes)
      const externalNumber = parsed.externalPreview?.numero ?? null

      if (externalNumber && remoteByNumber.has(externalNumber)) {
        matchedExternalNumbers.add(externalNumber)
        reconciled.push({
          orderId: snap.entityId,
          externalOrderNumber: externalNumber,
          status: 'matched',
          localSnapshot: parsed,
          remoteOrder: remoteByNumber.get(externalNumber),
        })
      } else {
        reconciled.push({
          orderId: snap.entityId,
          externalOrderNumber: externalNumber,
          status: 'local_only',
          localSnapshot: parsed,
          remoteOrder: null,
        })
      }
    }

    for (const [num, ro] of remoteByNumber.entries()) {
      if (!matchedExternalNumbers.has(num)) {
        reconciled.push({
          orderId: '',
          externalOrderNumber: num,
          status: 'remote_only',
          localSnapshot: null,
          remoteOrder: ro,
        })
      }
    }

    const matched = reconciled.filter((r) => r.status === 'matched').length
    const localOnly = reconciled.filter((r) => r.status === 'local_only').length
    const remoteOnly = reconciled.filter((r) => r.status === 'remote_only').length

    return {
      period: { from, to },
      summary: { total: reconciled.length, matched, localOnly, remoteOnly },
      items: reconciled,
    }
  }

  async syncCancelledOrder(payload: InternalOrderContract, reason?: string) {
    if (!(await this.integrationModules.isEnabled('solidcom'))) {
      await this.logSyncEvent('CANCEL_ORDER_SKIPPED_MODULE_DISABLED', payload.orderId, {
        reason: 'Modulo Solidcom desativado',
      })
      return
    }

    const externalOrderNumber = await this.resolveExternalOrderNumber(payload.orderId, payload)

    await this.logSyncEvent('INTERNAL_ORDER_CANCELLATION_SNAPSHOT', payload.orderId, {
      contract: payload,
      externalOrderNumber,
      reason: reason || null,
    })

    try {
      await this.solidcomERPService.cancelOrder(externalOrderNumber, reason)
      await this.logSyncEvent('CANCEL_ORDER_SUCCESS', payload.orderId, {
        externalOrderNumber,
        reason: reason || null,
      })
    } catch (error) {
      const reasonText = this.stringifyError(error)
      await this.logSyncEvent('CANCEL_ORDER_FAILED', payload.orderId, {
        externalOrderNumber,
        reason: reason || null,
        error: reasonText,
      })
      await this.integrationOutbox.enqueueEvent({
        connectorType: 'ERP',
        provider: 'SOLIDCOM',
        aggregate: 'ORDER',
        aggregateId: payload.orderId,
        type: 'ORDER_CANCEL_TO_ERP',
        payload: { orderId: payload.orderId, externalOrderNumber, reason: reason || null, previousError: reasonText },
        idempotencyKey: `solidcom:order:${payload.orderId}:cancel`,
      })
      this.logger.warn(`Falha ao cancelar pedido ${payload.orderId} na integracao ERP`, error)
    }
  }

  async retryOrderSync(orderId: string) {
    if (!(await this.integrationModules.isEnabled('solidcom'))) {
      return { orderId, retried: false, reason: 'Modulo Solidcom desativado.' }
    }

    // Remonta o pedido a partir do estado atual em vez de reenviar o payload
    // que ja falhou -- senao um pedido que quebrou por payload incompleto
    // (ex.: obs/endereco nulos, que travaram tudo em 17/08) fica preso pra
    // sempre repetindo exatamente o mesmo erro.
    const contract = await this.buildLiveOrderContract(orderId)

    if (!contract) {
      return { orderId, retried: false, reason: 'Pedido nao encontrado para reprocessar.' }
    }

    const payload = this.mapToSolidcomPedido(contract)

    try {
      const dav = await this.solidcomERPService.syncOrder(orderId, payload)
      await this.persistErpDav(orderId, dav)
      await this.logSyncEvent('SYNC_ORDER_RETRY_SUCCESS', orderId, {
        externalNumero: payload.numero,
        dav,
      })
      return { orderId, retried: true, success: true }
    } catch (error) {
      await this.logSyncEvent('SYNC_ORDER_RETRY_FAILED', orderId, {
        reason: this.stringifyError(error),
        payload,
      })
      return {
        orderId,
        retried: true,
        success: false,
        reason: this.stringifyError(error),
      }
    }
  }

  private mapToSolidcomPedido(payload: InternalOrderContract): SolidcomPedidoDto {
    const externalNumber = this.toExternalOrderNumber(payload.orderId)

    return {
      cnpj: this.defaultCnpj,
      numero: externalNumber,
      data: new Date().toISOString(),
      codEcom: this.defaultCodEcom,
      dav: 0,
      valorFrete: this.round2(payload.delivery),
      valorDesconto: this.round2(payload.discount),
      retiraNaLoja: payload.fulfillmentType === 'PICKUP',
      ecommerceSolidcon: true,
      ecommerceSolidconStatus: 1,
      // `obs` e `cliente.endereco` NAO podem ser null: o GravaPedido do
      // Solidcom (Dorsal/Pedido.cs, linhas 111 e 148) chama .Length neles sem
      // checagem de nulo e devolve 400 "Object reference not set to an
      // instance of an object" -- que foi o que travou todo pedido em 17/08.
      // String vazia passa; so nao pode ser null.
      obs: this.buildPedidoObs(payload),
      cep: (payload.deliveryAddress?.zipCode || '').replace(/\D/g, '').slice(0, 8),
      hrCombinada: this.buildHoraCombinada(payload),
      referencia: `PDV-${externalNumber}`,
      cliente: {
        cpf: this.parseCpf(payload.customer.cpf),
        nome: payload.customer.name || 'BALCAO',
        telefone: (payload.customer.whatsapp || '').replace(/\D/g, '').slice(0, 12),
        endereco: {
          logradouro: payload.deliveryAddress?.street || '',
          numero: payload.deliveryAddress?.number || '',
          complemento: payload.deliveryAddress?.complement || '',
          // CEP como 25750-222 cobre varios pontos ("Chafariz" a "Cond.
          // Bosque das Mangueiras") -- sem anexar a localidade escolhida aqui,
          // o separador so via o bairro generico ("Pedro do Rio") e nao sabia
          // qual dos pontos era o pedido de verdade.
          bairro: [payload.deliveryAddress?.neighborhood, payload.deliveryAddress?.locality]
            .filter(Boolean)
            .join(' - '),
          cidade: payload.deliveryAddress?.city || '',
          cep: (payload.deliveryAddress?.zipCode || '').replace(/\D/g, ''),
          estado: payload.deliveryAddress?.state || '',
        },
      },
      itens: payload.items.map((item, index) => {
        const scaleData = this.parseScaleBarcode(item.scannedCode)
        const hasScaleLabel = Boolean(scaleData)
        const cdProduto = hasScaleLabel ? scaleData!.productCode : this.parseInteger(item.productId)

        // Produtos pesaveis: nosso OrderItem.quantity guarda o numero de
        // "steps" que o cliente escolheu (ex: 3 steps de 0.4kg), nao o peso
        // real. O ERP espera quantidade em peso real e valorUnitario por kg
        // -- sem essa conversao o Solidcom recebe "3" em vez de "1.2" (kg).
        const isWeighed = !hasScaleLabel && Boolean(item.isFractional) && Boolean(item.fractionStep)
        const quantityRaw = hasScaleLabel
          ? scaleData!.totalValue / Math.max(item.unitPrice, 0.0001)
          : isWeighed
          ? item.quantity * (item.fractionStep as number)
          : item.quantity
        const quantity = Number(quantityRaw.toFixed(3))
        const valorUnitario = isWeighed ? (item.listUnitPrice ?? item.unitPrice) : item.unitPrice

        return {
          numero: index + 1,
          ean: this.parseInteger(item.ean),
          cdProduto,
          inCodigoInterno: cdProduto > 0,
          nmProduto: item.productName || `Produto ${index + 1}`,
          quantidade: quantity,
          quantidadeAtendida: quantity,
          valorUnitario: this.round2(valorUnitario),
          valorDesconto: 0,
        }
      }),
    }
  }

  /** Observacao que a loja le na separacao/caixa. Cortada em 500 por nossa
   *  conta -- o truncamento do lado deles e justamente o trecho bugado. */
  private buildPedidoObs(payload: InternalOrderContract): string {
    const paymentLabels: Record<string, string> = {
      CASH: 'Dinheiro',
      PIX: 'PIX',
      CARD: 'Cartao na entrega',
      VOUCHER: 'Vale/Ticket Alimentacao',
    }
    const payment = paymentLabels[payload.paymentMethod] || payload.paymentMethod

    return [payload.notes?.trim(), this.buildTrocaLabel(payload), payment ? `Pgto: ${payment}` : null]
      .filter(Boolean)
      .join(' / ')
      .slice(0, 500)
  }

  /**
   * Resume, pra `obs` do pedido, se o cliente aceita substituicao de item.
   *
   * O dado existe por item (`OrderItem.substitutionPolicy`, o cliente escolhe
   * no carrinho) e nunca era enviado -- o separador da loja abria o pedido no
   * PDV sem saber se podia trocar. Substituir sem permissao gera devolucao;
   * nao substituir quando o cliente aceitava perde a venda do item.
   *
   * Resumo e nao lista, de proposito: o detalhe por produto e' o nosso
   * `picking-app` que mostra. No Dorsal o separador so precisa da regra geral.
   */
  private buildTrocaLabel(payload: InternalOrderContract): string | null {
    const itens = payload.items || []
    if (itens.length === 0) return null
    const aceitam = itens.filter((item) => (item.substitutionPolicy || 'ALLOW') === 'ALLOW').length
    if (aceitam === itens.length) return 'Aceita troca: Sim'
    if (aceitam === 0) return 'Aceita troca: Nao'
    return `Aceita troca: Parcial (${aceitam}/${itens.length} itens)`
  }

  /** Guarda o DAV pro separador conseguir puxar o pedido no PDV. */
  private async persistErpDav(orderId: string, dav: string | null) {
    if (!dav) return
    await this.prisma.order
      .update({ where: { id: orderId }, data: { erpDav: dav } })
      .catch((error) => this.logger.warn(`Falha ao gravar DAV do pedido ${orderId}`, error))
  }

  /** Minutos entre o pedido e a hora combinada quando o cliente nao agenda. */
  private static readonly ASAP_LEAD_MINUTES = 15

  private buildHoraCombinada(payload: InternalOrderContract): string {
    if (payload.scheduledFor) {
      return new Date(payload.scheduledFor).toISOString()
    }

    const asap = new Date(Date.now() + OrderOrchestrationService.ASAP_LEAD_MINUTES * 60 * 1000)
    return asap.toISOString()
  }

  private parseScaleBarcode(scannedCode?: string | null): ScaleBarcodeParsingResult | null {
    if (!scannedCode) return null
    const clean = scannedCode.replace(/\D/g, '')
    if (clean.length !== 13 || !clean.startsWith('2')) return null

    const productCode = Number(clean.slice(1, 7))
    const totalValue = Number(clean.slice(7, 12)) / 100

    if (!Number.isFinite(productCode) || productCode <= 0 || !Number.isFinite(totalValue)) {
      return null
    }

    return { productCode, totalValue }
  }

  private async logSyncEvent(action: string, orderId: string, changes: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entity: 'ORDER_SYNC_SOLIDCOM',
        entityId: orderId,
        changes: JSON.stringify(changes),
      },
    })
  }

  /**
   * Pedidos esperando o caixa, pro agente da loja consultar no banco deles.
   *
   * Lista curta de proposito: o agente pergunta AQUI primeiro e so entao
   * consulta o `DORSAL` por esses DAVs. O inverso -- varrer a `tbPedido` deles
   * por janela de tempo -- obrigaria a raciocinar sobre janela, fuso e pedido
   * antigo, e cada um desses e um jeito de errar.
   *
   * `erpDav` obrigatorio porque e a chave da consulta la (`nrSeqPAF`); pedido
   * que nao sincronizou nao tem DAV e tambem nao existe no PDV pra ser
   * faturado.
   */
  async listPendingInvoice(context?: Partial<TenantContext>) {
    return this.prisma.order.findMany({
      where: {
        ...tenantStoreWhere(context),
        status: 'READY_FOR_CHECKOUT',
        erpDav: { not: null },
      },
      select: { id: true, erpDav: true, fulfillmentType: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * O PDV faturou: libera o pedido pra proxima etapa e avisa o cliente.
   *
   * O sinal e `hrRegistro` da `DORSAL.tbPedido` -- preenchido no fechamento em
   * 386 de 386 pedidos fechados e em nenhum nao-fechado.
   * `EcommerceSolidconStatus` NAO serve no nosso caminho: pedido nosso fica em
   * `1` mesmo faturado, porque a transicao `5 -> 6` pertence a esteira do app
   * coletor, que a gente pula de proposito. Ver docs/solidcom-api.md.
   *
   * Idempotente: o agente roda em loop e pode reportar o mesmo pedido duas
   * vezes (reenvio, retry, duas instancias abertas). Chamar de novo depois de
   * ja ter avancado e no-op, nao erro -- senao o agente ficaria logando falha
   * pra sempre no mesmo pedido.
   */
  async markInvoiced(
    context: Partial<TenantContext> | undefined,
    orderId: string,
    dados: { hrRegistro?: string; coo?: number; nrCupom?: number },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ...tenantStoreWhere(context) },
      select: { id: true, status: true, fulfillmentType: true, erpDav: true },
    })
    if (!order) throw new NotFoundException('Pedido nao encontrado.')

    // Retirada nao vira "pronto pra entrega": o cliente e quem busca, e o
    // aviso que ele recebe e outro.
    const proximo = order.fulfillmentType === 'PICKUP' ? 'READY_FOR_PICKUP' : 'READY_FOR_DELIVERY'

    if (order.status === proximo) {
      return { orderId, status: order.status, jaEstava: true }
    }
    if (order.status !== 'READY_FOR_CHECKOUT') {
      throw new BadRequestException(
        `Pedido em ${order.status}: so pedido aguardando o caixa pode ser marcado como faturado.`,
      )
    }

    await this.prisma.order.update({ where: { id: orderId }, data: { status: proximo } })
    await this.prisma.orderEvent.create({
      data: {
        tenantId: context?.tenantId || DEFAULT_TENANT_ID,
        storeId: context?.storeId || DEFAULT_STORE_ID,
        orderId,
        type: 'order.invoiced',
        payload: {
          status: proximo,
          dav: order.erpDav,
          hrRegistro: dados.hrRegistro ?? null,
          coo: dados.coo ?? null,
          nrCupom: dados.nrCupom ?? null,
        },
        actorType: 'SYSTEM',
      },
    })

    // Nao bloqueia a resposta: falha de push nao pode impedir o pedido de
    // avancar, senao o agente reprocessa em loop por causa de notificacao.
    this.notificationsService.notifyOrderStatusChange(orderId, proximo).catch(() => {})

    // Pedido faturado no PDV entra na fila compartilhada de entrega neste
    // instante -- e a hora de avisar quem esta com o celular na mao.
    if (proximo === 'READY_FOR_DELIVERY') {
      this.notificationsService.notifyDeliveryTeamOrderReady(orderId).catch(() => {})
    }

    return { orderId, status: proximo, jaEstava: false }
  }

  private async resolveExternalOrderNumber(orderId: string, payload?: InternalOrderContract): Promise<number> {
    const snapshot = await this.prisma.auditLog.findFirst({
      where: {
        entity: 'ORDER_SYNC_SOLIDCOM',
        entityId: orderId,
        action: 'INTERNAL_ORDER_CONTRACT_SNAPSHOT',
      },
      orderBy: { createdAt: 'desc' },
    })

    const parsed = this.parseAuditChanges<{ externalPreview?: SolidcomPedidoDto }>(snapshot?.changes)
    const snapshotNumber = parsed.externalPreview?.numero

    if (typeof snapshotNumber === 'number' && Number.isFinite(snapshotNumber) && snapshotNumber > 0) {
      return snapshotNumber
    }

    return payload ? this.mapToSolidcomPedido(payload).numero : this.toExternalOrderNumber(orderId)
  }

  private parseAuditChanges<T>(changes?: string | null): T {
    if (!changes) return {} as T

    try {
      return JSON.parse(changes) as T
    } catch {
      return {} as T
    }
  }

  private parseCpf(cpf?: string | null): number {
    if (!cpf) return this.defaultBalcaoCpf
    const digits = cpf.replace(/\D/g, '')
    const numeric = Number(digits)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : this.defaultBalcaoCpf
  }

  private parseInteger(value?: string | null): number {
    if (!value) return 0
    const digits = value.replace(/\D/g, '')
    const numeric = Number(digits)
    return Number.isFinite(numeric) ? numeric : 0
  }

  /**
   * `numero` precisa caber em int32: o PutCancelamentoPedido do Solidcom
   * recebe cdPedido como int32, entao numero maior que isso gera um pedido
   * que NUNCA da pra cancelar pela API deles ("The value 'X' is not valid").
   *
   * Tem que ser deterministico tambem: eles deduplicam por numero, entao um
   * reprocesso precisa cair no mesmo numero em vez de inserir duplicado.
   * Por isso hash do orderId, e nao Date.now().
   */
  private toExternalOrderNumber(orderId: string): number {
    // FNV-1a 32 bits, dobrado pra 31 bits (positivo, cabe em int32).
    let hash = 0x811c9dc5
    for (let i = 0; i < orderId.length; i += 1) {
      hash ^= orderId.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
    // >>> 1 mantem positivo e dentro de 2^31-1; 0 nao e numero valido de pedido.
    return (hash >>> 1) || 1
  }

  private round2(value: number): number {
    return Number(value.toFixed(2))
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }
}
