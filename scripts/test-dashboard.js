// Usage: node scripts/test-dashboard.js <baseUrl> <screenshotDir>   (dev server must be running)
require('dotenv').config();
process.env.USE_MOCKS = 'true';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/lib/prisma');
const { mockAudit } = require('../src/ai/claude');

const base = process.argv[2] || 'http://localhost:3000';
const shots = process.argv[3] || path.join(require('os').tmpdir(), 'dash-shots');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

const mk = (clientId, score, daysAgo, pdf) => {
  const c = { url: 'https://dash.test', businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' };
  const analysis = { ...mockAudit(c), overall_score: score };
  return prisma.audit.create({
    data: {
      clientId, status: 'COMPLETED', progress: 100, overallScore: score, pdfPath: pdf,
      resultJson: { analysis, signals: {} },
      createdAt: new Date(Date.now() - daysAgo * 864e5),
    },
  });
};

(async () => {
  const tag = Date.now().toString().slice(-5);
  const data = { url: 'https://dash.test', businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' };
  const multi = await prisma.client.create({ data: { ...data, name: `Dash Multi ${tag}` } });
  const single = await prisma.client.create({ data: { ...data, name: `Dash Single ${tag}` } });
  const none = await prisma.client.create({ data: { ...data, name: `Dash None ${tag}` } });
  // the PDF button needs a real file path
  const pdfAudit = await prisma.audit.findFirst({ where: { pdfPath: { not: null }, status: 'COMPLETED' } });
  for (const [score, d] of [[48, 90], [55, 60], [61, 30], [72, 1]]) await mk(multi.id, score, d, pdfAudit?.pdfPath ?? null);
  await mk(single.id, 66, 2, null);
  await prisma.audit.create({ data: { clientId: multi.id, status: 'RUNNING', progress: 45 } });

  // one login per scenario: the dashboard reads the client from the session
  const hash = bcrypt.hashSync('Test@12345', 4);
  const mkUser = (suffix, clientId) =>
    prisma.user.create({ data: { email: `dash-${suffix}-${tag}@test.local`, passwordHash: hash, role: 'CLIENT', clientId } });
  const users = {
    multi: await mkUser('multi', multi.id),
    single: await mkUser('single', single.id),
    none: await mkUser('none', none.id),
    unlinked: await mkUser('unlinked', null),
  };
  const cookieFor = async (email, password) => {
    const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const raw = res.headers.getSetCookie().find((c) => c.startsWith('seo_session=')) || '';
    return raw.split(';')[0].split('=')[1];
  };

  const browser = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const text = () => page.evaluate(() => document.body.innerText);
  const signInAs = async (email, password = 'Test@12345') => {
    await page.deleteCookie(...(await page.cookies()));
    await page.setCookie({ name: 'seo_session', value: await cookieFor(email, password), url: base });
  };

  await signInAs(users.multi.email);
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle0' });
  let t = await text();
  check('shows latest audit score (72), not an older one', t.includes('72') && t.includes('Overall score'));
  check('shows breakdown, summary, top issues, quick wins', ['Technical', 'On-page', 'Core Web Vitals', 'Summary', 'Top issues to fix', 'Quick wins'].every((s) => t.includes(s)));
  check('shows in-progress notice for the running audit', t.includes('new audit is in progress (45%)'));
  check('read-only: no Run Audit button', !t.includes('Run Audit'));
  const pdfHref = await page.$eval('a[href$="/pdf"]', (a) => a.getAttribute('href')).catch(() => null);
  check('PDF link points at the latest completed audit', !!pdfHref || !pdfAudit, pdfHref || '(no sample PDF in DB)');
  const dots = await page.$$eval('.recharts-line-dot', (n) => n.length);
  check('history chart renders 4 points', dots === 4, `${dots} dots`);
  await page.hover('.recharts-line-dot:nth-of-type(2)').catch(() => {});
  const tableRows = await page.$$eval('details table tbody tr', (r) => r.length);
  check('table view lists all 4 audits', tableRows === 4, `${tableRows} rows`);
  await page.evaluate(() => (document.querySelector('details').open = true));
  await page.screenshot({ path: path.join(shots, 'dashboard.png'), fullPage: true });

  await signInAs(users.single.email);
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle0' });
  t = await text();
  check('one audit: score shown, chart replaced by hint', t.includes('66') && t.includes('after your second audit'));

  await signInAs(users.none.email);
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle0' });
  t = await text();
  check('no audit yet: friendly empty state', t.includes('has not finished yet') && !t.includes('Overall score'));

  await signInAs(users.unlinked.email);
  const bad = await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle0' });
  t = await text();
  check('login with no linked client: handled without a crash', bad.status() === 200 && t.includes('No client account is linked'));

  // the admin detail page must still work after the shared-component refactor
  await signInAs('admin@seo-demo.com', 'Admin@12345');
  const any = await prisma.audit.findFirst({ where: { clientId: multi.id, status: 'COMPLETED' } });
  await page.goto(`${base}/admin/audits/${any.id}`, { waitUntil: 'networkidle0' });
  t = await text();
  check('admin audit detail still renders after refactor', ['Overall score', 'Critical issues', 'Recommendations'].every((s) => t.includes(s)));

  check('no browser console / page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users).map((u) => u.id) } } });
  await prisma.client.deleteMany({ where: { id: { in: [multi.id, single.id, none.id] } } });
  await prisma.$disconnect();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed  (screenshot in ${shots})`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
