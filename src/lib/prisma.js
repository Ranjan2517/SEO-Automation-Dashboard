const { PrismaClient } = require('@prisma/client');

// Reuse one client across Next.js hot reloads and the standalone worker.
const globalForPrisma = globalThis;
const prisma = globalForPrisma.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;

module.exports = { prisma };
