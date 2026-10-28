const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/gsc.mock');

async function getSearchConsole(url) {
  if (USE_MOCKS) return mockData;
  // Real Search Console needs OAuth + a verified property, which this build does not implement.
  throw new Error(`Google Search Console is not configured for ${url}; set USE_MOCKS=true`);
}

module.exports = { getSearchConsole };
