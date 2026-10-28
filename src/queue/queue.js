const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const QUEUE_NAME = 'seo-audit-jobs';

// BullMQ requires maxRetriesPerRequest: null. A rediss:// URL enables TLS (Upstash).
function createConnection() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not set');
  return new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
}

let queue;
function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: createConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return queue;
}

// The Audit row id doubles as the BullMQ job id, so a job can be looked up from the portal.
async function enqueueAudit(auditId, clientId) {
  return getQueue().add('audit', { auditId, clientId }, { jobId: auditId });
}

module.exports = { QUEUE_NAME, createConnection, getQueue, enqueueAudit };
