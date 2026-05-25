'use client';
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import ConfettiExplosion from '@/components/effects/ConfettiExplosion';
import FireworksExplosion from '@/components/effects/FireworksExplosion';
import SparklesExplosion from '@/components/effects/SparklesExplosion';
import { useEventMusic } from '@/hooks/useEventMusic';
import type { EventMusicTrack, EventEffectType } from '@/types';

type ActionKey = 'tema' | 'fundo' | 'musica' | 'efeitos';

const COLOR_PRESETS: { name: string; color: string }[] = [
  { name: 'Verde Ganja', color: '#00FFA3' },
  { name: 'Azul Neon',   color: '#00E5FF' },
  { name: 'Roxo Cyber',  color: '#A050FF' },
  { name: 'Rosa Hype',   color: '#FF4081' },
  { name: 'Laranja Fogo',color: '#FF8A3D' },
  { name: 'Amarelo Ouro',color: '#FFD166' },
];

const MUSIC_TRACKS: { id: EventMusicTrack; name: string; desc: string }[] = [
  { id: 'cyberpunk', name: 'CYBERPUNK',   desc: 'Synth pesado e tenso, perfeito pro hype' },
  { id: 'epic',      name: 'ÉPICO',       desc: 'Pads orquestrais — momento grandioso' },
  { id: 'lofi',      name: 'LO-FI CHILL',desc: 'Vibe relax, sorteios casuais' },
  { id: 'off',       name: 'SEM MÚSICA',  desc: 'Apenas SFX do sorteio' },
];

const EFFECT_OPTIONS: { id: EventEffectType; name: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'confetti',  name: 'CONFETES',   desc: 'Chuva colorida ao revelar o vencedor',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 22l4.5-9 4.5 4.5L2 22zm12.5-13.5l-6 6 4 4 6-6c1.1-1.1 1.1-2.9 0-4-.6-.6-1.4-.9-2.1-.9s-1.4.3-1.9.9zM5 12c-.5 0-1-.2-1.4-.6-.8-.8-.8-2 0-2.8L5.7 6.5c-.4-2 .2-4.1 1.8-5.6.7-.7 1.7-.7 2.4 0s.7 1.7 0 2.4C9.5 3.7 9.2 4.5 9.2 5.4c.9-.1 1.7.2 2.4.9.8.8.8 2 0 2.8l-5 5c-.5.4-1 .6-1.6.6z"/></svg> },
  { id: 'fireworks', name: 'FOGOS',      desc: 'Explosões cinematográficas multicoloridas',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13.5 7L18 6L14.5 9.5L19 12L14 12.5L15 17L12 14L9 17L10 12.5L5 12L9.5 9.5L6 6L10.5 7L12 2Z"/></svg> },
  { id: 'sparkles',  name: 'BRILHOS',   desc: 'Estrelas douradas sobem em câmera lenta',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2 8 8 2-8 2-2 8-2-8-8-2 8-2z"/></svg> },
  { id: 'none',      name: 'SEM EFEITO',desc: 'Foco total no resultado, sem distração',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M6 6l12 12"/></svg> },
];

interface IconProps { color: string; size?: number }

const ICON_TEMA = ({ color, size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M21 12.7c0 4.9-4 8.9-8.9 8.9-1.4 0-2.5-.4-2.5-1.5 0-1.4 1.5-1.6 1.5-2.9 0-1-.8-1.8-1.8-1.8H7c-3.3 0-6-2.7-6-6C1 4.8 5.8 0 11.6 0 17.1 0 21 4.2 21 9.6v3.1z" fill={color}/>
    <circle cx="6.5" cy="9" r="1.5" fill="#fff"/>
    <circle cx="11" cy="5" r="1.5" fill="#fff"/>
    <circle cx="16.5" cy="7.5" r="1.5" fill="#fff"/>
    <circle cx="17.5" cy="13" r="1.5" fill="#fff"/>
  </svg>
);
const ICON_FUNDO = ({ color, size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.9 13.98l2.1 2.53 3.1-3.99L18 18H6l2.9-4.02z"/>
  </svg>
);
const ICON_MUSICA = ({ color, size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>
);
const ICON_EFEITOS = ({ color, size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 1l2.5 6.5L21 9l-5 4.5L17.5 21 12 17.5 6.5 21 8 13.5 3 9l6.5-1.5z"/>
  </svg>
);

function CrownIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2 18l2.5-8L9 14l3-8 3 8 4.5-4L22 18H2z" fill={color} stroke={color} strokeWidth="0.5"
        style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
      <rect x="2" y="18" width="20" height="2" rx="1" fill={color} opacity="0.7" />
    </svg>
  );
}

/* ─── Shared modal + preview state lives here, rendered once ─────────────── */
interface EventActionsState {
  open: ActionKey | null;
  setOpen: (v: ActionKey | null) => void;
  previewEffect: EventEffectType;
  triggerPreview: (e: EventEffectType) => void;
  playMusicPreview: (t: EventMusicTrack) => void;
  fileRef: React.RefObject<HTMLInputElement>;
}

function useEventActionsState(): EventActionsState {
  const { setEventBackground, eventMusic, setEventMusic } = useStore();
  const [open, setOpen] = useState<ActionKey | null>(null);
  const [previewEffect, setPreviewEffect] = useState<EventEffectType>('none');
  const fileRef = useRef<HTMLInputElement>(null!);
  const music = useEventMusic();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setEventBackground(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  // attach onChange imperatively since we share fileRef
  if (fileRef.current && !fileRef.current.onchange) {
    fileRef.current.onchange = handleFile as unknown as ((this: GlobalEventHandlers, ev: Event) => unknown);
  }

  const triggerPreview = (effect: EventEffectType) => {
    setPreviewEffect('none');
    requestAnimationFrame(() => {
      setPreviewEffect(effect);
      setTimeout(() => setPreviewEffect('none'), 3500);
    });
  };

  const playMusicPreview = (track: EventMusicTrack) => {
    music.stop();
    setEventMusic(track);
    if (track === 'off') return;
    requestAnimationFrame(() => {
      music.start(track);
      setTimeout(() => music.stop(), 4000);
    });
  };

  void eventMusic; // consumed via store inside music hooks

  return { open, setOpen, previewEffect, triggerPreview, playMusicPreview, fileRef };
}

/* ─── EventHeader — the green "EVENTO ATUAL" strip ──────────────────────── */
export function EventHeader() {
  const { themeColor, currentUser, participants, prizes } = useStore();
  const displayName = (currentUser?.displayName || currentUser?.username || 'EVENTO').toUpperCase();

  const hasParticipants = participants.length > 0;
  const hasPrizes = prizes.some(p => p.quantity > 0);

  const status = !hasParticipants
    ? { label: 'AGUARDANDO PARTICIPANTES', color: '#FF9500', icon: (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
        </svg>
      )}
    : !hasPrizes
      ? { label: 'AGUARDANDO PRÊMIOS', color: '#A050FF', icon: (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M20 12v-2h-2V8c0-1.1-.9-2-2-2h-2V4h-4v2H8C6.9 6 6 6.9 6 8v2H4v2h2v8h12v-8h2zm-6 0H10V8h4v4z"/>
            <rect x="1" y="8" width="22" height="4" rx="1" opacity="0"/>
            <path d="M12 2C10.3 2 8 3.5 8 6h8c0-2.5-2.3-4-4-4z"/>
          </svg>
        )}
      : { label: 'TUDO PRONTO', color: '#00FFA3', icon: (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        )};

  return (
    <div
      className="relative flex flex-col items-center text-center gap-1 px-4 py-3 rounded-2xl overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, ${themeColor}22 0%, transparent 70%), linear-gradient(180deg, rgba(5,8,22,0.6) 0%, rgba(5,8,22,0.85) 100%)`,
        border: `1px solid ${themeColor}25`,
        boxShadow: `0 0 32px ${themeColor}18, inset 0 1px 0 ${themeColor}30`,
      }}
    >
      {/* Glow blob behind title */}
      <div
        style={{
          position: 'absolute',
          top: '30%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '180px', height: '60px',
          background: themeColor,
          borderRadius: '50%',
          filter: 'blur(32px)',
          opacity: 0.18,
          pointerEvents: 'none',
        }}
      />

      <span className="font-rajdhani tracking-[0.3em] uppercase relative" style={{ fontSize: '9px', color: `${themeColor}99` }}>
        ▸ EVENTO ATUAL ◂
      </span>

      <div className="flex items-center gap-2 relative">
        <CrownIcon color={themeColor} />
        <h2
          className="font-orbitron font-black tracking-widest"
          style={{
            fontSize: '16px',
            color: themeColor,
            textShadow: `0 0 18px ${themeColor}cc, 0 0 36px ${themeColor}55`,
            letterSpacing: '0.1em',
          }}
        >
          {displayName} LIVE
        </h2>
        <CrownIcon color={themeColor} />
      </div>

      {/* Status badge */}
      <motion.div
        key={status.label}
        initial={{ opacity: 0, y: -4, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative flex items-center"
        style={{
          gap: '6px',
          padding: '4px 12px 4px 8px',
          borderRadius: '999px',
          background: `${status.color}18`,
          border: `1px solid ${status.color}45`,
          boxShadow: hasPrizes && hasParticipants
            ? `0 0 14px ${status.color}35, 0 0 28px ${status.color}18`
            : `0 0 8px ${status.color}20`,
        }}
      >
        {/* Pulsing dot */}
        <motion.div
          animate={{ opacity: [1, 0.25, 1], scale: [1, 0.8, 1] }}
          transition={{ repeat: Infinity, duration: hasPrizes && hasParticipants ? 2 : 1.2, ease: 'easeInOut' }}
          style={{
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: status.color,
            boxShadow: `0 0 6px ${status.color}`,
            flexShrink: 0,
          }}
        />
        <span style={{ color: status.color, display: 'flex', alignItems: 'center' }}>
          {status.icon}
        </span>
        <span className="font-orbitron font-bold" style={{ fontSize: '8.5px', letterSpacing: '0.08em', color: status.color }}>
          {status.label}
        </span>
      </motion.div>

      <p className="font-rajdhani tracking-wide relative" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
        Prepare tudo e deixe sua comunidade no hype!
      </p>
    </div>
  );
}

/* ─── EventButtons — 4 buttons + modals (place wherever needed) ─────────── */

let _sharedState: EventActionsState | null = null;

export function EventButtons() {
  const { themeColor, eventBackground, setEventBackground, eventMusic, eventEffect, setEventEffect } = useStore();
  const state = useEventActionsState();
  _sharedState = state;
  const { open, setOpen, previewEffect, triggerPreview, playMusicPreview, fileRef } = state;

  const buttons: { key: ActionKey; label: string; Icon: React.FC<IconProps> }[] = [
    { key: 'tema',    label: 'TEMA',    Icon: ICON_TEMA    },
    { key: 'fundo',   label: 'FUNDO',   Icon: ICON_FUNDO   },
    { key: 'musica',  label: 'MÚSICA',  Icon: ICON_MUSICA  },
    { key: 'efeitos', label: 'EFEITOS', Icon: ICON_EFEITOS },
  ];

  return (
    <>
      {/* Preview effects */}
      <ConfettiExplosion active={previewEffect === 'confetti'} originX={50} originY={40} />
      <FireworksExplosion active={previewEffect === 'fireworks'} color={themeColor} />
      <SparklesExplosion active={previewEffect === 'sparkles'} color={themeColor} />

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => setEventBackground(ev.target?.result as string);
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
      />

      {/* 1 row of 4 buttons */}
      <div className="grid grid-cols-4 gap-2 w-full">
        {buttons.map(({ key, label, Icon }) => (
          <motion.button
            key={key}
            onClick={() => setOpen(key)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-2 transition-all"
            style={{
              background: `linear-gradient(135deg, ${themeColor}0f, rgba(255,255,255,0.02))`,
              border: `1px solid ${themeColor}2e`,
            }}
          >
            <Icon color={themeColor} size={18} />
            <span className="font-orbitron font-bold tracking-widest text-white" style={{ fontSize: '10px' }}>
              {label}
            </span>
            <span className="font-rajdhani tracking-widest" style={{ fontSize: '9px', color: `${themeColor}99` }}>
              VER ▸
            </span>
          </motion.button>
        ))}
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.72)' }}
            onClick={() => setOpen(null)}
          >
            <motion.div
              className="relative w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                border: `1px solid ${themeColor}40`,
                boxShadow: `0 0 80px ${themeColor}1a`,
              }}
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ height: '3px', background: `linear-gradient(90deg, ${themeColor}, ${themeColor}55)` }} />
              <div className="p-6 space-y-4">
                {/* Modal header */}
                <div className="flex items-center justify-between">
                  <span className="font-orbitron text-xs tracking-widest" style={{ color: themeColor }}>
                    {open === 'tema'    && 'TEMA DO EVENTO'}
                    {open === 'fundo'   && 'FUNDO DO EVENTO'}
                    {open === 'musica'  && 'MÚSICA DO EVENTO'}
                    {open === 'efeitos' && 'EFEITOS DO SORTEIO'}
                  </span>
                  <button onClick={() => setOpen(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>

                {/* TEMA */}
                {open === 'tema' && <TemaPanel themeColor={themeColor} />}

                {/* FUNDO */}
                {open === 'fundo' && (
                  <FundoPanel
                    themeColor={themeColor}
                    eventBackground={eventBackground}
                    setEventBackground={setEventBackground}
                    onPickFile={() => fileRef.current?.click()}
                  />
                )}

                {/* MÚSICA */}
                {open === 'musica' && (
                  <MusicaPanel
                    themeColor={themeColor}
                    eventMusic={eventMusic}
                    onSelect={playMusicPreview}
                  />
                )}

                {/* EFEITOS */}
                {open === 'efeitos' && (
                  <EfeitosPanel
                    themeColor={themeColor}
                    eventEffect={eventEffect}
                    setEventEffect={setEventEffect}
                    onPreview={triggerPreview}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Default export — both header + buttons (backward compat) ───────────── */
export default function EventActions() {
  return (
    <div className="flex flex-col gap-4">
      <EventHeader />
      <EventButtons />
    </div>
  );
}

/* ─── Sub-panels ─────────────────────────────────────────────────────────── */

export function TemaPanel({ themeColor }: { themeColor: string }) {
  const { setThemeColor } = useStore();
  return (
    <div className="space-y-4">
      <p className="font-rajdhani text-xs text-white/40 tracking-wide leading-relaxed">
        A cor será aplicada nos destaques, brilhos e títulos do evento.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {COLOR_PRESETS.map(p => (
          <button key={p.color} onClick={() => setThemeColor(p.color)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all"
            style={{
              background: themeColor === p.color ? `${p.color}1a` : 'rgba(255,255,255,0.03)',
              border: themeColor === p.color ? `1.5px solid ${p.color}` : '1px solid rgba(255,255,255,0.08)',
              boxShadow: themeColor === p.color ? `0 0 14px ${p.color}55` : 'none',
            }}>
            <span className="w-7 h-7 rounded-full" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} />
            <span className="font-rajdhani text-[10px] tracking-widest text-white/60">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
        <span className="font-rajdhani text-xs text-white/35 tracking-wider uppercase">
          Cor personalizada — {themeColor}
        </span>
      </div>
    </div>
  );
}

export function FundoPanel({ themeColor, eventBackground, setEventBackground, onPickFile }: {
  themeColor: string;
  eventBackground: string | null;
  setEventBackground: (v: string | null) => void;
  onPickFile: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden"
        style={{ height: '130px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
        {eventBackground ? (
          <>
            <img src={eventBackground} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', filter:'brightness(0.45)' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-rajdhani text-xs text-white/50 tracking-wider">Preview do fundo</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.12)">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            <span className="font-rajdhani text-xs text-white/25 tracking-wider">Nenhum fundo definido</span>
          </div>
        )}
      </div>
      <motion.button onClick={onPickFile} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className="w-full py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm"
        style={{ background: `${themeColor}1f`, border: `1px solid ${themeColor}59`, color: themeColor }}>
        {eventBackground ? 'TROCAR IMAGEM' : 'ESCOLHER IMAGEM'}
      </motion.button>
      {eventBackground && (
        <button onClick={() => setEventBackground(null)}
          className="w-full py-2 rounded-xl font-rajdhani text-xs tracking-widest transition-all"
          style={{ color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
          REMOVER FUNDO
        </button>
      )}
    </div>
  );
}

export function MusicaPanel({ themeColor, eventMusic, onSelect }: {
  themeColor: string;
  eventMusic: EventMusicTrack;
  onSelect: (t: EventMusicTrack) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-rajdhani text-xs text-white/40 tracking-wide">
        Trilha durante o sorteio. Clique para selecionar e ouvir prévia.
      </p>
      {MUSIC_TRACKS.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
          style={{
            background: eventMusic === t.id ? `${themeColor}15` : 'rgba(255,255,255,0.03)',
            border: eventMusic === t.id ? `1.5px solid ${themeColor}` : '1px solid rgba(255,255,255,0.06)',
          }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${themeColor}20`, border: `1px solid ${themeColor}40` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={themeColor}><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div className="flex-1">
            <p className="font-orbitron font-bold text-xs tracking-widest text-white">{t.name}</p>
            <p className="font-rajdhani text-xs text-white/40">{t.desc}</p>
          </div>
          {eventMusic === t.id && (
            <span className="font-rajdhani text-xs font-bold tracking-widest" style={{ color: themeColor }}>ATIVO</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function EfeitosPanel({ themeColor, eventEffect, setEventEffect, onPreview }: {
  themeColor: string;
  eventEffect: EventEffectType;
  setEventEffect: (e: EventEffectType) => void;
  onPreview: (e: EventEffectType) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-rajdhani text-xs text-white/40 tracking-wide">
        Animação exibida quando o vencedor é revelado.
      </p>
      {EFFECT_OPTIONS.map(e => (
        <button key={e.id}
          onClick={() => { setEventEffect(e.id); onPreview(e.id); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
          style={{
            background: eventEffect === e.id ? `${themeColor}15` : 'rgba(255,255,255,0.03)',
            border: eventEffect === e.id ? `1.5px solid ${themeColor}` : '1px solid rgba(255,255,255,0.06)',
            color: eventEffect === e.id ? themeColor : 'rgba(255,255,255,0.5)',
          }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${themeColor}20`, border: `1px solid ${themeColor}40`, color: themeColor }}>
            {e.icon}
          </div>
          <div className="flex-1">
            <p className="font-orbitron font-bold text-xs tracking-widest text-white">{e.name}</p>
            <p className="font-rajdhani text-xs text-white/40">{e.desc}</p>
          </div>
          {eventEffect === e.id && (
            <span className="font-rajdhani text-xs font-bold tracking-widest" style={{ color: themeColor }}>ATIVO</span>
          )}
        </button>
      ))}
    </div>
  );
}
