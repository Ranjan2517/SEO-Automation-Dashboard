require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRaw`SELECT current_database() AS db, version() AS v`.then(r => { console.log('CONNECTED', r); }).catch(e => console.log('FAILED', e.message)).finally(() => p.$disconnect());
