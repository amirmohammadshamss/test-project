-- CreateEnum
CREATE TYPE "NotificationRealm" AS ENUM ('RESTAURANT', 'PLATFORM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_ORDER', 'ITEM_READY', 'ORDER_CANCELLED', 'PREPARATION_CHANGED', 'ORDER_DELAYED', 'AI_FAILED', 'TENANT_SUSPENDED', 'PLATFORM_ISSUE');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "realm" "NotificationRealm" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "tenantId" UUID,
    "branchId" UUID,
    "entityId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorCode" TEXT,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "realm" "NotificationRealm" NOT NULL,
    "tenantId" UUID,
    "branchId" UUID,
    "membershipId" UUID,
    "platformAdminId" UUID,
    "recipientId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "acknowledgedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "includeLow" BOOLEAN NOT NULL DEFAULT true,
    "categories" "NotificationType"[],
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "encrypted" TEXT NOT NULL,
    "realm" "NotificationRealm" NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "branchId" UUID,
    "membershipId" UUID,
    "platformAdminId" UUID,
    "sessionId" UUID NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseToken" UUID,
    "errorCode" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationMonitorState" (
    "key" TEXT NOT NULL,
    "unhealthy" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationMonitorState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationOutbox_processedAt_failedAt_nextAttemptAt_creat_idx" ON "NotificationOutbox"("processedAt", "failedAt", "nextAttemptAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_realm_tenantId_branchId_createdAt__idx" ON "Notification"("recipientId", "realm", "tenantId", "branchId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventId_realm_recipientId_type_key" ON "Notification"("eventId", "realm", "recipientId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_scopeKey_key" ON "NotificationPreference"("userId", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "PushSubscription"("endpointHash");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_realm_tenantId_branchId_active_idx" ON "PushSubscription"("userId", "realm", "tenantId", "branchId", "active");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_subscriptionId_key" ON "NotificationDelivery"("notificationId", "subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_id_userId_key" ON "Membership"("tenantId", "id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_id_userId_key" ON "PlatformAdmin"("id", "userId");

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_membershipId_recipientId_fkey" FOREIGN KEY ("tenantId", "membershipId", "recipientId") REFERENCES "Membership"("tenantId", "id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_platformAdminId_recipientId_fkey" FOREIGN KEY ("platformAdminId", "recipientId") REFERENCES "PlatformAdmin"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_tenantId_membershipId_userId_fkey" FOREIGN KEY ("tenantId", "membershipId", "userId") REFERENCES "Membership"("tenantId", "id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_platformAdminId_userId_fkey" FOREIGN KEY ("platformAdminId", "userId") REFERENCES "PlatformAdmin"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT notification_realm_ownership CHECK (
 (realm='RESTAURANT' AND "tenantId" IS NOT NULL AND "membershipId" IS NOT NULL AND "platformAdminId" IS NULL)
 OR (realm='PLATFORM' AND "tenantId" IS NULL AND "branchId" IS NULL AND "membershipId" IS NULL AND "platformAdminId" IS NOT NULL)
);
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT outbox_realm_ownership CHECK (
 (realm='RESTAURANT' AND "tenantId" IS NOT NULL) OR (realm='PLATFORM' AND "tenantId" IS NULL AND "branchId" IS NULL)
);
ALTER TABLE "PushSubscription" ADD CONSTRAINT push_realm_ownership CHECK (
 (realm='RESTAURANT' AND "tenantId" IS NOT NULL AND "branchId" IS NOT NULL AND "membershipId" IS NOT NULL AND "platformAdminId" IS NULL)
 OR (realm='PLATFORM' AND "tenantId" IS NULL AND "branchId" IS NULL AND "membershipId" IS NULL AND "platformAdminId" IS NOT NULL)
);
