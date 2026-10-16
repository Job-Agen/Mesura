/**
 * Sandbox seed: merchants, one verified demo user, demo cards and activity.
 * Idempotent — re-running resets the demo user's data.
 *
 *   Demo login: demo@mesura.test / demo1234
 */
import { PrismaClient } from '@prisma/client';
import { createDemoUser, DEMO_EMAIL, DEMO_PASSWORD, MERCHANTS, rebuildDemoCards } from '../src/demo/demo-account';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Reset the demo account, plus any older account still holding seed cards.
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: DEMO_EMAIL }, { cards: { some: { providerCardId: { startsWith: 'sbx_card_seed_' } } } }],
    },
  });
  const now = Date.now();
  const userId = await createDemoUser(prisma, now);
  await rebuildDemoCards(prisma, userId, now);
  console.log(`Seeded ${MERCHANTS.length} merchants and demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
