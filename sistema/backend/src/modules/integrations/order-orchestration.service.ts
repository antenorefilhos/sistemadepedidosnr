import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { InternalOrderContract } from './dto/order-contract.dto'
import { SolidcomPedidoDto } from './dto/solidcom-order.dto'
import { SolidcomERPService } from './solidcom-erp.service'
import { IntegrationModulesService } from './integration-modules.service'
import { IntegrationOutboxService } from './integration-outbox.service'

interface ScaleBarcodeParsingResult {
  productCode: number
  totalValue: number
}

@Injectable()
export class OrderOrchestrationService {
  private readonly logger = new Logger(OrderOrchestrationService.name)
  private readonly defaultCnpj = Number(process.env.SOLIDCOM_CNPJ || '5147995000131')
  private readonly defaultCodEcom = Number(process.env.SOLIDCOM_CODECOM || '19')
  private readonly defaultBalcaoCpf = Number(process.env.SOLIDCOM_BALCAO_CPF || '23715771704')

  constructor(
    private readonly solidcomERPService: SolidcomERPService,
    private readonly prisma: PrismaService,
    private readonly integrationModules: IntegrationModulesService,
    private readonly integrationOutbox: IntegrationOutboxService,
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
      await this.solidcomERPService.syncOrder(payload.orderId, externalPayload)
      await this.logSyncEvent('SYNC_ORDER_SUCCESS', payload.orderId, {
        externalNumero: externalPayload.numero,
        codEcom: externalPayload.codEcom,
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
      return {
        found: false,
        orderId,
      }
    }

    const contract: InternalOrderContract = {
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
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || null,
        ean: item.product?.ean || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        scannedCode: null,
      })),
    }

    return {
      found: true,
      orderId,
      source: 'live',
      contract,
      externalPreview: this.mapToSolidcomPedido(contract),
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

    const failed = await this.prisma.auditLog.findFirst({
      where: {
        entity: 'ORDER_SYNC_SOLIDCOM',
        entityId: orderId,
        action: 'SYNC_ORDER_FAILED',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!failed?.changes) {
      return { orderId, retried: false, reason: 'Nenhum payload de falha encontrado para reprocessar.' }
    }

    let payload: SolidcomPedidoDto | null = null
    try {
      const parsed = JSON.parse(failed.changes) as { payload?: SolidcomPedidoDto }
      payload = parsed.payload || null
    } catch {
      payload = null
    }

    if (!payload) {
      return { orderId, retried: false, reason: 'Payload inválido no histórico de falha.' }
    }

    try {
      await this.solidcomERPService.syncOrder(orderId, payload)
      await this.logSyncEvent('SYNC_ORDER_RETRY_SUCCESS', orderId, {
        externalNumero: payload.numero,
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
      referencia: `PDV-${externalNumber}`,
      cliente: {
        cpf: this.parseCpf(payload.customer.cpf),
        nome: payload.customer.name || 'BALCAO',
      },
      itens: payload.items.map((item, index) => {
        const scaleData = this.parseScaleBarcode(item.scannedCode)
        const hasScaleLabel = Boolean(scaleData)
        const cdProduto = hasScaleLabel ? scaleData!.productCode : this.parseInteger(item.productId)
        const quantityRaw = hasScaleLabel
          ? scaleData!.totalValue / Math.max(item.unitPrice, 0.0001)
          : item.quantity
        const quantity = Number(quantityRaw.toFixed(3))

        return {
          numero: index + 1,
          ean: this.parseInteger(item.ean),
          cdProduto,
          inCodigoInterno: cdProduto > 0,
          nmProduto: item.productName || `Produto ${index + 1}`,
          quantidade: quantity,
          quantidadeAtendida: quantity,
          valorUnitario: this.round2(item.unitPrice),
          valorDesconto: 0,
        }
      }),
    }
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

  private toExternalOrderNumber(orderId: string): number {
    const digits = orderId.replace(/\D/g, '')
    if (digits.length >= 8) {
      return Number(digits.slice(-12))
    }
    return Date.now()
  }

  private round2(value: number): number {
    return Number(value.toFixed(2))
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }
}
