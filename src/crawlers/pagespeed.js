const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/pagespeed.mock');

async function getPageSpeed(url) {
  if (USE_MOCKS) return mockData;

  const api = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  api.searchParams.set('url', url);
  api.searchParams.set('strategy', 'mobile');
  for (const c of ['performance', 'seo', 'accessibility']) api.searchParams.append('category', c);
  if (process.env.PAGESPEED_API_KEY) api.searchParams.set('key', process.env.PAGESPEED_API_KEY);

  const res = await fetch(api, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`PageSpeed API failed: ${res.status}`);
  const data = await res.json();
  const lh = data.lighthouseResult;

  const wanted = ['largest-contentful-paint', 'cumulative-layout-shift', 'interaction-to-next-paint',
    'render-blocking-resources', 'unused-javascript'];
  const audits = {};
  for (const id of wanted) {
    const a = lh.audits[id];
    if (a) audits[id] = { score: a.score, displayValue: a.displayValue, description: a.title };
  }
  return {
    url,
    strategy: 'mobile',
    categories: Object.fromEntries(
      Object.entries(lh.categories).map(([k, v]) => [k, { score: v.score }])
    ),
    audits,
  };
}

module.exports = { getPageSpeed };
