ALTER TABLE "OrderItem" ADD COLUMN "preparingAt" TIMESTAMPTZ(3), ADD COLUMN "readyAt" TIMESTAMPTZ(3), ADD COLUMN "servedAt" TIMESTAMPTZ(3);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_timing_order" CHECK (("preparingAt" IS NULL OR "preparingAt" >= "createdAt") AND ("readyAt" IS NULL OR ("readyAt" >= "createdAt" AND ("preparingAt" IS NULL OR "readyAt" >= "preparingAt"))) AND ("servedAt" IS NULL OR ("servedAt" >= "createdAt" AND ("readyAt" IS NULL OR "servedAt" >= "readyAt"))));
CREATE INDEX "Order_tenantId_branchId_createdAt_idx" ON "Order"("tenantId", "branchId", "createdAt");
CREATE INDEX "OrderItem_tenantId_branchId_readyAt_idx" ON "OrderItem"("tenantId", "branchId", "readyAt");
