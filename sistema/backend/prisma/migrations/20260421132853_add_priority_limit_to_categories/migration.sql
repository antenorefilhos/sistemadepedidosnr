-- AlterTable
ALTER TABLE "categories_cms" ADD COLUMN     "limit" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "fractionStep" DOUBLE PRECISION;
