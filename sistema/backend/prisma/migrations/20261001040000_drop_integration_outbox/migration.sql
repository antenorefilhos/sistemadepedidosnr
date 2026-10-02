-- Fila de outbox de integracao removida (01/10/2026). O despacho nunca enviou
-- nada ("conector sem implementacao real de envio"); pedido sem DAV e
-- cancelamento sao reenviados pela AntenorApi (OrderSyncRetryScheduler e tela
-- Integracoes). Em producao havia 9 eventos PENDING parados, 1 conector e
-- nenhum job, tentativa ou dead letter. Copia das tabelas guardada na VPS antes.
DROP TABLE IF EXISTS "integration_attempts";
DROP TABLE IF EXISTS "integration_dead_letters";
DROP TABLE IF EXISTS "integration_jobs";
DROP TABLE IF EXISTS "outbox_events";
DROP TABLE IF EXISTS "integration_connectors";
