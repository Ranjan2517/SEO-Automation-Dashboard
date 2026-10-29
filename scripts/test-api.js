// Usage: node scripts/test-api.js [baseUrl]   (dev server must be running)
require('dotenv').config();
const { prisma } = require('../src/lib/prisma');
const { getQueue } = require('../src/queue/queue');
const { startWorker } = require('../src/queue/worker');

const base = process.argv[2] || 'http://localhost:3000';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};
let cookie = ''; // admin session, set in main()
const call = async (path, opts = {}) => {
  const t = Date.now();
  const res = await fetch(base + path, { ...opts, headers: { ...opts.headers, cookie } });
  const ct = res.headers.get('content-type') || '';
  return { res, ms: Date.now() - t, body: ct.includes('json') ? await res.json() : null };
};
const json = (b) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

(async () => {
  const client = await prisma.client.findFirst({ where: { url: 'https://example.com' } });
  const loginRes = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@seo-demo.com', password: 'Admin@12345' }),
  });
  cookie = (loginRes.headers.getSetCookie().find((c) => c.startsWith('seo_session=')) || '').split(';')[0];
  check('admin login for API tests (run scripts/seed.js first)', !!cookie);

  let r = await call('/api/audits', json({}));
  check('POST /api/audits without clientId -> 400', r.res.status === 400);
  r = await call('/api/audits', json({ clientId: 'nope' }));
  check('POST /api/audits unknown client -> 404', r.res.status === 404);

  r = await call('/api/audits', json({ clientId: client.id }));
  const id = r.body?.id;
  check('POST /api/audits -> 202 QUEUED, under 10s', r.res.status === 202 && r.body.status === 'QUEUED' && r.ms < 10000, `${r.res.status} in ${r.ms}ms`);
  const job = await getQueue().getJob(id);
  check('job exists in BullMQ queue with audit id', !!job && job.data.auditId === id);

  r = await call('/api/audits', json({ clientId: client.id }));
  check('second POST while in flight -> 409', r.res.status === 409);

  r = await call('/api/audits');
  check('GET /api/audits lists audit with client, no resultJson', r.res.status === 200 && r.body.audits.some((a) => a.id === id && a.client?.name) && !('resultJson' in r.body.audits[0]));
  r = await call('/api/audits?status=QUEUED');
  check('GET /api/audits?status= filters', r.body.audits.every((a) => a.status === 'QUEUED'));

  r = await call(`/api/audits/${id}`);
  check('GET /api/audits/:id shows status + progress', r.res.status === 200 && r.body.status === 'QUEUED' && r.body.progress === 0 && r.body.client?.url);
  r = await call('/api/audits/does-not-exist');
  check('GET /api/audits/:bad -> 404', r.res.status === 404);
  r = await call(`/api/audits/${id}/pdf`);
  check('GET pdf before ready -> 404', r.res.status === 404);

  r = await call('/api/cron/monthly');
  check('cron without secret -> 401', r.res.status === 401);
  r = await call('/api/cron/monthly', { headers: { 'x-cron-secret': 'wrong' } });
  check('cron with wrong secret -> 401', r.res.status === 401);

  // Let a worker process the queued audit; poll the HTTP API like the portal will.
  const worker = startWorker();
  const seen = new Set();
  let last;
  for (let i = 0; i < 90; i++) {
    await new Promise((x) => setTimeout(x, 1000));
    last = (await call(`/api/audits/${id}`)).body;
    seen.add(last.progress);
    if (['COMPLETED', 'FAILED'].includes(last.status)) break;
  }
  check('polling shows live progress then COMPLETED', last.status === 'COMPLETED' && seen.size > 3, `${seen.size} distinct progress values`);
  check('detail has resultJson, score, hasPdf, no server path leaked', !!last.resultJson?.analysis && last.overallScore != null && last.hasPdf && !('pdfPath' in last));

  const pdf = await fetch(`${base}/api/audits/${id}/pdf`, { headers: { cookie } });
  const buf = Buffer.from(await pdf.arrayBuffer());
  check('GET pdf -> 200 application/pdf', pdf.status === 200 && pdf.headers.get('content-type') === 'application/pdf' && buf.slice(0, 5).toString() === '%PDF-', `${buf.length} bytes`);

  r = await call('/api/cron/monthly', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
  check('cron with secret -> 200, enqueues active clients', r.res.status === 200 && r.body.queued >= 1 && r.body.failed.length === 0, JSON.stringify(r.body));
  const cronAgain = await call('/api/cron/monthly', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  check('cron again skips in-flight audits (Bearer auth also works)', cronAgain.res.status === 200 && cronAgain.body.skipped >= 1, JSON.stringify(cronAgain.body));

  // drain the cron-created audits so nothing is left running
  for (let i = 0; i < 120; i++) {
    const n = await prisma.audit.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } });
    if (!n) break;
    await new Promise((x) => setTimeout(x, 1000));
  }
  await worker.close();
  await getQueue().close();
  await prisma.$disconnect();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
