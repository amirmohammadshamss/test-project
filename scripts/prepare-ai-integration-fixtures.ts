import { PrismaClient } from '@prisma/client';
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.pathname !== '/restaurantos_test')
    throw new Error('Dedicated test database required');
  const db = new PrismaClient();
  try {
    // These two tenants are seed-owned test fixtures, never production tenants.
    // Reset only their AI request history so daily caps do not depend on prior runs.
    await db.aiAnalysis.deleteMany({
      where: {
        tenantId: {
          in: [
            '10000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000002',
          ],
        },
      },
    });
    await db.aiDraft.deleteMany({
      where: {
        tenantId: {
          in: [
            '10000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000002',
          ],
        },
      },
    });
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  console.error('AI_TEST_FIXTURE_PREPARATION_FAILED');
  process.exitCode = 1;
});
