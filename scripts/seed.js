// Seeds one admin and one client user (the client is linked to the demo clinic). Safe to re-run.
// Usage: node scripts/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/lib/prisma');

const { ADMIN, CLIENT } = require('../src/lib/demo-accounts');

(async () => {
  let clinic = await prisma.client.findFirst({ where: { url: 'https://example.com' } });
  if (!clinic) {
    clinic = await prisma.client.create({
      data: { name: 'Demo Dental Clinic', url: 'https://example.com', businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' },
    });
  }

  await prisma.user.upsert({
    where: { email: ADMIN.email },
    update: { passwordHash: bcrypt.hashSync(ADMIN.password, 10), role: 'ADMIN', clientId: null },
    create: { email: ADMIN.email, passwordHash: bcrypt.hashSync(ADMIN.password, 10), role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: CLIENT.email },
    update: { passwordHash: bcrypt.hashSync(CLIENT.password, 10), role: 'CLIENT', clientId: clinic.id },
    create: { email: CLIENT.email, passwordHash: bcrypt.hashSync(CLIENT.password, 10), role: 'CLIENT', clientId: clinic.id },
  });

  console.log('Seeded demo users:');
  console.log(`  ADMIN   ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`  CLIENT  ${CLIENT.email} / ${CLIENT.password}   (client: ${clinic.name})`);
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
