const cheerio = require('cheerio');

const LOCAL_TYPES = ['LocalBusiness', 'Dentist', 'Organization', 'MedicalBusiness', 'MedicalClinic', 'Physician'];
const REQUIRED_FIELDS = ['name', 'address', 'telephone', 'url'];

// Flatten @graph and arrays into a list of schema nodes.
function collectNodes(json) {
  if (Array.isArray(json)) return json.flatMap(collectNodes);
  if (json && typeof json === 'object') {
    return [json, ...(json['@graph'] ? collectNodes(json['@graph']) : [])];
  }
  return [];
}

// Step 4: read every ld+json block, parse it, and check the business entity.
function validateSchema(html) {
  const $ = cheerio.load(html);
  const blocks = [];
  const parseErrors = [];

  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      blocks.push(JSON.parse($(el).contents().text()));
    } catch (e) {
      parseErrors.push({ block: i, error: e.message });
    }
  });

  const nodes = blocks.flatMap(collectNodes);
  const types = nodes.flatMap((n) => [].concat(n['@type'] || []));
  const business = nodes.find((n) => [].concat(n['@type'] || []).some((t) => LOCAL_TYPES.includes(t)));

  return {
    blockCount: blocks.length,
    parseErrors,
    types: [...new Set(types)],
    hasBusinessSchema: Boolean(business),
    businessType: business ? [].concat(business['@type']).find((t) => LOCAL_TYPES.includes(t)) : null,
    missingFields: business ? REQUIRED_FIELDS.filter((f) => !business[f]) : REQUIRED_FIELDS,
  };
}

module.exports = { validateSchema };
