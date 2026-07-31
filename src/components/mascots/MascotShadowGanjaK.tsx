'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { RaffleStatus } from '@/types';
import { useStore } from '@/store/useStore';

interface Props {
  status: RaffleStatus;
  winnerNumber?: number | null;
  isExploding?: boolean;
  isScorched?: boolean;
}

type FrameNum = 1 | 2 | 3 | 4 | 5;

// ── Layout math ──────────────────────────────────────────────────────────────
// Container: 300×380px (same as existing Nakelas wrapper)
// Images are square (≈500×500). With objectFit:contain + objectPosition:bottom
// they render as 300×300, anchored at the bottom → top of image = y 80 in container.
//
// Frame3/4 blunt tip: ≈57% left, ≈52% top of image
//   x = 300 × 0.57 = 171  →  using 174 (slight right-of-center for the mouth side)
//   y = 80 + 300 × 0.52 = 236
//
// Frame5 dreads smoke: scattered horizontally, top of head ≈ y 108–120 in container
const BLUNT = { x: 174, y: 236 } as const;

// Deterministic ash particles — fixed values to avoid SSR/client hydration mismatch
const ASH = [
  { id: 0,  x: 40,  dx: 15,   delay: 0.00, dur: 2.8, sz: 2.5 },
  { id: 1,  x: 66,  dx: -12,  delay: 0.25, dur: 3.2, sz: 2.0 },
  { id: 2,  x: 93,  dx: 18,   delay: 0.10, dur: 2.5, sz: 3.0 },
  { id: 3,  x: 114, dx: -9,   delay: 0.40, dur: 3.0, sz: 2.0 },
  { id: 4,  x: 135, dx: 12,   delay: 0.15, dur: 2.6, sz: 2.5 },
  { id: 5,  x: 156, dx: -18,  delay: 0.35, dur: 3.4, sz: 2.0 },
  { id: 6,  x: 174, dx: 14,   delay: 0.05, dur: 2.9, sz: 3.0 },
  { id: 7,  x: 195, dx: -11,  delay: 0.30, dur: 2.7, sz: 2.0 },
  { id: 8,  x: 216, dx: 9,    delay: 0.20, dur: 3.1, sz: 2.5 },
  { id: 9,  x: 240, dx: -15,  delay: 0.45, dur: 2.8, sz: 2.0 },
  { id: 10, x: 51,  dx: 17,   delay: 0.50, dur: 3.3, sz: 1.8 },
  { id: 11, x: 126, dx: -13,  delay: 0.55, dur: 3.0, sz: 1.5 },
  { id: 12, x: 183, dx: -8,   delay: 0.70, dur: 2.8, sz: 2.0 },
  { id: 13, x: 225, dx: 9,    delay: 0.65, dur: 3.2, sz: 2.5 },
  { id: 14, x: 84,  dx: -17,  delay: 0.60, dur: 2.6, sz: 2.2 },
  { id: 15, x: 144, dx: 11,   delay: 0.80, dur: 3.0, sz: 1.8 },
  { id: 16, x: 207, dx: -14,  delay: 0.85, dur: 2.7, sz: 2.2 },
  { id: 17, x: 258, dx: 6,    delay: 0.75, dur: 3.1, sz: 1.5 },
] as const;

// Spark directions for Frame4 explosion
const SPARKS = [
  { angle: -90, dist: 62, color: '#FFD700' },
  { angle: -65, dist: 55, color: '#FF8800' },
  { angle: -45, dist: 70, color: '#FFEE55' },
  { angle: -25, dist: 50, color: '#FF6600' },
  { angle:  -5, dist: 74, color: '#FFD700' },
  { angle:  20, dist: 58, color: '#FF4400' },
  { angle:  45, dist: 64, color: '#FFAA00' },
  { angle:  70, dist: 46, color: '#FFD700' },
  { angle:  95, dist: 56, color: '#FF8800' },
  { angle: 120, dist: 52, color: '#FF4400' },
  { angle:-120, dist: 60, color: '#FF6600' },
  { angle:-150, dist: 48, color: '#FFEE55' },
  { angle:-170, dist: 66, color: '#FFD700' },
] as const;

// Smoke wisps for Frame5 (rising from scorched dreads)
const DREADS_SMOKE = [
  { sx: 108, sy: 118, c1x: 100, c1y: 96,  ex: 106, ey: 76 },
  { sx: 150, sy: 103, c1x: 158, c1y: 81,  ex: 152, ey: 61 },
  { sx: 190, sy: 115, c1x: 198, c1y: 92,  ex: 190, ey: 72 },
  { sx: 130, sy: 108, c1x: 121, c1y: 85,  ex: 128, ey: 65 },
  { sx: 168, sy: 110, c1x: 176, c1y: 88,  ex: 170, ey: 68 },
] as const;

function playPunchSound() {
  try {
    if (!useStore.getState().audioEnabled) return;
    const Ctx = (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // Low-freq body thud
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(160, now);
    thudOsc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
    thudGain.gain.setValueAtTime(0, now);
    thudGain.gain.linearRampToValueAtTime(0.9, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.22);

    // High-freq crack (noise burst)
    const sampleCount = Math.floor(ctx.sampleRate * 0.06);
    const noiseBuf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1200;
    bpf.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.75, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noiseSource.connect(bpf);
    bpf.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);

    setTimeout(() => { try { ctx.close(); } catch { /* */ } }, 600);
  } catch { /* ignore */ }
}

export default function MascotShadowGanjaK({ status }: Props) {
  const [currentFrame, setCurrentFrame] = useState<FrameNum>(1);
  const [prevFrame, setPrevFrame]       = useState<FrameNum | null>(null);
  const [transitionDur, setTransitionDur] = useState(0.5);
  const [showFlash, setShowFlash]       = useState(false);
  const [showRevealBlast, setShowRevealBlast] = useState(false);
  const timersRef       = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sequenceStarted = useRef(false);

  const { mascotSocoKey, mascotChuteKey, mascotHp, mascotMaxHp, mascotDead, reviveMascot, raffleStage } = useStore();
  const [showSoco, setShowSoco] = useState(false);
  const [showChute, setShowChute] = useState(false);
  const [ripTimer, setRipTimer] = useState(5);
  const shakeControls = useAnimation();

  // Auto-revive after 5 seconds when dead — disabled in stage 3
  useEffect(() => {
    if (!mascotDead) { setRipTimer(5); return; }
    if (raffleStage === 3) return;
    setRipTimer(5);
    const interval = setInterval(() => setRipTimer(t => t - 1), 1000);
    const reviveTimeout = setTimeout(() => { reviveMascot(); }, 5000);
    return () => { clearInterval(interval); clearTimeout(reviveTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascotDead, raffleStage]);

  useEffect(() => {
    if (mascotSocoKey === 0) return;
    playPunchSound();
    setShowSoco(true);
    shakeControls.start({
      x: [-12, 16, -9, 13, -6, 8, -3, 5, -1, 2, 0],
      y: [-6, 8, -5, 6, -3, 4, -1, 2, 0],
      transition: { duration: 0.40, ease: 'linear' },
    });
    const t = setTimeout(() => setShowSoco(false), 540);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascotSocoKey]);

  useEffect(() => {
    if (mascotChuteKey === 0) return;
    playPunchSound();
    setShowChute(true);
    shakeControls.start({
      x: [-6, 8, -5, 7, -3, 5, -2, 3, 0],
      y: [-14, 18, -10, 14, -7, 9, -3, 5, -1, 2, 0],
      transition: { duration: 0.40, ease: 'linear' },
    });
    const t = setTimeout(() => setShowChute(false), 540);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mascotChuteKey]);

  // ── Animation sequence driver ─────────────────────────────────────────────
  useEffect(() => {
    const add = (cb: () => void, ms: number) => {
      const t = setTimeout(cb, ms);
      timersRef.current.push(t);
    };
    const clearAll = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    if (status === 'idle') {
      clearAll();
      sequenceStarted.current = false;
      setShowFlash(false);
      setShowRevealBlast(false);
      setPrevFrame(null);
      setTransitionDur(0.5);
      setCurrentFrame(1);
      return;
    }

    // Start the 5-frame sequence once — don't restart on intermediate status changes
    // (suspense → spinning → revealing → winner → etc.)
    if (sequenceStarted.current) return;
    sequenceStarted.current = true;
    setCurrentFrame(1);
    setPrevFrame(null);
    setTransitionDur(0.5);

    // go(ms, from, to, fadeSec)
    // Schedules: at ms → begin crossfade from→to; clear prevFrame after fade
    const go = (ms: number, from: FrameNum, to: FrameNum, fadeSec: number) => {
      add(() => {
        setPrevFrame(from);
        setTransitionDur(fadeSec);
        setCurrentFrame(to);
        if (to === 4) {
          setShowFlash(true);
          add(() => setShowFlash(false), 680);
        }
      }, ms);
      add(() => setPrevFrame(null), ms + Math.round(fadeSec * 1000) + 90);
    };

    // Timeline (absolute from sequence start):
    //  t =    0 ms  Frame1 shown (idle breathing)
    //  t = 2000 ms  → Frame2 (0.3 s fade)   [blunt raised]
    //  t = 3500 ms  → Frame3 (0.4 s fade)   [blunt in mouth, smoke]
    //  t = 5500 ms  → Frame4 (0.1 s cut)    [spark explosion + shake]
    //  t = 6050 ms  reveal blast fires       [gold shockwave rings]
    //  t = 6300 ms  → Frame5 (0.2 s fade)   [scorched, particles]
    //  t = 6850 ms  reveal blast ends
    go(2000, 1, 2, 0.30);
    go(3500, 2, 3, 0.40);
    go(5500, 3, 4, 0.10);
    add(() => { setShowRevealBlast(true);  }, 6050);
    add(() => { setShowRevealBlast(false); }, 6050 + 800);
    go(6300, 4, 5, 0.20);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  // ── Derived booleans for per-frame effects ────────────────────────────────
  const isIdleLoop = currentFrame === 1 && !sequenceStarted.current;
  const f3 = currentFrame === 3;
  const f4 = currentFrame === 4;
  const f5 = currentFrame === 5;

  // Flash radial center in percentage for CSS
  const flashCX = ((BLUNT.x / 300) * 100).toFixed(1);
  const flashCY = ((BLUNT.y / 380) * 100).toFixed(1);

  const hpPct = mascotMaxHp > 0 ? mascotHp / mascotMaxHp : 0;
  const hpColor = hpPct > 0.6 ? '#00FF99' : hpPct > 0.3 ? '#FFD166' : '#FF4444';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-end">

      {/* ── HP Bar (only in stage 1, when HP is initialised) ─── */}
      {mascotMaxHp > 0 && raffleStage === 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30" style={{ width: 220 }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-orbitron font-bold" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>
              BOSS HP
            </span>
            <span className="font-orbitron font-bold" style={{ fontSize: 9, color: hpColor }}>
              {mascotHp}/{mascotMaxHp}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${hpPct * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ background: `linear-gradient(90deg, ${hpColor}, ${hpColor}88)`, boxShadow: `0 0 8px ${hpColor}66` }}
            />
          </div>
        </div>
      )}

      {/* ── Coffin (shown when dead) ─── */}
      <AnimatePresence>
        {mascotDead && (
          <motion.div
            key="coffin"
            className="absolute inset-0 flex flex-col items-center justify-end z-40"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="220" height="360" viewBox="0 0 240 440" fill="none" style={{ filter: 'drop-shadow(0 0 18px rgba(0,255,153,0.55))' }}>
              <defs>
                <linearGradient id="greenGlowCoffin" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00FF99"/>
                  <stop offset="100%" stopColor="#32CD32"/>
                </linearGradient>
                <filter id="glowCoffin">
                  <feGaussianBlur stdDeviation="7" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="smokeCoffin">
                  <feGaussianBlur stdDeviation="10"/>
                </filter>
              </defs>
              <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
                {/* Fumaça */}
                <circle cx="70" cy="50" r="25" fill="#66FFAA" opacity="0.12" filter="url(#smokeCoffin)"/>
                <circle cx="160" cy="70" r="30" fill="#66FFAA" opacity="0.1" filter="url(#smokeCoffin)"/>
                <circle cx="120" cy="35" r="22" fill="#66FFAA" opacity="0.15" filter="url(#smokeCoffin)"/>
                {/* Caixão */}
                <polygon points="120,15 210,90 185,410 55,410 30,90" fill="#07110B" stroke="url(#greenGlowCoffin)" strokeWidth="6" filter="url(#glowCoffin)"/>
                {/* Interior */}
                <polygon points="120,40 188,100 168,385 72,385 52,100" fill="#0B1B10" stroke="#00FF99" strokeWidth="2" opacity="0.9"/>
                {/* Folha central */}
                <g transform="translate(120 200) scale(1.1)">
                  <path d="M0 -60 C10 -35 12 -15 5 5 C20 -10 30 -20 45 -25 C35 -5 28 10 15 20 C35 18 50 22 65 35 C40 38 20 35 0 28 C-20 35 -40 38 -65 35 C-50 22 -35 18 -15 20 C-28 10 -35 -5 -45 -25 C-30 -20 -20 -10 -5 5 C-12 -15 -10 -35 0 -60Z" fill="#00FF7F" stroke="#7CFFB2" strokeWidth="3" filter="url(#glowCoffin)"/>
                </g>
                {/* Texto RIP */}
                <text x="120" y="340" textAnchor="middle" fill="#00FF99" fontSize="20" fontFamily="Arial" fontWeight="bold" letterSpacing="2">
                  RIP SESSION
                </text>
                {/* Partículas */}
                <circle cx="65" cy="120" r="3" fill="#00FF99" opacity="0.8"/>
                <circle cx="175" cy="140" r="2" fill="#00FF99" opacity="0.7"/>
                <circle cx="90" cy="360" r="2" fill="#00FF99" opacity="0.6"/>
                <circle cx="160" cy="320" r="3" fill="#00FF99" opacity="0.8"/>
              </g>
            </svg>
            {/* Countdown */}
            <div className="absolute bottom-6 font-orbitron font-bold text-center"
              style={{ fontSize: 11, color: 'rgba(0,255,153,0.7)', letterSpacing: '0.1em' }}>
              ressuscitando em {Math.max(0, ripTimer)}s...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Soco shake wrapper */}
      <motion.div
        animate={mascotDead ? {} : shakeControls}
        style={{ width: 300, height: 380, position: 'relative', opacity: mascotDead ? 0 : 1 }}
      >
      {/* Fixed-size wrapper — same dimensions as MascotNakelas */}
      <motion.div
        className="relative"
        style={{ width: 300, height: 380, position: 'absolute', inset: 0 }}
        // Per-frame body motion
        animate={
          f4
            ? { x: [0, -15, 15, -11, 11, -7, 7, -4, 4, -2, 2, 0], y: [0, -7, 5, -4, 3, -2, 1, 0] }
            : f5
            ? { rotate: [0, -1, 1, -0.7, 0.7, -0.4, 0.4, 0] }
            : isIdleLoop
            ? { scale: [1, 1.02, 1] }
            : {}
        }
        transition={
          f4
            ? { duration: 0.6, ease: 'linear' }
            : f5
            ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }
            : isIdleLoop
            ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.8 }
        }
      >
        {/* ── Stacked frames with crossfade ── */}
        <motion.div
          style={{ position: 'absolute', inset: 0 }}
          animate={{ opacity: showChute ? 0 : 1 }}
          transition={{ duration: showChute ? 0.025 : 0.12, ease: 'easeOut' }}
        >
          {([1, 2, 3, 4, 5] as FrameNum[]).map(fn => (
            <motion.img
              key={fn}
              src={`/sg/frame${fn}.png`}
              alt={`ShadowGanjaK frame ${fn}`}
              draggable={false}
              initial={{ opacity: fn === 1 ? 1 : 0 }}
              animate={{
                opacity: fn === currentFrame ? 1 : fn === prevFrame ? 0 : 0,
              }}
              transition={{
                duration:
                  fn === currentFrame ? transitionDur
                  : fn === prevFrame  ? transitionDur * 0.85
                  : 0,
                ease: 'easeInOut',
              }}
              style={{
                position: 'absolute',
                bottom: 0, left: 0,
                width: '100%', height: '100%',
                objectFit: 'contain',
                objectPosition: 'bottom',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          ))}
        </motion.div>

        {/* ════════════════════════════════════════════════════════
            FRAME 3 — animated smoke wisps rising from blunt tip
        ════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {f3 && (
            <motion.svg
              key="smoke-f3"
              className="absolute pointer-events-none"
              viewBox="0 0 300 380"
              style={{ inset: 0, width: '100%', height: '100%', zIndex: 5 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {([0, 1, 2, 3] as const).map(i => {
                const offsets = [-4, 2, -1, 5];
                const ox = BLUNT.x + offsets[i];
                const oy = BLUNT.y;
                return (
                  <motion.path
                    key={i}
                    fill="none"
                    stroke={`rgba(${180 + i * 5},${165 + i * 4},${145 + i * 3},0.52)`}
                    strokeLinecap="round"
                    animate={{
                      d: [
                        `M ${ox} ${oy - 5} Q ${ox + 9}  ${oy - 20} ${ox - 6}  ${oy - 38}`,
                        `M ${ox} ${oy - 5} Q ${ox - 10} ${oy - 26} ${ox + 7}  ${oy - 47}`,
                        `M ${ox} ${oy - 5} Q ${ox + 11} ${oy - 33} ${ox - 5}  ${oy - 57}`,
                      ],
                      opacity: [0, 0.65, 0],
                      strokeWidth: [2.5, 3.6, 0.5],
                    }}
                    transition={{
                      duration: 2.2 + i * 0.28,
                      repeat: Infinity,
                      delay: i * 0.55,
                      ease: 'linear',
                    }}
                  />
                );
              })}
            </motion.svg>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════
            FRAME 4 — orange explosion flash overlay
        ════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              key="flash-f4"
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 10,
                background: `radial-gradient(ellipse at ${flashCX}% ${flashCY}%,
                  rgba(255,215,80,0.96) 0%,
                  rgba(255,110,0,0.78) 28%,
                  rgba(255,40,0,0.28)  62%,
                  transparent 82%)`,
                mixBlendMode: 'screen',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.88, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.62, times: [0, 0.07, 0.38, 1] }}
            />
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════
            FRAME 4 — spark particles radiating from blunt tip
        ════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {f4 && (
            <motion.svg
              key="sparks-f4"
              className="absolute pointer-events-none"
              viewBox="0 0 300 380"
              overflow="visible"
              style={{ inset: 0, width: '100%', height: '100%', zIndex: 8 }}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {SPARKS.map((p, i) => {
                const rad = (p.angle * Math.PI) / 180;
                const ex = BLUNT.x + Math.cos(rad) * p.dist;
                const ey = BLUNT.y + Math.sin(rad) * p.dist;
                return (
                  <motion.circle
                    key={i}
                    cx={BLUNT.x} cy={BLUNT.y}
                    r={2.6}
                    fill={p.color}
                    animate={{
                      cx: [BLUNT.x, ex],
                      cy: [BLUNT.y, ey],
                      opacity: [1, 0],
                      r: [2.6, 0.4],
                    }}
                    transition={{
                      duration: 0.52 + i * 0.018,
                      delay: i * 0.012,
                      ease: 'easeOut',
                    }}
                  />
                );
              })}
              {/* Central flash circle */}
              <motion.circle
                cx={BLUNT.x} cy={BLUNT.y} r={6}
                fill="rgba(255,240,160,0.9)"
                animate={{ r: [6, 28], opacity: [0.9, 0] }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </motion.svg>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════
            FRAME 5 — residual smoke rising from scorched dreads
        ════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {f5 && (
            <motion.svg
              key="smoke-f5"
              className="absolute pointer-events-none"
              viewBox="0 0 300 380"
              style={{ inset: 0, width: '100%', height: '100%', zIndex: 5 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {DREADS_SMOKE.map((s, i) => (
                <motion.path
                  key={i}
                  fill="none"
                  stroke="rgba(95, 70, 50, 0.42)"
                  strokeLinecap="round"
                  animate={{
                    d: [
                      `M ${s.sx} ${s.sy} Q ${s.c1x}     ${s.c1y}      ${s.ex}     ${s.ey}`,
                      `M ${s.sx} ${s.sy} Q ${s.c1x - 8} ${s.c1y - 11} ${s.ex + 6} ${s.ey - 19}`,
                      `M ${s.sx} ${s.sy} Q ${s.c1x + 9} ${s.c1y - 21} ${s.ex - 5} ${s.ey - 36}`,
                    ],
                    opacity: [0, 0.52, 0],
                    strokeWidth: [1.8, 2.9, 0.4],
                  }}
                  transition={{
                    duration: 2.9,
                    repeat: Infinity,
                    delay: i * 0.58,
                    ease: 'linear',
                  }}
                />
              ))}
            </motion.svg>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════
            FRAME 5 — falling ash / ember particles
        ════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {f5 && (
            <motion.div
              key="ash-f5"
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ zIndex: 6 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {ASH.map(p => (
                <motion.div
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    width: p.sz,
                    height: p.sz,
                    background:
                      p.id % 3 === 0 ? '#7A4520'
                      : p.id % 3 === 1 ? '#5C3010'
                      : '#9B5530',
                    boxShadow: `0 0 ${p.sz + 1}px rgba(255,120,50,0.32)`,
                  }}
                  animate={{
                    top:    [-5, 392],
                    left:   [p.x, p.x + p.dx],
                    opacity: [0, 0.88, 0.88, 0],
                    scale:   [1, 0.65],
                  }}
                  transition={{
                    duration: p.dur,
                    delay:    p.delay,
                    repeat:   Infinity,
                    ease:     'linear',
                    times:    [0, 0.07, 0.88, 1],
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        {/* ════════════════════════════════════════════════════════
            FRAME 4 → 5 TRANSITION — gold reveal explosion
        ════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showRevealBlast && (
            <motion.div
              key="reveal-blast"
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 15 }}
            >
              {/* Radial flash centered on head */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse at 50% 33%, rgba(255,255,200,0.99) 0%, rgba(255,230,60,0.90) 18%, rgba(255,150,0,0.58) 44%, transparent 70%)',
                  mixBlendMode: 'screen',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.88, 0] }}
                transition={{ duration: 0.72, times: [0, 0.06, 0.36, 1] }}
              />
              {/* Shockwave ring 1 */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  border: '3px solid rgba(255,220,50,0.95)',
                  left: '50%', top: '33%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 12px rgba(255,200,0,0.6)',
                }}
                initial={{ width: 28, height: 28, opacity: 0.95 }}
                animate={{ width: 480, height: 480, opacity: 0 }}
                transition={{ duration: 0.65, ease: 'easeOut' }}
              />
              {/* Shockwave ring 2 — delayed, slightly smaller */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  border: '2px solid rgba(255,180,30,0.75)',
                  left: '50%', top: '33%',
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ width: 28, height: 28, opacity: 0 }}
                animate={{ width: 370, height: 370, opacity: [0, 0.72, 0] }}
                transition={{ duration: 0.60, delay: 0.10, ease: 'easeOut' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════
            !SOCO — SocoGanja.png overlay + impact flash
        ════════════════════════════════════════════════════════ */}
        <motion.img
          src="/sg/soco.png"
          alt="soco"
          draggable={false}
          animate={{ opacity: showSoco ? 1 : 0 }}
          transition={{ duration: showSoco ? 0.025 : 0.12, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'bottom',
            zIndex: 25,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        <AnimatePresence>
          {showSoco && (
            <motion.div
              key="soco-impact"
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 26,
                background: 'radial-gradient(ellipse at 50% 38%, rgba(255,60,0,0.72) 0%, rgba(255,120,0,0.42) 35%, transparent 65%)',
                mixBlendMode: 'screen',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, times: [0, 0.06, 1] }}
            />
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════
            !CHUTE — GanjaChute.png overlay + impact flash
        ════════════════════════════════════════════════════════ */}
        <motion.img
          src="/sg/chute.png"
          alt="chute"
          draggable={false}
          animate={{ opacity: showChute ? 1 : 0 }}
          transition={{ duration: showChute ? 0.025 : 0.12, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'bottom',
            zIndex: 25,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        <AnimatePresence>
          {showChute && (
            <motion.div
              key="chute-impact"
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 26,
                background: 'radial-gradient(ellipse at 50% 60%, rgba(255,60,0,0.72) 0%, rgba(255,120,0,0.42) 35%, transparent 65%)',
                mixBlendMode: 'screen',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, times: [0, 0.06, 1] }}
            />
          )}
        </AnimatePresence>

      </motion.div>
      </motion.div>
    </div>
  );
}
