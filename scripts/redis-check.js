require('dotenv').config();
const IORedis = require('ioredis');
const r = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, tls: {} });
r.set('healthcheck', 'ok', 'EX', 30).then(() => r.get('healthcheck')).then(v => console.log('REDIS CONNECTED, read back:', v)).catch(e => console.log('FAILED', e.message)).finally(() => r.quit());
