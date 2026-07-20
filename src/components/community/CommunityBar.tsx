'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';

function useMarketingImage() {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/marketing/random')
      .then(r => r.json())
      .then(data => { if (data?.imageData) setSrc(data.imageData); })
      .catch(() => {});
  }, []);
  return src;
}

interface RankStatus {
  points: number;
  rank: { name: string; pointsRequired: number };
  nextRank: { name: string; pointsRequired: number } | null;
  pointsToNext: number | null;
  streakCount: number;
}

function useRankStatus(username: string | undefined) {
  const [status, setStatus] = useState<RankStatus | null>(null);
  useEffect(() => {
    if (!username) return;
    fetch(`/api/streamer/rank-status?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(data => { if (data && !data.error) setStatus(data); })
      .catch(() => {});
  }, [username]);
  return status;
}

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

function stripAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '');
}

// "Ouro 4" / "Diamante 1" → "ouro" / "diamante" — família de cor do tier (sem divisão).
function rankColorKey(name: string): string {
  return stripAccents(name.replace(/\s*\d+$/, '').trim());
}

// "Ouro 4" → "ouro4.png" · "Ouro 1"/"Ouro" (topo da divisão, sem número) → "ouro1.png"
// (reaproveita a arte do "1") · "Bronze"/"Lendário" (sem divisões) → "bronze.png"/"lendario.png".
function rankImageSlug(name: string): string {
  const stripped = stripAccents(name.trim());
  const match = stripped.match(/^([a-z]+)\s*(\d+)?$/);
  if (!match) return stripped.replace(/\s+/g, '');
  const [, base, division] = match;
  if (division) return `${base}${division}`;
  if (base === 'bronze' || base === 'lendario') return base;
  return `${base}1`;
}

const RANK_COLORS: Record<string, { main: string; glow: string }> = {
  bronze: { main: '#B87333', glow: '#D9985C' },
  prata: { main: '#C7CBD1', glow: '#F0F2F5' },
  ouro: { main: '#F5A623', glow: '#FFD700' },
  diamante: { main: '#4FD8E8', glow: '#00E5FF' },
  lendario: { main: '#BF5AF2', glow: '#FF6EFB' },
};

export default function CommunityBar() {
  const marketingImg = useMarketingImage();
  const currentUser = useStore(s => s.currentUser);
  const rankStatus = useRankStatus(currentUser?.username);
  const [showInfo, setShowInfo] = useState(false);
  // Marca qual slug falhou ao carregar. Como comparamos com o slug atual, ao
  // trocar de rank o "falhou" se reseta sozinho — sem mexer no DOM na mão
  // (o que antes deixava a imagem escondida pra sempre depois do 1º 404).
  const [failedSlug, setFailedSlug] = useState<string | null>(null);

  const rankName = rankStatus?.rank.name ?? '—';
  const slug = rankImageSlug(rankName);
  const colors = RANK_COLORS[rankColorKey(rankName)] ?? RANK_COLORS.bronze;
  const points = rankStatus?.points ?? 0;
  const nextRank = rankStatus?.nextRank ?? null;
  const rangeStart = rankStatus?.rank.pointsRequired ?? 0;
  const rangeEnd = nextRank?.pointsRequired ?? rangeStart;
  const progressPct = nextRank && rangeEnd > rangeStart
    ? Math.min(100, Math.max(0, ((points - rangeStart) / (rangeEnd - rangeStart)) * 100))
    : 100;

  return (
    <div
      className="relative z-20 w-full flex items-stretch hide-in-obs"
      style={{
        background: 'rgba(5,8,22,0.92)',
        borderTop: '1px solid rgba(0,229,255,0.12)',
        minHeight: '96px',
      }}
    >
      {/* LEFT — PlayerSkins WEAR banner */}
      <div
        className="flex items-stretch flex-shrink-0 overflow-hidden"
        style={{ borderRight: '1px solid rgba(0,229,255,0.1)', width: '420px' }}
      >
        {/* Marketing image slot */}
        <div
          className="relative flex-shrink-0 overflow-hidden"
          style={{ width: '160px', height: '96px', background: 'rgba(0,0,0,0.45)' }}
        >
          {marketingImg ? (
            <img
              src={marketingImg}
              alt="marketing"
              style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', height: '96px', width: 'auto' }}
            />
          ) : (
            <span className="font-rajdhani text-white/15 tracking-widest uppercase text-xs">
              imagem
            </span>
          )}
        </div>

        {/* Branding em coluna única */}
        <div className="flex-1 flex flex-col justify-center px-5 py-3 gap-0.5">
          <img
            src="/wordmark.png"
            alt="PlayerSkins"
            className="object-contain object-left opacity-80"
            style={{ height: '16.8px', marginBottom: '3px' }}
          />
          <span
            className="font-orbitron font-black text-white"
            style={{ fontSize: '18px', letterSpacing: '0.1em', lineHeight: 1.1 }}
          >
            WEAR
          </span>
          <p
            className="font-rajdhani text-white/40 tracking-widest uppercase"
            style={{ fontSize: '10px' }}
          >
            VISTA O GAME. VIVA O HYPE.
          </p>
          <div className="flex items-center gap-2" style={{ marginTop: '3px' }}>
            <a
              href="https://www.playerskins.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-rajdhani tracking-wider transition-all hover:opacity-75"
              style={{ fontSize: '10px', color: 'rgba(0,229,255,0.75)' }}
            >
              www.playerskins.com.br
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
              </svg>
            </a>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded font-rajdhani tracking-wider"
              style={{
                background: 'rgba(0,229,255,0.08)',
                border: '1px solid rgba(0,229,255,0.25)',
                fontSize: '10px',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>CUPOM:</span>
              <span className="font-bold" style={{ color: 'rgba(0,229,255,0.9)' }}>GANJA10</span>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE — Info text (original) */}
      <div
        className="flex-1 flex items-center justify-center px-8 py-5"
        style={{ borderRight: '1px solid rgba(0,229,255,0.1)' }}
      >
        <div className="text-center max-w-md">
          <p className="font-rajdhani text-white/35 leading-snug" style={{ fontSize: '17px' }}>
            10% de todas as vendas com seu cupom são convertidas
            <br />
            em créditos para sorteios e ativações.
          </p>
          <button
            onClick={() => setShowInfo(true)}
            className="font-rajdhani tracking-widest mt-1.5 transition-all hover:opacity-80"
            style={{ fontSize: '15px', color: 'rgba(0,229,255,0.6)' }}
          >
            SAIBA MAIS &gt;
          </button>
        </div>
      </div>

      {/* RIGHT — Rank da Comunidade */}
      <div
        className="relative flex items-center gap-3 px-6 py-2.5 flex-shrink-0 overflow-hidden"
        style={{ width: '340px', background: `linear-gradient(90deg, ${colors.main}0D, transparent 60%)` }}
      >
        {/* faísca decorativa */}
        <div className="absolute pointer-events-none" style={{ top: 8, right: 8, width: 4, height: 4, borderRadius: '50%', background: colors.glow, boxShadow: `0 0 6px 1px ${colors.glow}` }} />

        <div className="flex-1 min-w-0 flex flex-col" style={{ gap: '3px' }}>
          {/* Header: ícone + label + linha */}
          <div className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill={colors.main} className="flex-shrink-0">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
            <span className="font-rajdhani tracking-widest uppercase whitespace-nowrap" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
              Rank da Comunidade
            </span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${colors.main}66, transparent)` }} />
          </div>

          {/* Nome do rank — gradiente */}
          <div
            className="font-orbitron font-black uppercase leading-none"
            style={{
              fontSize: '19px',
              letterSpacing: '0.02em',
              backgroundImage: `linear-gradient(180deg, ${colors.glow}, ${colors.main})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 0 6px ${colors.main}55)`,
            }}
          >
            {rankName}
          </div>

          {/* Barra de progresso hexagonal */}
          <div className="flex items-center" style={{ height: '12px', marginTop: '1px' }}>
            <div
              className="relative z-10 flex items-center justify-center flex-shrink-0"
              style={{
                width: '15px', height: '15px', marginRight: '-6px',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                background: `linear-gradient(135deg, ${colors.glow}, ${colors.main})`,
              }}
            >
              <span className="font-orbitron font-black" style={{ fontSize: '7px', color: '#050816' }}>P</span>
            </div>
            <div
              className="flex-1 overflow-hidden"
              style={{
                height: '9px',
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%)',
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${colors.main}40`,
              }}
            >
              <div
                className="h-full"
                style={{
                  width: `${progressPct}%`,
                  background: `linear-gradient(90deg, ${colors.main}, ${colors.glow})`,
                  boxShadow: `0 0 6px ${colors.main}`,
                }}
              />
            </div>
          </div>

          {/* Pontos */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={colors.main} strokeWidth="2.5" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" />
              </svg>
              <span className="font-orbitron font-bold" style={{ fontSize: '11px', color: colors.main }}>
                {points.toLocaleString('pt-BR')}
              </span>
            </div>
            {nextRank && (
              <span className="font-orbitron" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
                / {nextRank.pointsRequired.toLocaleString('pt-BR')}
              </span>
            )}
          </div>

          {/* Próximo rank */}
          <div className="flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" className="flex-shrink-0">
              <path d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5zm0 2h14v2H5v-2z" />
            </svg>
            <span className="font-rajdhani tracking-widest uppercase" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
              Próximo: <span className="font-bold" style={{ color: 'rgba(255,255,255,0.65)' }}>{nextRank ? nextRank.name : 'Rank máximo'}</span>
            </span>
          </div>
        </div>

        {/* Badge hexagonal do rank atual */}
        <div className="relative flex-shrink-0" style={{ width: '62px', height: '62px' }}>
          {/* cantos decorativos */}
          {([['top','left'], ['top','right'], ['bottom','left'], ['bottom','right']] as const).map(([v, h]) => (
            <div
              key={`${v}-${h}`}
              className="absolute"
              style={{
                [v]: -2, [h]: -2,
                width: 8, height: 8,
                borderTop: v === 'top' ? `1.5px solid ${colors.main}` : undefined,
                borderBottom: v === 'bottom' ? `1.5px solid ${colors.main}` : undefined,
                borderLeft: h === 'left' ? `1.5px solid ${colors.main}` : undefined,
                borderRight: h === 'right' ? `1.5px solid ${colors.main}` : undefined,
              } as CSSProperties}
            />
          ))}
          <div
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              inset: 3,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `linear-gradient(155deg, ${colors.main}26, rgba(5,8,22,0.6))`,
              border: `1px solid ${colors.main}88`,
              boxShadow: `0 0 14px ${colors.main}44, inset 0 0 10px ${colors.main}22`,
            }}
          >
            {failedSlug === slug ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path
                  d="M2 18l2.5-8L9 14l3-8 3 8 4.5-4L22 18H2z"
                  fill={colors.main}
                  stroke={colors.glow}
                  strokeWidth="0.5"
                />
                <rect x="2" y="18" width="20" height="2" rx="1" fill={colors.main} />
              </svg>
            ) : (
              <img
                key={slug}
                src={`/ranks/${slug}.png`}
                alt={rankName}
                className="w-full h-full object-contain p-1.5"
                onError={() => setFailedSlug(slug)}
              />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              className="relative w-full max-w-md rounded-2xl overflow-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              style={{
                background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                border: '1px solid rgba(0,229,255,0.2)',
                boxShadow: '0 0 100px rgba(0,229,255,0.08)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00E5FF, #00E5FF55)' }} />
              <div style={{ padding: '28px' }} className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-orbitron text-sm tracking-widest" style={{ color: '#00E5FF' }}>
                    COMO FUNCIONA O CUPOM
                  </span>
                  <button
                    onClick={() => setShowInfo(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 transition-all"
                  >
                    ✕
                  </button>
                </div>

                <div
                  className="flex items-center gap-1 px-2.5 py-1 rounded self-start font-rajdhani tracking-wider"
                  style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', fontSize: '11px' }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>CUPOM:</span>
                  <span className="font-bold" style={{ color: 'rgba(0,229,255,0.9)' }}>GANJA10</span>
                </div>

                <p className="font-rajdhani leading-relaxed" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.65)' }}>
                  A cada compra feita em <span style={{ color: 'rgba(0,229,255,0.85)' }}>www.playerskins.com.br</span> com o cupom <strong>GANJA10</strong>, 10% do valor da venda é convertido em <strong>PlayerSkins Coins</strong> e creditado automaticamente na conta do streamer.
                </p>
                <p className="font-rajdhani leading-relaxed" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.65)' }}>
                  Esses créditos são o combustível dos sorteios e das ativações do canal — quanto mais vendas o cupom gera, mais prêmios entram na roleta para a comunidade.
                </p>
                <p className="font-rajdhani leading-relaxed" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
                  O saldo de PlayerSkins Coins pode ser acompanhado em tempo real no canto superior da tela.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
