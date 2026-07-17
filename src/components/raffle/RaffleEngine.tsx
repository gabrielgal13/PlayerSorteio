'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import MascotContainer from '@/components/mascots/MascotContainer';
import ConfettiExplosion from '@/components/effects/ConfettiExplosion';
import FireworksExplosion from '@/components/effects/FireworksExplosion';
import SparklesExplosion from '@/components/effects/SparklesExplosion';
import ParticleCanvas from '@/components/effects/ParticleCanvas';
import RaffleAnimation from '@/components/effects/RaffleAnimation';
import { useAudio } from '@/hooks/useAudio';
import { useEventMusic } from '@/hooks/useEventMusic';
import type { Participant } from '@/types';

const PRIZE_ICONS = ['🏆', '🎮', '💰', '🎁', '⚔️', '🔥', '💎', '🌟'];

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

// ── Number spinner ─────────────────────────────────────────────────────────────
function NumberSpinner({ isSpinning, finalNumber, spinColor = '#1F8CFF', spinShadowRgb = '0,229,255' }: { isSpinning: boolean; finalNumber: number | null; spinColor?: string; spinShadowRgb?: string }) {
  const [displayed, setDisplayed] = useState('???');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isSpinning) {
      intervalRef.current = setInterval(() => {
        setDisplayed(String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0'));
      }, 60);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayed(finalNumber !== null ? String(finalNumber) : '???');
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isSpinning, finalNumber]);

  return (
    <motion.div className="relative text-center"
      animate={isSpinning ? { y: [0, -2, 0, 2, 0] } : {}}
      transition={{ duration: 0.1, repeat: Infinity }}>
      <div className="font-orbitron font-black text-7xl md:text-8xl tracking-widest"
        style={{
          color: isSpinning ? spinColor : '#FFD166',
          textShadow: isSpinning
            ? `0 0 30px rgba(${spinShadowRgb},0.8), 0 0 60px rgba(${spinShadowRgb},0.4)`
            : '0 0 40px rgba(255,209,102,1), 0 0 80px rgba(255,209,102,0.6)',
          fontVariantNumeric: 'tabular-nums',
        }}>
        {displayed}
      </div>
    </motion.div>
  );
}

// ── Name reel spinner (slot-machine style) ────────────────────────────────────
function NameReelSpinner({
  isSpinning, finalName, participants, spinColor = '#1F8CFF', spinShadowRgb = '0,229,255',
}: {
  isSpinning: boolean;
  finalName: string | null;
  participants: Participant[];
  spinColor?: string;
  spinShadowRgb?: string;
}) {
  const [offset, setOffset] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const ITEM_H = 56;
  const pool = participants.length > 0 ? participants.map(p => p.name) : ['?'];

  useEffect(() => {
    if (isSpinning) {
      startRef.current = performance.now();
      const tick = (now: number) => {
        const elapsed = now - (startRef.current ?? now);
        const speed = 1.1; // pixels per ms
        setOffset(-(elapsed * speed));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setOffset(0);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isSpinning]);

  if (!isSpinning && finalName) {
    return (
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
        className="font-orbitron font-black tracking-wider text-center"
        style={{
          fontSize: 'clamp(2.4rem, 5vw, 4rem)',
          color: '#FFD166',
          textShadow: '0 0 40px rgba(255,209,102,1), 0 0 80px rgba(255,209,102,0.6)',
          lineHeight: 1.1,
          padding: '0 16px',
        }}
      >
        {finalName}
      </motion.div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        width: 'clamp(280px, 32vw, 460px)',
        height: ITEM_H * 3,
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid rgba(${spinShadowRgb},0.35)`,
        boxShadow: `inset 0 0 40px rgba(${spinShadowRgb},0.18), 0 0 22px rgba(${spinShadowRgb},0.25)`,
      }}
    >
      <div
        style={{
          transform: `translateY(${offset % (ITEM_H * pool.length)}px)`,
          willChange: 'transform',
        }}
      >
        {[...pool, ...pool, ...pool].map((name, i) => (
          <div
            key={i}
            className="font-orbitron font-bold flex items-center justify-center"
            style={{
              height: ITEM_H,
              fontSize: 22,
              color: spinColor,
              letterSpacing: '0.08em',
              textShadow: `0 0 14px rgba(${spinShadowRgb},0.6)`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '0 16px',
            }}
          >
            {name}
          </div>
        ))}
      </div>
      {/* Highlight band on middle row */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: ITEM_H,
          height: ITEM_H,
          borderTop: `1px solid rgba(${spinShadowRgb},0.5)`,
          borderBottom: `1px solid rgba(${spinShadowRgb},0.5)`,
          background: `linear-gradient(90deg, transparent, rgba(${spinShadowRgb},0.08), transparent)`,
        }}
      />
      {/* Top/bottom fades */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: ITEM_H, background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: ITEM_H, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }} />
    </div>
  );
}

// ── Wheel of fortune spinner ──────────────────────────────────────────────────
function WheelSpinner({
  isSpinning, finalName, participants, spinColor = '#1F8CFF', spinShadowRgb = '0,229,255',
}: {
  isSpinning: boolean;
  finalName: string | null;
  participants: Participant[];
  spinColor?: string;
  spinShadowRgb?: string;
}) {
  const [rotation, setRotation] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  // Cap at 16 slices for legibility
  const slices = participants.length > 0 ? participants.slice(0, 16) : [{ name: '?', number: 0, id: 'x' } as Participant];
  const sliceAngle = 360 / slices.length;

  useEffect(() => {
    if (isSpinning) {
      startRef.current = performance.now();
      const tick = (now: number) => {
        const elapsed = now - (startRef.current ?? now);
        setRotation((elapsed * 0.6) % 360);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isSpinning]);

  if (!isSpinning && finalName) {
    return (
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
        className="font-orbitron font-black tracking-wider text-center"
        style={{
          fontSize: 'clamp(2.4rem, 5vw, 4rem)',
          color: '#FFD166',
          textShadow: '0 0 40px rgba(255,209,102,1), 0 0 80px rgba(255,209,102,0.6)',
          lineHeight: 1.1,
          padding: '0 16px',
        }}
      >
        {finalName}
      </motion.div>
    );
  }

  const SIZE = 280;
  const R = SIZE / 2;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* Pointer */}
      <div
        className="absolute"
        style={{
          top: -6, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent',
          borderTop: `18px solid ${spinColor}`,
          filter: `drop-shadow(0 0 8px rgba(${spinShadowRgb},0.9))`,
          zIndex: 5,
        }}
      />
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          filter: `drop-shadow(0 0 18px rgba(${spinShadowRgb},0.4))`,
          willChange: 'transform',
        }}
      >
        <defs>
          <radialGradient id="wheel-glow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={spinColor} stopOpacity="0" />
            <stop offset="100%" stopColor={spinColor} stopOpacity="0.35" />
          </radialGradient>
        </defs>
        {slices.map((p, i) => {
          const a1 = (i * sliceAngle - 90) * Math.PI / 180;
          const a2 = ((i + 1) * sliceAngle - 90) * Math.PI / 180;
          const x1 = R + R * Math.cos(a1);
          const y1 = R + R * Math.sin(a1);
          const x2 = R + R * Math.cos(a2);
          const y2 = R + R * Math.sin(a2);
          const large = sliceAngle > 180 ? 1 : 0;
          const fill = i % 2 === 0 ? `rgba(${spinShadowRgb},0.25)` : `rgba(${spinShadowRgb},0.05)`;
          // Text along middle of slice
          const tA = ((i + 0.5) * sliceAngle - 90) * Math.PI / 180;
          const tx = R + (R * 0.62) * Math.cos(tA);
          const ty = R + (R * 0.62) * Math.sin(tA);
          const textRot = (i + 0.5) * sliceAngle;
          const short = p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name;
          return (
            <g key={p.id ?? i}>
              <path d={`M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`}
                fill={fill}
                stroke={`rgba(${spinShadowRgb},0.6)`}
                strokeWidth={1}
              />
              <text
                x={tx} y={ty}
                fill="#fff"
                fontFamily="Orbitron, sans-serif"
                fontWeight={700}
                fontSize={slices.length > 10 ? 10 : 12}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${textRot} ${tx} ${ty})`}
                style={{ textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
              >
                {short}
              </text>
            </g>
          );
        })}
        <circle cx={R} cy={R} r={R} fill="url(#wheel-glow)" />
        <circle cx={R} cy={R} r={16} fill={spinColor} stroke="#fff" strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 6px rgba(${spinShadowRgb},1))` }} />
      </svg>
    </div>
  );
}

// ── Matrix spinner — decrypts winner's name char-by-char ─────────────────────
function MatrixSpinner({
  isSpinning, finalName, spinColor = '#1F8CFF', spinShadowRgb = '0,229,255',
}: {
  isSpinning: boolean;
  finalName: string | null;
  spinColor?: string;
  spinShadowRgb?: string;
}) {
  const [displayed, setDisplayed] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const CHARSET = '!@#$%&*+-/<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const TARGET_LEN = 12;

  useEffect(() => {
    if (isSpinning) {
      intervalRef.current = setInterval(() => {
        let s = '';
        for (let i = 0; i < TARGET_LEN; i++) {
          s += CHARSET[Math.floor(Math.random() * CHARSET.length)];
        }
        setDisplayed(s);
      }, 55);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isSpinning]);

  // Decrypt animation when winner is revealed
  useEffect(() => {
    if (isSpinning || !finalName) return;
    let i = 0;
    const decryptInterval = setInterval(() => {
      i++;
      let s = finalName.slice(0, i);
      // Pad remaining with random chars
      while (s.length < finalName.length) {
        s += CHARSET[Math.floor(Math.random() * CHARSET.length)];
      }
      setDisplayed(s);
      if (i >= finalName.length) clearInterval(decryptInterval);
    }, 85);
    return () => clearInterval(decryptInterval);
  }, [isSpinning, finalName]);

  const revealed = !isSpinning && !!finalName;

  return (
    <motion.div
      className="font-orbitron font-black text-center"
      animate={isSpinning ? { opacity: [0.7, 1, 0.7] } : {}}
      transition={{ duration: 0.4, repeat: Infinity }}
      style={{
        fontSize: revealed ? 'clamp(2rem, 4.5vw, 3.5rem)' : 'clamp(1.8rem, 4vw, 3rem)',
        letterSpacing: '0.12em',
        color: revealed ? '#FFD166' : spinColor,
        textShadow: revealed
          ? '0 0 40px rgba(255,209,102,1), 0 0 80px rgba(255,209,102,0.6)'
          : `0 0 14px rgba(${spinShadowRgb},0.9), 0 0 28px rgba(${spinShadowRgb},0.5)`,
        fontFamily: 'Orbitron, monospace',
        padding: '0 16px',
        wordBreak: 'break-all',
      }}
    >
      {displayed || '...'}
    </motion.div>
  );
}

// ── Spin animation dispatcher ─────────────────────────────────────────────────
function SpinAnimation({
  effect, isSpinning, winner, participants, accent, accentRgb,
}: {
  effect: 'numbers' | 'name-reel' | 'wheel' | 'matrix';
  isSpinning: boolean;
  winner: Participant | null;
  participants: Participant[];
  accent: string;
  accentRgb: string;
}) {
  switch (effect) {
    case 'name-reel':
      return <NameReelSpinner isSpinning={isSpinning} finalName={winner?.name ?? null} participants={participants} spinColor={accent} spinShadowRgb={accentRgb} />;
    case 'wheel':
      return <WheelSpinner isSpinning={isSpinning} finalName={winner?.name ?? null} participants={participants} spinColor={accent} spinShadowRgb={accentRgb} />;
    case 'matrix':
      return <MatrixSpinner isSpinning={isSpinning} finalName={winner?.name ?? null} spinColor={accent} spinShadowRgb={accentRgb} />;
    case 'numbers':
    default:
      return <NumberSpinner isSpinning={isSpinning} finalNumber={winner?.number ?? null} spinColor={accent} spinShadowRgb={accentRgb} />;
  }
}

// ── Winner card ────────────────────────────────────────────────────────────────
function WinnerCard({ winner, prize, accentRgb = '0,229,255' }: { winner: Participant; prize?: { name: string } | null; accentRgb?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0, rotateY: -180 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
      className="relative rounded-2xl overflow-hidden text-center px-6 py-5"
      style={{
        background: `linear-gradient(135deg, rgba(255,209,102,0.12), rgba(${accentRgb},0.12))`,
        border: '1px solid rgba(255,209,102,0.4)',
        boxShadow: `0 0 60px rgba(255,209,102,0.2), 0 0 120px rgba(${accentRgb},0.1)`,
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(45deg, transparent 30%, rgba(255,209,102,0.1) 50%, transparent 70%)', backgroundSize: '200% 100%' }}
        animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      <div className="relative z-10">
        <motion.div className="text-3xl mb-1"
          animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5 }}>🏆</motion.div>
        <p className="font-rajdhani text-xs tracking-[0.4em] text-neon-gold/60 uppercase mb-1">
          ⚡ E TEMOS UM VENCEDOR! ⚡
        </p>
        <p className="font-orbitron font-black text-3xl text-neon-gold leading-tight">{winner.name}</p>
        <p className="font-rajdhani font-bold text-lg text-white/60 mt-1">#{winner.number}</p>
        {prize && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,209,102,0.15)' }}>
            <p className="font-rajdhani text-xs text-white/40 tracking-widest uppercase">Prêmio</p>
            <p className="font-rajdhani text-sm text-neon-cyan">{prize.name}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Winner verification modal ──────────────────────────────────────────────────
function WinnerVerificationModal({
  winner, prize, countdown, chatMessage, twitchConnected, onConfirm, onReroll, accent, accentRgb,
}: {
  winner: Participant;
  prize?: { name: string } | null;
  countdown: number;
  chatMessage: string | null;
  twitchConnected: boolean;
  onConfirm: () => void;
  onReroll: () => void;
  accent: string;
  accentRgb: string;
}) {
  const verified = chatMessage !== null;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="relative rounded-3xl overflow-hidden mx-4 w-full max-w-sm text-center"
        style={{
          background: 'linear-gradient(145deg, rgba(10,14,40,0.98), rgba(5,8,22,0.98))',
          border: verified ? '1px solid rgba(0,255,163,0.5)' : `1px solid rgba(${accentRgb},0.35)`,
          boxShadow: verified ? '0 0 80px rgba(0,255,163,0.25)' : `0 0 80px rgba(${accentRgb},0.2)`,
        }}>
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)', backgroundSize: '200% 100%' }}
          animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
        <div className="relative z-10 p-8 space-y-5">
          <motion.div className="text-5xl" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>🏆</motion.div>
          <div>
            <p className="font-rajdhani text-xs tracking-[0.4em] text-white/40 uppercase mb-1">VENCEDOR</p>
            <p className="font-orbitron font-black text-3xl text-white leading-tight">{winner.name}</p>
            <p className="font-rajdhani text-sm text-white/30 mt-0.5">#{winner.number}</p>
          </div>
          {prize && (
            <div className="px-4 py-4 rounded-xl" style={{ background: 'rgba(255,209,102,0.07)', border: '1px solid rgba(255,209,102,0.15)' }}>
              <p className="font-rajdhani text-xs text-white/30 tracking-widest uppercase mb-1">Prêmio</p>
              <p className="font-orbitron text-base font-bold text-neon-gold">{prize.name}</p>
            </div>
          )}
          {!twitchConnected && (
            <div className="px-4 py-4 rounded-xl" style={{ background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.25)' }}>
              <p className="font-rajdhani text-xs text-orange-400/80">Twitch desconectada — confirme manualmente</p>
            </div>
          )}
          {twitchConnected && (
            <div className="space-y-3">
              {!verified ? (
                <>
                  <motion.p className="font-rajdhani text-sm text-neon-cyan/70"
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    Aguardando mensagem no chat...
                  </motion.p>
                  <div className="relative w-20 h-20 mx-auto">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
                      <motion.circle cx="40" cy="40" r="34" fill="none"
                        stroke={countdown <= 10 ? '#FF4444' : accent} strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - countdown / 30)}`}
                        style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-orbitron font-bold text-xl" style={{ color: countdown <= 10 ? '#FF4444' : accent }}>{countdown}</span>
                    </div>
                  </div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,255,163,0.3)', background: 'rgba(0,255,163,0.06)' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(0,255,163,0.12)', background: 'rgba(0,255,163,0.06)' }}>
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-neon-green"
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.7, repeat: Infinity }} />
                    <span className="font-orbitron text-xs text-neon-green/70 tracking-widest">MENSAGEM RECEBIDA</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="font-rajdhani text-base text-white/90 leading-snug">&ldquo;{chatMessage}&rdquo;</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <motion.button onClick={onReroll} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="flex-1 py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
              style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', color: '#FFA500' }}>
              🔄 REROLL
            </motion.button>
            <motion.button onClick={onConfirm} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="flex-1 py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
              style={{
                background: verified ? 'rgba(0,255,163,0.2)' : 'rgba(0,255,163,0.1)',
                border: verified ? '1px solid rgba(0,255,163,0.5)' : '1px solid rgba(0,255,163,0.25)',
                color: '#00FFA3',
                boxShadow: verified ? '0 0 20px rgba(0,255,163,0.2)' : 'none',
              }}>
              ✓ CONFIRMAR
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RaffleEngine() {
  const {
    participants, prizes, currentPrize, setCurrentPrize,
    raffleStatus, setRaffleStatus,
    currentWinner, setCurrentWinner,
    addHistory, history,
    twitchConnected, twitchConfig,
    setValidationCountdown, validationCountdown,
    currentUser,
    winnerChatMessage, setWinnerChatMessage,
    chatMessages,
    setRaffleStage,
    updatePrize,
    deductPSC,
    isAffiliate,
    themeColor,
    eventEffect,
    spinEffect,
    setSessionStartTimestamp,
    setSessionDuration,
    setSessionParticipantCount,
    setLiveViewerCount,
    mascotDead,
    resetMascotRound,
    autoRevealWinner,
    chatTriggerCount,
    chatTriggerCommand,
    raffleAnimationStyle,
    setPendingMarketplaceDelivery,
    audioEnabled,
  } = useStore();

  const eventMusic = useEventMusic();

  const [showConfetti, setShowConfetti] = useState(false);
  const [spinningNumber, setSpinningNumber] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const [isScorched, setIsScorched] = useState(false);
  const [chatCountdown, setChatCountdown] = useState(30);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [prizeWindowStart, setPrizeWindowStart] = useState(0);
  const [showEndModal, setShowEndModal] = useState(false);
  const [winnerMessages, setWinnerMessages] = useState<Array<{ text: string; color: string }>>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingAutoRerollRef = useRef(false);
  const skipResolverRef = useRef<(() => void) | null>(null);
  const skipAllRef = useRef(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [chatVoteProgress, setChatVoteProgress] = useState(0);
  const [chatTriggerArmed, setChatTriggerArmed] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatVotersRef = useRef<Set<string>>(new Set());
  const startRaffleRef = useRef<(() => Promise<void>) | null>(null);
  const revealResolveRef = useRef<(() => void) | null>(null);
  const isCancelledRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const aoVivoRef = useRef<HTMLDivElement>(null);
  const [timeoutPopupTop, setTimeoutPopupTop] = useState(146);
  const { play } = useAudio();

  // Captura início da sessão
  useEffect(() => {
    setSessionStartTimestamp(Date.now());
    setSessionParticipantCount(0);
    setLiveViewerCount(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live timer
  useEffect(() => {
    const i = setInterval(() => setLiveSeconds(s => s + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Track AO VIVO clock position for timeout popup placement
  useEffect(() => {
    const update = () => {
      if (!aoVivoRef.current) return;
      const rect = aoVivoRef.current.getBoundingClientRect();
      setTimeoutPopupTop(rect.bottom + 20);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Viewer count polling — sums Twitch + Kick + YouTube
  useEffect(() => {
    const kickChannel = currentUser?.kickChannel;
    const youtubeChannel = currentUser?.youtubeChannel;
    const hasTwitch = twitchConnected && twitchConfig.channel;
    const hasKick = Boolean(kickChannel);
    const hasYoutube = Boolean(youtubeChannel);
    if (!hasTwitch && !hasKick && !hasYoutube) return;

    const fetchViewers = async () => {
      const [twitchResult, kickResult, ytResult] = await Promise.allSettled([
        hasTwitch
          ? fetch(`/api/twitch/viewers?channel=${encodeURIComponent(twitchConfig.channel)}`).then(r => r.json())
          : Promise.resolve({ isLive: false, viewerCount: 0 }),
        hasKick
          ? fetch(`/api/kick-viewers/${encodeURIComponent(kickChannel!)}`).then(r => r.json())
          : Promise.resolve({ isLive: false, viewerCount: 0 }),
        hasYoutube
          ? fetch(`/api/youtube-viewers?handle=${encodeURIComponent(youtubeChannel!)}`).then(r => r.json())
          : Promise.resolve({ isLive: false, viewerCount: 0 }),
      ]);

      const sum =
        (twitchResult.status === 'fulfilled' ? (twitchResult.value?.viewerCount ?? 0) : 0) +
        (kickResult.status === 'fulfilled' ? (kickResult.value?.viewerCount ?? 0) : 0) +
        (ytResult.status === 'fulfilled' ? (ytResult.value?.viewerCount ?? 0) : 0);

      setViewerCount(sum);
      setLiveViewerCount(sum);
      setSessionParticipantCount(Math.max(useStore.getState().sessionParticipantCount, sum));
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 60_000);
    return () => clearInterval(interval);
  }, [twitchConnected, twitchConfig.channel, currentUser?.kickChannel, currentUser?.youtubeChannel]);

  // Música ambiente do evento — toca enquanto a engine estiver montada, e
  // reage ao mute (audioEnabled) em tempo real: sem isso, apertar mute
  // durante o sorteio não parava a música já tocando.
  useEffect(() => {
    if (audioEnabled) eventMusic.start();
    else eventMusic.stop();
    return () => eventMusic.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEnabled]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-seleciona o primeiro prêmio se nenhum estiver selecionado
  useEffect(() => {
    if (!currentPrize && prizes.length > 0) {
      setCurrentPrize(prizes[0]);
    }
  }, [prizes, currentPrize, setCurrentPrize]);

  const canRaffle = participants.length > 0 && raffleStatus === 'idle' && !!currentPrize && currentPrize.quantity > 0 && !mascotDead;

  const cancelAutoTrigger = () => {
    if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
    setAutoCountdown(null);
    setChatTriggerArmed(false);
    setChatVoteProgress(0);
    chatVotersRef.current = new Set();
  };

  const skipableDelay = useCallback((ms: number) =>
    new Promise<void>(resolve => {
      if (skipAllRef.current) { resolve(); return; }
      const t = setTimeout(resolve, ms);
      skipResolverRef.current = () => { clearTimeout(t); resolve(); };
    }), []);

  const handleSkipAnimation = () => {
    skipAllRef.current = true;
    skipResolverRef.current?.();
    skipResolverRef.current = null;
  };

  const selectWinner = useCallback((): Participant => {
    // Weighted by tickets (chances). No tickets field => 1 chance, so default
    // raffles behave exactly as before.
    const total = participants.reduce((s, p) => s + Math.max(1, p.tickets ?? 1), 0);
    let r = Math.random() * total;
    for (const p of participants) {
      r -= Math.max(1, p.tickets ?? 1);
      if (r < 0) return p;
    }
    return participants[participants.length - 1];
  }, [participants]);

  const startRaffle = async () => {
    if (!canRaffle) return;
    cancelAutoTrigger();
    resetMascotRound();
    isCancelledRef.current = false;
    setCurrentWinner(null);
    setRaffleStatus('suspense');
    play('suspense');
    await skipableDelay(2000);
    if (isCancelledRef.current) return;
    setIsExploding(true);
    setIsScorched(true);
    setRaffleStatus('spinning');
    setSpinningNumber(true);
    play('spin');
    await skipableDelay(1400);
    if (isCancelledRef.current) return;
    setIsExploding(false);
    await skipableDelay(2800);
    if (isCancelledRef.current) return;
    const winner = selectWinner();
    setSpinningNumber(false);
    setCurrentWinner(winner);
    play('reveal');
    await skipableDelay(1800);
    if (isCancelledRef.current) return;
    skipAllRef.current = false;
    setRaffleStatus('revealing');
    if (autoRevealWinner) {
      await skipableDelay(2000);
    } else {
      await new Promise<void>(resolve => { revealResolveRef.current = resolve; });
    }
    if (isCancelledRef.current) return;
    setRaffleStatus('winner');
    play('victory');
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
    if (twitchConnected && twitchConfig.channel) {
      setRaffleStatus('validating');
      startValidation(winner);
    }
  };

  // Keep ref updated so armAutoRound's interval closure always calls the latest startRaffle
  startRaffleRef.current = startRaffle;

  const startValidation = (_winner: Participant) => {
    let countdown = twitchConfig.validationTimeout;
    setValidationCountdown(countdown);
    countdownRef.current = setInterval(() => {
      countdown--;
      setValidationCountdown(countdown);
      if (countdown <= 0) { stopValidation(); setRaffleStatus('timeout'); }
    }, 1000);
  };

  const stopValidation = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  const stopChatVerification = () => {
    if (chatCountdownRef.current) { clearInterval(chatCountdownRef.current); chatCountdownRef.current = null; }
  };

  const startChatVerification = () => {
    setWinnerChatMessage(null);
    setChatCountdown(30);
    setRaffleStatus('chat-verifying');
    let countdown = 30;
    chatCountdownRef.current = setInterval(() => {
      countdown--;
      setChatCountdown(countdown);
      if (countdown <= 0) {
        stopChatVerification();
        pendingAutoRerollRef.current = true;
        setCurrentWinner(null);
        setWinnerChatMessage(null);
        setRaffleStatus('idle');
      }
    }, 1000);
  };

  const armAutoRound = () => {
    const state = useStore.getState();
    if (state.raffleTriggerMode === 'auto') {
      cancelAutoTrigger();
      let remaining = state.autoRoundDelay;
      setAutoCountdown(remaining);
      autoTimerRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
          setAutoCountdown(null);
          startRaffleRef.current?.();
        } else {
          setAutoCountdown(remaining);
        }
      }, 1000);
    } else if (state.raffleTriggerMode === 'chat') {
      cancelAutoTrigger();
      chatVotersRef.current = new Set();
      setChatVoteProgress(0);
      setChatTriggerArmed(true);
    }
  };

  const confirmWinner = () => {
    stopValidation();
    stopChatVerification();
    setRaffleStatus('confirmed');
    if (!activePrize || !currentWinner) return;
    const historyId = `raffle_${Date.now()}`;
    addHistory({
      id: historyId,
      winner: currentWinner,
      prize: activePrize,
      streamer: currentUser?.username || 'Unknown',
      timestamp: Date.now(),
      confirmed: true,
    });
    if (isAffiliate && activePrize.pscValue && !activePrize.skipPsc) deductPSC(activePrize.pscValue);

    const winnerName = currentWinner.name;
    const prizeName = activePrize.name;
    const username = currentUser?.username;

    // Notifica ganhador no chat imediatamente ao confirmar
    const winnerSource = currentWinner.source ?? null;
    const channel = twitchConfig.channel || currentUser?.twitchChannel;
    if (channel) {
      fetch('/api/twitch/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, winnerName, prizeName, winnerSource }),
      })
        .then(r => r.json())
        .then(data => {
          if (!data?.ok) console.warn('[twitch/notify] bot não enviou:', data);
        })
        .catch(err => console.warn('[twitch/notify] erro de rede:', err));
    }

    const youtubeHandle = currentUser?.youtubeChannel;
    if (youtubeHandle) {
      fetch('/api/youtube/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeHandle, winnerName, prizeName, winnerSource }),
      })
        .then(r => r.json())
        .then(data => {
          if (!data?.ok) console.warn('[youtube/notify] bot não enviou:', data);
        })
        .catch(err => console.warn('[youtube/notify] erro de rede:', err));
    }

    const kickChannel = currentUser?.kickChannel;
    if (kickChannel) {
      fetch('/api/kick/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kickChannel, winnerName, prizeName, winnerSource }),
      })
        .then(r => r.json())
        .then(data => {
          if (!data?.ok) console.warn('[kick/notify] bot não enviou:', data);
        })
        .catch(err => console.warn('[kick/notify] erro de rede:', err));
    }

    // Aguarda trade link do ganhador. A compra + entrega no Waxpeer só acontece
    // depois que o tradeLink é recebido (via chat ou inserção manual), pois o
    // endpoint /buy-one-p2p precisa de partner+token para entregar direto na Steam.
    if (isAffiliate && username) {
      setPendingMarketplaceDelivery({ winnerName, prizeName, waxpeerItemId: null, status: 'waiting_tradelink' });
    }
    const newQty = activePrize.quantity - 1;
    updatePrize(activePrize.id, { quantity: newQty });
    if (newQty <= 0) {
      const hasMore = prizes.some(p => p.id !== activePrize.id && p.quantity > 0);
      if (!hasMore) {
        setTimeout(() => { reset(); setShowEndModal(true); }, 1800);
      } else {
        setTimeout(() => {
          const idx = prizes.indexOf(activePrize);
          const nextAfter = prizes.find((p, i) => i > idx && p.quantity > 0);
          const fallback = prizes.find(p => p.id !== activePrize.id && p.quantity > 0);
          setCurrentPrize(nextAfter ?? fallback ?? null);
          reset();
          armAutoRound();
        }, 1800);
      }
    } else {
      // Ainda tem quantidade: volta ao idle no mesmo prêmio automaticamente
      setTimeout(() => { reset(); armAutoRound(); }, 1800);
    }
  };

  const reroll = async () => {
    stopValidation(); stopChatVerification();
    setWinnerChatMessage(null); setCurrentWinner(null); setRaffleStatus('idle');
    await delay(500);
    startRaffle();
  };

  const reset = () => {
    isCancelledRef.current = true;
    skipAllRef.current = false;
    skipResolverRef.current?.();
    skipResolverRef.current = null;
    revealResolveRef.current?.();
    revealResolveRef.current = null;
    stopValidation(); stopChatVerification();
    cancelAutoTrigger();
    setWinnerChatMessage(null); setCurrentWinner(null);
    setRaffleStatus('idle'); setShowConfetti(false);
    setIsExploding(false); setIsScorched(false);
  };

  const goNextPrize = () => {
    const idx = prizes.findIndex(p => p.id === activePrize?.id);
    const remaining = prizes.filter(p => p.quantity > 0 && p.id !== activePrize?.id);
    const nextAfter = remaining.find((_, i, arr) => prizes.indexOf(arr[i]) > idx);
    const next = nextAfter ?? remaining[0] ?? null;
    setCurrentPrize(next);
    reset();
  };

  const exportResults = () => {
    if (!myHistory.length) return;
    const csv = [
      'Nº,Nome,Prêmio,Data,Confirmado',
      ...myHistory.map(r =>
        `${r.winner.number},"${r.winner.name}","${r.prize.name}",${new Date(r.timestamp).toLocaleString('pt-BR')},${r.confirmed ? 'Sim' : 'Não'}`
      ),
    ].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })),
      download: `sorteio_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (chatCountdownRef.current) clearInterval(chatCountdownRef.current);
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, []);

  // Chat-trigger mode: count unique voters and auto-start when threshold is reached
  useEffect(() => {
    if (!chatTriggerArmed || raffleStatus !== 'idle' || chatMessages.length === 0) return;
    const latest = chatMessages[chatMessages.length - 1];
    const state = useStore.getState();
    const cmd = state.chatTriggerCommand.trim().toLowerCase();
    if (latest.text.trim().toLowerCase() === cmd) {
      chatVotersRef.current.add(latest.username.toLowerCase());
      const count = chatVotersRef.current.size;
      setChatVoteProgress(count);
      if (count >= state.chatTriggerCount) {
        setChatTriggerArmed(false);
        chatVotersRef.current = new Set();
        startRaffleRef.current?.();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, chatTriggerArmed]);

  useEffect(() => {
    if (raffleStatus === 'chat-verified') stopChatVerification();
  }, [raffleStatus]);

  // Limpa mensagens acumuladas quando começa nova validação
  useEffect(() => {
    if (raffleStatus === 'validating') setWinnerMessages([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffleStatus]);

  // Acumula mensagens do ganhador durante validating e para o timer na primeira
  useEffect(() => {
    if (raffleStatus !== 'validating' || !currentWinner || chatMessages.length === 0) return;
    const latest = chatMessages[chatMessages.length - 1];
    if (latest.username.toLowerCase() === currentWinner.name.toLowerCase()) {
      setWinnerMessages(prev => {
        if (prev.length === 0) stopValidation();
        return [...prev, { text: latest.text, color: latest.color }];
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages]);

  useEffect(() => {
    if (raffleStatus === 'idle' && pendingAutoRerollRef.current && participants.length > 0) {
      pendingAutoRerollRef.current = false;
      const t = setTimeout(() => startRaffle(), 400);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raffleStatus]);

  const isIdle = raffleStatus === 'idle';
  const isSuspense = raffleStatus === 'suspense';
  const isSpinning = raffleStatus === 'spinning';
  const isRevealing = raffleStatus === 'revealing';
  const isWinner = raffleStatus === 'winner';
  const isValidating = raffleStatus === 'validating';
  const isChatVerifying = raffleStatus === 'chat-verifying';
  const isChatVerified = raffleStatus === 'chat-verified';
  const isConfirmed = raffleStatus === 'confirmed';
  const isTimeout = raffleStatus === 'timeout';
  const myHistory = history.filter(r => r.streamer === currentUser?.username);
  const isAnimating = isSuspense || isSpinning || isRevealing;
  const accent = themeColor;
  const accentRgb = hexToRgb(themeColor);
  const accentGrad = `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 50%, ${themeColor} 100%)`;

  const activePrize = currentPrize || prizes[0];
  const displayPrizes = prizes.length > 6 ? prizes.filter(p => p.quantity > 0) : prizes;

  // Garante que o prêmio ativo fique visível na janela de 6
  useEffect(() => {
    if (!activePrize) return;
    const dp = prizes.length > 6 ? prizes.filter(p => p.quantity > 0) : prizes;
    const idx = dp.findIndex(p => p.id === activePrize.id);
    if (idx < 0) return;
    setPrizeWindowStart(prev => {
      if (idx >= prev && idx < prev + 6) return prev;
      return Math.max(0, Math.min(idx, dp.length - 6));
    });
  }, [activePrize, prizes]);

  // ── BTN height shared ──────────────────────────────────────────────────────
  const BTN_H = '68px';
  const btnBase = { height: BTN_H };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Timeout popup — rendered via portal so fixed positioning is always relative to viewport */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {isTimeout && (
            <motion.div
              key="timeout-popup"
              initial={{ scale: 0.85, opacity: 0, y: -10, x: '-50%' }}
              animate={{ scale: 1, opacity: 1, y: 0, x: '-50%' }}
              exit={{ scale: 0.85, opacity: 0, y: -10, x: '-50%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{
                position: 'fixed',
                top: timeoutPopupTop,
                left: '50%',
                zIndex: 9999,
                borderRadius: '16px',
                overflow: 'hidden',
                textAlign: 'center',
                background: 'linear-gradient(145deg, rgba(10,14,40,0.82), rgba(5,8,22,0.82))',
                border: '1px solid rgba(255,68,68,0.5)',
                boxShadow: '0 0 60px rgba(255,68,68,0.25)',
                backdropFilter: 'blur(12px)',
                padding: '18px 28px',
                whiteSpace: 'nowrap',
              }}>
              <motion.div
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(45deg, transparent 30%, rgba(255,68,68,0.05) 50%, transparent 70%)', backgroundSize: '200% 100%' }}
                animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
                  <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.4, repeat: Infinity }} style={{ lineHeight: 1 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF4444" style={{ display: 'block', filter: 'drop-shadow(0 0 5px rgba(255,68,68,0.7))' }}>
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </motion.div>
                  <p className="font-orbitron font-black tracking-widest" style={{ fontSize: '18px', color: '#FF4444', textShadow: '0 0 18px rgba(255,68,68,0.5)', margin: 0 }}>
                    TEMPO ESGOTADO
                  </p>
                </div>
                <p className="font-rajdhani" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  Vencedor não respondeu
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <ConfettiExplosion active={showConfetti && eventEffect === 'confetti'} originX={50} originY={40} />
      <FireworksExplosion active={showConfetti && eventEffect === 'fireworks'} color={themeColor} />
      <SparklesExplosion active={showConfetti && eventEffect === 'sparkles'} color={themeColor} />

      {/* ── FIM DO SORTEIO modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEndModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.88)' }}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              className="relative rounded-3xl overflow-hidden mx-4 w-full max-w-sm text-center"
              style={{
                background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                border: `1px solid rgba(${accentRgb},0.4)`,
                boxShadow: `0 0 80px rgba(${accentRgb},0.2), 0 0 160px rgba(${accentRgb},0.08)`,
              }}>
              {/* shimmer */}
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: `linear-gradient(45deg, transparent 30%, rgba(${accentRgb},0.05) 50%, transparent 70%)`, backgroundSize: '200% 100%' }}
                animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />

              <div className="relative z-10 p-10 space-y-6">
                <motion.div className="text-6xl"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity }}>
                  🏆
                </motion.div>

                <div>
                  <p className="font-orbitron font-black text-3xl tracking-widest"
                    style={{ color: accent, textShadow: `0 0 40px rgba(${accentRgb},0.8)` }}>
                    FIM DO SORTEIO
                  </p>
                  <div className="h-0.5 w-24 mx-auto mt-3 rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
                </div>

                <p className="font-rajdhani text-white/40 tracking-widest text-sm">
                  Todos os prêmios foram sorteados!
                </p>

                <motion.button
                  onClick={() => {
                    setShowEndModal(false);
                    setSessionDuration(liveSeconds);
                    setRaffleStage(3);
                  }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-2xl font-orbitron font-bold tracking-widest text-base"
                  style={{
                    height: '54px',
                    background: accentGrad,
                    color: '#050816',
                    boxShadow: `0 0 30px rgba(${accentRgb},0.4)`,
                  }}>
                  FINALIZAR
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verification modal */}
      <AnimatePresence>
        {(isChatVerifying || isChatVerified) && currentWinner && (
          <WinnerVerificationModal
            winner={currentWinner} prize={activePrize} countdown={chatCountdown}
            chatMessage={winnerChatMessage} twitchConnected={twitchConnected}
            onConfirm={confirmWinner} onReroll={reroll}
            accent={accent} accentRgb={accentRgb} />
        )}
      </AnimatePresence>


      {/* Validating modal */}
      <AnimatePresence>
        {(isValidating || (isRevealing && !autoRevealWinner)) && currentWinner && (() => {
          return (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={isRevealing && !autoRevealWinner ? () => { revealResolveRef.current?.(); revealResolveRef.current = null; } : undefined}
              style={{ background: 'rgba(0,0,0,0.75)', cursor: isRevealing && !autoRevealWinner ? 'pointer' : 'default' }}>
              <motion.div
                initial={{ scale: 0.7, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="relative rounded-3xl overflow-hidden mx-4 w-full max-w-sm text-center"
                style={{
                  background: 'linear-gradient(145deg, rgba(10,14,40,0.98), rgba(5,8,22,0.98))',
                  border: `1px solid rgba(${accentRgb},0.45)`,
                  boxShadow: `0 0 80px rgba(${accentRgb},0.2)`,
                }}>
                <motion.div className="absolute inset-0 pointer-events-none"
                  style={{ background: `linear-gradient(45deg, transparent 30%, rgba(${accentRgb},0.05) 50%, transparent 70%)`, backgroundSize: '200% 100%' }}
                  animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
                <div className="relative z-10" style={{ padding: '36px 32px 28px' }}>
                  <p className="font-rajdhani text-xs tracking-[0.4em] text-white/40 uppercase" style={{ marginBottom: '20px' }}>Aguardando confirmação</p>
                  <div style={{ marginBottom: '28px' }}>
                    {isRevealing && !autoRevealWinner ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '150px', height: '38px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)' }} />
                        <div style={{ width: '52px', height: '16px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }} />
                      </div>
                    ) : (
                      <>
                        <p className="font-orbitron font-black text-3xl text-white leading-tight">{currentWinner.name}</p>
                        <p className="font-rajdhani text-sm text-white/30 mt-0.5">#{currentWinner.number}</p>
                      </>
                    )}
                  </div>
                  {isValidating && (
                    <>
                      <AnimatePresence mode="wait">
                        {winnerMessages.length > 0 ? (
                          <motion.div key="msgs"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            style={{ marginBottom: '28px', borderRadius: '14px', overflow: 'hidden', border: `1px solid rgba(${accentRgb},0.18)`, maxHeight: '140px', overflowY: 'auto' }}>
                            {winnerMessages.map((msg, i) => (
                              <motion.div key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.05 }}
                                style={{ padding: '8px 14px', background: i % 2 === 0 ? `rgba(${accentRgb},0.06)` : 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                                <span className="font-rajdhani font-bold text-sm" style={{ color: msg.color }}>{currentWinner.name}</span>
                                <span className="font-rajdhani text-white/40 text-sm">: </span>
                                <span className="font-rajdhani text-white/80 text-sm">{msg.text}</span>
                              </motion.div>
                            ))}
                          </motion.div>
                        ) : (
                          <motion.div key="timer" exit={{ opacity: 0 }} style={{ marginBottom: '28px' }}>
                            <div className="px-4 py-3 rounded-xl" style={{ background: `rgba(${accentRgb},0.07)`, border: `1px solid rgba(${accentRgb},0.18)`, marginBottom: '24px' }}>
                              <p className="font-rajdhani text-sm" style={{ color: `rgba(${accentRgb},0.7)` }}>
                                Aguardando mensagem no chat
                              </p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <div className="relative w-20 h-20">
                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
                                  <motion.circle cx="40" cy="40" r="34" fill="none"
                                    stroke={accent} strokeWidth="4" strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 34}`}
                                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - validationCountdown / twitchConfig.validationTimeout)}`}
                                    style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="font-orbitron font-bold text-xl" style={{ color: accent }}>{validationCountdown}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="flex gap-3 pt-2">
                        <motion.button onClick={reroll} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          className="flex-1 py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
                          style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', color: '#FFA500' }}>
                          🔄 REROLL
                        </motion.button>
                        <motion.button onClick={confirmWinner} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          className="flex-1 py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
                          style={{ background: `rgba(${accentRgb},0.15)`, border: `1px solid rgba(${accentRgb},0.4)`, color: accent }}>
                          ✓ CONFIRMAR
                        </motion.button>
                      </div>
                    </>
                  )}
                  {isRevealing && !autoRevealWinner && (
                    <div style={{ minHeight: '176px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                      <motion.div style={{ display: 'flex', gap: '14px' }}>
                        {[0, 1, 2].map(i => (
                          <motion.div key={i}
                            animate={{ scale: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }}
                            style={{ width: '10px', height: '10px', borderRadius: '50%', background: accent }} />
                        ))}
                      </motion.div>
                      <motion.p className="font-rajdhani text-xs tracking-widest uppercase"
                        animate={{ opacity: [0.25, 0.55, 0.25] }} transition={{ duration: 2, repeat: Infinity }}
                        style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Clique em qualquer lugar para revelar
                      </motion.p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Cinematic vignette */}
      <AnimatePresence>
        {!isIdle && (
          <motion.div className="fixed inset-0 z-30 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)' }} />
        )}
      </AnimatePresence>

      {/* ── 3-COLUMN MAIN ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* CENTER: Mascot + status + action buttons */}
        <div className="flex-1 flex flex-col min-h-0 relative">

          {/* Mascot area */}
          <div className="flex-1 relative min-h-0 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.005)', paddingBottom: '80px' }}>

            {/* Floating: Participantes — topo esquerdo */}
            {(() => {
              return (
                <div className="absolute top-5 left-5 z-10 rounded-2xl"
                  style={{
                    padding: '14px 20px',
                    background: 'rgba(0,0,0,0.15)',
                    border: `1px solid rgba(${accentRgb},0.30)`,
                    boxShadow: `0 0 28px rgba(${accentRgb},0.18), inset 0 0 20px rgba(${accentRgb},0.04)`,
                    backdropFilter: 'blur(10px)',
                  }}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={accent}>
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    <span className="font-rajdhani text-xs font-bold tracking-widest uppercase text-white">Participantes</span>
                  </div>
                  <div className="font-orbitron font-black text-3xl mb-0.5 text-center" style={{ color: accent, padding: '4px 12px' }}>
                    {participants.length.toLocaleString('pt-BR')}
                  </div>
                  <div className="font-rajdhani text-xs text-white/25 text-center">carregados</div>
                </div>
              );
            })()}

            {/* Floating: AO VIVO — topo centro */}
            {(() => {
              return (
                <div ref={aoVivoRef} className="absolute top-5 left-1/2 z-10 flex items-center gap-3 rounded-2xl"
                  style={{
                    transform: 'translateX(-50%)',
                    padding: '13px 22px',
                    background: 'rgba(5,8,22,0.18)',
                    border: `1px solid rgba(${accentRgb},0.35)`,
                  }}>
                  <motion.div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: accent }}
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  <span className="font-orbitron text-xs tracking-widest font-bold" style={{ color: accent }}>AO VIVO</span>
                  <span className="font-orbitron font-bold text-lg text-white tracking-widest" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(liveSeconds)}
                  </span>
                </div>
              );
            })()}


            {/* Floating: Prêmio Atual — topo direito */}
            <div className="absolute top-5 right-5 z-10 rounded-2xl flex items-center gap-5"
              style={{
                padding: '14px 20px',
                minWidth: '320px',
                background: 'rgba(0,0,0,0.15)',
                border: `1px solid rgba(${accentRgb},0.30)`,
                boxShadow: `0 0 28px rgba(${accentRgb},0.18), inset 0 0 20px rgba(${accentRgb},0.04)`,
                backdropFilter: 'blur(10px)',
              }}>
              {/* Left: info */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFD166">
                    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V17H7v2h10v-2h-4v-2.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 11.63 21 9.55 21 7V6c0-1.1-.9-2-2-2zM7 10.82C5.84 10.4 5 9.3 5 8V7h2v3.82zM19 8c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                  </svg>
                  <span className="font-rajdhani text-xs font-bold tracking-widest uppercase text-white">Prêmio Atual</span>
                </div>
                <div className="font-orbitron font-black text-xl mb-2 text-white truncate">
                  {activePrize?.name?.replace(/\s*\(.*?\)/g, '').trim() ?? '—'}
                </div>
                {activePrize && (
                  <div>
                    <div className="rounded inline-flex items-center justify-center font-orbitron font-bold"
                      style={{
                        minWidth: '28px', height: '20px',
                        padding: '0 6px',
                        fontSize: '10px',
                        background: '#00FF88',
                        color: '#050816',
                      }}>
                      {activePrize.quantity}x
                    </div>
                  </div>
                )}
              </div>
              {/* Right: prize image */}
              {activePrize?.imageUrl ? (
                <img src={activePrize.imageUrl} alt={activePrize.name}
                  className="object-contain flex-shrink-0"
                  style={{ width: '64px', height: '64px' }} />
              ) : (
                <div className="flex items-center justify-center flex-shrink-0 text-3xl"
                  style={{ width: '64px', height: '64px' }}>
                  🏆
                </div>
              )}
            </div>

            {/* Floating chat box */}
            <div className="absolute bottom-10 left-5 z-10 flex flex-col rounded-2xl overflow-hidden"
              style={{
                width: '272px',
                maxHeight: '320px',
                background: 'rgba(5,8,22,0.93)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}>
              <div className="flex items-center gap-3 flex-shrink-0"
                style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="font-orbitron text-white/40 tracking-widest text-xs">CHAT DA LIVE</span>
                <motion.div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              </div>
              <div className="overflow-y-auto space-y-3" style={{ padding: '16px 20px', scrollbarWidth: 'none' }}>
                {chatMessages.length === 0 ? (
                  <p className="font-rajdhani text-white/20 text-center tracking-wider leading-relaxed text-xs">
                    aguardando mensagens...
                  </p>
                ) : (
                  chatMessages.slice(-6).map(msg => (
                    <div key={msg.id} className="leading-relaxed break-words text-xs">
                      <span className="font-rajdhani font-bold" style={{ color: msg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {msg.source === 'twitch' && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#9147FF" style={{ flexShrink: 0 }}>
                            <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
                          </svg>
                        )}
                        {msg.source === 'kick' && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#53FC1C" style={{ flexShrink: 0 }}>
                            <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
                          </svg>
                        )}
                        {msg.source === 'youtube' && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
                            <path d="m10 15 5-3-5-3z"/>
                          </svg>
                        )}
                        {msg.username}
                      </span>
                      <span className="font-rajdhani text-white/25">: </span>
                      <span className="font-rajdhani text-white/65">{msg.text}</span>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Floating últimos sorteados box */}
            <div className="absolute bottom-10 right-5 z-10 flex flex-col rounded-2xl overflow-hidden"
              style={{
                width: '380px',
                maxHeight: '640px',
                background: 'rgba(5,8,22,0.93)',
                border: '1px solid rgba(255,255,255,0.09)',
              }}>
              <div className="flex items-center gap-3 flex-shrink-0"
                style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,209,102,0.6)">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span className="font-orbitron text-white/40 tracking-widest text-xs">ÚLTIMOS SORTEADOS</span>
              </div>
              <div className="overflow-y-auto space-y-3" style={{ padding: '16px 16px', scrollbarWidth: 'none' }}>
                {(() => {
                  const now = new Date();
                  const todayHistory = myHistory.filter(r => {
                    const d = new Date(r.timestamp);
                    return d.getFullYear() === now.getFullYear() &&
                           d.getMonth() === now.getMonth() &&
                           d.getDate() === now.getDate();
                  });
                  return todayHistory.length === 0 ? (
                    <p className="font-rajdhani text-white/20 text-center tracking-wider text-xs">nenhum sorteio hoje</p>
                  ) : (
                    todayHistory.slice(0, 5).map((result, i) => (
                      <motion.div key={result.id}
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 rounded-xl"
                        style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-orbitron font-black text-xs"
                          style={{ background: `linear-gradient(135deg, rgba(${accentRgb},0.2), rgba(168,85,247,0.3))`, border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                          {result.winner.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-rajdhani font-bold text-white/85 text-xs truncate" style={{ marginBottom: '4px' }}>{result.winner.name}</div>
                          <div className="font-rajdhani text-neon-gold/60 text-xs truncate">{result.prize.name.replace(/\s*\(.*?\)/g, '').trim()}</div>
                        </div>
                        <motion.div className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}>
                          {result.prize.imageUrl
                            ? <img src={result.prize.imageUrl} alt={result.prize.name} className="w-8 h-8 object-contain" />
                            : <span className="text-base">🏆</span>
                          }
                        </motion.div>
                      </motion.div>
                    ))
                  );
                })()}
              </div>
            </div>

            <ParticleCanvas count={40} intensity={isWinner ? 'high' : isSuspense ? 'medium' : 'low'}
              colors={isWinner ? ['#FFD166', '#FFA500', '#FF6B6B'] : undefined} />

            {/* Explosion flash */}
            <AnimatePresence>
              {isExploding && (
                <motion.div className="absolute inset-0 z-20 pointer-events-none"
                  initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.7, 0] }} exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, times: [0, 0.08, 0.4, 1] }}
                  style={{
                    background: 'radial-gradient(ellipse at 50% 55%, rgba(255,230,120,0.95) 0%, rgba(255,120,0,0.75) 35%, rgba(255,40,0,0.35) 65%, transparent 85%)',
                    mixBlendMode: 'screen',
                  }} />
              )}
            </AnimatePresence>

            <motion.div className="w-full h-full"
              style={{ marginTop: '-60px' }}
              animate={
                isExploding ? { x: [0, -10, 10, -7, 7, -4, 4, 0], y: [0, -6, 4, -5, 3, -2, 2, 0] } :
                isSuspense ? { scale: [1, 1.03, 1] } :
                isRevealing ? { scale: [1, 1.08, 1.05] } :
                isWinner ? { scale: 1.05 } : { scale: 1 }
              }
              transition={
                isExploding ? { duration: 0.5 } :
                isSuspense ? { duration: 0.5, repeat: Infinity } :
                { duration: 0.8, ease: [0.23, 1, 0.32, 1] }
              }>
              <MascotContainer isExploding={isExploding} isScorched={isScorched} withStage />
            </motion.div>

            {/* Show de luzes — animação canvas durante o sorteio */}
            <RaffleAnimation active={isAnimating || isWinner} animStyle={raffleAnimationStyle} />

            {/* PREPARANDO / SELECIONANDO / número final — entre AO VIVO e o mascote */}
            <div className="absolute left-0 right-0 flex flex-col items-center pointer-events-none" style={{ top: '90px', zIndex: 25 }}>
              <AnimatePresence mode="wait">
                {isSuspense && (
                  <motion.div key="suspense" className="text-center"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className="font-orbitron font-black text-3xl tracking-widest"
                      style={{ color: accent, textShadow: `0 0 40px rgba(${accentRgb},0.8)` }}
                      animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.4, repeat: Infinity }}>
                      PREPARANDO...
                    </motion.div>
                  </motion.div>
                )}
                {isSpinning && (
                  <motion.div key="spinning" className="text-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className="font-rajdhani text-sm tracking-[0.5em] text-white/50 uppercase mb-4"
                      animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.3, repeat: Infinity }}>
                      SELECIONANDO...
                    </motion.div>
                    <SpinAnimation effect={spinEffect} isSpinning={spinningNumber} winner={null} participants={participants} accent={accent} accentRgb={accentRgb} />
                  </motion.div>
                )}
                {(isRevealing || isWinner) && currentWinner && (
                  <motion.div key="number-reveal" className="text-center"
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}>
                    <SpinAnimation effect={spinEffect} isSpinning={false} winner={currentWinner} participants={participants} accent={accent} accentRgb={accentRgb} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status overlay — winner card / confirmed (centrado verticalmente) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 25 }}>
              <AnimatePresence mode="wait">
                {isWinner && currentWinner && (
                  <motion.div key="winner" className="text-center space-y-4 px-6 w-full max-w-md"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <WinnerCard winner={currentWinner} prize={activePrize} accentRgb={accentRgb} />
                  </motion.div>
                )}

                {isConfirmed && currentWinner && (
                  <motion.div key="confirmed" className="text-center space-y-3"
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <motion.div className="text-6xl"
                      animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.3, 1] }} transition={{ duration: 0.5 }}>
                      ✅
                    </motion.div>
                    <div className="font-orbitron font-bold text-2xl tracking-widest" style={{ color: accent }}>CONFIRMADO!</div>
                    <div className="font-rajdhani text-white font-bold text-xl">{currentWinner.name}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Neon vignette */}
            <AnimatePresence>
              {(isSuspense || isSpinning) && (
                <motion.div className="absolute inset-0 pointer-events-none"
                  initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.7, 0.3] }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  style={{ boxShadow: `inset 0 0 80px rgba(${accentRgb},0.5)` }} />
              )}
              {isWinner && (
                <motion.div className="absolute inset-0 pointer-events-none"
                  initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} exit={{ opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{ boxShadow: 'inset 0 0 80px rgba(255,209,102,0.4)' }} />
              )}
            </AnimatePresence>

            {/* AÇÃO DO SORTEIO — flutua sobre o mascote */}
            <AnimatePresence>
              {(isWinner || isTimeout || isConfirmed || isSuspense || isSpinning) && (
                <motion.div
                  style={{
                    position: 'absolute',
                    zIndex: 40,
                    left: '50%',
                    bottom: '20px',
                    width: '500px',
                    maxWidth: 'calc(100% - 48px)',
                    pointerEvents: 'all',
                  }}
                  initial={{ opacity: 0, y: 16, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 16, x: '-50%' }}
                  transition={{ duration: 0.25 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{
                      borderRadius: '16px',
                      overflow: 'hidden',
                      background: 'rgba(6,8,22,0.96)',
                      border: '1px solid rgba(200,20,20,0.3)',
                      boxShadow: '-10px 0 36px rgba(180,10,10,0.18), 10px 0 36px rgba(180,10,10,0.18)',
                      backdropFilter: 'blur(16px)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="font-orbitron" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.35em', color: '#FFD166' }}>
                          ⚡ AÇÃO DO SORTEIO ⚡
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', padding: '8px 16px' }}>
                        {(isSuspense || isSpinning) ? (
                          <>
                            <motion.button onClick={handleSkipAnimation}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                height: '40px', padding: '0 16px', borderRadius: '10px',
                                background: `rgba(${accentRgb},0.1)`, border: `1px solid rgba(${accentRgb},0.35)`,
                                color: accent, cursor: 'pointer',
                              }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
                              </svg>
                              <span className="font-orbitron" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>PULAR ANIMAÇÃO</span>
                            </motion.button>
                            <motion.button onClick={reset}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                height: '40px', padding: '0 16px', borderRadius: '10px',
                                background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)',
                                color: '#FF4444', cursor: 'pointer',
                              }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                              </svg>
                              <span className="font-orbitron" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>CANCELAR</span>
                            </motion.button>
                          </>
                        ) : (
                          <>
                            {(isWinner || isTimeout) && (
                              <motion.button onClick={reroll}
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                style={{
                                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                  height: '40px', padding: '0 16px', borderRadius: '10px',
                                  background: 'rgba(109,40,217,0.9)', boxShadow: '0 0 22px rgba(109,40,217,0.38)',
                                  color: '#fff', border: 'none', cursor: 'pointer',
                                }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                                </svg>
                                <span className="font-orbitron" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>REROLL</span>
                              </motion.button>
                            )}
                            <motion.button onClick={goNextPrize}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                height: '40px', padding: '0 16px', borderRadius: '10px',
                                background: 'rgba(15,20,45,0.95)', border: '1px solid rgba(255,255,255,0.12)',
                                color: '#fff', cursor: 'pointer',
                              }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                              </svg>
                              <span className="font-orbitron" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em' }}>PULAR</span>
                            </motion.button>
                          </>
                        )}
                      </div>
                    </div>
                    {isWinner && (
                      <motion.button onClick={startChatVerification}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        className="font-rajdhani font-bold tracking-widest"
                        style={{
                          width: '100%', height: BTN_H, borderRadius: '14px',
                          background: `rgba(${accentRgb},0.12)`, border: `1px solid rgba(${accentRgb},0.35)`,
                          color: accent, fontSize: '14px', letterSpacing: '0.12em', cursor: 'pointer',
                        }}>
                        CONFIRMAR
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* INICIAR SORTEIO — flutua sobre a borda inferior da área do mascote */}
          <AnimatePresence>
            {isIdle && (
              <motion.div className="absolute z-30 pointer-events-none"
                style={{ left: 0, right: 0, bottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}>
                {mascotDead && (
                  <motion.div
                    className="text-center mb-2 font-orbitron text-xs tracking-wider"
                    style={{ color: '#00FF99', pointerEvents: 'none' }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.2, repeat: Infinity }}>
                    ⚰ MASCOTE MORTO — aguardando ressurreição...
                  </motion.div>
                )}
                {!mascotDead && participants.length > 0 && !currentPrize && (
                  <div className="text-center mb-2 font-orbitron text-xs tracking-wider"
                    style={{ color: 'rgba(255,180,0,0.85)', pointerEvents: 'none' }}>
                    Selecione um prêmio para sortear
                  </div>
                )}
                {!mascotDead && currentPrize && currentPrize.quantity <= 0 && (
                  <div className="text-center mb-2 font-orbitron text-xs tracking-wider"
                    style={{ color: 'rgba(255,80,80,0.9)', pointerEvents: 'none' }}>
                    Prêmio esgotado — selecione outro
                  </div>
                )}

                {/* Auto countdown banner */}
                {autoCountdown !== null && (
                  <div className="flex items-center gap-3 mb-2 pointer-events-all"
                    style={{ background: `rgba(${accentRgb},0.08)`, border: `1px solid rgba(${accentRgb},0.3)`, borderRadius: '10px', padding: '8px 14px' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={accent}>
                      <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                    <span className="font-orbitron font-bold text-xs" style={{ color: accent, letterSpacing: '0.1em' }}>
                      PRÓXIMO ROUND EM {autoCountdown}s
                    </span>
                    <button onClick={cancelAutoTrigger}
                      className="font-orbitron font-bold"
                      style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: '4px' }}>
                      ✕ CANCELAR
                    </button>
                  </div>
                )}

                {/* Chat vote progress banner */}
                {chatTriggerArmed && (
                  <div className="flex flex-col gap-2 mb-2 pointer-events-all"
                    style={{ background: `rgba(${accentRgb},0.08)`, border: `1px solid rgba(${accentRgb},0.3)`, borderRadius: '10px', padding: '8px 14px', minWidth: '240px' }}>
                    <div className="flex items-center gap-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={accent}>
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                      </svg>
                      <span className="font-orbitron font-bold text-xs" style={{ color: accent, letterSpacing: '0.1em' }}>
                        {chatVoteProgress} / {chatTriggerCount} {chatTriggerCommand}
                      </span>
                      <button onClick={cancelAutoTrigger}
                        className="font-orbitron font-bold"
                        style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer', background: 'none', border: 'none', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: '4px' }}>
                        ✕
                      </button>
                    </div>
                    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <motion.div
                        animate={{ width: `${Math.min(100, (chatVoteProgress / chatTriggerCount) * 100)}%` }}
                        transition={{ duration: 0.3 }}
                        style={{ height: '100%', borderRadius: '2px', background: accent, boxShadow: `0 0 8px rgba(${accentRgb},0.6)` }}
                      />
                    </div>
                  </div>
                )}

                <motion.button onClick={startRaffle} disabled={!canRaffle}
                  whileHover={canRaffle ? { scale: 1.05 } : {}} whileTap={canRaffle ? { scale: 0.96 } : {}}
                  className="relative rounded-xl font-orbitron font-bold text-sm tracking-widest overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{
                    pointerEvents: 'all',
                    height: '40px',
                    padding: '0 28px',
                    background: canRaffle ? accentGrad : 'rgba(255,255,255,0.05)',
                    boxShadow: canRaffle ? `0 0 40px rgba(${accentRgb},0.5), 0 0 80px rgba(${accentRgb},0.2)` : 'none',
                    color: canRaffle ? '#050816' : 'rgba(255,255,255,0.3)',
                  }}>
                  {canRaffle && (
                    <motion.div className="absolute inset-0 shimmer-bg"
                      animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                    </svg>
                    {autoCountdown !== null || chatTriggerArmed ? 'INICIAR AGORA' : 'INICIAR SORTEIO'}
                  </span>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

      {/* ── PRIZE STRIP ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-2"
        style={{ background: 'rgba(5,8,22,0.97)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0" style={{ marginLeft: '12px' }}>
            <span className="font-rajdhani text-xs text-white tracking-widest uppercase whitespace-nowrap">Próximos Sorteios</span>
            <svg width="20" height="13" viewBox="0 0 20 13" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="0" y1="6.5" x2="15" y2="6.5"/>
              <polyline points="9,1 15,6.5 9,12"/>
            </svg>
          </div>
          {displayPrizes.length > 6 && (
            <button
              onClick={() => setPrizeWindowStart(s => Math.max(0, s - 1))}
              disabled={prizeWindowStart === 0}
              className="flex-shrink-0 p-1 rounded transition-all"
              style={{ color: prizeWindowStart === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
          )}
          <div className="flex-1 flex flex-col" style={{ gap: 0 }}>
            <div className="grid gap-2 items-center" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {displayPrizes.slice(prizeWindowStart, prizeWindowStart + 6).map((prize, i) => {
              const isActivePrize = activePrize?.id === prize.id;
              const globalIndex = prizeWindowStart + i;
              return (
                <button key={prize.id}
                  onClick={() => isIdle && prize.quantity > 0 && !isActivePrize && setCurrentPrize(prize)}
                  className="relative flex flex-row items-center gap-2 rounded-2xl transition-all overflow-hidden my-1"
                  style={{
                    minWidth: 0,
                    padding: '14px 10px',
                    opacity: prize.quantity <= 0 ? 0.4 : 1,
                    background: isActivePrize
                      ? `linear-gradient(160deg, rgba(${accentRgb},0.1), rgba(${accentRgb},0.04))`
                      : 'rgba(255,255,255,0.03)',
                    border: isActivePrize ? `1px solid rgba(${accentRgb},0.4)` : '1px solid rgba(255,255,255,0.07)',
                    cursor: isIdle && prize.quantity > 0 ? 'pointer' : 'default',
                    boxShadow: isActivePrize ? `0 0 24px rgba(${accentRgb},0.12)` : 'none',
                  }}>
                  {/* top accent line when active */}
                  {isActivePrize && (
                    <div className="absolute top-0 left-0 right-0"
                      style={{ height: '2px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
                  )}
                  {/* Left: imagem grande */}
                  <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '44px', height: '44px' }}>
                    {prize.imageUrl ? (
                      <img src={prize.imageUrl} alt="" className="object-contain rounded-lg w-full h-full" />
                    ) : (
                      <span className="text-2xl leading-none">{PRIZE_ICONS[globalIndex % PRIZE_ICONS.length]}</span>
                    )}
                  </div>
                  {/* Right: nome + quantidade */}
                  <div className="flex flex-col flex-1 min-w-0 gap-1">
                    <span className="font-rajdhani font-bold text-xs leading-tight"
                      style={{
                        color: '#ffffff',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textAlign: 'left',
                      }}>
                      {prize.name.replace(/\s*\(.*?\)/g, '').trim()}
                    </span>
                    <span className="font-orbitron px-1.5 py-0.5 rounded self-start"
                      style={{
                        fontSize: '9px',
                        background: isActivePrize ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.06)',
                        color: isActivePrize ? 'rgba(0,255,136,0.9)' : 'rgba(255,255,255,0.25)',
                        letterSpacing: '0.05em',
                      }}>
                      {prize.quantity}x
                    </span>
                  </div>
                </button>
              );
            })}
            </div>
            {/* Timeline — mesmo grid dos cards, dot alinhado por coluna */}
            {(() => {
              const slice = displayPrizes.slice(prizeWindowStart, prizeWindowStart + 6);
              const n = slice.length;
              if (n === 0) return null;
              return (
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: 'repeat(6, 1fr)', padding: '4px 0 2px' }}
                >
                  {slice.map((prize, i) => {
                    const isActive = activePrize?.id === prize.id;
                    const isDone   = prize.quantity <= 0;
                    const isFirst  = i === 0;
                    const isLast   = i === n - 1;
                    return (
                      <div
                        key={prize.id}
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}
                      >
                        {/* linha conectora — segmento por célula, cobre o gap de 8px entre células */}
                        {n > 1 && (
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left:  isFirst ? '50%' : '-4px',
                            right: isLast  ? '50%' : '-4px',
                            height: '1px',
                            background: 'rgba(0,255,136,0.18)',
                            transform: 'translateY(-50%)',
                            zIndex: 0,
                          }} />
                        )}
                        <motion.div
                          animate={isActive ? {
                            boxShadow: [
                              '0 0 5px #00FF88, 0 0 12px rgba(0,255,136,0.55)',
                              '0 0 10px #00FF88, 0 0 26px rgba(0,255,136,0.92)',
                              '0 0 5px #00FF88, 0 0 12px rgba(0,255,136,0.55)',
                            ],
                          } : {}}
                          transition={{ duration: 1.4, repeat: Infinity }}
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            width:  isActive ? 10 : 6,
                            height: isActive ? 10 : 6,
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: isActive
                              ? '#00FF88'
                              : isDone
                              ? 'rgba(0,255,136,0.10)'
                              : 'rgba(0,255,136,0.28)',
                            transition: 'width 0.3s, height 0.3s, background 0.3s',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          {displayPrizes.length > 6 && (
            <button
              onClick={() => setPrizeWindowStart(s => Math.min(s + 1, displayPrizes.length - 6))}
              disabled={prizeWindowStart >= displayPrizes.length - 6}
              className="flex-shrink-0 p-1 rounded transition-all"
              style={{ color: prizeWindowStart >= prizes.length - 6 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── BOTTOM BAR ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-7 py-5"
        style={{ background: 'rgba(3,5,15,0.96)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>

        {/* Sair do sorteio */}
        <motion.button
          onClick={() => { reset(); setRaffleStage(1); }}
          whileHover={{ color: '#FF4444' }}
          className="flex items-center gap-2 font-rajdhani text-xs tracking-widest transition-all"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          SAIR DO SORTEIO
        </motion.button>

        {/* Live info */}
        <div className="flex items-center gap-2 font-rajdhani text-xs text-white/20">
          {(() => {
            const channelName = (twitchConnected && twitchConfig.channel)
              ? twitchConfig.channel
              : currentUser?.kickChannel || currentUser?.youtubeChannel || currentUser?.username || '';
            return viewerCount !== null && viewerCount > 0 ? (
              <>
                <span>Transmitido ao vivo para</span>
                <span className="font-orbitron font-bold" style={{ color: 'rgba(145,71,255,0.85)', fontSize: 11 }}>
                  {viewerCount.toLocaleString('pt-BR')}
                </span>
                <span>pessoa{viewerCount !== 1 ? 's' : ''}</span>
                {channelName && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="font-orbitron font-bold" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                      {channelName}
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1.5 ml-1">
                  {twitchConnected && twitchConfig.channel && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(145,71,255,0.6)">
                      <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
                    </svg>
                  )}
                  {currentUser?.kickChannel && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(83,252,28,0.6)">
                      <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
                    </svg>
                  )}
                  {currentUser?.youtubeChannel && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,0,0,0.6)">
                      <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.8 5 12 5 12 5s-4.8 0-7 .1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.3.9C6.8 19 12 19 12 19s4.8 0 7-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM9.8 14.5V9l5.4 2.8-5.4 2.7z"/>
                    </svg>
                  )}
                </span>
              </>
            ) : (
              <>
                <span>Sorteio transmitido ao vivo</span>
                {channelName && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="font-orbitron font-bold" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                      {channelName}
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1.5 ml-1">
                  {twitchConnected && twitchConfig.channel && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(145,71,255,0.6)">
                      <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
                    </svg>
                  )}
                  {currentUser?.kickChannel && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(83,252,28,0.6)">
                      <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
                    </svg>
                  )}
                  {currentUser?.youtubeChannel && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,0,0,0.6)">
                      <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.8 5 12 5 12 5s-4.8 0-7 .1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.3.9C6.8 19 12 19 12 19s4.8 0 7-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM9.8 14.5V9l5.4 2.8-5.4 2.7z"/>
                    </svg>
                  )}
                </span>
              </>
            );
          })()}
        </div>

        {/* Export */}
        <motion.button
          onClick={exportResults}
          disabled={!myHistory.length}
          whileHover={myHistory.length ? { color: accent } : {}}
          className="flex items-center gap-2 font-rajdhani text-xs tracking-widest transition-all disabled:opacity-20"
          style={{ color: 'rgba(255,255,255,0.3)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/>
          </svg>
          EXPORTAR RESULTADOS
        </motion.button>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
