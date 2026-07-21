-- Milestone 10 - Integration outbox, jobs, attempts and DLQ foundation
CREATE TABLE "integration_connectors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "connectorId" TEXT,
    "aggregate" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "idempotencyKey" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "connectorId" TEXT NOT NULL,
    "outboxEventId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "idempotencyKey" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "jobId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "integration_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_dead_letters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "connectorId" TEXT,
    "outboxEventId" TEXT,
    "jobId" TEXT,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "lastError" TEXT,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_dead_letters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_connectors_tenantId_storeId_type_provider_key" ON "integration_connectors"("tenantId", "storeId", "type", "provider");
CREATE INDEX "integration_connectors_tenantId_storeId_status_idx" ON "integration_connectors"("tenantId", "storeId", "status");
CREATE INDEX "integration_connectors_type_provider_status_idx" ON "integration_connectors"("type", "provider", "status");

CREATE UNIQUE INDEX "outbox_events_tenantId_storeId_connectorId_idempotencyKey_key" ON "outbox_events"("tenantId", "storeId", "connectorId", "idempotencyKey");
CREATE INDEX "outbox_events_status_nextRetryAt_idx" ON "outbox_events"("status", "nextRetryAt");
CREATE INDEX "outbox_events_tenantId_storeId_status_createdAt_idx" ON "outbox_events"("tenantId", "storeId", "status", "createdAt");
CREATE INDEX "outbox_events_tenantId_storeId_aggregate_aggregateId_idx" ON "outbox_events"("tenantId", "storeId", "aggregate", "aggregateId");
CREATE INDEX "outbox_events_type_status_createdAt_idx" ON "outbox_events"("type", "status", "createdAt");

CREATE UNIQUE INDEX "integration_jobs_tenantId_storeId_connectorId_idempotencyKey_key" ON "integration_jobs"("tenantId", "storeId", "connectorId", "idempotencyKey");
CREATE INDEX "integration_jobs_tenantId_storeId_status_createdAt_idx" ON "integration_jobs"("tenantId", "storeId", "status", "createdAt");
CREATE INDEX "integration_jobs_connectorId_status_createdAt_idx" ON "integration_jobs"("connectorId", "status", "createdAt");
CREATE INDEX "integration_jobs_outboxEventId_idx" ON "integration_jobs"("outboxEventId");

CREATE INDEX "integration_attempts_tenantId_storeId_status_startedAt_idx" ON "integration_attempts"("tenantId", "storeId", "status", "startedAt");
CREATE INDEX "integration_attempts_jobId_attemptNo_idx" ON "integration_attempts"("jobId", "attemptNo");

CREATE INDEX "integration_dead_letters_tenantId_storeId_createdAt_idx" ON "integration_dead_letters"("tenantId", "storeId", "createdAt");
CREATE INDEX "integration_dead_letters_connectorId_createdAt_idx" ON "integration_dead_letters"("connectorId", "createdAt");
CREATE INDEX "integration_dead_letters_outboxEventId_idx" ON "integration_dead_letters"("outboxEventId");
CREATE INDEX "integration_dead_letters_jobId_idx" ON "integration_dead_letters"("jobId");

ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "integration_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "integration_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "outbox_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "integration_attempts" ADD CONSTRAINT "integration_attempts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "integration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_dead_letters" ADD CONSTRAINT "integration_dead_letters_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "integration_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "integration_dead_letters" ADD CONSTRAINT "integration_dead_letters_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "outbox_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "integration_dead_letters" ADD CONSTRAINT "integration_dead_letters_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "integration_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
