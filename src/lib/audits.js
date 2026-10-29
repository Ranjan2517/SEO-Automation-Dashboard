const { prisma } = require('./prisma');
const { enqueueAudit, getQueue } = require('../queue/queue');

// An audit stuck QUEUED/RUNNING (worker offline or crashed) must not block the client forever.
const STALE_MS = 30 * 60 * 1000;

async function expireStaleAudits(clientId) {
  const stale = await prisma.audit.findMany({
    where: { clientId, status: { in: ['QUEUED', 'RUNNING'] }, createdAt: { lt: new Date(Date.now() - STALE_MS) } },
    select: { id: true },
  });
  if (!stale.length) return;
  await prisma.audit.updateMany({
    where: { id: { in: stale.map((a) => a.id) } },
    data: { status: 'FAILED', error: 'Timed out waiting for the worker' },
  });
  // Drop the orphaned jobs too so a late worker does not resurrect them.
  await Promise.all(stale.map((a) => getQueue().getJob(a.id).then((j) => j?.remove()).catch(() => {})));
}

// Creates a QUEUED Audit row and adds the BullMQ job. If Redis is unreachable the row is
// marked FAILED so it never sits in QUEUED forever. Returns null when an audit is already in flight.
async function createAndEnqueueAudit(clientId) {
  await expireStaleAudits(clientId);
  const inFlight = await prisma.audit.findFirst({
    where: { clientId, status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true },
  });
  if (inFlight) return { audit: null, existingId: inFlight.id };

  const audit = await prisma.audit.create({ data: { clientId, status: 'QUEUED' } });
  try {
    await enqueueAudit(audit.id, clientId);
  } catch (err) {
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED', error: `Could not enqueue: ${err.message}` } });
    throw err;
  }
  return { audit };
}

module.exports = { createAndEnqueueAudit };
