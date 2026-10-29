ALTER TYPE "NotificationType" ADD VALUE 'AI_READY';
ALTER TABLE "AiDraft"
 ADD COLUMN "provider" TEXT,
 ADD COLUMN "model" TEXT,
 ADD COLUMN "inputTokens" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "outputTokens" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "usageSamples" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "processingMs" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "approvedAt" TIMESTAMPTZ(3),
 ADD COLUMN "corrected" BOOLEAN;
CREATE INDEX "AiDraft_tenantId_createdAt_idx" ON "AiDraft"("tenantId", "createdAt");
