const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)';

// Step 1: fetch the page and parse it. Not mocked, runs against the real site.
async function crawlPage(url) {
  const started = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  return {
    url,
    finalUrl: res.url,
    status: res.status,
    redirected: res.redirected,
    responseMs: Date.now() - started,
    html,
  };
}

// Step 5: on-page signals from the crawled HTML.
function analyseOnPage(page) {
  const $ = cheerio.load(page.html);
  const base = new URL(page.finalUrl);

  const imgs = $('img');
  const withAlt = imgs.filter((_, el) => ($(el).attr('alt') || '').trim() !== '').length;

  let internal = 0;
  let external = 0;
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
    try {
      new URL(href, base).hostname === base.hostname ? internal++ : external++;
    } catch {
      /* malformed href, ignore */
    }
  });

  const text = $('body').clone().find('script,style,noscript').remove().end().text();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    og[$(el).attr('property')] = $(el).attr('content') || '';
  });

  const title = $('title').first().text().trim();
  const metaDescription = ($('meta[name="description"]').attr('content') || '').trim();

  return {
    title,
    titleLength: title.length,
    metaDescription,
    metaDescriptionLength: metaDescription.length,
    h1Count: $('h1').length,
    h1Text: $('h1').first().text().trim(),
    h2Count: $('h2').length,
    wordCount,
    images: {
      total: imgs.length,
      withAlt,
      altCoveragePct: imgs.length ? Math.round((withAlt / imgs.length) * 100) : 100,
    },
    canonical: $('link[rel="canonical"]').attr('href') || null,
    links: { internal, external },
    openGraph: og,
    hasViewportMeta: $('meta[name="viewport"]').length > 0,
    lang: $('html').attr('lang') || null,
  };
}

module.exports = { crawlPage, analyseOnPage };
