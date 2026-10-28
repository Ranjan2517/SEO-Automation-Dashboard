// Usage: node scripts/add-job.js [url]
require('dotenv').config();
const { prisma } = require('../src/lib/prisma');
const { enqueueAudit, getQueue } = require('../src/queue/queue');

(async () => {
  const url = process.argv[2] || 'https://example.com';
  let client = await prisma.client.findFirst({ where: { url } });
  if (!client) {
    client = await prisma.client.create({
      data: { name: 'Demo Dental Clinic', url, businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' },
    });
  }
  const audit = await prisma.audit.create({ data: { clientId: client.id, status: 'QUEUED' } });
  await enqueueAudit(audit.id, client.id);
  console.log('queued audit', audit.id, 'for', url);
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await getQueue().close(); });
