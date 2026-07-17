import { prisma } from './prisma';

// ─── Rank da Comunidade (só streamers) ───────────────────────────────────────
// Cada ação de pontos grava um RankEvent (auditoria) e incrementa o cache
// Streamer.rankPoints. Rank atual = maior tier cujo `points` <= rankPoints.

export const RANK_TIERS = [
  { name: 'Bronze', points: 0 },
  { name: 'Prata 4', points: 1 },
  { name: 'Prata 3', points: 300 },
  { name: 'Prata 2', points: 700 },
  { name: 'Prata 1', points: 1200 },
  { name: 'Prata', points: 1800 },
  { name: 'Ouro 4', points: 2600 },
  { name: 'Ouro 3', points: 3600 },
  { name: 'Ouro 2', points: 4800 },
  { name: 'Ouro 1', points: 6200 },
  { name: 'Ouro', points: 7800 },
  { name: 'Diamante 4', points: 9800 },
  { name: 'Diamante 3', points: 12200 },
  { name: 'Diamante 2', points: 15000 },
  { name: 'Diamante 1', points: 18200 },
  { name: 'Diamante', points: 22000 },
  { name: 'Lendário', points: 27000 },
] as const;

export const RANK_POINTS = {
  sorteio: 50,
  jogoConcluido: 100,
  streakBonus: 50,
} as const;

// Anti-abuso — ajuste estes valores se precisar rebalancear a economia de pontos.
const RAFFLE_COOLDOWN_MS = 10 * 60 * 1000; // mínimo entre sorteios contados pro rank
const MAX_GAME_POINTS_PER_DAY = 3;         // máx. de "jogo concluído" pontuando por dia
const STREAK_MILESTONE = 7;                // bônus a cada N dias ativos seguidos

export interface RankStatus {
  points: number;
  rank: { name: string; pointsRequired: number };
  nextRank: { name: string; pointsRequired: number } | null;
  pointsToNext: number | null;
  streakCount: number;
}

export function getRankForPoints(points: number) {
  let current: (typeof RANK_TIERS)[number] = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (points >= tier.points) current = tier;
    else break;
  }
  const idx = RANK_TIERS.indexOf(current);
  const next = idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
  return { current, next };
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Streak de dias ativos — idempotente dentro do mesmo dia UTC (chamar várias
// vezes no mesmo dia não infla o streak nem reaplica o bônus).
async function computeStreakUpdate(streamerId: string, now: Date) {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { rankStreakCount: true, rankLastActiveDate: true },
  });
  if (!streamer) return null;

  const today = dateKey(now);
  const lastActive = streamer.rankLastActiveDate ? dateKey(streamer.rankLastActiveDate) : null;
  if (lastActive === today) return { streakCount: streamer.rankStreakCount, bonusPoints: 0, changed: false as const };

  const yesterday = dateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const streakCount = lastActive === yesterday ? streamer.rankStreakCount + 1 : 1;
  const bonusPoints = streakCount % STREAK_MILESTONE === 0 ? RANK_POINTS.streakBonus : 0;

  return { streakCount, bonusPoints, changed: true as const, lastActiveDate: now };
}

// POST /api/streamer/history chama isso após criar o RaffleHistory.
export async function recordRaffleCompleted(streamerId: string): Promise<{ awarded: boolean; points: number }> {
  const streamer = await prisma.streamer.findUnique({ where: { id: streamerId }, select: { rankLastRaffleAt: true } });
  if (!streamer) return { awarded: false, points: 0 };

  const now = new Date();
  if (streamer.rankLastRaffleAt && now.getTime() - streamer.rankLastRaffleAt.getTime() < RAFFLE_COOLDOWN_MS) {
    return { awarded: false, points: 0 };
  }

  const streak = await computeStreakUpdate(streamerId, now);
  const totalPoints = RANK_POINTS.sorteio + (streak?.bonusPoints ?? 0);

  await prisma.$transaction([
    prisma.rankEvent.create({ data: { streamerId, type: 'sorteio', points: RANK_POINTS.sorteio } }),
    ...(streak?.bonusPoints ? [prisma.rankEvent.create({ data: { streamerId, type: 'streak_bonus', points: streak.bonusPoints } })] : []),
    prisma.streamer.update({
      where: { id: streamerId },
      data: {
        rankPoints: { increment: totalPoints },
        rankLastRaffleAt: now,
        ...(streak?.changed ? { rankStreakCount: streak.streakCount, rankLastActiveDate: streak.lastActiveDate } : {}),
      },
    }),
  ]);

  return { awarded: true, points: totalPoints };
}

// Chamado quando um mini-game (Chat Wars / Pool Wars) termina com interação real
// (validação de "mensagem no chat" fica a cargo de quem chama — ver componentes dos jogos).
export async function recordGameCompleted(streamerId: string): Promise<{ awarded: boolean; points: number; reason?: string }> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const countToday = await prisma.rankEvent.count({
    where: { streamerId, type: 'jogo_concluido', createdAt: { gte: todayStart } },
  });
  if (countToday >= MAX_GAME_POINTS_PER_DAY) return { awarded: false, points: 0, reason: 'daily_limit' };

  const streak = await computeStreakUpdate(streamerId, now);
  const totalPoints = RANK_POINTS.jogoConcluido + (streak?.bonusPoints ?? 0);

  await prisma.$transaction([
    prisma.rankEvent.create({ data: { streamerId, type: 'jogo_concluido', points: RANK_POINTS.jogoConcluido } }),
    ...(streak?.bonusPoints ? [prisma.rankEvent.create({ data: { streamerId, type: 'streak_bonus', points: streak.bonusPoints } })] : []),
    prisma.streamer.update({
      where: { id: streamerId },
      data: {
        rankPoints: { increment: totalPoints },
        ...(streak?.changed ? { rankStreakCount: streak.streakCount, rankLastActiveDate: streak.lastActiveDate } : {}),
      },
    }),
  ]);

  return { awarded: true, points: totalPoints };
}

export async function getRankStatus(streamerId: string): Promise<RankStatus | null> {
  const streamer = await prisma.streamer.findUnique({
    where: { id: streamerId },
    select: { rankPoints: true, rankStreakCount: true },
  });
  if (!streamer) return null;
  const { current, next } = getRankForPoints(streamer.rankPoints);
  return {
    points: streamer.rankPoints,
    rank: { name: current.name, pointsRequired: current.points },
    nextRank: next ? { name: next.name, pointsRequired: next.points } : null,
    pointsToNext: next ? next.points - streamer.rankPoints : null,
    streakCount: streamer.rankStreakCount,
  };
}
