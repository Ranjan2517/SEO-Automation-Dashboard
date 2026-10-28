const UA = 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)';

async function get(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : '' };
  } catch (e) {
    return { ok: false, status: 0, text: '', error: e.message };
  }
}

function parseRobots(text) {
  const sitemaps = [];
  let disallowAll = false;
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    const [k, ...rest] = line.split(':');
    const key = k.toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') applies = value === '*';
    else if (key === 'disallow' && applies && value === '/') disallowAll = true;
    else if (key === 'sitemap' && value) sitemaps.push(value);
  }
  return { sitemaps, disallowAll };
}

// Step 6: https, robots.txt, sitemap.xml, status codes.
async function checkTechnical(page) {
  const origin = new URL(page.finalUrl).origin;

  const robotsRes = await get(`${origin}/robots.txt`);
  const robots = robotsRes.ok ? parseRobots(robotsRes.text) : { sitemaps: [], disallowAll: false };

  const sitemapUrl = robots.sitemaps[0] || `${origin}/sitemap.xml`;
  const sitemapRes = await get(sitemapUrl);
  const urlCount = sitemapRes.ok ? (sitemapRes.text.match(/<loc>/gi) || []).length : 0;

  return {
    https: new URL(page.finalUrl).protocol === 'https:',
    statusCode: page.status,
    redirected: page.redirected,
    responseMs: page.responseMs,
    robots: {
      exists: robotsRes.ok,
      status: robotsRes.status,
      blocksAllCrawlers: robots.disallowAll,
      sitemapsDeclared: robots.sitemaps,
    },
    sitemap: {
      url: sitemapUrl,
      exists: sitemapRes.ok,
      status: sitemapRes.status,
      urlCount,
    },
  };
}

module.exports = { checkTechnical };
