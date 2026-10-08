-- Como cada item foi confirmado na separacao e item incluido pelo separador (08/10/2026).
ALTER TABLE "order_items"
  ADD COLUMN "pickMethod" TEXT,
  ADD COLUMN "pickedBarcode" TEXT,
  ADD COLUMN "addedByPicker" BOOLEAN NOT NULL DEFAULT false;

-- Incluidos pelo separador: ate hoje so pelo texto da nota (no item do pedido ou na tarefa).
UPDATE "order_items" SET "addedByPicker" = true WHERE "pickerNotes" LIKE '%Incluido durante separacao%';
UPDATE "order_items" oi SET "addedByPicker" = true
  FROM "picking_task_items" pti
  WHERE pti."orderItemId" = oi.id AND pti.notes LIKE '%Incluido durante separacao%';

-- Itens ja separados: codigo lido (camera ou digitado, sem distincao antes de hoje) ou marcado a mao.
UPDATE "order_items" oi SET
  "pickMethod" = CASE WHEN COALESCE(pti.barcode, '') <> '' THEN 'BARCODE' ELSE 'MANUAL' END,
  "pickedBarcode" = NULLIF(pti.barcode, '')
  FROM "picking_task_items" pti
  WHERE pti."orderItemId" = oi.id AND pti.status = 'PICKED' AND oi."addedByPicker" = false;
