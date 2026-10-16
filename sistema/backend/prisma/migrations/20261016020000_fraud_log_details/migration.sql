-- Antifraude: o que foi tentado de fato (16/10/2026). Ate aqui o log so
-- registrava um rotulo generico ("cadastro/login", "pedido") sem guardar
-- qual identificador bateu no bloqueio nem o aparelho/IP usados na tentativa.
ALTER TABLE "fraud_logs" ADD COLUMN "details" JSONB;
