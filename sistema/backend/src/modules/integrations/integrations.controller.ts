import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { IntegrationsService } from './integrations.service'
import { OrderOrchestrationService } from './order-orchestration.service'
import { WebhookPayload } from './payments-webhook.service'
import { WebhookGuard } from './webhook.guard'
import { IntegrationModuleKey } from './integration-modules.service'
import { CreatePaymentTransactionDto, CreateRefundDto, ReconcilePaymentsDto, RegisterChargebackDto } from './dto/payment-ledger.dto'
import { CreateIntegrationConnectorDto, EnqueueOutboxEventDto, RunOutboxWorkerDto } from './dto/integration-outbox.dto'

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly orderOrchestrationService: OrderOrchestrationService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('modules')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar módulos de integração conectáveis',
    description: 'Retorna catálogo de módulos plugáveis (enabled/removable), permitindo estratégia desconectável e excluível por conector.',
  })
  @ApiResponse({ status: 200, description: 'Módulos listados com sucesso.' })
  async listModules() {
    return this.integrationsService.listModules()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('modules/:key')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ativar ou desativar módulo de integração',
    description: 'Liga/desliga uma extensão de integração. Serviços e rotinas vinculadas ao módulo devem respeitar este estado.',
  })
  @ApiResponse({ status: 200, description: 'Módulo atualizado com sucesso.' })
  async setModuleEnabled(
    @Param('key') key: IntegrationModuleKey,
    @Body() body: { enabled: boolean },
  ) {
    return this.integrationsService.setModuleEnabled(key, Boolean(body?.enabled))
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('operations/panel')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Painel operacional das integracoes resilientes',
    description: 'Resume conectores, outbox, jobs, DLQ e ultimas tentativas para operacao do M10.',
  })
  @ApiResponse({ status: 200, description: 'Painel consultado com sucesso.' })
  async getIntegrationPanel() {
    return this.integrationsService.getIntegrationOperationsPanel()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('connectors')
  @ApiBearerAuth()
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiOperation({
    summary: 'Listar conectores de integracao',
    description: 'Retorna conectores ERP/PDV/fiscal/pagamento/logistica com contadores de saude operacional.',
  })
  @ApiResponse({ status: 200, description: 'Conectores listados.' })
  async listConnectors(
    @Query('type') type?: string,
    @Query('provider') provider?: string,
    @Query('status') status?: string,
  ) {
    return this.integrationsService.listIntegrationConnectors({ type, provider, status })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('connectors')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar ou atualizar conector de integracao',
    description: 'Registra conector por tenant/loja/tipo/provedor para outbox, jobs, retry e DLQ.',
  })
  @ApiResponse({ status: 201, description: 'Conector salvo.' })
  async createConnector(@Body() body: CreateIntegrationConnectorDto) {
    return this.integrationsService.createIntegrationConnector(body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('outbox/events')
  @ApiBearerAuth()
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'connectorId', required: false, type: String })
  @ApiQuery({ name: 'aggregate', required: false, type: String })
  @ApiQuery({ name: 'aggregateId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({
    summary: 'Listar eventos de outbox',
    description: 'Lista mensagens pendentes, enviadas, falhas ou mortas com payload rastreavel.',
  })
  @ApiResponse({ status: 200, description: 'Eventos listados.' })
  async listOutboxEvents(
    @Query('status') status?: string,
    @Query('connectorId') connectorId?: string,
    @Query('aggregate') aggregate?: string,
    @Query('aggregateId') aggregateId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.integrationsService.listOutboxEvents({
      status,
      connectorId,
      aggregate,
      aggregateId,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('outbox/events')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Enfileirar evento de integracao',
    description: 'Cria mensagem idempotente na outbox transacional baseada em Postgres.',
  })
  @ApiResponse({ status: 201, description: 'Evento enfileirado.' })
  async enqueueOutboxEvent(@Body() body: EnqueueOutboxEventDto) {
    return this.integrationsService.enqueueIntegrationEvent(body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('outbox/events/:eventId/replay')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reprocessar evento de outbox',
    description: 'Recoloca um evento falho ou morto na fila para nova tentativa manual.',
  })
  @ApiResponse({ status: 200, description: 'Evento recolocado na fila.' })
  async replayOutboxEvent(@Param('eventId') eventId: string) {
    return this.integrationsService.replayOutboxEvent(eventId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('outbox/worker/run')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Executar worker de outbox sob demanda',
    description: 'Processa mensagens vencidas com controle de retry, backoff e DLQ.',
  })
  @ApiResponse({ status: 200, description: 'Worker executado.' })
  async runOutboxWorker(@Body() body: RunOutboxWorkerDto) {
    return this.integrationsService.runOutboxWorker(body?.limit)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('jobs')
  @ApiBearerAuth()
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'connectorId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({
    summary: 'Listar jobs de integracao',
    description: 'Retorna jobs e ultimas tentativas para acompanhamento operacional.',
  })
  @ApiResponse({ status: 200, description: 'Jobs listados.' })
  async listIntegrationJobs(
    @Query('status') status?: string,
    @Query('connectorId') connectorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.integrationsService.listIntegrationJobs({
      status,
      connectorId,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('dead-letters')
  @ApiBearerAuth()
  @ApiQuery({ name: 'connectorId', required: false, type: String })
  @ApiQuery({ name: 'unresolvedOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({
    summary: 'Listar DLQ de integracao',
    description: 'Lista mensagens que excederam retry e precisam de acao manual.',
  })
  @ApiResponse({ status: 200, description: 'DLQ listada.' })
  async listDeadLetters(
    @Query('connectorId') connectorId?: string,
    @Query('unresolvedOnly') unresolvedOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.integrationsService.listIntegrationDeadLetters({
      connectorId,
      unresolvedOnly: unresolvedOnly === undefined ? undefined : unresolvedOnly !== 'false',
      limit: limit ? Number(limit) : undefined,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('dead-letters/:deadLetterId/replay')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replay manual de DLQ',
    description: 'Cria novo evento de outbox a partir do payload morto e marca a DLQ como resolvida.',
  })
  @ApiResponse({ status: 200, description: 'Replay criado.' })
  async replayDeadLetter(@Param('deadLetterId') deadLetterId: string) {
    return this.integrationsService.replayIntegrationDeadLetter(deadLetterId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solidcom/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Status da integração Solidcom',
    description: 'Retorna o status da última sincronização com o ERP Solidcom e histórico das últimas execuções.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status de sincronização',
    schema: {
      example: {
        service: 'solidcom-erp',
        lastSync: '2026-04-18T10:30:00Z',
        status: 'success',
        syncedCount: 45,
        history: [
          {
            timestamp: '2026-04-18T10:30:00Z',
            status: 'success',
            syncedCount: 45,
            duration: '2.5s',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async getSolidcomStatus() {
    return this.integrationsService.getSolidcomStatus()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solidcom/orders/failures')
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite de itens (max 200).' })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: ['SYNC_ORDER_FAILED', 'SYNC_ORDER_RETRY_FAILED'],
    description: 'Filtrar por tipo de falha.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Data inicial em ISO (createdAt >= from).' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Data final em ISO (createdAt <= to).' })
  @ApiOperation({
    summary: 'Listar falhas de sincronização de pedidos com Solidcom',
    description: 'Retorna histórico recente de falhas da trilha ORDER_SYNC_SOLIDCOM.',
  })
  @ApiResponse({ status: 200, description: 'Falhas listadas com sucesso.' })
  async listSolidcomOrderSyncFailures(
    @Query('limit') limit?: string,
    @Query('action') action?: 'SYNC_ORDER_FAILED' | 'SYNC_ORDER_RETRY_FAILED',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const parsed = limit ? Number(limit) : undefined
    return this.integrationsService.listOrderSyncFailures(parsed, action, from, to)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solidcom/orders/period')
  @ApiBearerAuth()
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Data inicial ISO (ex: 2026-04-01).' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'Data final ISO (ex: 2026-04-19).' })
  @ApiOperation({
    summary: 'Reconciliar pedidos por período entre sistema interno e ERP Solidcom',
    description: 'Consulta GetPedidoPeriodo no ERP e cruza com os snapshots internos do mesmo período, retornando matched/local_only/remote_only.',
  })
  @ApiResponse({ status: 200, description: 'Reconciliação executada com sucesso.' })
  async reconcileSolidcomOrdersByPeriod(@Query('from') from: string, @Query('to') to: string) {
    return this.orderOrchestrationService.reconcileOrdersByPeriod(from, to)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solidcom/orders/:orderId/contract')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar contrato interno normalizado de um pedido',
    description: 'Retorna o contrato interno da API própria e um preview do payload ERP derivado para auditoria operacional.',
  })
  @ApiResponse({ status: 200, description: 'Contrato consultado com sucesso.' })
  async getSolidcomOrderContract(@Param('orderId') orderId: string) {
    return this.orderOrchestrationService.getOrderContract(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solidcom/orders/:orderId/contracts')
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite de snapshots (max 30).' })
  @ApiOperation({
    summary: 'Listar snapshots historicos do contrato de um pedido',
    description: 'Retorna snapshots do contrato interno e snapshots de cancelamento registrados para um pedido.',
  })
  @ApiResponse({ status: 200, description: 'Historico de snapshots consultado com sucesso.' })
  async listSolidcomOrderContracts(@Param('orderId') orderId: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined
    return this.orderOrchestrationService.listOrderContractSnapshots(orderId, parsed)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solidcom/orders/:orderId/remote')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar pedido remoto no ERP Solidcom',
    description: 'Resolve o numero externo a partir do snapshot local e consulta o pedido correspondente no ERP.',
  })
  @ApiResponse({ status: 200, description: 'Pedido remoto consultado com sucesso.' })
  async getSolidcomRemoteOrder(@Param('orderId') orderId: string) {
    return this.orderOrchestrationService.getRemoteOrder(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solidcom/orders/:orderId/failure')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Detalhar última falha de sincronização por pedido',
    description: 'Retorna a última falha registrada para um pedido na trilha ORDER_SYNC_SOLIDCOM.',
  })
  @ApiResponse({ status: 200, description: 'Detalhe de falha consultado.' })
  async getSolidcomOrderSyncFailure(@Param('orderId') orderId: string) {
    return this.integrationsService.getOrderSyncFailure(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('solidcom/orders/:orderId/retry')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reprocessar sincronização de pedido com Solidcom',
    description: 'Tenta reenviar um pedido que falhou na integração, usando o payload registrado no histórico.',
  })
  @ApiResponse({ status: 200, description: 'Reprocesso executado.' })
  async retrySolidcomOrderSync(@Param('orderId') orderId: string) {
    return this.orderOrchestrationService.retryOrderSync(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('payments/health')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Health do conector de pagamentos',
    description: 'Retorna o estado real da configuracao minima do proximo conector planejado de pagamentos.',
  })
  @ApiResponse({ status: 200, description: 'Health do conector de pagamentos consultado com sucesso.' })
  async getPaymentsHealth() {
    return this.integrationsService.getPaymentsHealth()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('payments/transactions')
  @ApiBearerAuth()
  @ApiQuery({ name: 'orderId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'provider', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({
    summary: 'Listar ledger financeiro de pagamentos',
    description: 'Retorna transacoes, ultimos eventos e reembolsos do ledger financeiro por pedido, status ou provedor.',
  })
  @ApiResponse({ status: 200, description: 'Transacoes listadas com sucesso.' })
  async listPaymentTransactions(
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : undefined
    return this.integrationsService.listPaymentTransactions({ orderId, status, provider, limit: parsed })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('crm/health')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Health do conector CRM',
    description: 'Retorna o estado real da configuracao minima do conector HubSpot planejado.',
  })
  @ApiResponse({ status: 200, description: 'Health do conector CRM consultado com sucesso.' })
  async getCrmHealth() {
    return this.integrationsService.getCrmHealth()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('fiscal/health')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Health do conector Fiscal',
    description: 'Retorna o estado real da configuracao minima do conector NF-e planejado.',
  })
  @ApiResponse({ status: 200, description: 'Health do conector Fiscal consultado com sucesso.' })
  async getFiscalHealth() {
    return this.integrationsService.getFiscalHealth()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('crm/contact-preview/:customerId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Preview do contrato interno de contato CRM',
    description: 'Gera o payload interno normalizado de contato HubSpot a partir de um cliente existente.',
  })
  @ApiResponse({ status: 200, description: 'Preview do contrato CRM gerado com sucesso.' })
  async getCrmContactPreview(@Param('customerId') customerId: string) {
    return this.integrationsService.buildCrmContactPreview(customerId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('crm/contact-preview/:customerId/history')
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite de snapshots (max 20).' })
  @ApiOperation({
    summary: 'Listar snapshots do contrato CRM',
    description: 'Retorna o histórico recente de snapshots gerados para um contato CRM.',
  })
  @ApiResponse({ status: 200, description: 'Histórico CRM consultado com sucesso.' })
  async listCrmContactSnapshots(@Param('customerId') customerId: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined
    return this.integrationsService.listCrmContactSnapshots(customerId, parsed)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('fiscal/document-preview/:orderId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Preview do contrato interno de documento fiscal',
    description: 'Gera o payload interno normalizado de NF-e a partir de um pedido existente.',
  })
  @ApiResponse({ status: 200, description: 'Preview do contrato fiscal gerado com sucesso.' })
  async getFiscalDocumentPreview(@Param('orderId') orderId: string) {
    return this.integrationsService.buildFiscalDocumentPreview(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('fiscal/document-preview/:orderId/history')
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite de snapshots (max 20).' })
  @ApiOperation({
    summary: 'Listar snapshots do contrato fiscal',
    description: 'Retorna o histórico recente de snapshots gerados para um documento fiscal.',
  })
  @ApiResponse({ status: 200, description: 'Histórico fiscal consultado com sucesso.' })
  async listFiscalDocumentSnapshots(@Param('orderId') orderId: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined
    return this.integrationsService.listFiscalDocumentSnapshots(orderId, parsed)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('payments/charge-preview/:orderId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Preview do contrato interno de cobranca',
    description: 'Gera o payload interno normalizado de cobranca a partir de um pedido existente.',
  })
  @ApiResponse({ status: 200, description: 'Preview do contrato de cobranca gerado com sucesso.' })
  async getChargePreview(@Param('orderId') orderId: string) {
    return this.integrationsService.buildChargePreview(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('payments/orders/:orderId/transaction')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar ou registrar transacao financeira para um pedido',
    description: 'Cria transacao idempotente no ledger para PIX, cartao online, voucher ou pagamento na entrega.',
  })
  @ApiResponse({ status: 201, description: 'Transacao registrada.' })
  async createPaymentTransaction(
    @Param('orderId') orderId: string,
    @Body() body: CreatePaymentTransactionDto,
  ) {
    return this.integrationsService.createPaymentTransaction(orderId, body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('payments/refunds')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registrar reembolso total ou parcial',
    description: 'Registra reembolso financeiro e atualiza o status de pagamento do pedido/transacao.',
  })
  @ApiResponse({ status: 201, description: 'Reembolso registrado.' })
  async createPaymentRefund(@Body() body: CreateRefundDto) {
    return this.integrationsService.createPaymentRefund(body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('payments/chargebacks')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Registrar chargeback',
    description: 'Associa chargeback a transacao e pedido para auditoria financeira.',
  })
  @ApiResponse({ status: 201, description: 'Chargeback registrado.' })
  async registerPaymentChargeback(@Body() body: RegisterChargebackDto) {
    return this.integrationsService.registerPaymentChargeback(body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('payments/reconciliation')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Conciliar gateway de pagamento contra ledger local',
    description: 'Cruza transacoes locais com extrato informado pelo provedor e salva divergencias para o financeiro.',
  })
  @ApiResponse({ status: 201, description: 'Conciliacao executada.' })
  async reconcilePayments(@Body() body: ReconcilePaymentsDto) {
    return this.integrationsService.reconcilePayments(body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('payments/charge-preview/:orderId/history')
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite de snapshots (max 20).' })
  @ApiOperation({
    summary: 'Listar snapshots do contrato de cobranca',
    description: 'Retorna o histórico recente de snapshots gerados para uma cobranca.',
  })
  @ApiResponse({ status: 200, description: 'Histórico de cobranca consultado com sucesso.' })
  async listChargeSnapshots(@Param('orderId') orderId: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined
    return this.integrationsService.listChargeSnapshots(orderId, parsed)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('crm/contact-sync/:customerId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sincronizar contato CRM com HubSpot',
    description: 'Gera o contrato interno e envia o contato ao HubSpot, criando ou atualizando o registro. Registra o resultado na trilha de auditoria.',
  })
  @ApiResponse({ status: 200, description: 'Sincronização executada.' })
  async syncCrmContact(@Param('customerId') customerId: string) {
    return this.integrationsService.syncCrmContact(customerId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('crm/contact-replay/:snapshotId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replay de contato CRM a partir de snapshot',
    description: 'Reenvia um contato ao HubSpot usando o contrato salvo em um snapshot de auditoria específico.',
  })
  @ApiResponse({ status: 200, description: 'Replay executado.' })
  async replayCrmContact(@Param('snapshotId') snapshotId: string) {
    return this.integrationsService.replayCrmContactFromSnapshot(snapshotId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('fiscal/document-emit/:orderId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Emitir NF-e para um pedido',
    description: 'Gera o contrato interno e envia ao provedor NF-e configurado (Focus NFe). Registra o resultado na trilha de auditoria.',
  })
  @ApiResponse({ status: 200, description: 'Emissão executada.' })
  async emitFiscalDocument(@Param('orderId') orderId: string) {
    return this.integrationsService.syncFiscalDocument(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('fiscal/document-replay/:snapshotId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replay de NF-e a partir de snapshot',
    description: 'Reemite uma NF-e ao provedor usando o contrato salvo em um snapshot de auditoria específico.',
  })
  @ApiResponse({ status: 200, description: 'Replay executado.' })
  async replayFiscalDocument(@Param('snapshotId') snapshotId: string) {
    return this.integrationsService.replayFiscalDocumentFromSnapshot(snapshotId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('payments/charge/:orderId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gerar cobrança para um pedido',
    description: 'Gera o contrato interno e envia ao gateway de pagamentos configurado. Registra o resultado na trilha de auditoria.',
  })
  @ApiResponse({ status: 200, description: 'Cobrança gerada.' })
  async chargePayment(@Param('orderId') orderId: string) {
    return this.integrationsService.syncChargePayment(orderId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('payments/charge-replay/:snapshotId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Replay de cobrança a partir de snapshot',
    description: 'Reenvia uma cobrança ao gateway usando o contrato salvo em um snapshot de auditoria específico.',
  })
  @ApiResponse({ status: 200, description: 'Replay executado.' })
  async replayCharge(@Param('snapshotId') snapshotId: string) {
    return this.integrationsService.replayChargeFromSnapshot(snapshotId)
  }

  @UseGuards(WebhookGuard)
  @Post('payments/webhook')
  @Throttle({ webhook: { limit: 120, ttl: 60000 } })
  @ApiOperation({
    summary: 'Receber evento webhook do gateway de pagamentos',
    description: 'Endpoint público que recebe eventos do gateway, valida assinatura HMAC-SHA256 e atualiza o status do pedido automaticamente.',
  })
  @ApiResponse({ status: 200, description: 'Evento processado.' })
  @ApiResponse({ status: 401, description: 'Assinatura inválida.' })
  async receiveWebhook(@Body() body: WebhookPayload) {
    return this.integrationsService.processPaymentWebhook(body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('payments/webhook/events')
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite de eventos (max 100).' })
  @ApiOperation({
    summary: 'Listar últimos eventos webhook recebidos',
    description: 'Retorna os eventos webhook de pagamento registrados na trilha de auditoria.',
  })
  @ApiResponse({ status: 200, description: 'Eventos listados com sucesso.' })
  async listWebhookEvents(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined
    return this.integrationsService.listPaymentWebhookEvents(parsed)
  }
}

