import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl, getDirectDatabaseUrl } from '../config/runtime-env.js';

const globalForPrisma = globalThis;
// Для Node runtime віддаємо пріоритет прямому PostgreSQL URL, щоб не залежати від
// Prisma Accelerate/Data Proxy під час локального старту сервера.
const datasourceUrl = getDirectDatabaseUrl() || getDatabaseUrl() || undefined;

export const prisma =
  globalForPrisma.__workTrackPrisma ||
  new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__workTrackPrisma = prisma;
}
