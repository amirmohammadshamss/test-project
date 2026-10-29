-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "ItemStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancellationPriorStatus" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(3),
ADD COLUMN     "cancelledBy" UUID;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cancellationPriorStatus" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(3),
ADD COLUMN     "cancelledBy" UUID;

-- CreateTable
CREATE TABLE "RestaurantSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RestaurantSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantSession_expiresAt_idx" ON "RestaurantSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "RestaurantSession" ADD CONSTRAINT "RestaurantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
