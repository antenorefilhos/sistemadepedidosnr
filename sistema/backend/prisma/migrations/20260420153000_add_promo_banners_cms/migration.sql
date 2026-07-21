-- CreateTable
CREATE TABLE "promo_banners_cms" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "badge" TEXT,
  "description" TEXT,
  "imageUrl" TEXT NOT NULL,
  "ctaLabel" TEXT,
  "ctaTo" TEXT,
  "align" TEXT NOT NULL DEFAULT 'left',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "promo_banners_cms_pkey" PRIMARY KEY ("id")
);
