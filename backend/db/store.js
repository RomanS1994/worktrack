import { prisma } from './prisma.js';
import {
  getDatabaseUrl,
  getDirectDatabaseUrl,
  isProductionEnvironment,
} from '../config/runtime-env.js';
export async function runStoreRead({ prisma: runPrisma }) {
  return runPrisma(prisma);
}

export async function runStoreTransaction({ prisma: runPrisma }) {
  return prisma.$transaction(async tx => runPrisma(tx));
}

export function getDatabaseInfo() {
  const databaseUrl = getDatabaseUrl();
  const directDatabaseUrl = getDirectDatabaseUrl();

  const prismaInfo = {
    provider: 'postgresql',
    configured: Boolean(databaseUrl || directDatabaseUrl),
    mode: 'prisma',
    connectionType: directDatabaseUrl ? 'direct' : databaseUrl ? 'proxy' : 'missing',
    productionOnly: isProductionEnvironment(),
  };
  return prismaInfo;
}

export async function getDatabaseHealth() {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return {
      ok: true,
      database: {
        ...getDatabaseInfo(),
        connected: true,
      },
    };
  } catch {
    return {
      ok: false,
      database: {
        ...getDatabaseInfo(),
        connected: false,
      },
      error: 'Database connection failed.',
    };
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
