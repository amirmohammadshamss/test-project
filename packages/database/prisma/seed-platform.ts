import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/password';
const db = new PrismaClient();
async function main() {
  if (
    process.env.ENABLE_PLATFORM_DEMO !== 'true' ||
    process.env.NODE_ENV === 'production'
  )
    throw new Error(
      'Platform demo seeding requires ENABLE_PLATFORM_DEMO=true in a nonproduction environment',
    );
  const password =
    process.env.PLATFORM_DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('Set a 12+ character PLATFORM_DEMO_PASSWORD');
  const email = 'platform@demo.restaurantos.test';
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: 'مدیر آزمایشی سامانه', passwordHash },
    update: { passwordHash },
  });
  await db.platformAdmin.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });
  console.log(
    'Nonproduction platform demo account ready. MFA is not implemented; never use this prototype for real customers.',
  );
}
main().finally(() => db.$disconnect());
