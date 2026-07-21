-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "comparisonType" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "operator" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_triggered" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 7,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminSeenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_triggered_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rules_metric_idx" ON "alert_rules"("metric");

-- CreateIndex
CREATE INDEX "alert_triggered_ruleId_idx" ON "alert_triggered"("ruleId");

-- CreateIndex
CREATE INDEX "alert_triggered_triggeredAt_idx" ON "alert_triggered"("triggeredAt");

-- AddForeignKey
ALTER TABLE "alert_triggered" ADD CONSTRAINT "alert_triggered_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
