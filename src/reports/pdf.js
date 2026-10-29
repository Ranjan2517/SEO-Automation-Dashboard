const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const scoreColor = (n) => (n >= 80 ? '#16a34a' : n >= 60 ? '#d97706' : '#dc2626');
const BREAKDOWN_LABELS = {
  technical: 'Technical',
  on_page: 'On-page',
  content: 'Content',
  core_web_vitals: 'Core Web Vitals',
  schema: 'Schema',
};

function reportsDir() {
  return process.env.REPORTS_DIR || path.join(os.tmpdir(), 'reports');
}

function renderHtml(client, audit) {
  const a = audit.analysis;
  const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">None.</p>');

  const bars = Object.entries(a.score_breakdown)
    .map(
      ([k, v]) => `<div class="bar-row"><span>${BREAKDOWN_LABELS[k] || esc(k)}</span>
        <div class="bar"><div style="width:${v}%;background:${scoreColor(v)}"></div></div><b>${v}</b></div>`
    )
    .join('');

  const rows = a.recommendations
    .map(
      (r) => `<tr><td><span class="pill p-${esc(r.priority)}">${esc(r.priority)}</span><br><small>${esc(r.category)}</small></td>
        <td>${esc(r.finding)}</td><td>${esc(r.fix)}</td>
        <td>${esc(r.estimated_impact)}<br><small>${esc(r.effort)}</small></td><td>${esc(r.falsifiability_check)}</td></tr>`
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:32px;font-size:12px}
    h1{margin:0;font-size:22px} h2{font-size:15px;border-bottom:2px solid #0f9488;padding-bottom:4px;margin-top:24px}
    .muted,small{color:#6b7280}
    .head{display:flex;justify-content:space-between;align-items:center;background:#0f9488;color:#fff;padding:20px;border-radius:8px}
    .score{font-size:44px;font-weight:700;background:#fff;color:${scoreColor(a.overall_score)};border-radius:50%;width:96px;height:96px;display:flex;align-items:center;justify-content:center}
    .bar-row{display:flex;align-items:center;gap:10px;margin:6px 0}.bar-row span{width:120px}.bar-row b{width:30px;text-align:right}
    .bar{flex:1;height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden}.bar div{height:100%}
    table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#0f9488;color:#fff;text-align:left}
    th,td{border:1px solid #e5e7eb;padding:6px;vertical-align:top} tr{page-break-inside:avoid}
    .pill{padding:2px 6px;border-radius:4px;color:#fff;font-size:10px;font-weight:700;background:#6b7280}
    .p-CRITICAL{background:#dc2626}.p-HIGH{background:#ea580c}.p-MEDIUM{background:#d97706}.p-LOW{background:#16a34a}
    .summary{background:#f0fdfa;border-left:4px solid #0f9488;padding:10px;font-size:13px}
  </style></head><body>
    <div class="head"><div><h1>SEO Audit Report</h1><div>${esc(client.name)} &middot; ${esc(client.url)}</div>
      <div>${esc(client.businessType)}, ${esc(client.city)}, ${esc(client.state)} &middot; ${new Date().toLocaleDateString('en-IN')}</div></div>
      <div class="score">${a.overall_score}</div></div>
    <h2>Executive summary</h2><div class="summary">${esc(a.executive_summary)}</div>
    <h2>Score breakdown</h2>${bars}
    <h2>Critical issues</h2>${list(a.critical_issues)}
    <h2>Important issues</h2>${list(a.important_issues)}
    <h2>Quick wins</h2>${list(a.quick_wins)}
    <h2>Recommendations</h2>
    <table><tr><th>Priority</th><th>Finding</th><th>Fix</th><th>Impact / Effort</th><th>How we verify</th></tr>${rows}</table>
  </body></html>`;
}

// Renders the audit to <reportsDir>/audit-<id>.pdf and returns the file path.
async function generatePdf(auditId, client, audit) {
  const dir = reportsDir();
  fs.mkdirSync(dir, { recursive: true });
  const pdfPath = path.join(dir, `audit-${auditId}.pdf`);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(renderHtml(client, audit), { waitUntil: 'load' });
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  } finally {
    await browser.close();
  }
  return pdfPath;
}

module.exports = { generatePdf, renderHtml, reportsDir };
