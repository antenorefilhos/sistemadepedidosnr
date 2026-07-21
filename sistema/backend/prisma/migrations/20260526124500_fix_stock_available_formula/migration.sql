-- Keep stock availability auditable: availability must equal onHand - reserved - safetyStock.

UPDATE "stock_positions"
SET "available" = "onHand" - "reserved" - "safetyStock",
    "updatedAt" = NOW()
WHERE "available" <> ("onHand" - "reserved" - "safetyStock");
