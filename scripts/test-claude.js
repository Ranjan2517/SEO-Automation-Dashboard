// Offline test of validation + retry. Forces real-call mode but injects a fake model.
require('dotenv').config();
process.env.USE_MOCKS = 'false';

const { analyseAudit, mockAudit } = require('../src/ai/claude');
const { buildUserPrompt } = require('../src/ai/prompt');

const client = { url: 'https://example-dental-clinic.com', businessType: 'Dental Clinic', city: 'Pune', state: 'Maharashtra' };
const signals = { onPage: { title: 'x' }, technical: { https: true }, cwv: {}, schema: {}, gsc: {}, rankings: {} };

(async () => {
  const prompt = buildUserPrompt(client, signals);
  console.log('prompt ok, unreplaced variables: none, length', prompt.length);

  const bad = { ...mockAudit(client), overall_score: 150, critical_issues: ['1', '2', '3', '4', '5', '6'] };
  const replies = [JSON.stringify(bad), '```json\n' + JSON.stringify(mockAudit(client)) + '\n```'];
  let calls = 0;
  const callModel = async (messages) => {
    calls++;
    console.log(`fake model call #${calls}, messages: ${messages.length}`);
    if (calls === 2) console.log('retry feedback sent to model:\n  ' + messages[messages.length - 1].content.split('\n')[0].slice(0, 220));
    return replies[calls - 1];
  };

  const result = await analyseAudit(client, signals, { callModel });
  console.log('RESULT: valid after', calls, 'calls, overall_score =', result.overall_score);

  // Two bad answers in a row must throw.
  try {
    await analyseAudit(client, signals, { callModel: async () => 'not json at all' });
    console.log('ERROR: should have thrown');
  } catch (e) {
    console.log('two bad responses throws as expected:', e.message.slice(0, 90));
  }
})();
