const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/dataforseo.mock');

async function getRankings(url, keyword) {
  if (USE_MOCKS) return mockData;

  const { DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD } = process.env;
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set; set USE_MOCKS=true');
  }
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ keyword, location_code: 2356, language_code: 'en' }]),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`DataForSEO failed: ${res.status}`);
  const data = await res.json();

  // Match the client by hostname, not by raw string equality.
  const host = new URL(url).hostname.replace(/^www\./, '');
  const items = data.tasks?.[0]?.result?.[0]?.items || [];
  const mine = items.find((i) => i.type === 'organic' && i.domain?.replace(/^www\./, '') === host);
  return { ...data, client_rank_position: mine ? mine.rank_absolute : null, keyword_search_volume: null };
}

module.exports = { getRankings };
