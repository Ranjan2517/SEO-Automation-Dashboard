// Single source of truth for pipeline step names. The worker asserts its steps match this list,
// and the admin portal uses it to draw the step list from the audit's progress value.
const STEP_NAMES = [
  'Fetch + Cheerio crawl',
  'PageSpeed Insights',
  'Google Search Console',
  'Schema.org validation',
  'On-page analysis',
  'robots.txt + sitemap.xml check',
  'DataForSEO rankings',
  'Claude analysis',
  'Save audit result',
  'Generate PDF report',
  'Send WhatsApp + email',
];

// Progress value the worker writes once step `index` has finished.
const progressAfter = (index) => Math.round(((index + 1) / STEP_NAMES.length) * 100);

module.exports = { STEP_NAMES, progressAfter };
