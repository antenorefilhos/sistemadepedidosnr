import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CrmContactContract, CrmContactPreviewResponse } from './dto/crm-contact.dto'
import { HubSpotService } from './hubspot.service'
import { NfeService } from './nfe.service'
import { PaymentsService } from './payments.service'
import { PaymentsWebhookService, WebhookPayload } from './payments-webhook.service'
import { PaymentsLedgerService } from './payments-ledger.service'
import { IntegrationOutboxService } from './integration-outbox.service'
import { FiscalDocumentContract, FiscalDocumentItemContract, FiscalDocumentPreviewResponse } from './dto/fiscal-document.dto'
import { ChargeContract, ChargePreviewResponse } from './dto/charge-contract.dto'
import { IntegrationModuleKey, IntegrationModulesService } from './integration-modules.service'
import { CreatePaymentTransactionDto, CreateRefundDto, ReconcilePaymentsDto, RegisterChargebackDto } from './dto/payment-ledger.dto'
import { CreateIntegrationConnectorDto, EnqueueOutboxEventDto } from './dto/integration-outbox.dto'

type SyncFailureAction = 'SYNC_ORDER_FAILED' | 'SYNC_ORDER_RETRY_FAILED'

@Injectable()
export class IntegrationsService {
  constructor(
    private prisma: PrismaService,
    private hubspot: HubSpotService,
    private nfe: NfeService,
    private payments: PaymentsService,
    private paymentsWebhook: PaymentsWebhookService,
    private paymentsLedger: PaymentsLedgerService,
    private integrationOutbox: IntegrationOutboxService,
    private integrationModules: IntegrationModulesService,
  ) {}

  async listModules() {
    return {
      items: await this.integrationModules.list(),
    }
  }

  async setModuleEnabled(key: IntegrationModuleKey, enabled: boolean) {
    return this.integrationModules.setEnabled(key, enabled)
  }

  async getSolidcomStatus() {
    const solidcomEnabled = await this.integrationModules.isEnabled('solidcom')

    const [productsCount, recentLogs] = await Promise.all([
      this.prisma.product.count({ where: { active: true } }),
      this.prisma.auditLog.findMany({
        where: {
          entity: 'INTEGRATION_SOLIDCOM',
          action: 'SYNC_PRODUCTS',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    const history = recentLogs.map((log) => {
      let parsedChanges: Record<string, unknown> = {}

      if (log.changes) {
        try {
          parsedChanges = JSON.parse(log.changes) as Record<string, unknown>
        } catch {
          parsedChanges = {}
        }
      }

      return {
        id: log.id,
        at: log.createdAt,
        products: Number(parsedChanges.products || 0),
        synced: Number(parsedChanges.synced || 0),
        errors: Number(parsedChanges.errors || 0),
      }
    })

    const lastSync = history[0] || null

    return {
      integration: 'solidcom',
      enabled: solidcomEnabled,
      removable: true,
      productsCount,
      lastSync,
      history,
      note: solidcomEnabled
        ? 'Modulo ativo.'
        : 'Modulo desativado. Dados locais de produtos/clientes/pedidos permanecem no banco.',
    }
  }

  async listOrderSyncFailures(limit = 50, action?: SyncFailureAction, from?: string, to?: string) {
    const take = Math.max(1, Math.min(limit, 200))
    const createdAt: { gte?: Date; lte?: Date } = {}

    if (from) {
      const parsedFrom = new Date(from)
      if (!Number.isNaN(parsedFrom.getTime())) {
        createdAt.gte = parsedFrom
      }
    }

    if (to) {
      const parsedTo = new Date(to)
      if (!Number.isNaN(parsedTo.getTime())) {
        createdAt.lte = parsedTo
      }
    }

    const where = {
      entity: 'ORDER_SYNC_SOLIDCOM',
      action: action ? action : { in: ['SYNC_ORDER_FAILED', 'SYNC_ORDER_RETRY_FAILED'] },
      ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    })

    return {
      total: logs.length,
      items: logs.map((log) => ({
        id: log.id,
        orderId: log.entityId,
        action: log.action,
        createdAt: log.createdAt,
        details: this.parseChanges(log.changes),
      })),
    }
  }

  async getOrderSyncFailure(orderId: string) {
    const failure = await this.prisma.auditLog.findFirst({
      where: {
        entity: 'ORDER_SYNC_SOLIDCOM',
        entityId: orderId,
        action: { in: ['SYNC_ORDER_FAILED', 'SYNC_ORDER_RETRY_FAILED'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!failure) {
      return { found: false, orderId }
    }

    return {
      found: true,
      orderId,
      action: failure.action,
      createdAt: failure.createdAt,
      details: this.parseChanges(failure.changes),
    }
  }

  async getPaymentsHealth() {
    const providerName = process.env.PAYMENTS_PROVIDER_NAME || ''
    const providerUrl = process.env.PAYMENTS_PROVIDER_URL || ''
    const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET || ''
    const pixKey = process.env.PIX_KEY || ''

    const checks = {
      providerName: Boolean(providerName),
      providerUrl: Boolean(providerUrl),
      webhookSecret: Boolean(webhookSecret),
      pixKey: Boolean(pixKey),
      manualPixFallback: true,
    }

    const configuredChecks = Object.values(checks).filter(Boolean).length - 1
    const status = configuredChecks >= 4 ? 'ready' : configuredChecks > 0 ? 'partial' : 'not_configured'

    return {
      integration: 'payments',
      status,
      configured: status !== 'not_configured',
      provider: providerName || 'nao_configurado',
      checks,
      notes:
        status === 'not_configured'
          ? 'Nenhum gateway configurado. Operacao atual permanece manual para PIX e cartao na entrega.'
          : status === 'partial'
            ? 'Configuracao parcial detectada. Validar URL do provedor, segredo de webhook e chave PIX antes da ativacao.'
            : 'Configuracao minima detectada para iniciar a implementacao do conector de pagamentos.',
    }
  }

  async getCrmHealth() {
    const apiKey = process.env.HUBSPOT_API_KEY || ''
    const portalId = process.env.HUBSPOT_PORTAL_ID || ''
    const defaultOwner = process.env.HUBSPOT_DEFAULT_OWNER_ID || ''

    const checks = {
      apiKey: Boolean(apiKey),
      portalId: Boolean(portalId),
      defaultOwner: Boolean(defaultOwner),
    }

    const configuredChecks = Object.values(checks).filter(Boolean).length
    const status = configuredChecks === 3 ? 'ready' : configuredChecks > 0 ? 'partial' : 'not_configured'

    return {
      integration: 'crm',
      provider: 'HubSpot',
      status,
      configured: status !== 'not_configured',
      portalId: portalId || null,
      checks,
      notes:
        status === 'not_configured'
          ? 'Nenhuma credencial HubSpot configurada. Defina HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID e HUBSPOT_DEFAULT_OWNER_ID.'
          : status === 'partial'
            ? 'Configuracao parcial. Validar todas as credenciais antes de ativar o conector CRM.'
            : 'Configuracao minima detectada para iniciar a implementacao do conector CRM.',
    }
  }

  async getFiscalHealth() {
    const providerName = process.env.NFE_PROVIDER_NAME || ''
    const providerUrl = process.env.NFE_PROVIDER_URL || ''
    const apiKey = process.env.NFE_API_KEY || ''
    const cnpjEmitente = process.env.NFE_CNPJ_EMITENTE || ''
    const certPath = process.env.NFE_CERT_PATH || ''

    const checks = {
      providerName: Boolean(providerName),
      providerUrl: Boolean(providerUrl),
      apiKey: Boolean(apiKey),
      cnpjEmitente: Boolean(cnpjEmitente),
      certPath: Boolean(certPath),
    }

    const configuredChecks = Object.values(checks).filter(Boolean).length
    const status = configuredChecks >= 5 ? 'ready' : configuredChecks > 0 ? 'partial' : 'not_configured'

    return {
      integration: 'fiscal',
      provider: providerName || 'nao_configurado',
      status,
      configured: status !== 'not_configured',
      checks,
      notes:
        status === 'not_configured'
          ? 'Nenhum provedor NF-e configurado. Defina NFE_PROVIDER_NAME, NFE_PROVIDER_URL, NFE_API_KEY, NFE_CNPJ_EMITENTE e NFE_CERT_PATH.'
          : status === 'partial'
            ? 'Configuracao parcial NF-e. Validar URL, chave de API, CNPJ emitente e caminho do certificado digital.'
            : 'Configuracao minima detectada para iniciar a implementacao do conector Fiscal.',
    }
  }

  async buildCrmContactPreview(customerId: string): Promise<CrmContactPreviewResponse> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })

    if (!customer) {
      return { found: false, customerId }
    }

    const nameParts = (customer.name || '').trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const contract: CrmContactContract = {
      customerId: customer.id,
      email: customer.email || null,
      firstName,
      lastName,
      phone: customer.whatsapp,
      cpf: customer.cpf,
      lifecycleStage: 'customer',
      eventType: 'customer_registered',
      registeredAt: customer.createdAt.toISOString(),
      properties: {
        email: customer.email || null,
        firstname: firstName,
        lastname: lastName,
        phone: customer.whatsapp,
        cpf_documento: customer.cpf,
        lifecyclestage: 'customer',
      },
    }

    await this.logIntegrationEvent('INTERNAL_CRM_CONTACT_SNAPSHOT', 'CRM_CONTACT_HUBSPOT', customerId, {
      contract,
    })

    return { found: true, customerId, source: 'live', contract }
  }

  async buildFiscalDocumentPreview(orderId: string): Promise<FiscalDocumentPreviewResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })

    if (!order) {
      return { found: false, orderId }
    }

    const cnpjEmitente = process.env.NFE_CNPJ_EMITENTE || process.env.SOLIDCOM_CNPJ || '5147995000131'

    const itens: FiscalDocumentItemContract[] = order.items.map((item) => ({
      productId: item.productId,
      ean: item.product.ean,
      descricao: item.product.name,
      quantidade: item.quantity,
      valorUnitario: item.unitPrice,
      valorTotal: item.subtotal,
      ncm: '22021000',
      cfop: '5102',
      cst: '400',
      unidade: item.product.unit || 'UN',
    }))

    const contract: FiscalDocumentContract = {
      orderId: order.id,
      naturezaOperacao: 'VENDA AO CONSUMIDOR FINAL',
      dataEmissao: new Date().toISOString(),
      emitenteCnpj: cnpjEmitente,
      destinatarioNome: order.customer.name,
      destinatarioCpf: order.customer.cpf,
      valorSubtotal: order.subtotal,
      valorDesconto: order.discount,
      valorFrete: order.delivery,
      valorTotal: order.total,
      observacoes: order.notes || null,
      itens,
    }

    await this.logIntegrationEvent('INTERNAL_FISCAL_DOCUMENT_SNAPSHOT', 'FISCAL_DOCUMENT_NFE', orderId, {
      contract,
    })

    return { found: true, orderId, source: 'live', contract }
  }

  async buildChargePreview(orderId: string): Promise<ChargePreviewResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    })

    if (!order) {
      return { found: false, orderId }
    }

    const pixKey = process.env.PIX_KEY || null
    const shortId = order.id.slice(-8).toUpperCase()

    const contract: ChargeContract = {
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customer.name,
      customerPhone: order.customer.whatsapp,
      amount: order.total,
      method: order.paymentMethod,
      description: `Pedido #${shortId} — ${order.customer.name}`,
      pixKey,
      expiresInSeconds: 3600,
      metadata: {
        orderId: order.id,
        customerId: order.customerId,
        paymentMethod: order.paymentMethod,
      },
    }

    await this.logIntegrationEvent('INTERNAL_CHARGE_CONTRACT_SNAPSHOT', 'PAYMENT_CHARGE', orderId, {
      contract,
    })

    return { found: true, orderId, source: 'live', contract }
  }

  async listCrmContactSnapshots(customerId: string, limit = 10) {
    return this.listIntegrationSnapshots('CRM_CONTACT_HUBSPOT', customerId, limit, 'customerId')
  }

  async listFiscalDocumentSnapshots(orderId: string, limit = 10) {
    return this.listIntegrationSnapshots('FISCAL_DOCUMENT_NFE', orderId, limit, 'orderId')
  }

  async listChargeSnapshots(orderId: string, limit = 10) {
    return this.listIntegrationSnapshots('PAYMENT_CHARGE', orderId, limit, 'orderId')
  }

  async processPaymentWebhook(payload: WebhookPayload) {
    return this.paymentsWebhook.processEvent(payload)
  }

  async listPaymentWebhookEvents(limit = 30) {
    return this.paymentsWebhook.listRecentEvents(limit)
  }

  async listPaymentTransactions(params: {
    orderId?: string
    status?: string
    provider?: string
    limit?: number
  }) {
    return this.paymentsLedger.listTransactions(params)
  }

  async createPaymentTransaction(orderId: string, dto: CreatePaymentTransactionDto) {
    return this.paymentsLedger.createTransactionForOrder(orderId, {
      provider: dto.provider,
      method: dto.method,
      status: dto.status,
      amount: dto.amount,
      providerRef: dto.providerRef,
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata,
    })
  }

  async createPaymentRefund(dto: CreateRefundDto) {
    return this.paymentsLedger.createRefund(dto)
  }

  async registerPaymentChargeback(dto: RegisterChargebackDto) {
    return this.paymentsLedger.registerChargeback(dto)
  }

  async reconcilePayments(dto: ReconcilePaymentsDto) {
    return this.paymentsLedger.reconcile({
      provider: dto.provider,
      from: dto.from,
      to: dto.to,
      providerRows: dto.providerRows,
      dryRun: dto.dryRun,
    })
  }

  async createIntegrationConnector(dto: CreateIntegrationConnectorDto) {
    return this.integrationOutbox.createConnector(dto)
  }

  async listIntegrationConnectors(filters: { type?: string; provider?: string; status?: string }) {
    return this.integrationOutbox.listConnectors(filters)
  }

  async enqueueIntegrationEvent(dto: EnqueueOutboxEventDto) {
    return this.integrationOutbox.enqueueEvent(dto)
  }

  async listOutboxEvents(filters: {
    status?: string
    connectorId?: string
    aggregate?: string
    aggregateId?: string
    limit?: number
  }) {
    return this.integrationOutbox.listOutboxEvents(filters)
  }

  async replayOutboxEvent(eventId: string) {
    return this.integrationOutbox.replayOutboxEvent(eventId)
  }

  async runOutboxWorker(limit?: number) {
    return this.integrationOutbox.runDueOutboxBatch(limit)
  }

  async listIntegrationJobs(filters: { status?: string; connectorId?: string; limit?: number }) {
    return this.integrationOutbox.listJobs(filters)
  }

  async listIntegrationDeadLetters(filters: { connectorId?: string; unresolvedOnly?: boolean; limit?: number }) {
    return this.integrationOutbox.listDeadLetters(filters)
  }

  async replayIntegrationDeadLetter(deadLetterId: string) {
    return this.integrationOutbox.replayDeadLetter(deadLetterId)
  }

  async getIntegrationOperationsPanel() {
    return this.integrationOutbox.getPanel()
  }

  private async logIntegrationEvent(
    action: string,
    entity: string,
    entityId: string,
    changes: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        changes: JSON.stringify(changes),
      },
    })
  }

  private async listIntegrationSnapshots(
    entity: string,
    entityId: string,
    limit: number,
    idField: 'customerId' | 'orderId',
  ) {
    const take = Math.max(1, Math.min(limit, 20))
    const logs = await this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take,
    })

    return {
      [idField]: entityId,
      total: logs.length,
      items: logs.map((log) => ({
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        contract: this.parseChanges(log.changes).contract || null,
      })),
    }
  }

  private parseChanges(changes?: string | null): Record<string, unknown> {
    if (!changes) return {}
    try {
      return JSON.parse(changes) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  private mapPaymentTransactionStatus(status?: string | null) {
    const normalized = String(status || '').trim().toUpperCase()
    const mapped: Record<string, string> = {
      AUTHORIZED: 'AUTHORIZED',
      CAPTURED: 'CAPTURED',
      PAID: 'CAPTURED',
      SUCCEEDED: 'CAPTURED',
      SUCCESS: 'CAPTURED',
      PENDING: 'PENDING',
      PROCESSING: 'PENDING',
      FAILED: 'FAILED',
      CANCELLED: 'FAILED',
      CANCELED: 'FAILED',
      REFUNDED: 'REFUNDED',
      CHARGEBACK: 'CHARGEBACK',
    }
    return mapped[normalized] || 'PENDING'
  }

  async syncCrmContact(customerId: string): Promise<{
    success: boolean
    hubspotId?: string
    action?: string
    error?: string
    contract?: CrmContactContract
  }> {
    const preview = await this.buildCrmContactPreview(customerId)
    if (!preview.found || !preview.contract) {
      return { success: false, error: 'Cliente não encontrado.' }
    }

    try {
      const result = await this.hubspot.pushContact(preview.contract)
      await this.logIntegrationEvent('CRM_CONTACT_SYNCED', 'CRM_CONTACT_HUBSPOT', customerId, {
        hubspotId: result.hubspotId,
        action: result.action,
        contract: preview.contract,
      })
      return { success: true, hubspotId: result.hubspotId, action: result.action, contract: preview.contract }
    } catch (err) {
      const message = (err as Error).message
      await this.logIntegrationEvent('CRM_CONTACT_SYNC_FAILED', 'CRM_CONTACT_HUBSPOT', customerId, {
        error: message,
        contract: preview.contract,
      })
      return { success: false, error: message, contract: preview.contract }
    }
  }

  async replayCrmContactFromSnapshot(snapshotId: string): Promise<{
    success: boolean
    hubspotId?: string
    action?: string
    error?: string
  }> {
    const log = await this.prisma.auditLog.findUnique({ where: { id: snapshotId } })
    if (!log || log.entity !== 'CRM_CONTACT_HUBSPOT') {
      return { success: false, error: 'Snapshot não encontrado ou entidade inválida.' }
    }

    const parsed = this.parseChanges(log.changes)
    const contract = parsed.contract as CrmContactContract | undefined
    if (!contract) {
      return { success: false, error: 'Snapshot sem contrato válido para replay.' }
    }

    try {
      const result = await this.hubspot.pushContact(contract)
      await this.logIntegrationEvent('CRM_CONTACT_SYNCED', 'CRM_CONTACT_HUBSPOT', log.entityId, {
        hubspotId: result.hubspotId,
        action: result.action,
        replayedFromSnapshot: snapshotId,
        contract,
      })
      return { success: true, hubspotId: result.hubspotId, action: result.action }
    } catch (err) {
      const message = (err as Error).message
      await this.logIntegrationEvent('CRM_CONTACT_SYNC_FAILED', 'CRM_CONTACT_HUBSPOT', log.entityId, {
        error: message,
        replayedFromSnapshot: snapshotId,
        contract,
      })
      return { success: false, error: message }
    }
  }

  async syncFiscalDocument(orderId: string): Promise<{
    success: boolean
    ref?: string
    chaveNfe?: string
    numeroNfe?: string
    error?: string
    contract?: FiscalDocumentContract
  }> {
    const preview = await this.buildFiscalDocumentPreview(orderId)
    if (!preview.found || !preview.contract) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    try {
      const result = await this.nfe.emitirDocumento(preview.contract)
      await this.logIntegrationEvent('FISCAL_DOCUMENT_EMITTED', 'FISCAL_DOCUMENT_NFE', orderId, {
        ref: result.ref,
        chaveNfe: result.chaveNfe,
        numeroNfe: result.numeroNfe,
        status: result.status,
        message: result.message,
        contract: preview.contract,
      })
      return { success: true, ref: result.ref, chaveNfe: result.chaveNfe, numeroNfe: result.numeroNfe, contract: preview.contract }
    } catch (err) {
      const message = (err as Error).message
      await this.logIntegrationEvent('FISCAL_DOCUMENT_EMIT_FAILED', 'FISCAL_DOCUMENT_NFE', orderId, {
        error: message,
        contract: preview.contract,
      })
      return { success: false, error: message, contract: preview.contract }
    }
  }

  async replayFiscalDocumentFromSnapshot(snapshotId: string): Promise<{
    success: boolean
    ref?: string
    chaveNfe?: string
    numeroNfe?: string
    error?: string
  }> {
    const log = await this.prisma.auditLog.findUnique({ where: { id: snapshotId } })
    if (!log || log.entity !== 'FISCAL_DOCUMENT_NFE') {
      return { success: false, error: 'Snapshot não encontrado ou entidade inválida.' }
    }

    const parsed = this.parseChanges(log.changes)
    const contract = parsed.contract as FiscalDocumentContract | undefined
    if (!contract) {
      return { success: false, error: 'Snapshot sem contrato válido para replay.' }
    }

    try {
      const result = await this.nfe.emitirDocumento(contract)
      await this.logIntegrationEvent('FISCAL_DOCUMENT_EMITTED', 'FISCAL_DOCUMENT_NFE', log.entityId, {
        ref: result.ref,
        chaveNfe: result.chaveNfe,
        numeroNfe: result.numeroNfe,
        status: result.status,
        replayedFromSnapshot: snapshotId,
        contract,
      })
      return { success: true, ref: result.ref, chaveNfe: result.chaveNfe, numeroNfe: result.numeroNfe }
    } catch (err) {
      const message = (err as Error).message
      await this.logIntegrationEvent('FISCAL_DOCUMENT_EMIT_FAILED', 'FISCAL_DOCUMENT_NFE', log.entityId, {
        error: message,
        replayedFromSnapshot: snapshotId,
        contract,
      })
      return { success: false, error: message }
    }
  }

  async syncChargePayment(orderId: string): Promise<{
    success: boolean
    chargeId?: string
    paymentTransactionId?: string
    paymentUrl?: string
    pixCopiaECola?: string
    error?: string
    contract?: ChargeContract
  }> {
    const preview = await this.buildChargePreview(orderId)
    if (!preview.found || !preview.contract) {
      return { success: false, error: 'Pedido não encontrado.' }
    }

    try {
      const result = await this.payments.gerarCobranca(preview.contract)
      const transaction = await this.paymentsLedger.createTransactionForOrder(orderId, {
        provider: process.env.PAYMENTS_PROVIDER_NAME || 'GATEWAY',
        method: preview.contract.method,
        status: this.mapPaymentTransactionStatus(result.status),
        amount: preview.contract.amount,
        providerRef: result.chargeId,
        idempotencyKey: `charge:${orderId}:${result.chargeId}`,
        metadata: {
          paymentUrl: result.paymentUrl,
          pixCopiaECola: result.pixCopiaECola,
          message: result.message,
          contract: preview.contract,
        },
      })
      await this.logIntegrationEvent('CHARGE_PAYMENT_CREATED', 'PAYMENT_CHARGE', orderId, {
        chargeId: result.chargeId,
        paymentTransactionId: transaction.id,
        status: result.status,
        paymentUrl: result.paymentUrl,
        pixCopiaECola: result.pixCopiaECola,
        message: result.message,
        contract: preview.contract,
      })
      return {
        success: true,
        chargeId: result.chargeId,
        paymentTransactionId: transaction.id,
        paymentUrl: result.paymentUrl,
        pixCopiaECola: result.pixCopiaECola,
        contract: preview.contract,
      }
    } catch (err) {
      const message = (err as Error).message
      await this.logIntegrationEvent('CHARGE_PAYMENT_FAILED', 'PAYMENT_CHARGE', orderId, {
        error: message,
        contract: preview.contract,
      })
      return { success: false, error: message, contract: preview.contract }
    }
  }

  async replayChargeFromSnapshot(snapshotId: string): Promise<{
    success: boolean
    chargeId?: string
    paymentTransactionId?: string
    paymentUrl?: string
    pixCopiaECola?: string
    error?: string
  }> {
    const log = await this.prisma.auditLog.findUnique({ where: { id: snapshotId } })
    if (!log || log.entity !== 'PAYMENT_CHARGE') {
      return { success: false, error: 'Snapshot não encontrado ou entidade inválida.' }
    }

    const parsed = this.parseChanges(log.changes)
    const contract = parsed.contract as ChargeContract | undefined
    if (!contract) {
      return { success: false, error: 'Snapshot sem contrato válido para replay.' }
    }

    try {
      const result = await this.payments.gerarCobranca(contract)
      const transaction = await this.paymentsLedger.createTransactionForOrder(contract.orderId, {
        provider: process.env.PAYMENTS_PROVIDER_NAME || 'GATEWAY',
        method: contract.method,
        status: this.mapPaymentTransactionStatus(result.status),
        amount: contract.amount,
        providerRef: result.chargeId,
        idempotencyKey: `charge:${contract.orderId}:${result.chargeId}`,
        metadata: {
          paymentUrl: result.paymentUrl,
          pixCopiaECola: result.pixCopiaECola,
          replayedFromSnapshot: snapshotId,
          contract,
        },
      })
      await this.logIntegrationEvent('CHARGE_PAYMENT_CREATED', 'PAYMENT_CHARGE', log.entityId, {
        chargeId: result.chargeId,
        paymentTransactionId: transaction.id,
        status: result.status,
        paymentUrl: result.paymentUrl,
        pixCopiaECola: result.pixCopiaECola,
        replayedFromSnapshot: snapshotId,
        contract,
      })
      return {
        success: true,
        chargeId: result.chargeId,
        paymentTransactionId: transaction.id,
        paymentUrl: result.paymentUrl,
        pixCopiaECola: result.pixCopiaECola,
      }
    } catch (err) {
      const message = (err as Error).message
      await this.logIntegrationEvent('CHARGE_PAYMENT_FAILED', 'PAYMENT_CHARGE', log.entityId, {
        error: message,
        replayedFromSnapshot: snapshotId,
        contract,
      })
      return { success: false, error: message }
    }
  }
}
