const { z } = require('zod');
const Anthropic = require('@anthropic-ai/sdk');
const { USE_MOCKS } = require('../mocks');
const { SYSTEM_PROMPT, buildUserPrompt } = require('./prompt');

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const score = z.number().int().min(0).max(100);

const recommendation = z.object({
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.enum(['Technical', 'OnPage', 'Content', 'Schema', 'CWV']),
  finding: z.string().min(1),
  fix: z.string().min(1),
  estimated_impact: z.enum(['High', 'Medium', 'Low']),
  effort: z.enum(['Hours', 'Days', 'Weeks']),
  falsifiability_check: z.string().min(1),
});

const auditSchema = z.object({
  audit_version: z.string(),
  overall_score: score,
  score_breakdown: z.object({
    technical: score,
    on_page: score,
    content: score,
    core_web_vitals: score,
    schema: score,
  }),
  critical_issues: z.array(z.string()).max(5),
  important_issues: z.array(z.string()).max(8),
  quick_wins: z.array(z.string()).max(5),
  recommendations: z.array(recommendation),
  executive_summary: z.string().min(1),
});

// Models sometimes wrap JSON in fences or add a sentence; take the outermost object.
function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('response contains no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

function validate(text) {
  let data;
  try {
    data = parseJson(text);
  } catch (e) {
    return { ok: false, problem: `The response was not valid JSON: ${e.message}` };
  }
  const result = auditSchema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const problem = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  return { ok: false, problem: `The JSON did not match the required schema: ${problem}` };
}

async function callAnthropic(messages) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set; set USE_MOCKS=true to run without it');
  const client = new Anthropic();
  const res = await client.messages.create({ model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, messages });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// Hand-written audit used when USE_MOCKS=true, so the pipeline runs with no API credits.
function mockAudit(client) {
  return {
    audit_version: 'v1.0',
    overall_score: 64,
    score_breakdown: { technical: 70, on_page: 62, content: 58, core_web_vitals: 52, schema: 55 },
    critical_issues: [
      'Largest Contentful Paint is 4.2 s on mobile, well above the 2.5 s "good" threshold.',
      '3 index coverage errors reported in Google Search Console.',
      'No complete LocalBusiness/Dentist schema, so the clinic is missing from rich local results.',
    ],
    important_issues: [
      'Meta description missing or outside the 70-160 character range.',
      '420 KiB of unused JavaScript is being shipped to mobile users.',
      '2 render-blocking resources delay first paint.',
      'Target keywords sit at positions 6-11, just off the top results.',
    ],
    quick_wins: [
      'Add a unique meta description to the home page (30 minutes).',
      'Add alt text to images that have none (1 hour).',
      'Add a canonical link tag to the home page (15 minutes).',
    ],
    recommendations: [
      {
        priority: 'CRITICAL',
        category: 'CWV',
        finding: 'Mobile LCP is 4.2 s, caused by an unoptimised hero image and render-blocking resources.',
        fix: 'Serve the hero image as WebP at the displayed size with fetchpriority="high", defer the 2 blocking scripts, and remove unused JavaScript.',
        estimated_impact: 'High',
        effort: 'Days',
        falsifiability_check: 'Re-run PageSpeed Insights on mobile: LCP should be under 2.5 s and the performance score above 0.8 within 2 weeks.',
      },
      {
        priority: 'CRITICAL',
        category: 'Technical',
        finding: 'Search Console reports 3 index coverage errors.',
        fix: 'Open the Pages report, fix the affected URLs (redirects, 404s or noindex), then use Validate Fix.',
        estimated_impact: 'High',
        effort: 'Hours',
        falsifiability_check: 'Index coverage errors drop to 0 in Search Console within 4 weeks.',
      },
      {
        priority: 'HIGH',
        category: 'Schema',
        finding: `${client.businessType} schema is missing required fields (address, telephone, opening hours).`,
        fix: `Add a JSON-LD Dentist block with name, address in ${client.city}, telephone, openingHours and geo coordinates.`,
        estimated_impact: 'Medium',
        effort: 'Hours',
        falsifiability_check: 'Google Rich Results Test passes with no errors and the clinic shows in the local pack within 6 weeks.',
      },
      {
        priority: 'MEDIUM',
        category: 'OnPage',
        finding: 'Title and meta description do not target "dental clinic" plus the city.',
        fix: `Rewrite the title to "Dental Clinic in ${client.city} | <Brand>" and add a 150-character meta description.`,
        estimated_impact: 'Medium',
        effort: 'Hours',
        falsifiability_check: 'Click-through rate for "dental clinic in pune" rises above 5% in Search Console within 8 weeks.',
      },
    ],
    executive_summary:
      `${client.url} scores 64/100. Slow mobile loading and incomplete local schema are the biggest drags on visibility. Fixing page speed and index errors first should lift rankings that already sit near page one.`,
  };
}

// Returns the validated audit JSON. `callModel` is injectable so the retry can be tested offline.
async function analyseAudit(client, signals, { callModel = callAnthropic } = {}) {
  if (USE_MOCKS) {
    console.log('[claude] USE_MOCKS=true, returning hand-written mock audit');
    return auditSchema.parse(mockAudit(client));
  }

  const messages = [{ role: 'user', content: buildUserPrompt(client, signals) }];
  let text = await callModel(messages);
  let result = validate(text);

  if (!result.ok) {
    console.warn(`[claude] invalid response, retrying once: ${result.problem}`);
    messages.push(
      { role: 'assistant', content: text },
      { role: 'user', content: `${result.problem}\nReturn the corrected JSON only, with no other text.` }
    );
    text = await callModel(messages);
    result = validate(text);
    if (!result.ok) throw new Error(`Claude response invalid after retry: ${result.problem}`);
  }
  return result.data;
}

module.exports = { analyseAudit, auditSchema, validate, mockAudit, MODEL };
