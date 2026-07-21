import { Module } from '@nestjs/common'
import { SolidcomERPService } from './solidcom-erp.service'
import { IntegrationsService } from './integrations.service'
import { IntegrationsController } from './integrations.controller'
import { HealthController } from './health.controller'
import { PrismaService } from '../../common/prisma.service'
import { OrderOrchestrationService } from './order-orchestration.service'
import { HubSpotService } from './hubspot.service'
import { NfeService } from './nfe.service'
import { PaymentsService } from './payments.service'
import { PaymentsWebhookService } from './payments-webhook.service'
import { PaymentsLedgerService } from './payments-ledger.service'
import { IntegrationOutboxService } from './integration-outbox.service'
import { WebhookGuard } from './webhook.guard'
import { RetryService } from '../../common/services/retry.service'
import { IntegrationModulesService } from './integration-modules.service'
import { PublicApiModule } from '../public-api/public-api.module'

@Module({
  imports: [PublicApiModule],
  controllers: [IntegrationsController, HealthController],
  providers: [
    SolidcomERPService,
    IntegrationsService,
    HubSpotService,
    NfeService,
    PaymentsService,
    PaymentsWebhookService,
    PaymentsLedgerService,
    IntegrationOutboxService,
    WebhookGuard,
    PrismaService,
    OrderOrchestrationService,
    RetryService,
    IntegrationModulesService,
  ],
  exports: [
    SolidcomERPService,
    IntegrationsService,
    HubSpotService,
    NfeService,
    PaymentsService,
    PaymentsWebhookService,
    PaymentsLedgerService,
    IntegrationOutboxService,
    WebhookGuard,
    OrderOrchestrationService,
    RetryService,
    IntegrationModulesService,
  ],
})
export class IntegrationsModule {}
