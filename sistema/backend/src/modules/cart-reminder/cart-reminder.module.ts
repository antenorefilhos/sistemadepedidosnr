import { Global, Module } from '@nestjs/common'
import { CartReminderController } from './cart-reminder.controller'
import { CartReminderService } from './cart-reminder.service'

/** Lembrete de carrinho esquecido pela fila de envios (02/10/2026). Global: pedido e fila usam. */
@Global()
@Module({
  controllers: [CartReminderController],
  providers: [CartReminderService],
  exports: [CartReminderService],
})
export class CartReminderModule {}
