ALTER TABLE "delivery_zones"
  ADD COLUMN IF NOT EXISTS "polygonGeoJSON" TEXT;
