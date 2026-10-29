// Creates (or resets) a CLIENT login linked to an existing client.
// Usage: node scripts/create-client-user.js <email> <password> <client name or id>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/lib/prisma');

(async () => {
  const [email, password, ...rest] = process.argv.slice(2);
  const who = rest.join(' ').trim();
  if (!email || !password || !who) {
    console.error('Usage: node scripts/create-client-user.js <email> <password> <client name or id>');
    process.exit(1);
  }
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const matches = await prisma.client.findMany({
    where: { OR: [{ id: who }, { name: { contains: who, mode: 'insensitive' } }] },
  });
  if (matches.length === 0) throw new Error(`No client matches "${who}"`);
  if (matches.length > 1) throw new Error(`"${who}" matches several clients: ${matches.map((c) => `${c.name} (${c.id})`).join(', ')}. Use the id.`);
  const client = matches[0];

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing && existing.role !== 'CLIENT') throw new Error(`${email} is an ${existing.role} account; refusing to change it`);

  const passwordHash = bcrypt.hashSync(password, 10);
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, clientId: client.id },
    create: { email: email.toLowerCase(), passwordHash, role: 'CLIENT', clientId: client.id },
  });
  console.log(`${existing ? 'Updated' : 'Created'} CLIENT login ${email.toLowerCase()} -> ${client.name} (${client.url})`);
})()
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
