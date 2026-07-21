-- M07 picking, conference and packing foundation.
CREATE TABLE "picking_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "picking_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "picking_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "batchId" TEXT,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "slaDueAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "picking_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "picking_task_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "taskId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQuantity" DECIMAL(12,3) NOT NULL,
    "pickedQuantity" DECIMAL(12,3),
    "finalWeight" DECIMAL(12,3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "barcode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "picking_task_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "picker_performance_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "pickerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "itemsPicked" INTEGER NOT NULL DEFAULT 0,
    "itemsMissing" INTEGER NOT NULL DEFAULT 0,
    "substitutions" INTEGER NOT NULL DEFAULT 0,
    "pickingSeconds" INTEGER NOT NULL DEFAULT 0,
    "itemsPerMinute" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "picker_performance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "packing_checklists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "orderId" TEXT NOT NULL,
    "taskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "items" JSONB NOT NULL,
    "checkedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_checklists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "picking_tasks_tenantId_storeId_orderId_key" ON "picking_tasks"("tenantId", "storeId", "orderId");
CREATE INDEX "picking_batches_tenantId_storeId_status_idx" ON "picking_batches"("tenantId", "storeId", "status");
CREATE INDEX "picking_batches_tenantId_storeId_assignedToId_idx" ON "picking_batches"("tenantId", "storeId", "assignedToId");
CREATE INDEX "picking_tasks_tenantId_storeId_status_priority_idx" ON "picking_tasks"("tenantId", "storeId", "status", "priority");
CREATE INDEX "picking_tasks_tenantId_storeId_assignedToId_status_idx" ON "picking_tasks"("tenantId", "storeId", "assignedToId", "status");
CREATE INDEX "picking_tasks_tenantId_storeId_slaDueAt_idx" ON "picking_tasks"("tenantId", "storeId", "slaDueAt");
CREATE INDEX "picking_task_items_tenantId_storeId_status_idx" ON "picking_task_items"("tenantId", "storeId", "status");
CREATE INDEX "picking_task_items_taskId_idx" ON "picking_task_items"("taskId");
CREATE INDEX "picking_task_items_orderItemId_idx" ON "picking_task_items"("orderItemId");
CREATE INDEX "picking_task_items_productId_idx" ON "picking_task_items"("productId");
CREATE INDEX "picker_performance_snapshots_tenantId_storeId_pickerId_periodStart_idx" ON "picker_performance_snapshots"("tenantId", "storeId", "pickerId", "periodStart");
CREATE INDEX "picker_performance_snapshots_tenantId_storeId_periodStart_idx" ON "picker_performance_snapshots"("tenantId", "storeId", "periodStart");
CREATE INDEX "packing_checklists_tenantId_storeId_orderId_idx" ON "packing_checklists"("tenantId", "storeId", "orderId");
CREATE INDEX "packing_checklists_tenantId_storeId_status_idx" ON "packing_checklists"("tenantId", "storeId", "status");
CREATE INDEX "packing_checklists_taskId_idx" ON "packing_checklists"("taskId");

ALTER TABLE "picking_tasks" ADD CONSTRAINT "picking_tasks_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "picking_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "picking_task_items" ADD CONSTRAINT "picking_task_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "picking_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
