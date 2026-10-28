require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const c = await p.client.create({ data: { name: 'Check Clinic', url: 'https://example-dental-clinic.com', businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' } });
  const back = await p.client.findUnique({ where: { id: c.id } });
  console.log('READ BACK:', back);
  await p.client.delete({ where: { id: c.id } });
  console.log('cleaned up test row');
})().catch(e => console.log('FAILED', e.message)).finally(() => p.$disconnect());
