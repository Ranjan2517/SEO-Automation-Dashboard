// End-to-end from one script: queue -> worker (7 steps) -> Claude -> DB -> (PDF -> notify).
// Usage: node scripts/run-audit.js [url]
require('dotenv').config();
const { prisma } = require('../src/lib/prisma');
const { enqueueAudit, getQueue } = require('../src/queue/queue');
const { startWorker } = require('../src/queue/worker');

(async () => {
  const url = process.argv[2] || 'https://example.com';
  let client = await prisma.client.findFirst({ where: { url } });
  if (!client) {
    client = await prisma.client.create({
      data: { name: 'Demo Dental Clinic', url, businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' },
    });
  }
  const audit = await prisma.audit.create({ data: { clientId: client.id } });
  const worker = startWorker();
  await enqueueAudit(audit.id, client.id);

  let row;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    row = await prisma.audit.findUnique({ where: { id: audit.id } });
    if (row.status === 'COMPLETED' || row.status === 'FAILED') break;
  }

  const r = row.resultJson;
  console.log('\n--- Audit row in DB ---');
  console.log({ id: row.id, status: row.status, progress: row.progress, overallScore: row.overallScore, pdfPath: row.pdfPath, error: row.error });
  console.log('resultJson keys:', r ? Object.keys(r) : null, '| analysis keys:', r?.analysis ? Object.keys(r.analysis) : null);
  console.log('critical_issues:', r?.analysis?.critical_issues?.length, '| recommendations:', r?.analysis?.recommendations?.length);

  await worker.close();
  await getQueue().close();
  await prisma.$disconnect();
  process.exit(row.status === 'COMPLETED' ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
