// Usage: node scripts/test-portal.js <baseUrl> <screenshotDir>   (dev server must be running)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { prisma } = require('../src/lib/prisma');
const { getQueue } = require('../src/queue/queue');
const { startWorker } = require('../src/queue/worker');

const base = process.argv[2] || 'http://localhost:3000';
const shots = process.argv[3] || path.join(require('os').tmpdir(), 'portal-shots');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const name = 'Portal Test Clinic ' + Date.now().toString().slice(-5);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The 400 (bad URL) and 404 (unknown audit) are triggered on purpose by this test.
  page.on('console', (m) => m.type() === 'error' && !/status of (400|404)/.test(m.text()) && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true });

  // sign in as the seeded admin; the landing page then redirects into the portal
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  await page.type('#email', 'admin@seo-demo.com');
  await page.type('#password', 'Admin@12345');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => location.pathname === '/admin/clients', { timeout: 15000 });
  check('login lands on /admin/clients', true, page.url());

  // the add-client form is collapsed behind the "Add client" button
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Add client')).click());
  await page.waitForSelector('#name');

  // add client: invalid URL is rejected with a message
  await page.type('#name', name);
  await page.type('#url', 'not a url');
  await page.type('#businessType', 'Dental Clinic');
  await page.type('#city', 'Pune');
  await page.type('#state', 'Maharashtra');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => document.body.innerText.includes('valid website URL'), { timeout: 10000 });
  check('invalid URL shows validation error', true);

  // fix URL and submit
  await page.click('#url', { clickCount: 3 });
  await page.type('#url', 'example.org');
  await page.click('button[type=submit]');
  // wait for the table row itself (the "was added" notice shows before the list refreshes)
  await page.waitForFunction((n) => [...document.querySelectorAll('tr')].some((r) => r.innerText.includes(n)), { timeout: 15000 }, name);
  check('new client appears in the list (URL normalised)', (await page.content()).includes('href="https://example.org"'));
  await shot('1-clients');

  // click Run Audit on that client's row
  const worker = startWorker();
  await page.evaluate((n) => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes(n));
    [...row.querySelectorAll('button')].find((b) => b.innerText.includes('Run Audit')).click();
  }, name);
  await page.waitForFunction(() => /\/admin\/audits\/[^/]+$/.test(location.pathname), { timeout: 15000 });
  const auditId = page.url().split('/').pop();
  check('Run Audit navigates to the audit page', !!auditId, auditId);

  // watch live progress
  const seen = new Set();
  let shotTaken = false;
  for (let i = 0; i < 90; i++) {
    // the page may still be navigating (first compile of the audit page), so tolerate that
    const state = await page
      .evaluate(() => {
        const bar = document.querySelector('[role=progressbar]');
        return { now: bar ? bar.getAttribute('aria-valuenow') : null, done: document.body.innerText.includes('Download PDF') };
      })
      .catch(() => ({ now: null, done: false }));
    if (state.now != null) seen.add(state.now);
    if (!shotTaken && Number(state.now) >= 40) { await shot('2-progress'); shotTaken = true; }
    if (state.done) break;
    await sleep(700);
  }
  const progressValues = [...seen].map(Number).sort((a, b) => a - b);
  check('progress bar updated live without reload', seen.size >= 4, progressValues.join(','));

  await page.waitForFunction(() => document.body.innerText.includes('Download PDF'), { timeout: 30000 });
  const text = await page.evaluate(() => document.body.innerText);
  check('finished page shows score cards, issues, recommendations', ['Overall score', 'Critical issues', 'Quick wins', 'Recommendations', 'Executive summary'].every((t) => text.includes(t)));
  const href = await page.$eval('a[href$="/pdf"]', (a) => a.getAttribute('href'));
  const cookies = await page.cookies();
  const pdf = await fetch(base + href, { headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } });
  check('PDF button link serves a PDF', pdf.status === 200 && pdf.headers.get('content-type') === 'application/pdf', href);
  await shot('3-complete');

  // audits list
  await page.goto(base + '/admin/audits', { waitUntil: 'networkidle0' });
  const listText = await page.evaluate(() => document.body.innerText);
  check('audits list shows client with COMPLETED badge', listText.includes(name) && listText.includes('COMPLETED'));
  await shot('4-audits');

  // unknown audit
  const missing = await page.goto(base + '/admin/audits/nope', { waitUntil: 'networkidle0' });
  check('unknown audit id -> 404 page', missing.status() === 404);

  check('no browser console / page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  await worker.close();
  await getQueue().close();
  await prisma.client.deleteMany({ where: { name } });
  await prisma.$disconnect();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed  (screenshots in ${shots})`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
