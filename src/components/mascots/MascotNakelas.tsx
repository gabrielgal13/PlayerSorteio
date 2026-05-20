'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { RaffleStatus } from '@/types';

interface MascotNakelasProps {
  status: RaffleStatus;
  winnerNumber?: number | null;
  isExploding?: boolean;
  isScorched?: boolean;
}

// Fixed ember positions to avoid Math.random() in render
const EMBER_POSITIONS = [
  { angle: 0,   dist: 22, size: 2.5 },
  { angle: 45,  dist: 28, size: 1.8 },
  { angle: 90,  dist: 20, size: 3.0 },
  { angle: 135, dist: 26, size: 2.0 },
  { angle: 180, dist: 24, size: 2.2 },
  { angle: 225, dist: 30, size: 1.5 },
  { angle: 270, dist: 22, size: 2.8 },
  { angle: 315, dist: 25, size: 1.9 },
];

const RAY_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export default function MascotNakelas({ status, winnerNumber, isExploding = false, isScorched = false }: MascotNakelasProps) {
  const isRevealing = status === 'revealing' || status === 'winner';
  const isPreSuspense = status === 'suspense';
  const isSuspense = status === 'suspense' || status === 'spinning';

  return (
    <div className="relative w-full h-full flex items-end justify-center">
      <motion.div
        className="relative"
        style={{ width: 280, height: 360 }}
        animate={
          isExploding ? { rotate: [0, -6, 6, -4, 4, 0], scale: [1, 1.08, 1.04, 1] } :
          isSuspense   ? { y: [0, -8, 0, -6, 0] } :
          isRevealing  ? { scale: [1, 1.05, 1.02, 1] } :
          { y: [0, -6, 0] }
        }
        transition={
          isExploding  ? { duration: 0.5 } :
          isSuspense   ? { duration: 0.4, repeat: Infinity, repeatType: 'loop' } :
          isRevealing  ? { duration: 0.6 } :
          { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <svg viewBox="0 0 280 360" width="280" height="360" xmlns="http://www.w3.org/2000/svg" overflow="visible">
          <defs>
            <radialGradient id="skinGrad" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#D4956A" />
              <stop offset="100%" stopColor="#8B5E3C" />
            </radialGradient>
            <radialGradient id="baldGrad" cx="50%" cy="30%" r="50%">
              <stop offset="0%" stopColor="#C8885A" />
              <stop offset="70%" stopColor="#A06840" />
              <stop offset="100%" stopColor="#7A4F28" />
            </radialGradient>
            <radialGradient id="glowRad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFD166" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FFD166" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="backGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#FF8C00" stopOpacity="0.85" />
              <stop offset="45%"  stopColor="#FF4500" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FF0000" stopOpacity="0" />
            </radialGradient>
            <filter id="glowFilter">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="strongGlow">
              <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="fireGlow">
              <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* === BACK GLOW — builds during suspense, explodes at isExploding === */}
          <AnimatePresence>
            {(isPreSuspense || isExploding) && (
              <motion.g key="backglow">
                {/* Radial heat glow behind mascot */}
                <motion.circle
                  cx="140" cy="200"
                  r="20"
                  fill="url(#backGlowGrad)"
                  initial={{ r: 20, opacity: 0 }}
                  animate={
                    isExploding
                      ? { r: [40, 280, 380], opacity: [0.9, 0.6, 0] }
                      : { r: [60, 110, 60], opacity: [0.4, 0.75, 0.4] }
                  }
                  transition={
                    isExploding
                      ? { duration: 0.65, ease: 'easeOut' }
                      : { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
                  }
                />
                {/* Sunburst rays */}
                {RAY_ANGLES.map((angle, i) => {
                  const rad = (angle * Math.PI) / 180;
                  const len = isExploding ? 420 : 180;
                  return (
                    <motion.line
                      key={angle}
                      x1="140" y1="200"
                      x2={140 + Math.cos(rad) * len}
                      y2={200 + Math.sin(rad) * len}
                      stroke={isExploding ? '#FFCC44' : '#FF5500'}
                      strokeLinecap="round"
                      initial={{ opacity: 0, strokeWidth: 1 }}
                      animate={
                        isExploding
                          ? { opacity: [0, 0.9, 0], strokeWidth: [3, 9, 0] }
                          : { opacity: [0.08, 0.45, 0.08], strokeWidth: [1.5, 3, 1.5] }
                      }
                      transition={
                        isExploding
                          ? { duration: 0.6, delay: i * 0.005 }
                          : { duration: 0.5, repeat: Infinity, delay: i * 0.04, ease: 'easeInOut' }
                      }
                    />
                  );
                })}
              </motion.g>
            )}
          </AnimatePresence>

          {/* Body / torso */}
          <rect x="80" y="220" width="120" height="130" rx="16" fill="#1a1a2e" />
          {/* Hoodie zipper detail */}
          <line x1="140" y1="230" x2="140" y2="345" stroke="rgba(0,229,255,0.4)" strokeWidth="1.5" strokeDasharray="4,3" />
          {/* Hoodie collar */}
          <path d="M100 222 Q140 240 180 222" fill="none" stroke="rgba(0,229,255,0.5)" strokeWidth="2" />

          {/* Silver chain */}
          <motion.g
            animate={isSuspense ? { rotate: [-2, 2, -2] } : {}}
            transition={{ duration: 0.3, repeat: Infinity }}
            style={{ transformOrigin: '140px 260px' }}
          >
            {[...Array(8)].map((_, i) => (
              <ellipse
                key={i}
                cx={128 + i * 4}
                cy={258 + Math.sin(i * 0.8) * 3}
                rx="5" ry="3"
                fill="none"
                stroke="#C0C0C0"
                strokeWidth="2.5"
                transform={`rotate(${i % 2 === 0 ? 0 : 90} ${128 + i * 4} ${258 + Math.sin(i * 0.8) * 3})`}
              />
            ))}
          </motion.g>

          {/* Neck */}
          <rect x="122" y="200" width="36" height="28" rx="8" fill="url(#skinGrad)" />

          {/* Head base */}
          <ellipse cx="140" cy="160" rx="62" ry="68" fill="url(#baldGrad)" />

          {/* Ear left */}
          <ellipse cx="80" cy="162" rx="14" ry="18" fill="#C8885A" />
          <ellipse cx="82" cy="162" rx="9" ry="12" fill="#A06840" />

          {/* Ear right */}
          <ellipse cx="200" cy="162" rx="14" ry="18" fill="#C8885A" />
          <ellipse cx="198" cy="162" rx="9" ry="12" fill="#A06840" />

          {/* Bald head shine */}
          <ellipse cx="120" cy="120" rx="22" ry="12" fill="rgba(255,255,255,0.12)" transform="rotate(-15 120 120)" />

          {/* === SCORCH MARKS — aparecem após explosão, somem na revelação === */}
          <AnimatePresence>
            {isScorched && !isRevealing && (
              <motion.g
                key="scorch"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {/* Grande mancha queimada topo-direito */}
                <ellipse cx="160" cy="108" rx="20" ry="13" fill="rgba(18,6,0,0.58)" transform="rotate(-18 160 108)" />
                {/* Mancha esquerda */}
                <ellipse cx="112" cy="118" rx="14" ry="9" fill="rgba(18,6,0,0.48)" transform="rotate(12 112 118)" />
                {/* Risca chamuscada centro-topo */}
                <path d="M128 90 Q135 85 142 92 Q136 96 128 90 Z" fill="rgba(22,8,0,0.52)" />
                {/* Sinal de queimado nas sobrancelhas */}
                <path d="M106 152 Q116 147 127 152" fill="rgba(14,4,0,0.45)" stroke="rgba(14,4,0,0.3)" strokeWidth="1" />
                <path d="M153 152 Q164 147 174 152" fill="rgba(14,4,0,0.45)" stroke="rgba(14,4,0,0.3)" strokeWidth="1" />
                {/* Estria lateral */}
                <path d="M98 132 Q93 148 96 166 Q99 150 105 135 Z" fill="rgba(18,6,0,0.38)" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* === SMOKE WISPS — sobem da cabeça chamuscada === */}
          <AnimatePresence>
            {isScorched && !isRevealing && (
              <motion.g key="smoke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {[
                  { sx: 128, sy: 92, c1x: 122, c1y: 72, ex: 126, ey: 56 },
                  { sx: 152, sy: 86, c1x: 159, c1y: 66, ex: 155, ey: 50 },
                  { sx: 141, sy: 94, c1x: 145, c1y: 74, ex: 139, ey: 58 },
                ].map((s, i) => (
                  <motion.path
                    key={i}
                    d={`M ${s.sx} ${s.sy} Q ${s.c1x} ${s.c1y} ${s.ex} ${s.ey}`}
                    fill="none"
                    stroke="rgba(110,90,70,0.5)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    animate={{
                      d: [
                        `M ${s.sx} ${s.sy} Q ${s.c1x} ${s.c1y} ${s.ex} ${s.ey}`,
                        `M ${s.sx} ${s.sy} Q ${s.c1x - 6} ${s.c1y - 8} ${s.ex + 4} ${s.ey - 14}`,
                        `M ${s.sx} ${s.sy} Q ${s.c1x + 5} ${s.c1y - 16} ${s.ex - 4} ${s.ey - 28}`,
                      ],
                      opacity: [0, 0.55, 0],
                      strokeWidth: [2, 3, 0.8],
                    }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.55, ease: 'linear' }}
                  />
                ))}
              </motion.g>
            )}
          </AnimatePresence>

          {/* WINNER NUMBER ON BALD HEAD — brand burn animation */}
          <AnimatePresence>
            {isRevealing && winnerNumber != null && (
              <motion.g
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              >
                {/* Glow behind number — starts fire-orange, cools to gold */}
                <motion.ellipse
                  cx="140" cy="148"
                  rx="50" ry="42"
                  fill="url(#glowRad)"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />

                {/* Brand flash — white-hot burst that fades */}
                <motion.ellipse
                  cx="140" cy="150"
                  rx="38" ry="32"
                  fill="rgba(255,255,220,0.9)"
                  animate={{ opacity: [0.9, 0], rx: [38, 55], ry: [32, 46] }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />

                {/* Ember sparks scatter from brand */}
                {EMBER_POSITIONS.map((e, i) => {
                  const rad = (e.angle * Math.PI) / 180;
                  const sx = 140 + Math.cos(rad) * 18;
                  const sy = 150 + Math.sin(rad) * 14;
                  return (
                    <motion.circle
                      key={i}
                      cx={sx} cy={sy}
                      r={e.size}
                      fill={i % 2 === 0 ? '#FF6600' : '#FFD166'}
                      filter="url(#glowFilter)"
                      animate={{
                        cx: [sx, sx + Math.cos(rad) * e.dist * 2.2],
                        cy: [sy, sy + Math.sin(rad) * e.dist * 1.8 - 20],
                        opacity: [1, 0],
                        r: [e.size, 0.4],
                      }}
                      transition={{ duration: 0.9 + i * 0.07, delay: i * 0.04, ease: 'easeOut' }}
                    />
                  );
                })}

                {/* Number — white-hot → orange → gold */}
                <motion.text
                  x="140" y="162"
                  textAnchor="middle"
                  fontFamily="Orbitron, monospace"
                  fontWeight="900"
                  fontSize={winnerNumber > 999 ? '28' : winnerNumber > 99 ? '36' : '44'}
                  filter="url(#fireGlow)"
                  animate={{
                    fill: ['#FFFFFF', '#FF6600', '#FFA500', '#FFD166'],
                    opacity: [0, 1, 1, 1],
                  }}
                  transition={{ duration: 1.8, times: [0, 0.12, 0.45, 1] }}
                >
                  {winnerNumber}
                </motion.text>

                {/* Smoke wisps rising from the brand number */}
                {[
                  { sx: 128, sy: 128, ex: 122, ey: 108 },
                  { sx: 152, sy: 126, ex: 158, ey: 106 },
                  { sx: 140, sy: 124, ex: 138, ey: 104 },
                ].map((s, i) => (
                  <motion.path
                    key={i}
                    fill="none"
                    stroke="rgba(120,100,80,0.45)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    animate={{
                      d: [
                        `M ${s.sx} ${s.sy} Q ${s.sx - 4} ${(s.sy + s.ey) / 2} ${s.ex} ${s.ey}`,
                        `M ${s.sx} ${s.sy} Q ${s.sx + 5} ${(s.sy + s.ey) / 2 - 8} ${s.ex - 3} ${s.ey - 14}`,
                        `M ${s.sx} ${s.sy} Q ${s.sx - 3} ${(s.sy + s.ey) / 2 - 16} ${s.ex + 4} ${s.ey - 28}`,
                      ],
                      opacity: [0, 0.5, 0],
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 + 0.3, ease: 'linear' }}
                  />
                ))}

                {/* Tattoo lines around number */}
                <motion.path
                  d="M100 140 L110 140 M170 140 L180 140 M140 105 L140 115 M140 185 L140 195"
                  stroke="#FFD166"
                  strokeWidth="2"
                  strokeLinecap="round"
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Sunglasses (hide in reveal) */}
          <AnimatePresence>
            {!isRevealing && (
              <motion.g
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <rect x="100" y="148" width="40" height="24" rx="10" fill="#1a1a1a" stroke="#333" strokeWidth="1.5" />
                <rect x="145" y="148" width="40" height="24" rx="10" fill="#1a1a1a" stroke="#333" strokeWidth="1.5" />
                <line x1="140" y1="158" x2="145" y2="158" stroke="#333" strokeWidth="2.5" />
                <line x1="100" y1="158" x2="86" y2="160" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
                <line x1="185" y1="158" x2="199" y2="160" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
                <ellipse cx="112" cy="155" rx="6" ry="4" fill="rgba(0,229,255,0.3)" />
                <ellipse cx="157" cy="155" rx="6" ry="4" fill="rgba(0,229,255,0.3)" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Eyes (only show in reveal) */}
          <AnimatePresence>
            {isRevealing && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                <motion.ellipse
                  cx="120" cy="162" rx="9" ry="9"
                  fill="white"
                  animate={{ scaleY: [1, 0.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity, times: [0, 0.05, 0.1] }}
                />
                <ellipse cx="120" cy="162" rx="5" ry="5" fill="#FFD166" filter="url(#glowFilter)" />
                <ellipse cx="121.5" cy="161" rx="2" ry="2" fill="white" />

                <motion.ellipse
                  cx="160" cy="162" rx="9" ry="9"
                  fill="white"
                  animate={{ scaleY: [1, 0.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity, times: [0, 0.05, 0.1], delay: 0.1 }}
                />
                <ellipse cx="160" cy="162" rx="5" ry="5" fill="#FFD166" filter="url(#glowFilter)" />
                <ellipse cx="161.5" cy="161" rx="2" ry="2" fill="white" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Cap */}
          <motion.g
            animate={
              isRevealing ? { y: -30, rotate: -25, opacity: 0 } :
              isExploding  ? { y: -50, rotate: -40, opacity: 0 } :
              isSuspense   ? { y: [0, -3, 0], rotate: [0, -3, 0] } :
              {}
            }
            transition={
              isRevealing || isExploding ? { duration: 0.4, ease: 'easeOut' } :
              isSuspense ? { duration: 0.5, repeat: Infinity } :
              {}
            }
          >
            <path d="M82 112 Q140 108 198 112 L204 118 Q140 114 76 118 Z" fill="#2a2a3e" />
            <path d="M90 112 Q140 82 190 112 Q170 90 140 88 Q110 90 90 112 Z" fill="#1a1a2e" />
            <text x="140" y="103" textAnchor="middle" fontFamily="monospace" fontWeight="900" fontSize="10" fill="#00E5FF">PS</text>
            <circle cx="140" cy="87" r="4" fill="#00E5FF" opacity="0.8" />
          </motion.g>

          {/* Nose */}
          <ellipse cx="140" cy="176" rx="8" ry="5" fill="rgba(0,0,0,0.15)" />

          {/* Mouth */}
          <motion.path
            d={
              isRevealing ? "M122 194 Q140 210 158 194" :
              isSuspense  ? "M126 194 Q140 200 154 194" :
              "M124 194 Q140 206 156 194"
            }
            fill="none"
            stroke="#5C3A1E"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Arms */}
          <motion.g
            animate={
              isRevealing ? { rotate: [0, 20, -10, 15, 0] } :
              isSuspense  ? { rotate: [0, 5, 0, -5, 0] } :
              {}
            }
            transition={{ duration: isRevealing ? 0.8 : 1.5, repeat: isRevealing ? 0 : Infinity }}
            style={{ transformOrigin: '80px 240px' }}
          >
            <path d="M80 230 Q40 260 50 300" stroke="#1a1a2e" strokeWidth="32" strokeLinecap="round" fill="none" />
            <path d="M80 230 Q40 260 50 300" stroke="url(#skinGrad)" strokeWidth="26" strokeLinecap="round" fill="none" />
          </motion.g>

          <motion.g
            animate={
              isRevealing ? { rotate: [0, -20, 10, -15, 0] } :
              isSuspense  ? { rotate: [0, -5, 0, 5, 0] } :
              {}
            }
            transition={{ duration: isRevealing ? 0.8 : 1.5, repeat: isRevealing ? 0 : Infinity }}
            style={{ transformOrigin: '200px 240px' }}
          >
            <path d="M200 230 Q240 260 230 300" stroke="#1a1a2e" strokeWidth="32" strokeLinecap="round" fill="none" />
            <path d="M200 230 Q240 260 230 300" stroke="url(#skinGrad)" strokeWidth="26" strokeLinecap="round" fill="none" />
          </motion.g>

          {/* Victory particles from bald head */}
          <AnimatePresence>
            {isRevealing && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {[...Array(6)].map((_, i) => (
                  <motion.circle
                    key={i}
                    cx={140 + Math.cos((i * 60 * Math.PI) / 180) * 40}
                    cy={130 + Math.sin((i * 60 * Math.PI) / 180) * 30}
                    r="3"
                    fill="#FFD166"
                    filter="url(#glowFilter)"
                    animate={{
                      cx: [
                        140 + Math.cos((i * 60 * Math.PI) / 180) * 40,
                        140 + Math.cos((i * 60 * Math.PI) / 180) * 80,
                      ],
                      cy: [
                        130 + Math.sin((i * 60 * Math.PI) / 180) * 30,
                        130 + Math.sin((i * 60 * Math.PI) / 180) * 60 - 30,
                      ],
                      opacity: [1, 0],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.g>
            )}
          </AnimatePresence>
        </svg>

        {/* Mascot glow aura */}
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: isRevealing
              ? 'radial-gradient(ellipse at 50% 40%, rgba(255,215,0,0.25) 0%, transparent 70%)'
              : isScorched
              ? 'radial-gradient(ellipse at 50% 40%, rgba(255,100,0,0.18) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at 50% 40%, rgba(0,229,255,0.15) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </div>
  );
}
