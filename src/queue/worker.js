require('dotenv').config();
const { Worker } = require('bullmq');
const { QUEUE_NAME, createConnection } = require('./queue');
const { prisma } = require('../lib/prisma');
const { crawlPage, analyseOnPage } = require('../crawlers/onpage');
const { getPageSpeed } = require('../crawlers/pagespeed');
const { getSearchConsole } = require('../crawlers/gsc');
const { validateSchema } = require('../crawlers/schema');
const { checkTechnical } = require('../crawlers/technical');
const { getRankings } = require('../crawlers/dataforseo');
const { analyseAudit } = require('../ai/claude');
const { generatePdf } = require('../reports/pdf');
const { sendWhatsApp, sendEmail } = require('../notifications/whatsapp');
const { STEP_NAMES, progressAfter } = require('../lib/steps');

// Each step is its own function. `ctx` carries the client and everything collected so far.
const steps = [
  { name: 'Fetch + Cheerio crawl', run: async (ctx) => { ctx.page = await crawlPage(ctx.client.url); } },
  { name: 'PageSpeed Insights', run: async (ctx) => { ctx.signals.cwv = await getPageSpeed(ctx.client.url); } },
  { name: 'Google Search Console', run: async (ctx) => { ctx.signals.gsc = await getSearchConsole(ctx.client.url); } },
  { name: 'Schema.org validation', run: async (ctx) => { ctx.signals.schema = validateSchema(ctx.page.html); } },
  { name: 'On-page analysis', run: async (ctx) => { ctx.signals.onPage = analyseOnPage(ctx.page); } },
  { name: 'robots.txt + sitemap.xml check', run: async (ctx) => { ctx.signals.technical = await checkTechnical(ctx.page); } },
  {
    name: 'DataForSEO rankings',
    run: async (ctx) => {
      const keyword = `${ctx.client.businessType} ${ctx.client.city}`.toLowerCase();
      ctx.signals.rankings = await getRankings(ctx.client.url, keyword);
    },
  },
  { name: 'Claude analysis', run: async (ctx) => { ctx.analysis = await analyseAudit(ctx.client, ctx.signals); } },
  {
    name: 'Save audit result',
    run: async (ctx) => {
      await prisma.audit.update({
        where: { id: ctx.auditId },
        data: { overallScore: ctx.analysis.overall_score, resultJson: { analysis: ctx.analysis, signals: ctx.signals } },
      });
    },
  },
  {
    name: 'Generate PDF report',
    run: async (ctx) => {
      const pdfPath = await generatePdf(ctx.auditId, ctx.client, { analysis: ctx.analysis });
      await prisma.audit.update({ where: { id: ctx.auditId }, data: { pdfPath } });
      ctx.pdfPath = pdfPath;
    },
  },
  {
    name: 'Send WhatsApp + email',
    run: async (ctx) => {
      await sendWhatsApp(ctx.client.id, ctx.pdfPath, ctx.analysis.overall_score);
      await sendEmail(ctx.client.id, ctx.pdfPath, ctx.analysis.overall_score);
    },
  },
];

const STEP_DELAY_MS = Number(process.env.AUDIT_STEP_DELAY_MS) || 0;

if (steps.length !== STEP_NAMES.length || steps.some((s, i) => s.name !== STEP_NAMES[i])) {
  throw new Error('worker steps are out of sync with src/lib/steps.js');
}

async function setProgress(job, auditId, progress, currentStep, status = 'RUNNING') {
  await job.updateProgress(progress);
  await prisma.audit.update({ where: { id: auditId }, data: { progress, currentStep, status } });
  console.log(`[audit ${auditId}] ${String(progress).padStart(3)}%  ${currentStep}`);
}

async function processAudit(job) {
  const { auditId } = job.data;
  const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { client: true } });
  const ctx = { auditId, client: audit.client, signals: {} };

  await setProgress(job, auditId, 0, 'Starting');
  for (let i = 0; i < steps.length; i++) {
    await steps[i].run(ctx);
    await setProgress(job, auditId, progressAfter(i), steps[i].name);
    // Optional pacing so mocked steps (which finish instantly) are watchable in a demo.
    if (STEP_DELAY_MS) await new Promise((r) => setTimeout(r, STEP_DELAY_MS));
  }

  await prisma.audit.update({ where: { id: auditId }, data: { status: 'COMPLETED' } });
  return { overallScore: ctx.analysis.overall_score };
}

function startWorker() {
  const worker = new Worker(QUEUE_NAME, processAudit, {
    connection: createConnection(),
    concurrency: 1,
    // Fewer idle Redis commands on the Upstash free tier.
    drainDelay: 30,
    stalledInterval: 120000,
  });

  worker.on('failed', async (job, err) => {
    console.error(`[audit ${job?.data?.auditId}] FAILED: ${err.message}`);
    if (job?.data?.auditId) {
      await prisma.audit
        .update({ where: { id: job.data.auditId }, data: { status: 'FAILED', error: err.message } })
        .catch((e) => console.error('could not mark audit FAILED:', e.message));
    }
  });
  worker.on('completed', (job) => console.log(`[audit ${job.data.auditId}] COMPLETED`));
  worker.on('error', (err) => console.error('worker error:', err.message));

  console.log(`Worker listening on queue "${QUEUE_NAME}" (USE_MOCKS=${process.env.USE_MOCKS})`);
  return worker;
}

if (require.main === module) startWorker();

module.exports = { processAudit, startWorker, steps };
