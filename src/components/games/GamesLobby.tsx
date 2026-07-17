'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type GameId = 'hangman' | 'worldguessr' | 'skribll' | 'chatwars' | 'poolwars';

interface GameCard {
  id: GameId;
  title: string;
  description: string;
  available: true;
  icon: React.ReactNode;
}

interface ComingSoonCard {
  id: string;
  title: string;
  description: string;
  available: false;
  icon: React.ReactNode;
}

type Card = GameCard | ComingSoonCard;

const GAMES: Card[] = [
  {
    id: 'hangman',
    title: 'JOGO DA FORCA',
    description: 'Adivinhe a palavra antes\nque o bonequinho engorque!',
    available: true,
    icon: <HangmanIcon />,
  },
  {
    id: 'worldguessr',
    title: 'WORLDGUESSR',
    description: 'Adivinhe onde você está\nno mundo pelo Street View!',
    available: true,
    icon: <GlobeIcon />,
  },
  {
    id: 'skribll',
    title: 'SKRIBLL',
    description: 'Desenhe e adivinhe\npalavras com os amigos!',
    available: true,
    icon: <SkribllIcon />,
  },
  {
    id: 'chatwars',
    title: 'CHAT WARS',
    description: 'Cada viewer vira uma bolinha\nviva — quem fala mais, cresce!',
    available: true,
    icon: <ChatWarsIcon />,
  },
  {
    id: 'poolwars',
    title: 'POOL WARS',
    description: 'Bonecos se equilibram numa piscina\n— derrube o outro time na água!',
    available: true,
    icon: <PoolWarsIcon />,
  },
  {
    id: 'coming1',
    title: 'EM BREVE',
    description: 'Novos jogos\nem desenvolvimento!',
    available: false,
    icon: <LockIcon />,
  },
  {
    id: 'coming2',
    title: 'EM BREVE',
    description: 'Novos jogos\nem desenvolvimento!',
    available: false,
    icon: <LockIcon />,
  },
  {
    id: 'coming3',
    title: 'EM BREVE',
    description: 'Novos jogos\nem desenvolvimento!',
    available: false,
    icon: <LockIcon />,
  },
];

interface Props {
  onSelectGame: (id: GameId) => void;
}

export default function GamesLobby({ onSelectGame }: Props) {
  const [disabledGames, setDisabledGames] = useState<string[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/streamer/games-config')
      .then(r => r.json())
      .then((data: { disabled: string[] }) => setDisabledGames(data.disabled ?? []))
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  const visibleGames = GAMES.filter(g => !disabledGames.includes(g.id));

  if (!configLoaded) return null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-6 py-10">
      {/* Title */}
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-orbitron font-bold text-2xl tracking-widest text-white mb-2">
          ESCOLHA UM JOGO
        </h1>
        <p className="font-rajdhani text-sm tracking-wide text-white/40">
          Divirta-se e ganhe Playerskins Coins jogando!
        </p>
      </motion.div>

      {/* Grid */}
      <div
        className="grid gap-5 mx-auto w-full"
        style={{ maxWidth: 900, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
      >
        {visibleGames.map((game, idx) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.07 }}
          >
            {game.available ? (
              <AvailableCard
                title={game.title}
                description={game.description}
                icon={game.icon}
                onPlay={() => onSelectGame(game.id as GameId)}
              />

            ) : (
              <ComingSoonCard
                title={game.title}
                description={game.description}
                icon={game.icon}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AvailableCard({ title, description, icon, onPlay }: {
  title: string; description: string; icon: React.ReactNode; onPlay: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-5 p-6 rounded-2xl transition-all group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(0,229,255,0.15)',
      }}
    >
      <div
        className="flex items-center justify-center w-24 h-24 rounded-xl transition-all group-hover:scale-105"
        style={{
          background: 'rgba(0,229,255,0.05)',
          border: '1px solid rgba(0,229,255,0.12)',
        }}
      >
        {icon}
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="font-orbitron font-bold text-sm tracking-widest text-white">{title}</h2>
        <p className="font-rajdhani text-xs text-white/40 whitespace-pre-line leading-relaxed">{description}</p>
      </div>
      <button
        onClick={onPlay}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-orbitron font-bold text-xs tracking-widest transition-all"
        style={{
          background: 'rgba(0,229,255,0.08)',
          border: '1px solid rgba(0,229,255,0.3)',
          color: '#00E5FF',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(0,229,255,0.18)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(0,229,255,0.15)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(0,229,255,0.08)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        JOGAR AGORA
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
    </div>
  );
}

function ComingSoonCard({ title, description, icon }: {
  title: string; description: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-5 p-6 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: 0.55,
      }}
    >
      <div
        className="flex items-center justify-center w-24 h-24 rounded-xl"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {icon}
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="font-orbitron font-bold text-sm tracking-widest text-white/50">{title}</h2>
        <p className="font-rajdhani text-xs text-white/25 whitespace-pre-line leading-relaxed">{description}</p>
      </div>
      <div
        className="w-full flex items-center justify-center py-3 rounded-xl font-orbitron font-bold text-xs tracking-widest"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.25)',
        }}
      >
        EM BREVE
      </div>
    </div>
  );
}

function HangmanIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="hm-glow">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#hm-glow)" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" fill="none">
        {/* base */}
        <line x1="8" y1="58" x2="40" y2="58"/>
        {/* pole */}
        <line x1="18" y1="58" x2="18" y2="6"/>
        {/* top bar */}
        <line x1="18" y1="6" x2="38" y2="6"/>
        {/* rope */}
        <line x1="38" y1="6" x2="38" y2="16"/>
        {/* head */}
        <circle cx="38" cy="22" r="6"/>
        {/* body */}
        <line x1="38" y1="28" x2="38" y2="42"/>
        {/* left arm */}
        <line x1="38" y1="32" x2="30" y2="38"/>
        {/* right arm */}
        <line x1="38" y1="32" x2="46" y2="38"/>
        {/* left leg */}
        <line x1="38" y1="42" x2="30" y2="52"/>
        {/* right leg */}
        <line x1="38" y1="42" x2="46" y2="52"/>
      </g>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  );
}

function SkribllIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="sk-glow">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#sk-glow)" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* canvas/quadro */}
        <rect x="8" y="10" width="48" height="36" rx="3"/>
        {/* lápis */}
        <line x1="14" y1="54" x2="50" y2="54"/>
        {/* desenho: ondinha */}
        <path d="M16 32 Q22 22 28 32 Q34 42 40 32 Q46 22 52 32" strokeWidth="2"/>
      </g>
    </svg>
  );
}

function ChatWarsIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cw-lobby-glow">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#cw-lobby-glow)" stroke="#00E5FF" strokeWidth="2.5" fill="none">
        {/* bolinhas disputando */}
        <circle cx="24" cy="34" r="13" />
        <circle cx="44" cy="26" r="8" />
        <circle cx="46" cy="44" r="5" />
        {/* coroa no maior */}
        <path d="M16 17 L18 23 L24 19 L30 23 L32 17" strokeWidth="2.2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function PoolWarsIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pw-lobby-glow">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#pw-lobby-glow)" stroke="#00E5FF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* pool */}
        <circle cx="32" cy="34" r="22" />
        {/* water waves */}
        <path d="M12 36 Q20 30 28 36 T44 36 T52 36" strokeWidth="2" />
        <path d="M12 44 Q20 38 28 44 T44 44 T52 44" strokeWidth="2" />
        {/* two fighters */}
        <circle cx="25" cy="24" r="5" />
        <circle cx="40" cy="26" r="5" />
      </g>
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="globe-glow">
          <feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#globe-glow)" stroke="#00E5FF" strokeWidth="1.6" fill="none">
        <circle cx="12" cy="12" r="9.5"/>
        <ellipse cx="12" cy="12" rx="3.5" ry="9.5"/>
        <line x1="2.5" y1="9" x2="21.5" y2="9"/>
        <line x1="2.5" y1="15" x2="21.5" y2="15"/>
      </g>
    </svg>
  );
}
