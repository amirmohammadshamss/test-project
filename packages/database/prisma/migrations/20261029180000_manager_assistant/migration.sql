-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "errorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseToken" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "processingMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAnalysis_tenantId_branchId_actorId_createdAt_idx" ON "AiAnalysis"("tenantId", "branchId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAnalysis_status_leaseUntil_idx" ON "AiAnalysis"("status", "leaseUntil");

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_tenantId_membershipId_actorId_fkey" FOREIGN KEY ("tenantId", "membershipId", "actorId") REFERENCES "Membership"("tenantId", "id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TYPE "NotificationType" ADD VALUE 'ANALYSIS_READY';
ALTER TYPE "NotificationType" ADD VALUE 'ANALYSIS_FAILED';

CREATE INDEX "Order_tenantId_branchId_completedAt_idx" ON "Order"("tenantId","branchId","completedAt");
CREATE INDEX "Order_tenantId_branchId_cancelledAt_idx" ON "Order"("tenantId","branchId","cancelledAt");
CREATE INDEX "OrderItem_tenantId_branchId_cancelledAt_idx" ON "OrderItem"("tenantId","branchId","cancelledAt");
