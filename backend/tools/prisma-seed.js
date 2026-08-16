import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import { PLANS } from '../config/plans.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDir, '..', '.env') });

async function seedPlans() {
  const { prisma } = await import('../db/prisma.js');

  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: {
        id: plan.id,
      },
      update: {
        name: plan.name,
        monthlyGenerationLimit: plan.monthlyGenerationLimit,
        description: plan.description,
        isActive: true,
      },
      create: {
        id: plan.id,
        name: plan.name,
        monthlyGenerationLimit: plan.monthlyGenerationLimit,
        description: plan.description,
        isActive: true,
      },
    });
  }

  return prisma;
}

seedPlans()
  .then(async prisma => {
    console.log(`Seeded ${PLANS.length} plans.`);
    await prisma.$disconnect();
  })
  .catch(error => {
    console.error('Prisma seed failed');
    console.error(error);
    process.exitCode = 1;
  });
