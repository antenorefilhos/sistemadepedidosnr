-- JON: broadcast manual agendado -- grava a intencao e um scheduler dispara
-- quando "sendAt" chegar.
CREATE TABLE "scheduled_notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "customerId" TEXT,
    "imageUrl" TEXT,
    "productId" TEXT,
    "bannerId" TEXT,
    "inactiveDays" INTEGER,
    "purchasedCategory" TEXT,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_notifications_tenantId_sentAt_sendAt_idx" ON "scheduled_notifications"("tenantId", "sentAt", "sendAt");
