-- Janelas de entrega/retirada com capacidade (01/10/2026). Cada janela era
-- avulsa (data e hora fixas, sem repeticao) e nunca foi cadastrada nenhuma;
-- quando existia, o checkout jogava o pedido na primeira janela livre sem o
-- cliente escolher, por cima do horario de entrega da marca. Quem decide o
-- horario e o agendamento e brand_config.businessHours/specialDates.
-- orders."fulfillmentSlotId" so guardava o marcador 'ASAP'; o agendamento
-- continua em orders."scheduledFor" e a janela prometida no deliverySnapshot.
DROP INDEX IF EXISTS "orders_tenantId_storeId_fulfillmentSlotId_idx";
DROP INDEX IF EXISTS "checkout_sessions_tenantId_storeId_fulfillmentSlotId_idx";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillmentSlotId";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillmentSlotItemCount";
ALTER TABLE "checkout_sessions" DROP COLUMN IF EXISTS "fulfillmentSlotId";
ALTER TABLE "checkout_sessions" DROP COLUMN IF EXISTS "fulfillmentSlotReserved";
ALTER TABLE "checkout_sessions" DROP COLUMN IF EXISTS "fulfillmentSlotItemCount";
DROP TABLE IF EXISTS "fulfillment_slots";
