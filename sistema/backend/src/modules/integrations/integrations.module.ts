import { Module, forwardRef } from '@nestjs/common'
import { SolidcomERPService } from './solidcom-erp.service'
import { AntenorApiService } from './antenor-api.service'
import { PdvCancellationScheduler } from './pdv-cancellation.scheduler'
import { IntegrationsService } from './integrations.service'
import { IntegrationsController } from './integrations.controller'
import { HealthController } from './health.controller'
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
import { NotificationsModule } from '../notifications/notifications.module'
import { ProductsModule } from '../products/products.module'

@Module({
  // JON-33 (Auditoria 360): forwardRef -- ProductsModule ja importa
  // IntegrationsModule, entao o webhook produto.alterado (que injeta
  // ProductsService aqui) fecharia um ciclo sem isso.
  imports: [PublicApiModule, NotificationsModule, forwardRef(() => ProductsModule)],
  controllers: [IntegrationsController, HealthController],
  providers: [
    SolidcomERPService,
    AntenorApiService,
    PdvCancellationScheduler,
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
  exports: [
    SolidcomERPService,
    AntenorApiService,
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
