// Usage: node scripts/test-crawlers.js [url ...]
require('dotenv').config();
const { crawlPage, analyseOnPage } = require('../src/crawlers/onpage');
const { validateSchema } = require('../src/crawlers/schema');
const { checkTechnical } = require('../src/crawlers/technical');

const urls = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['https://www.python.org', 'https://www.mozilla.org', 'https://www.colgate.com'];

(async () => {
  for (const url of urls) {
    console.log('\n=====', url);
    try {
      const page = await crawlPage(url);
      const onPage = analyseOnPage(page);
      const schema = validateSchema(page.html);
      const technical = await checkTechnical(page);
      const out = { onPage, schema, technical };
      JSON.parse(JSON.stringify(out)); // must be plain serialisable JSON
      console.log(JSON.stringify(out, null, 1).slice(0, 1800));
    } catch (e) {
      console.log('FAILED', e.message);
    }
  }
})();
