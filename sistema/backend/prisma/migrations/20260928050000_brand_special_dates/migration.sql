-- Datas especiais do horario de entrega (feriado, horario reduzido). Ver common/delivery-hours.ts.
ALTER TABLE "brand_config" ADD COLUMN "specialDates" TEXT;
