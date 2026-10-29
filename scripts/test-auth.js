// Usage: node scripts/test-auth.js <baseUrl>   (dev server must be running; run scripts/seed.js first)
require('dotenv').config();
const puppeteer = require('puppeteer');
const { SignJWT } = require('jose');
const { prisma } = require('../src/lib/prisma');

const base = process.argv[2] || 'http://localhost:3000';
const ADMIN = { email: 'admin@seo-demo.com', password: 'Admin@12345' };
const CLIENT = { email: 'client@seo-demo.com', password: 'Client@12345' };

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

// manual redirects so 307s can be asserted; optional session cookie
const req = (path, { cookie, method = 'GET', body, headers = {} } = {}) =>
  fetch(base + path, {
    method,
    redirect: 'manual',
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
const loc = (r) => r.headers.get('location') || '';

async function login(creds) {
  const res = await req('/api/auth/login', { method: 'POST', body: creds });
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('seo_session=')) || '';
  return { res, raw, cookie: raw.split(';')[0] };
}

(async () => {
  // ---- unauthenticated ----
  let r = await req('/admin/clients');
  check('anon /admin/clients -> redirect to /login?next=', r.status === 307 && /\/login\?next=%2Fadmin%2Fclients/.test(loc(r)), `${r.status} ${loc(r)}`);
  r = await req('/dashboard');
  check('anon /dashboard -> redirect to /login', r.status === 307 && loc(r).includes('/login'));
  for (const p of ['/api/audits', '/api/clients', '/api/audits/x', '/api/audits/x/pdf']) {
    r = await req(p);
    check(`anon GET ${p} -> 401`, r.status === 401);
  }
  r = await req('/api/audits', { method: 'POST', body: { clientId: 'x' } });
  check('anon POST /api/audits -> 401', r.status === 401);
  r = await req('/api/cron/monthly');
  check('cron stays reachable to its own secret check (401 from route, not redirect)', r.status === 401 && (await r.json()).error === 'Unauthorized');

  // ---- login ----
  const bad = await login({ email: ADMIN.email, password: 'wrong' });
  const ghost = await login({ email: 'nobody@nowhere.com', password: 'wrong' });
  const badBody = await req('/api/auth/login', { method: 'POST', body: { email: 'x' } });
  check('wrong password -> 401, no cookie', bad.res.status === 401 && !bad.raw);
  check('unknown email -> identical 401 message (no user enumeration)', ghost.res.status === 401 && (await ghost.res.json()).error === (await bad.res.json()).error);
  check('malformed body -> 400', badBody.status === 400);

  const admin = await login(ADMIN);
  const adminBody = await admin.res.json();
  check('admin login -> 200 role ADMIN', admin.res.status === 200 && adminBody.role === 'ADMIN' && adminBody.home === '/admin/clients');
  check('session cookie is HttpOnly + SameSite=Lax', /httponly/i.test(admin.raw) && /samesite=lax/i.test(admin.raw), admin.raw.split(';').slice(1).join(';').trim());
  const client = await login(CLIENT);
  check('client login -> role CLIENT', (await client.res.json()).role === 'CLIENT');

  // ---- admin ----
  r = await req('/admin/clients', { cookie: admin.cookie });
  check('admin can open /admin/clients', r.status === 200);
  r = await req('/dashboard', { cookie: admin.cookie });
  check('admin on /dashboard -> redirected to /admin/clients', r.status === 307 && loc(r).endsWith('/admin/clients'));
  r = await req('/api/audits', { cookie: admin.cookie });
  check('admin GET /api/audits -> 200', r.status === 200);

  // ---- client ----
  r = await req('/dashboard', { cookie: client.cookie });
  check('client can open /dashboard', r.status === 200);
  r = await req('/admin/clients', { cookie: client.cookie });
  check('client on /admin -> redirected to /dashboard', r.status === 307 && loc(r).endsWith('/dashboard'));
  r = await req('/admin/audits', { cookie: client.cookie });
  check('client on /admin/audits -> redirected', r.status === 307);
  for (const [m, p, b] of [['GET', '/api/audits'], ['GET', '/api/clients'], ['POST', '/api/audits', { clientId: 'x' }], ['POST', '/api/clients', { name: 'x' }]]) {
    r = await req(p, { cookie: client.cookie, method: m, body: b });
    check(`client ${m} ${p} -> 403`, r.status === 403);
  }

  // ---- ownership ----
  const own = await prisma.client.findFirst({ where: { users: { some: { email: CLIENT.email } } } });
  const ownAudit = await prisma.audit.findFirst({ where: { clientId: own.id, status: 'COMPLETED', pdfPath: { not: null } } });
  const other = await prisma.client.create({ data: { name: 'Other Co ' + Date.now(), url: 'https://other.test', businessType: 'Dental Clinic', city: 'Pune', state: 'MH' } });
  const otherAudit = await prisma.audit.create({ data: { clientId: other.id, status: 'COMPLETED', progress: 100, overallScore: 33, pdfPath: ownAudit.pdfPath, resultJson: ownAudit.resultJson } });
  r = await req(`/api/audits/${ownAudit.id}`, { cookie: client.cookie });
  check('client reads their own audit -> 200', r.status === 200);
  r = await req(`/api/audits/${ownAudit.id}/pdf`, { cookie: client.cookie });
  check('client downloads their own PDF -> 200', r.status === 200 && r.headers.get('content-type') === 'application/pdf');
  r = await req(`/api/audits/${otherAudit.id}`, { cookie: client.cookie });
  check("client cannot read another client's audit -> 404", r.status === 404);
  r = await req(`/api/audits/${otherAudit.id}/pdf`, { cookie: client.cookie });
  check("client cannot download another client's PDF -> 404", r.status === 404);
  r = await req(`/api/audits/${otherAudit.id}`, { cookie: admin.cookie });
  check('admin can read any audit -> 200', r.status === 200);
  r = await req(`/dashboard?clientId=${other.id}`, { cookie: client.cookie });
  const html = await r.text();
  check('dashboard ignores ?clientId=, shows only own data', r.status === 200 && !html.includes(other.name) && html.includes('Demo Dental Clinic'));

  // ---- forged / tampered tokens ----
  const tampered = admin.cookie.slice(0, -3) + (admin.cookie.endsWith('AAA') ? 'BBB' : 'AAA');
  r = await req('/api/clients', { cookie: tampered });
  check('tampered token -> 401', r.status === 401);
  const forged = await new SignJWT({ email: 'evil@x.com', role: 'ADMIN', clientId: null })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('x').setExpirationTime('1h').sign(new TextEncoder().encode('a-different-secret-entirely-0000'));
  r = await req('/api/clients', { cookie: 'seo_session=' + forged });
  check('token signed with another secret (role=ADMIN) -> 401', r.status === 401);
  const expired = await new SignJWT({ email: ADMIN.email, role: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('x').setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  r = await req('/api/clients', { cookie: 'seo_session=' + expired });
  check('expired (correctly signed) token -> 401', r.status === 401);
  const none = await new SignJWT({ role: 'ADMIN' }).setProtectedHeader({ alg: 'none' }).setSubject('x').sign(new TextEncoder().encode('x')).catch(() => null);
  const algNone = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from('{"role":"ADMIN","sub":"x"}').toString('base64url') + '.';
  r = await req('/api/clients', { cookie: 'seo_session=' + algNone });
  check('alg=none token -> 401', r.status === 401 && none === null);

  // ---- real browser ----
  const browser = await puppeteer.launch({ args: ['--no-sandbox'], defaultViewport: { width: 1100, height: 800 } });
  const page = await browser.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle0' });
  check('/ sends signed-out visitor to /login', page.url().includes('/login'), page.url());

  const fill = async (email, password) => {
    // clear with real keystrokes: the inputs are React-controlled, so assigning .value is ignored
    for (const sel of ['#email', '#password']) {
      await page.click(sel, { clickCount: 3 });
      await page.keyboard.press('Backspace');
    }
    await page.type('#email', email);
    await page.type('#password', password);
    await page.click('button[type=submit]');
  };
  await fill(ADMIN.email, 'wrong-password');
  await page.waitForSelector('[role=alert]');
  check('browser: wrong password shows an error, stays on /login', (await page.$eval('[role=alert]', (e) => e.innerText)).includes('Invalid') && page.url().includes('/login'));

  await fill(ADMIN.email, ADMIN.password);
  await page.waitForFunction(() => location.pathname === '/admin/clients', { timeout: 15000 });
  check('browser: admin lands on /admin/clients', true);
  check('browser: header shows signed-in email', (await page.evaluate(() => document.body.innerText)).includes(ADMIN.email));

  await page.goto(base + '/login', { waitUntil: 'networkidle0' });
  check('browser: signed-in user visiting /login is sent home', page.url().endsWith('/admin/clients'));

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Sign out')).click());
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 15000 });
  await page.goto(base + '/admin/audits', { waitUntil: 'networkidle0' });
  check('browser: after sign out, /admin/audits redirects to /login', page.url().includes('/login?next=%2Fadmin%2Faudits'), page.url());

  await fill(ADMIN.email, ADMIN.password);
  await page.waitForFunction(() => location.pathname === '/admin/audits', { timeout: 15000 });
  check('browser: ?next= is honoured after login', true);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Sign out')).click());
  await page.waitForFunction(() => location.pathname === '/login');

  await page.goto(base + '/login?next=//evil.example.com', { waitUntil: 'networkidle0' });
  await fill(CLIENT.email, CLIENT.password);
  await page.waitForFunction(() => location.pathname === '/dashboard', { timeout: 15000 });
  check('browser: open-redirect ?next=//evil is ignored; client lands on /dashboard', new URL(page.url()).host === new URL(base).host);
  check('browser: client dashboard shows their report', (await page.evaluate(() => document.body.innerText)).includes('Overall score'));
  await browser.close();

  await prisma.client.delete({ where: { id: other.id } });
  await prisma.$disconnect();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
