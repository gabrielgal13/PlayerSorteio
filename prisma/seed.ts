import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const streamers = [
  {
    username: 'Nakelas',
    password: '123',
    mascot: 'careca',
    displayName: 'Nakelas',
    twitchChannel: 'RNakano',
    kickChannel: 'nakelas',
    kickChatroomId: 66973867,
    pscBalance: 0,
  },
  {
    username: 'ShadowGanjaK',
    password: '123',
    mascot: 'dreads',
    displayName: 'ShadowGanjaK',
    twitchChannel: 'shadowsganjaking',
    pscBalance: 300,
  },
  {
    username: 'ddK',
    password: '123',
    mascot: 'careca',
    isAdmin: true,
    pscBalance: 0,
  },
];

async function main() {
  for (const s of streamers) {
    const passwordHash = await bcrypt.hash(s.password, 10);
    await prisma.streamer.upsert({
      where: { username: s.username },
      update: {},
      create: {
        username: s.username,
        passwordHash,
        mascot: s.mascot,
        displayName: s.displayName ?? null,
        twitchChannel: s.twitchChannel ?? null,
        kickChannel: s.kickChannel ?? null,
        kickChatroomId: s.kickChatroomId ?? null,
        isAdmin: s.isAdmin ?? false,
        pscBalance: s.pscBalance,
      },
    });
    console.log(`✓ ${s.username}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
