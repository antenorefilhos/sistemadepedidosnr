-- CreateTable
CREATE TABLE "store_banners_cms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'full',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "link" TEXT,
    "linkTarget" TEXT NOT NULL DEFAULT '_self',
    "title" TEXT,
    "imageUrl" TEXT NOT NULL,
    "mobileImageUrl" TEXT,
    "pages" TEXT NOT NULL DEFAULT 'home',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_banners_cms_pkey" PRIMARY KEY ("id")
);
