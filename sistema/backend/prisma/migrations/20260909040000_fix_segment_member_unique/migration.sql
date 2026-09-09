-- JON-31 (varredura de 09/09/2026): customerId tinha UNIQUE sozinho, alem do
-- composto (segmentId, customerId). Isso impedia um cliente de pertencer a
-- mais de um segmento ao mesmo tempo -- refreshSegments() estourava
-- P2002 (unique constraint) em producao sempre que um cliente batia em
-- mais de uma regra (ex.: inativo E alto ticket).
DROP INDEX IF EXISTS "customer_segment_members_customerId_key";
