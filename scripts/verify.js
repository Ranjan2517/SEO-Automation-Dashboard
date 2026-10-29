// Usage: node scripts/verify.js            (full check)
//        USE_MOCKS=false node scripts/verify.js nokey   (internal stage)
require('dotenv').config();
const fs = require('fs');
const { spawnSync } = require('child_process');

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

async function nokey() {
  delete process.env.ANTHROPIC_API_KEY;
  const { analyseAudit } = require('../src/ai/claude');
  const { sendWhatsApp } = require('../src/notifications/whatsapp');
  const c = { url: 'https://x.com', businessType: 'a', city: 'b', state: 'c' };
  const out = {};
  try { await analyseAudit(c, {}); out.claude = 'no error'; } catch (e) { out.claude = e.message; }
  try { await sendWhatsApp('id', 'p', 1); out.whatsapp = 'no error'; } catch (e) { out.whatsapp = e.message; }
  console.log(JSON.stringify(out));
}

async function main() {
  const { prisma } = require('../src/lib/prisma');
  const { enqueueAudit, getQueue } = require('../src/queue/queue');
  const { startWorker } = require('../src/queue/worker');

  // Phase 1: tables exist
  const t = await prisma.$queryRawUnsafe("select table_name from information_schema.tables where table_schema='public'");
  const names = t.map((r) => r.table_name);
  check('P1 tables User/Client/Audit/Recommendation', ['User', 'Client', 'Audit', 'Recommendation'].every((n) => names.includes(n)), names.join(','));

  // Phases 2-5: a good audit and a failing audit through the real queue
  const good = await prisma.client.findFirst({ where: { url: 'https://example.com' } });
  const bad = await prisma.client.create({
    data: { name: 'Broken Site', url: 'https://this-domain-does-not-exist-xyz123.invalid', businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' },
  });
  const a1 = await prisma.audit.create({ data: { clientId: good.id } });
  const a2 = await prisma.audit.create({ data: { clientId: bad.id } });
  const worker = startWorker();
  await enqueueAudit(a1.id, good.id);
  await enqueueAudit(a2.id, bad.id);

  let r1, r2;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    [r1, r2] = await Promise.all([a1, a2].map((a) => prisma.audit.findUnique({ where: { id: a.id } })));
    if (['COMPLETED', 'FAILED'].includes(r1.status) && ['COMPLETED', 'FAILED'].includes(r2.status)) break;
  }

  check('P2 good audit COMPLETED at 100%', r1.status === 'COMPLETED' && r1.progress === 100, `${r1.status} ${r1.progress}%`);
  check('P2 failing audit marked FAILED with error', r2.status === 'FAILED' && !!r2.error && r2.progress < 100, `${r2.status} ${r2.progress}% "${(r2.error || '').slice(0, 60)}"`);
  const res = r1.resultJson || {};
  check('P3 signals saved (onPage/schema/technical/cwv/gsc/rankings)', ['onPage', 'schema', 'technical', 'cwv', 'gsc', 'rankings'].every((k) => res.signals?.[k]));
  check('P3 raw HTML not stored in signals', !JSON.stringify(res.signals || {}).includes('<html'));

  const { auditSchema } = require('../src/ai/claude');
  check('P4 stored analysis passes Zod schema', auditSchema.safeParse(res.analysis).success);
  check('P4 overallScore column matches analysis', r1.overallScore === res.analysis?.overall_score, String(r1.overallScore));

  const buf = r1.pdfPath && fs.existsSync(r1.pdfPath) ? fs.readFileSync(r1.pdfPath) : null;
  check('P5 PDF file exists and is a real PDF', !!buf && buf.slice(0, 5).toString() === '%PDF-' && buf.length > 5000, buf ? `${buf.length} bytes` : 'missing');
  check('P5 failing audit produced no PDF', !r2.pdfPath);

  await worker.close();
  await getQueue().close();
  await prisma.client.delete({ where: { id: bad.id } }); // cascades its audit
  await prisma.$disconnect();

  // USE_MOCKS=false behaviour, in a fresh process
  const sub = spawnSync(process.execPath, [__filename, 'nokey'], { env: { ...process.env, USE_MOCKS: 'false' }, encoding: 'utf8' });
  const line = sub.stdout.trim().split('\n').pop();
  let out = {};
  try { out = JSON.parse(line); } catch { /* reported below */ }
  check('USE_MOCKS=false, Claude without key fails clearly', /ANTHROPIC_API_KEY/.test(out.claude || ''), out.claude);
  check('USE_MOCKS=false, WhatsApp fails clearly (no silent mock)', /not configured/.test(out.whatsapp || ''), out.whatsapp);

  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
}

(process.argv[2] === 'nokey' ? nokey() : main()).catch((e) => { console.error(e); process.exit(1); });
