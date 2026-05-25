'use client';
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import ParticipantImport from '@/components/participants/ParticipantImport';
import PrizeManager, { type PrizeManagerHandle } from '@/components/prizes/PrizeManager';
import MascotContainer from '@/components/mascots/MascotContainer';
import MascotNakelas from '@/components/mascots/MascotNakelas';
import MascotShadowGanjaK from '@/components/mascots/MascotShadowGanjaK';
import StageBase from '@/components/mascots/StageBase';
import { EventHeader, TemaPanel, FundoPanel, MusicaPanel, EfeitosPanel } from '@/components/raffle/EventActions';
import ConfettiExplosion from '@/components/effects/ConfettiExplosion';
import FireworksExplosion from '@/components/effects/FireworksExplosion';
import SparklesExplosion from '@/components/effects/SparklesExplosion';
import { useEventMusic } from '@/hooks/useEventMusic';
import AnimationPreviewMini from '@/components/effects/AnimationPreviewMini';
import type { RaffleSpinEffect, RaffleTriggerMode, EventMusicTrack, EventEffectType, RaffleAnimationStyle } from '@/types';

const ANIMATION_STYLES: { id: RaffleAnimationStyle; name: string; desc: string; emoji: string }[] = [
  { id: 'balada',   name: 'BALADA',   desc: 'Holofotes triangulares coloridos oscilando com fade trail', emoji: '🎡' },
  { id: 'concerto', name: 'CONCERTO', desc: 'Feixes curvos azul/branco/ciano varrendo devagar', emoji: '🎵' },
  { id: 'fogos',    name: 'FOGOS',    desc: 'Foguetes sobem e explodem em faíscas coloridas', emoji: '🎆' },
  { id: 'scifi',    name: 'SCI-FI',   desc: 'Anéis pulsantes e raios rotatórios verde/teal', emoji: '🤖' },
];

const SPIN_EFFECTS: { id: RaffleSpinEffect; name: string; desc: string; emoji: string }[] = [
  { id: 'numbers',   name: 'NÚMEROS ALEATÓRIOS', desc: 'Os números rolam rápido até parar no vencedor', emoji: '🔢' },
  { id: 'name-reel', name: 'LISTA DE NOMES',     desc: 'Nomes dos participantes passam em alta velocidade (estilo slot) até parar no vencedor', emoji: '📜' },
  { id: 'wheel',     name: 'RODA DA FORTUNA',    desc: 'Roleta circular gira e ponteiro indica o vencedor', emoji: '🎡' },
  { id: 'matrix',    name: 'MATRIX DECIFRANDO',  desc: 'Caracteres aleatórios estilo hack são decifrados letra por letra até revelar o nome', emoji: '🟢' },
];

// ── Spin effect mini-previews ─────────────────────────────────────────────────
const DEMO_NAMES = ['Nakelas', 'ShadowK', 'Draven', 'ProPlay', 'Vitória', 'ZueiraBR'];
const ACCENT = '#00E5FF';
const ACCENT_RGB = '0,229,255';

function PreviewNumbers() {
  const [num, setNum] = useState('????');
  useEffect(() => {
    const id = setInterval(() => setNum(String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')), 90);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height: 160 }}>
      <div className="font-rajdhani text-xs tracking-[0.4em]" style={{ color: `rgba(${ACCENT_RGB},0.5)`, letterSpacing: '0.4em' }}>SELECIONANDO...</div>
      <motion.div
        className="font-orbitron font-black"
        animate={{ y: [0, -2, 0, 2, 0] }}
        transition={{ duration: 0.1, repeat: Infinity }}
        style={{ fontSize: 52, color: ACCENT, textShadow: `0 0 24px rgba(${ACCENT_RGB},0.8)`, letterSpacing: '0.06em' }}
      >
        {num}
      </motion.div>
    </div>
  );
}

function PreviewNameReel() {
  const ITEM_H = 38;
  const offsetRef = useRef(0);
  const [offsetState, setOffsetState] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (now: number) => {
      const dt = lastRef.current != null ? now - lastRef.current : 16;
      lastRef.current = now;
      offsetRef.current -= dt * 0.22;
      setOffsetState(offsetRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const poolLen = DEMO_NAMES.length;
  const looped = [...DEMO_NAMES, ...DEMO_NAMES, ...DEMO_NAMES];
  const offset = ((offsetState % (ITEM_H * poolLen)) + ITEM_H * poolLen * 3) % (ITEM_H * poolLen);

  return (
    <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div className="font-rajdhani text-xs tracking-[0.4em]" style={{ color: `rgba(${ACCENT_RGB},0.5)` }}>SELECIONANDO...</div>
      <div className="relative overflow-hidden rounded-xl"
        style={{ width: 160, height: 3 * ITEM_H, border: `1px solid rgba(${ACCENT_RGB},0.3)`, background: 'rgba(0,0,0,0.4)' }}>
        <div style={{ transform: `translateY(${offset}px)`, willChange: 'transform' }}>
          {looped.map((name, i) => (
            <div key={i} className="font-orbitron font-bold flex items-center justify-center"
              style={{ height: ITEM_H, fontSize: 13, color: ACCENT, letterSpacing: '0.06em', textShadow: `0 0 10px rgba(${ACCENT_RGB},0.6)` }}>
              {name}
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: ITEM_H, background: 'linear-gradient(to bottom,rgba(0,0,0,.9),transparent)' }} />
        <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: ITEM_H, background: 'linear-gradient(to top,rgba(0,0,0,.9),transparent)' }} />
        <div className="absolute inset-x-0 pointer-events-none" style={{ top: ITEM_H, height: ITEM_H, borderTop: `1px solid rgba(${ACCENT_RGB},0.45)`, borderBottom: `1px solid rgba(${ACCENT_RGB},0.45)`, background: `rgba(${ACCENT_RGB},0.05)` }} />
      </div>
    </div>
  );
}

function PreviewWheel() {
  const [rot, setRot] = useState(0);
  const rotRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (now: number) => {
      const dt = lastRef.current != null ? now - lastRef.current : 16;
      lastRef.current = now;
      rotRef.current = (rotRef.current + dt * 0.22) % 360;
      setRot(rotRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const S = 130;
  const R = S / 2;
  const sliceAngle = 360 / DEMO_NAMES.length;

  return (
    <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <div className="font-rajdhani text-xs tracking-[0.4em]" style={{ color: `rgba(${ACCENT_RGB},0.5)` }}>SELECIONANDO...</div>
      <div className="relative" style={{ width: S, height: S }}>
        <div className="absolute" style={{ top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `12px solid ${ACCENT}`, filter: `drop-shadow(0 0 5px rgba(${ACCENT_RGB},1))`, zIndex: 5 }} />
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}
          style={{ transform: `rotate(${rot}deg)`, filter: `drop-shadow(0 0 10px rgba(${ACCENT_RGB},0.4))`, willChange: 'transform' }}>
          {DEMO_NAMES.map((name, i) => {
            const a1 = (i * sliceAngle - 90) * Math.PI / 180;
            const a2 = ((i + 1) * sliceAngle - 90) * Math.PI / 180;
            const x1 = R + R * Math.cos(a1); const y1 = R + R * Math.sin(a1);
            const x2 = R + R * Math.cos(a2); const y2 = R + R * Math.sin(a2);
            const tA = ((i + 0.5) * sliceAngle - 90) * Math.PI / 180;
            const tx = R + (R * 0.62) * Math.cos(tA); const ty = R + (R * 0.62) * Math.sin(tA);
            const fill = i % 2 === 0 ? `rgba(${ACCENT_RGB},0.22)` : `rgba(${ACCENT_RGB},0.05)`;
            return (
              <g key={name}>
                <path d={`M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill={fill} stroke={`rgba(${ACCENT_RGB},0.5)`} strokeWidth={0.8} />
                <text x={tx} y={ty} fill="#fff" fontFamily="Orbitron,sans-serif" fontWeight={700} fontSize={9}
                  textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(i + 0.5) * sliceAngle} ${tx} ${ty})`}
                  style={{ textShadow: '0 0 3px rgba(0,0,0,.9)' }}>
                  {name}
                </text>
              </g>
            );
          })}
          <circle cx={R} cy={R} r={10} fill={ACCENT} stroke="#fff" strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 4px rgba(${ACCENT_RGB},1))` }} />
        </svg>
      </div>
    </div>
  );
}

function PreviewMatrix() {
  const CHARSET = '!@#$%&*+-/<>?ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const [chars, setChars] = useState<string[]>([]);
  const TARGET = 'NAKELAS';

  useEffect(() => {
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      // Every ~2s do a partial decrypt cycle, otherwise scramble
      const cycle = frame % 44;
      if (cycle < 7) {
        const revealed = TARGET.slice(0, cycle);
        const rest = Array.from({ length: TARGET.length - cycle }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]);
        setChars([...revealed.split(''), ...rest]);
      } else if (cycle < 15) {
        setChars(TARGET.split(''));
      } else {
        setChars(Array.from({ length: TARGET.length }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]));
      }
    }, 80);
    return () => clearInterval(id);
  }, []);

  const isDecrypted = chars.join('') === TARGET;

  return (
    <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div className="font-rajdhani text-xs tracking-[0.4em]" style={{ color: `rgba(${ACCENT_RGB},0.5)` }}>DECIFRANDO...</div>
      <div className="font-orbitron font-black" style={{ fontSize: 26, letterSpacing: '0.18em', color: isDecrypted ? '#FFD166' : ACCENT, textShadow: isDecrypted ? '0 0 28px rgba(255,209,102,0.9)' : `0 0 12px rgba(${ACCENT_RGB},0.9)`, transition: 'color 0.15s, text-shadow 0.15s', minWidth: 140, textAlign: 'center' }}>
        {chars.join('')}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {TARGET.split('').map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: 2, background: (chars[i] === TARGET[i]) ? ACCENT : 'rgba(255,255,255,0.12)', boxShadow: (chars[i] === TARGET[i]) ? `0 0 5px rgba(${ACCENT_RGB},0.8)` : 'none', transition: 'background 0.1s' }} />
        ))}
      </div>
    </div>
  );
}


function StructureTooltip({ lines, color }: { lines: string[]; color: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Info icon */}
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center cursor-default select-none flex-shrink-0"
        style={{
          background: `${color}22`,
          border: `1px solid ${color}55`,
          color,
          fontSize: '9px',
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        i
      </div>

      <AnimatePresence>
        {visible && (
          <motion.div
            className="absolute left-6 top-1/2 z-50 rounded-xl px-4 py-3"
            style={{
              transform: 'translateY(-50%)',
              background: 'rgba(6,9,24,0.98)',
              border: `1px solid ${color}33`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
              pointerEvents: 'none',
              minWidth: '260px',
            }}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
          >
            {lines.map((line, i) => (
              <p
                key={i}
                className="font-rajdhani text-xs tracking-wide"
                style={{ color: i === 0 ? `${color}cc` : 'rgba(255,255,255,0.3)', marginTop: i > 0 ? '4px' : 0 }}
              >
                {line}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type SettingsTab = 'plataformas' | 'chat' | 'sorteio' | 'config-evento' | 'geral';

const SETTINGS_TABS: { id: SettingsTab; label: string; subtitle: string }[] = [
  { id: 'plataformas',   label: 'PLATAFORMAS',          subtitle: 'Personalize e conecte suas plataformas de streaming' },
  { id: 'chat',          label: 'CHAT',                 subtitle: '' },
  { id: 'sorteio',       label: 'SORTEIO',              subtitle: '' },
  { id: 'config-evento', label: 'CONFIG. DO EVENTO',    subtitle: '' },
  { id: 'geral',         label: 'GERAL',                subtitle: '' },
];

export default function EventConfig() {
  const { participants, prizes, setRaffleStage, currentUser, twitchConfig, setTwitchConfig, saveConfigToDB, setYoutubeChannel: saveYoutubeChannel, setKickChannel: saveKickChannel, excelImportEnabled, setExcelImportEnabled, excelPrizesImportEnabled, setExcelPrizesImportEnabled, autoRevealWinner, setAutoRevealWinner, spinEffect, setSpinEffect, socoChuteModeEnabled, setSocoChuteModeEnabled, raffleTriggerMode, setRaffleTriggerMode, autoRoundDelay, setAutoRoundDelay, chatTriggerCount, setChatTriggerCount, chatTriggerCommand, setChatTriggerCommand, themeColor, eventBackground, setEventBackground, eventMusic, setEventMusic, eventEffect, setEventEffect, raffleAnimationStyle, setRaffleAnimationStyle, isAffiliate, pscBalance } = useStore();
  const prizeManagerRef = useRef<PrizeManagerHandle>(null);
  const overlayMouseDownRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('plataformas');
  const [mounted, setMounted] = useState(false);
  const [youtubeChannel, setYoutubeChannel] = useState(currentUser?.youtubeChannel || '');
  const [youtubeDisplayName, setYoutubeDisplayNameLocal] = useState(currentUser?.youtubeDisplayName || '');
  const [kickChannel, setKickChannel] = useState(currentUser?.kickChannel || '');
  const [twitchConnectedUI, setTwitchConnectedUI] = useState(Boolean(twitchConfig.channel || currentUser?.twitchChannel));
  const [twitchVerifying, setTwitchVerifying] = useState(false);
  const [twitchError, setTwitchError] = useState('');
  const [youtubeConnectedUI, setYoutubeConnectedUI] = useState(Boolean(currentUser?.youtubeChannel));
  const [youtubeVerifying, setYoutubeVerifying] = useState(false);
  const [youtubeError, setYoutubeError] = useState('');
  const [kickConnectedUI, setKickConnectedUI] = useState(Boolean(currentUser?.kickChannel));
  const [localAutoDelay, setLocalAutoDelay] = useState(autoRoundDelay);
  const [localChatCount, setLocalChatCount] = useState(chatTriggerCount);
  const [localChatCmd, setLocalChatCmd] = useState(chatTriggerCommand);
  const [kickVerifying, setKickVerifying] = useState(false);
  const [kickError, setKickError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showEfeitos, setShowEfeitos] = useState(false);
  const [previewEffect, setPreviewEffect] = useState<EventEffectType>('none');
  const [stagePreviewSpin, setStagePreviewSpin] = useState<RaffleSpinEffect | null>(null);
  const [previewSpinKey, setPreviewSpinKey] = useState(0);
  const [stagePreviewStyle, setStagePreviewStyle] = useState<RaffleAnimationStyle | null>(null);
  const [previewStyleKey, setPreviewStyleKey] = useState(0);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null!);
  const music = useEventMusic();

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
  const settingsSnapshotRef = useRef<{
    twitchChannel: string;
    registrationCommand: string;
    youtubeChannelVal: string;
    youtubeDisplayNameVal: string;
    kickChannelVal: string;
    kickChatroomId: number | undefined;
    twitchConnectedUIVal: boolean;
    youtubeConnectedUIVal: boolean;
    kickConnectedUIVal: boolean;
  } | null>(null);

  async function handleTwitchConnect() {
    const channel = (twitchConfig.channel || currentUser?.twitchChannel || '').trim();
    if (!channel) { setTwitchError('Digite o nome do canal'); return; }
    setTwitchVerifying(true);
    setTwitchError('');
    try {
      const res = await fetch(`/api/twitch-channel/${encodeURIComponent(channel)}`);
      const data = await res.json();
      if (!res.ok) { setTwitchError(data.error || 'Canal não encontrado'); return; }
      setTwitchConfig({ channel: data.login });
      setTwitchConnectedUI(true);
      saveConfigToDB();
    } catch {
      setTwitchError('Erro de conexão');
    } finally {
      setTwitchVerifying(false);
    }
  }

  async function handleYoutubeConnect() {
    const handle = youtubeChannel.trim();
    if (!handle) { setYoutubeError('Digite o handle do canal'); return; }
    setYoutubeVerifying(true);
    setYoutubeError('');
    try {
      const clean = handle.replace(/^@/, '');
      const res = await fetch(`/api/youtube-channel/${encodeURIComponent(clean)}`);
      const data = await res.json() as { error?: string; displayName?: string };
      if (!res.ok) { setYoutubeError(data.error || 'Canal não encontrado'); return; }
      const normalized = `@${clean}`;
      const dn = data.displayName || clean;
      setYoutubeChannel(normalized);
      setYoutubeDisplayNameLocal(dn);
      saveYoutubeChannel(normalized, dn);
      setYoutubeConnectedUI(true);
    } catch {
      setYoutubeError('Erro de conexão');
    } finally {
      setYoutubeVerifying(false);
    }
  }

  async function handleKickConnect() {
    const slug = kickChannel.trim();
    if (!slug) { setKickError('Digite o nome do canal'); return; }
    setKickVerifying(true);
    setKickError('');
    try {
      const res = await fetch(`/api/kick-channel/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) { setKickError(data.error || 'Canal não encontrado'); return; }
      setKickChannel(slug);
      saveKickChannel(slug, data.chatroomId);
      setKickConnectedUI(true);
    } catch {
      setKickError('Erro de conexão');
    } finally {
      setKickVerifying(false);
    }
  }

  function openSettings() {
    settingsSnapshotRef.current = {
      twitchChannel: twitchConfig.channel,
      registrationCommand: twitchConfig.registrationCommand,
      youtubeChannelVal: youtubeChannel,
      youtubeDisplayNameVal: youtubeDisplayName,
      kickChannelVal: kickChannel,
      kickChatroomId: currentUser?.kickChatroomId,
      twitchConnectedUIVal: twitchConnectedUI,
      youtubeConnectedUIVal: youtubeConnectedUI,
      kickConnectedUIVal: kickConnectedUI,
    };
    setShowSettings(true);
  }

  function cancelSettings() {
    const snap = settingsSnapshotRef.current;
    if (!snap) { setShowCancelConfirm(false); setShowSettings(false); return; }
    setTwitchConfig({ channel: snap.twitchChannel, registrationCommand: snap.registrationCommand });
    saveYoutubeChannel(snap.youtubeChannelVal, snap.youtubeDisplayNameVal || undefined);
    saveKickChannel(snap.kickChannelVal, snap.kickChatroomId);
    setYoutubeChannel(snap.youtubeChannelVal);
    setYoutubeDisplayNameLocal(snap.youtubeDisplayNameVal);
    setKickChannel(snap.kickChannelVal);
    setTwitchConnectedUI(snap.twitchConnectedUIVal);
    setYoutubeConnectedUI(snap.youtubeConnectedUIVal);
    setKickConnectedUI(snap.kickConnectedUIVal);
    setTwitchError('');
    setYoutubeError('');
    setKickError('');
    setShowCancelConfirm(false);
    setShowSettings(false);
  }

  useEffect(() => setMounted(true), []);
  const hasAvailablePrizes = prizes.some(p => p.quantity > 0);
  const totalPscCost = prizes.filter(p => !p.skipPsc).reduce((sum, p) => sum + (p.pscValue ?? 0) * p.quantity, 0);
  const hasPscOverflow = isAffiliate && totalPscCost > pscBalance;
  const canStart = participants.length > 0 && hasAvailablePrizes;

  const startLabel = !canStart
    ? participants.length === 0
      ? 'ADICIONE PARTICIPANTES PARA INICIAR'
      : prizes.length === 0
        ? 'ADICIONE PRÊMIOS PARA INICIAR'
        : 'TODOS OS PRÊMIOS ESGOTADOS'
    : 'INICIAR EVENTO AO VIVO';

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 md:px-10 pt-6 pb-6" style={{ gap: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Preview effects */}
      <ConfettiExplosion active={previewEffect === 'confetti'} originX={50} originY={40} />
      <FireworksExplosion active={previewEffect === 'fireworks'} color={themeColor} />
      <SparklesExplosion active={previewEffect === 'sparkles'} color={themeColor} />
      {/* Hidden file input for fundo */}
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0, position: 'relative', zIndex: 10 }}>
        <div>
          <h1 className="font-orbitron font-black text-lg md:text-xl tracking-wider">
            <span className="text-white">CONFIGURAÇÃO</span>{' '}
            <span style={{ color: '#00E5FF' }}>DO EVENTO</span>
          </h1>
          <p className="font-rajdhani text-sm mt-2 tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Prepare tudo e inicie seu sorteio ao vivo!
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Configurações */}
          <motion.button
            onClick={openSettings}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '12px',
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginTop: '10px',
              marginRight: '14px',
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
            CONFIGURAÇÕES
          </motion.button>

          {/* Settings Modal — portal to escape parent transform stacking contexts */}
          {mounted && createPortal(
            <AnimatePresence>
              {showSettings && (
              <motion.div
                className="fixed inset-0 px-4"
                style={{ zIndex: 9999, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', alignContent: 'center' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onMouseDown={(e) => { overlayMouseDownRef.current = e.target === e.currentTarget; }}
                onClick={() => { if (overlayMouseDownRef.current) { saveConfigToDB(); setShowSettings(false); } }}
              >
                <motion.div
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '800px',
                    borderRadius: '16px',
                    background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                    border: '1px solid rgba(0,229,255,0.3)',
                    boxShadow: '0 0 60px rgba(0,229,255,0.1)',
                  }}
                  initial={{ scale: 0.88, opacity: 0, y: 24 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.88, opacity: 0, y: 24 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                  onClick={e => e.stopPropagation()}
                >
                  {/* Top accent bar */}
                  <div style={{ height: '3px', background: 'linear-gradient(90deg, #00E5FF, #00E5FF55)' }} />

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#00E5FF">
                          <path d="M4.3 3H21v13.7l-4.3 4.3H3V7.3L4.3 3zM5 5.7V19h11l3-3V5H5zm6 3h2v6h-2zm0 8h2v2h-2z"/>
                        </svg>
                        <span className="font-orbitron text-xs tracking-widest" style={{ color: '#00E5FF' }}>
                          CONFIGURAÇÕES DO CHAT
                        </span>
                      </div>
                      <AnimatePresence mode="wait">
                        {SETTINGS_TABS.find(t => t.id === settingsTab)?.subtitle && (
                          <motion.p
                            key={settingsTab}
                            className="font-rajdhani text-sm"
                            style={{ color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                          >
                            {SETTINGS_TABS.find(t => t.id === settingsTab)?.subtitle}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={() => setShowCancelConfirm(true)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                      style={{ flexShrink: 0, marginTop: '2px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  </div>

                  {/* Body: nav esquerda + conteúdo direita */}
                  <div style={{ display: 'flex', gap: 0, padding: '16px 0 0' }}>

                    {/* Nav esquerda */}
                    <div style={{ width: '148px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 12px 24px 16px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                      {SETTINGS_TABS.map(tab => {
                        const active = settingsTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setSettingsTab(tab.id)}
                            className="font-orbitron font-bold text-left rounded-lg transition-all"
                            style={{
                              fontSize: '10px',
                              letterSpacing: '0.1em',
                              padding: '10px 12px',
                              color: active ? '#00E5FF' : 'rgba(255,255,255,0.3)',
                              background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
                              borderLeft: active ? '2px solid #00E5FF' : '2px solid transparent',
                              cursor: 'pointer',
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Conteúdo da aba */}
                    <div style={{ flex: 1, minWidth: 0, padding: '0 24px 24px' }}>
                      <AnimatePresence mode="sync">
                        {settingsTab === 'plataformas' && (
                          <motion.div key="plataformas"
                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                          >
                            {/* Platform boxes */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>

                              {/* TWITCH */}
                              <div style={{
                                display: 'flex', flexDirection: 'column', gap: '12px',
                                padding: '14px 12px', borderRadius: '12px',
                                background: twitchConnectedUI ? 'rgba(145,71,255,0.09)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${twitchConnectedUI ? 'rgba(145,71,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                transition: 'all 0.25s',
                              }}>
                                {/* Icon + name */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill={twitchConnectedUI ? '#9147FF' : 'rgba(255,255,255,0.2)'} style={{ transition: 'fill 0.25s', filter: twitchConnectedUI ? 'drop-shadow(0 0 6px rgba(145,71,255,0.7))' : 'none' }}>
                                    <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z"/>
                                  </svg>
                                  <span className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: twitchConnectedUI ? '#9147FF' : 'rgba(255,255,255,0.3)' }}>TWITCH</span>
                                </div>
                                {/* Input or floating channel name */}
                                <AnimatePresence mode="wait">
                                  {twitchConnectedUI ? (
                                    <motion.div
                                      key="twitch-connected"
                                      initial={{ opacity: 0, scale: 0.85 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.85 }}
                                      transition={{ duration: 0.2 }}
                                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '6px 0' }}
                                    >
                                      <span
                                        className="font-mono font-bold"
                                        style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em' }}
                                      >
                                        #{twitchConfig.channel || currentUser?.twitchChannel}
                                      </span>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="twitch-input"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.15 }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '7px 9px', borderRadius: '7px',
                                        background: 'rgba(0,0,0,0.28)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                      }}
                                    >
                                      <span className="font-mono" style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px' }}>#</span>
                                      <input
                                        type="text"
                                        value={twitchConfig.channel}
                                        onChange={e => setTwitchConfig({ channel: e.target.value })}
                                        placeholder={currentUser?.twitchChannel || 'canal'}
                                        className="font-mono outline-none placeholder-white/20"
                                        style={{ flex: 1, background: 'transparent', fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, minWidth: 0 }}
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                {/* Error */}
                                {twitchError && (
                                  <span className="font-rajdhani text-xs" style={{ color: '#FF5555', lineHeight: 1.3 }}>{twitchError}</span>
                                )}
                                {/* Badge + button */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '8px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                                    letterSpacing: '0.1em', padding: '3px 7px', borderRadius: '6px',
                                    background: twitchConnectedUI ? 'rgba(0,220,100,0.12)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${twitchConnectedUI ? 'rgba(0,220,100,0.45)' : 'rgba(255,255,255,0.1)'}`,
                                    color: twitchConnectedUI ? '#00DC64' : 'rgba(255,255,255,0.3)',
                                    boxShadow: twitchConnectedUI ? '0 0 8px rgba(0,220,100,0.3)' : 'none',
                                    transition: 'all 0.25s', whiteSpace: 'nowrap',
                                  }}>
                                    {twitchConnectedUI ? 'CONECTADO' : 'DESCONECTADO'}
                                  </span>
                                  <button
                                    onClick={twitchConnectedUI ? () => { setTwitchConnectedUI(false); setTwitchError(''); } : handleTwitchConnect}
                                    disabled={twitchVerifying}
                                    style={{
                                      fontSize: '8px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                                      letterSpacing: '0.1em', padding: '4px 9px', borderRadius: '6px',
                                      cursor: twitchVerifying ? 'wait' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                      background: twitchConnectedUI ? 'rgba(255,255,255,0.06)' : 'rgba(145,71,255,0.2)',
                                      color: twitchConnectedUI ? 'rgba(255,255,255,0.35)' : '#9147FF',
                                      border: `1px solid ${twitchConnectedUI ? 'rgba(255,255,255,0.1)' : 'rgba(145,71,255,0.4)'}`,
                                      opacity: twitchVerifying ? 0.6 : 1,
                                    }}
                                  >
                                    {twitchVerifying ? 'VERIFICANDO...' : twitchConnectedUI ? 'DESCONECTAR' : 'CONECTAR'}
                                  </button>
                                </div>
                              </div>

                              {/* YOUTUBE */}
                              <div style={{
                                display: 'flex', flexDirection: 'column', gap: '12px',
                                padding: '14px 12px', borderRadius: '12px',
                                background: youtubeConnectedUI ? 'rgba(255,60,60,0.07)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${youtubeConnectedUI ? 'rgba(255,60,60,0.4)' : 'rgba(255,255,255,0.08)'}`,
                                transition: 'all 0.25s',
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill={youtubeConnectedUI ? '#FF3C3C' : 'rgba(255,255,255,0.2)'} style={{ transition: 'fill 0.25s', filter: youtubeConnectedUI ? 'drop-shadow(0 0 6px rgba(255,60,60,0.7))' : 'none' }}>
                                    <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.8 5 12 5 12 5s-4.8 0-7 .1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.2.9C6.8 19 12 19 12 19s4.8 0 7-.1c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM9.8 14.7V9.3l5.4 2.7-5.4 2.7z"/>
                                  </svg>
                                  <span className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: youtubeConnectedUI ? '#FF3C3C' : 'rgba(255,255,255,0.3)' }}>YOUTUBE</span>
                                </div>
                                <AnimatePresence mode="wait">
                                  {youtubeConnectedUI ? (
                                    <motion.div
                                      key="yt-connected"
                                      initial={{ opacity: 0, scale: 0.85 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.85 }}
                                      transition={{ duration: 0.2 }}
                                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '6px 0' }}
                                    >
                                      {youtubeDisplayName && (
                                        <span className="font-rajdhani font-bold" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', letterSpacing: '0.02em' }}>
                                          {youtubeDisplayName}
                                        </span>
                                      )}
                                      <span className="font-mono" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                                        {youtubeChannel}
                                      </span>
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="yt-input"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.15 }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '5px',
                                        padding: '7px 9px', borderRadius: '7px',
                                        background: 'rgba(0,0,0,0.28)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                      }}
                                    >
                                      <span className="font-mono" style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px' }}>@</span>
                                      <input
                                        type="text"
                                        value={youtubeChannel.replace(/^@/, '')}
                                        onChange={e => setYoutubeChannel(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleYoutubeConnect()}
                                        placeholder="seucanal"
                                        className="font-mono outline-none placeholder-white/20"
                                        style={{ flex: 1, background: 'transparent', fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, minWidth: 0 }}
                                      />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                {youtubeError && (
                                  <span className="font-rajdhani text-xs" style={{ color: '#FF5555', lineHeight: 1.3 }}>{youtubeError}</span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '8px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                                    letterSpacing: '0.1em', padding: '3px 7px', borderRadius: '6px',
                                    background: youtubeConnectedUI ? 'rgba(0,220,100,0.12)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${youtubeConnectedUI ? 'rgba(0,220,100,0.45)' : 'rgba(255,255,255,0.1)'}`,
                                    color: youtubeConnectedUI ? '#00DC64' : 'rgba(255,255,255,0.3)',
                                    boxShadow: youtubeConnectedUI ? '0 0 8px rgba(0,220,100,0.3)' : 'none',
                                    transition: 'all 0.25s', whiteSpace: 'nowrap',
                                  }}>
                                    {youtubeConnectedUI ? 'CONECTADO' : 'DESCONECTADO'}
                                  </span>
                                  <button
                                    onClick={youtubeConnectedUI
                                      ? () => { setYoutubeConnectedUI(false); setYoutubeError(''); saveYoutubeChannel('', undefined); setYoutubeChannel(''); setYoutubeDisplayNameLocal(''); }
                                      : handleYoutubeConnect}
                                    disabled={youtubeVerifying}
                                    style={{
                                      fontSize: '8px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                                      letterSpacing: '0.1em', padding: '4px 9px', borderRadius: '6px',
                                      cursor: youtubeVerifying ? 'wait' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                      background: youtubeConnectedUI ? 'rgba(255,255,255,0.06)' : 'rgba(255,60,60,0.18)',
                                      color: youtubeConnectedUI ? 'rgba(255,255,255,0.35)' : '#FF3C3C',
                                      border: `1px solid ${youtubeConnectedUI ? 'rgba(255,255,255,0.1)' : 'rgba(255,60,60,0.4)'}`,
                                      opacity: youtubeVerifying ? 0.6 : 1,
                                    }}
                                  >
                                    {youtubeVerifying ? 'VERIFICANDO...' : youtubeConnectedUI ? 'DESCONECTAR' : 'CONECTAR'}
                                  </button>
                                </div>
                              </div>

                              {/* KICK */}
                              <div style={{
                                display: 'flex', flexDirection: 'column', gap: '12px',
                                padding: '14px 12px', borderRadius: '12px',
                                background: kickConnectedUI ? 'rgba(83,252,28,0.05)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${kickConnectedUI ? 'rgba(83,252,28,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                transition: 'all 0.25s',
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill={kickConnectedUI ? '#53FC1C' : 'rgba(255,255,255,0.2)'} style={{ transition: 'fill 0.25s', filter: kickConnectedUI ? 'drop-shadow(0 0 6px rgba(83,252,28,0.7))' : 'none' }}>
                                    <path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z"/>
                                  </svg>
                                  <span className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: kickConnectedUI ? '#53FC1C' : 'rgba(255,255,255,0.3)' }}>KICK</span>
                                </div>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: '5px',
                                  padding: '7px 9px', borderRadius: '7px',
                                  background: 'rgba(0,0,0,0.28)',
                                  border: `1px solid ${kickConnectedUI ? 'rgba(83,252,28,0.2)' : 'rgba(255,255,255,0.07)'}`,
                                  transition: 'all 0.25s',
                                }}>
                                  <span className="font-mono" style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px' }}>#</span>
                                  {kickConnectedUI ? (
                                    <span className="font-mono" style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, minWidth: 0 }}>
                                      {kickChannel || currentUser?.kickChannel || '—'}
                                    </span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={kickChannel}
                                      onChange={e => setKickChannel(e.target.value)}
                                      placeholder={currentUser?.kickChannel || 'canal'}
                                      className="font-mono outline-none placeholder-white/20"
                                      style={{ flex: 1, background: 'transparent', fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, minWidth: 0 }}
                                    />
                                  )}
                                </div>
                                {kickError && (
                                  <span className="font-rajdhani text-xs" style={{ color: '#FF5555', lineHeight: 1.3 }}>{kickError}</span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '8px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                                    letterSpacing: '0.1em', padding: '3px 7px', borderRadius: '6px',
                                    background: kickConnectedUI ? 'rgba(0,220,100,0.12)' : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${kickConnectedUI ? 'rgba(0,220,100,0.45)' : 'rgba(255,255,255,0.1)'}`,
                                    color: kickConnectedUI ? '#00DC64' : 'rgba(255,255,255,0.3)',
                                    boxShadow: kickConnectedUI ? '0 0 8px rgba(0,220,100,0.3)' : 'none',
                                    transition: 'all 0.25s', whiteSpace: 'nowrap',
                                  }}>
                                    {kickConnectedUI ? 'CONECTADO' : 'DESCONECTADO'}
                                  </span>
                                  <button
                                    onClick={kickConnectedUI
                                      ? () => { setKickConnectedUI(false); setKickError(''); saveKickChannel(''); setKickChannel(''); }
                                      : handleKickConnect}
                                    disabled={kickVerifying}
                                    style={{
                                      fontSize: '8px', fontFamily: 'Orbitron, sans-serif', fontWeight: 700,
                                      letterSpacing: '0.1em', padding: '4px 9px', borderRadius: '6px',
                                      cursor: kickVerifying ? 'wait' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                                      background: kickConnectedUI ? 'rgba(255,255,255,0.06)' : 'rgba(83,252,28,0.12)',
                                      color: kickConnectedUI ? 'rgba(255,255,255,0.35)' : '#53FC1C',
                                      border: `1px solid ${kickConnectedUI ? 'rgba(255,255,255,0.1)' : 'rgba(83,252,28,0.35)'}`,
                                      opacity: kickVerifying ? 0.6 : 1,
                                    }}
                                  >
                                    {kickVerifying ? 'VERIFICANDO...' : kickConnectedUI ? 'DESCONECTAR' : 'CONECTAR'}
                                  </button>
                                </div>
                              </div>

                            </div>

                            {/* Comando de inscrição */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label className="font-rajdhani text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                                Comando de inscrição
                              </label>
                              <input
                                type="text"
                                value={twitchConfig.registrationCommand}
                                onChange={e => setTwitchConfig({ registrationCommand: e.target.value })}
                                placeholder="!entrar"
                                className="input-neon font-mono"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', lineHeight: 1.5, boxSizing: 'border-box' }}
                              />
                              <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.25)', lineHeight: 1.6, marginTop: '2px' }}>
                                Quem digitar esse comando no chat entra na lista de participantes
                              </p>
                            </div>

                          </motion.div>
                        )}

                        {settingsTab === 'chat' && (
                          <motion.div key="chat"
                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}
                          >
                            <p className="font-rajdhani text-sm tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>Em breve</p>
                          </motion.div>
                        )}

                        {settingsTab === 'sorteio' && (
                          <motion.div key="sorteio"
                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                          >
                            {/* ── Top: 3 columns ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'start' }}>

                              {/* Col 1: MODOS DE INÍCIO DO ROUND */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)' }}>
                                  MODOS DE INÍCIO DO ROUND
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                  {([
                                    {
                                      id: 'manual' as RaffleTriggerMode,
                                      name: 'Manual',
                                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 11.24V7.5C9 6.67 9.67 6 10.5 6S12 6.67 12 7.5v3.74c1.21-.81 2-2.18 2-3.74C14 5.01 12.49 3.5 10.5 3.5S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/></svg>,
                                    },
                                    {
                                      id: 'auto' as RaffleTriggerMode,
                                      name: 'Automático',
                                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>,
                                    },
                                    {
                                      id: 'chat' as RaffleTriggerMode,
                                      name: 'Chat',
                                      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>,
                                    },
                                  ] as { id: RaffleTriggerMode; name: string; icon: React.ReactNode }[]).map(opt => {
                                    const active = raffleTriggerMode === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        onClick={() => setRaffleTriggerMode(opt.id)}
                                        style={{
                                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                          padding: '10px 6px', borderRadius: '10px',
                                          background: active ? `rgba(${ACCENT_RGB},0.08)` : 'rgba(255,255,255,0.02)',
                                          border: `1px solid ${active ? `rgba(${ACCENT_RGB},0.4)` : 'rgba(255,255,255,0.07)'}`,
                                          cursor: 'pointer', transition: 'all 0.2s',
                                          boxShadow: active ? `0 0 14px rgba(${ACCENT_RGB},0.12)` : 'none',
                                        }}
                                      >
                                        <div style={{ color: active ? ACCENT : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}>
                                          {opt.icon}
                                        </div>
                                        <span className="font-rajdhani font-bold" style={{ fontSize: '10px', letterSpacing: '0.04em', color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s', textAlign: 'center', lineHeight: 1.2 }}>
                                          {opt.name}
                                        </span>
                                        <div style={{
                                          width: '14px', height: '14px', borderRadius: '50%',
                                          border: `2px solid ${active ? ACCENT : 'rgba(255,255,255,0.2)'}`,
                                          background: active ? ACCENT : 'transparent',
                                          boxShadow: active ? `0 0 8px rgba(${ACCENT_RGB},0.6)` : 'none',
                                          transition: 'all 0.2s',
                                        }} />
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Auto delay stepper */}
                                {raffleTriggerMode === 'auto' && (
                                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)' }}>
                                    <label className="font-orbitron font-bold" style={{ fontSize: '8px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '8px' }}>
                                      INTERVALO ENTRE ROUNDS (SEG)
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                      <button
                                        onClick={() => { const v = Math.max(5, localAutoDelay - 1); setLocalAutoDelay(v); setAutoRoundDelay(v); }}
                                        style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >−</button>
                                      <span className="font-orbitron font-bold" style={{ fontSize: '22px', color: ACCENT, minWidth: '40px', textAlign: 'center' }}>
                                        {localAutoDelay}
                                      </span>
                                      <button
                                        onClick={() => { const v = Math.min(300, localAutoDelay + 1); setLocalAutoDelay(v); setAutoRoundDelay(v); }}
                                        style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >+</button>
                                    </div>
                                  </div>
                                )}

                                {/* Chat trigger inputs */}
                                {raffleTriggerMode === 'chat' && (
                                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div>
                                      <label className="font-orbitron font-bold" style={{ fontSize: '8px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>
                                        MENSAGENS ÚNICAS PARA INICIAR
                                      </label>
                                      <input
                                        type="number" min={1} max={500} value={localChatCount}
                                        onChange={e => setLocalChatCount(Number(e.target.value))}
                                        onBlur={() => setChatTriggerCount(Math.min(500, Math.max(1, localChatCount)))}
                                        className="font-orbitron font-bold"
                                        style={{
                                          width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,229,255,0.25)',
                                          borderRadius: '8px', padding: '8px 12px', color: '#00E5FF', fontSize: '14px',
                                          outline: 'none', letterSpacing: '0.08em',
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="font-orbitron font-bold" style={{ fontSize: '8px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>
                                        COMANDO DO CHAT
                                      </label>
                                      <input
                                        type="text" value={localChatCmd}
                                        onChange={e => setLocalChatCmd(e.target.value)}
                                        onBlur={() => { const v = localChatCmd.trim() || '!sortear'; setLocalChatCmd(v); setChatTriggerCommand(v); }}
                                        className="font-orbitron font-bold"
                                        style={{
                                          width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,229,255,0.25)',
                                          borderRadius: '8px', padding: '8px 12px', color: '#00E5FF', fontSize: '13px',
                                          outline: 'none', letterSpacing: '0.08em',
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Col 2: REVELAÇÃO E RESTRIÇÕES */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)' }}>
                                  REVELAÇÃO E RESTRIÇÕES
                                </p>

                                {/* Toggle: Mostrar automaticamente o ganhador */}
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                                  padding: '12px 14px', borderRadius: '12px',
                                  background: autoRevealWinner ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${autoRevealWinner ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
                                  transition: 'all 0.25s',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill={autoRevealWinner ? '#00E5FF' : 'rgba(255,255,255,0.25)'} style={{ flexShrink: 0, transition: 'fill 0.25s' }}>
                                      {autoRevealWinner
                                        ? <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                        : <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                                      }
                                    </svg>
                                    <span className="font-rajdhani" style={{ fontSize: '12px', lineHeight: 1.3, color: autoRevealWinner ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', transition: 'color 0.25s' }}>
                                      Mostrar automaticamente o ganhador
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setAutoRevealWinner(!autoRevealWinner)}
                                    style={{
                                      position: 'relative', flexShrink: 0,
                                      width: '42px', height: '22px', borderRadius: '11px',
                                      background: autoRevealWinner ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.1)',
                                      border: `1px solid ${autoRevealWinner ? 'rgba(0,229,255,0.55)' : 'rgba(255,255,255,0.15)'}`,
                                      cursor: 'pointer', transition: 'all 0.25s',
                                      boxShadow: autoRevealWinner ? '0 0 10px rgba(0,229,255,0.2)' : 'none',
                                    }}
                                  >
                                    <motion.div
                                      animate={{ x: autoRevealWinner ? 21 : 2 }}
                                      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                                      style={{
                                        position: 'absolute', top: '2px',
                                        width: '16px', height: '16px', borderRadius: '50%',
                                        background: autoRevealWinner ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                                        boxShadow: autoRevealWinner ? '0 0 6px rgba(0,229,255,0.6)' : 'none',
                                        transition: 'background 0.25s, box-shadow 0.25s',
                                      }}
                                    />
                                  </button>
                                </div>

                                {/* Toggle: Modo lento e chute */}
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                                  padding: '12px 14px', borderRadius: '12px',
                                  background: socoChuteModeEnabled ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${socoChuteModeEnabled ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
                                  transition: 'all 0.25s',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill={socoChuteModeEnabled ? '#00E5FF' : 'rgba(255,255,255,0.25)'} style={{ flexShrink: 0, transition: 'fill 0.25s' }}>
                                      <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                                    </svg>
                                    <span className="font-rajdhani" style={{ fontSize: '12px', lineHeight: 1.3, color: socoChuteModeEnabled ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', transition: 'color 0.25s' }}>
                                      Modo lento e chute restringe quem busca o chute
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setSocoChuteModeEnabled(!socoChuteModeEnabled)}
                                    style={{
                                      position: 'relative', flexShrink: 0,
                                      width: '42px', height: '22px', borderRadius: '11px',
                                      background: socoChuteModeEnabled ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.1)',
                                      border: `1px solid ${socoChuteModeEnabled ? 'rgba(0,229,255,0.55)' : 'rgba(255,255,255,0.15)'}`,
                                      cursor: 'pointer', transition: 'all 0.25s',
                                      boxShadow: socoChuteModeEnabled ? '0 0 10px rgba(0,229,255,0.2)' : 'none',
                                    }}
                                  >
                                    <motion.div
                                      animate={{ x: socoChuteModeEnabled ? 21 : 2 }}
                                      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                                      style={{
                                        position: 'absolute', top: '2px',
                                        width: '16px', height: '16px', borderRadius: '50%',
                                        background: socoChuteModeEnabled ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                                        boxShadow: socoChuteModeEnabled ? '0 0 6px rgba(0,229,255,0.6)' : 'none',
                                        transition: 'background 0.25s, box-shadow 0.25s',
                                      }}
                                    />
                                  </button>
                                </div>
                              </div>

                              {/* Col 3: FUNDO */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)' }}>
                                  FUNDO
                                </p>
                                <FundoPanel
                                  themeColor={themeColor}
                                  eventBackground={eventBackground}
                                  setEventBackground={setEventBackground}
                                  onPickFile={() => fileRef.current?.click()}
                                />
                              </div>
                            </div>

                            {/* ── Bottom: EFEITOS DO SORTEIO button ── */}
                            <button
                              onClick={() => setShowEfeitos(true)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                                transition: 'all 0.2s', textAlign: 'left', width: '100%',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,255,0.2)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            >
                              <div style={{
                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(0,229,255,0.8)">
                                  <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6zm-2 16a2 2 0 110-4 2 2 0 010 4z"/>
                                </svg>
                              </div>
                              <div style={{ flex: 1 }}>
                                <p className="font-orbitron font-bold" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)' }}>
                                  EFEITOS DO SORTEIO
                                </p>
                                <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                                  Sons, reprodução, visuais e show de luzes
                                </p>
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                              </svg>
                            </button>
                          </motion.div>
                        )}

                        {settingsTab === 'config-evento' && (
                          <motion.div key="config-evento"
                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                          >
                            {/* ── FUNDO DO EVENTO ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)' }}>
                                FUNDO DO EVENTO
                              </p>
                              <FundoPanel
                                themeColor={themeColor}
                                eventBackground={eventBackground}
                                setEventBackground={setEventBackground}
                                onPickFile={() => fileRef.current?.click()}
                              />
                            </div>

                            {/* ── DADOS ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)', marginBottom: '8px' }}>
                              DADOS
                            </p>

                            {/* Toggle: Excel Import — Participantes */}
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                              padding: '14px 16px', borderRadius: '12px',
                              background: excelImportEnabled ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${excelImportEnabled ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
                              transition: 'all 0.25s',
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill={excelImportEnabled ? '#00E5FF' : 'rgba(255,255,255,0.3)'} style={{ flexShrink: 0, transition: 'fill 0.25s' }}>
                                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 8l-3-3h2v-4h2v4h2l-3 3z"/>
                                  </svg>
                                  <span className="font-orbitron font-bold" style={{ fontSize: '10px', letterSpacing: '0.1em', color: excelImportEnabled ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', transition: 'color 0.25s' }}>
                                    IMPORTAR PARTICIPANTES (EXCEL)
                                  </span>
                                </div>
                                <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)', lineHeight: 1.5, paddingLeft: '20px' }}>
                                  {excelImportEnabled
                                    ? 'Área de arrastar/soltar visível na coluna de participantes'
                                    : 'Oculta — adicione pelo chat ou manualmente'}
                                </span>
                              </div>
                              <button
                                onClick={() => setExcelImportEnabled(!excelImportEnabled)}
                                style={{
                                  position: 'relative', flexShrink: 0,
                                  width: '42px', height: '22px', borderRadius: '11px',
                                  background: excelImportEnabled ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.1)',
                                  border: `1px solid ${excelImportEnabled ? 'rgba(0,229,255,0.55)' : 'rgba(255,255,255,0.15)'}`,
                                  cursor: 'pointer', transition: 'all 0.25s',
                                  boxShadow: excelImportEnabled ? '0 0 10px rgba(0,229,255,0.2)' : 'none',
                                }}
                              >
                                <motion.div
                                  animate={{ x: excelImportEnabled ? 21 : 2 }}
                                  transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                                  style={{
                                    position: 'absolute', top: '2px',
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    background: excelImportEnabled ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                                    boxShadow: excelImportEnabled ? '0 0 6px rgba(0,229,255,0.6)' : 'none',
                                    transition: 'background 0.25s, box-shadow 0.25s',
                                  }}
                                />
                              </button>
                            </div>

                            {/* Toggle: Excel Import — Prêmios */}
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                              padding: '14px 16px', borderRadius: '12px',
                              background: excelPrizesImportEnabled ? 'rgba(160,80,255,0.05)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${excelPrizesImportEnabled ? 'rgba(160,80,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
                              transition: 'all 0.25s',
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill={excelPrizesImportEnabled ? '#A050FF' : 'rgba(255,255,255,0.3)'} style={{ flexShrink: 0, transition: 'fill 0.25s' }}>
                                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 8l-3-3h2v-4h2v4h2l-3 3z"/>
                                  </svg>
                                  <span className="font-orbitron font-bold" style={{ fontSize: '10px', letterSpacing: '0.1em', color: excelPrizesImportEnabled ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', transition: 'color 0.25s' }}>
                                    IMPORTAR PRÊMIOS (EXCEL)
                                  </span>
                                </div>
                                <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)', lineHeight: 1.5, paddingLeft: '20px' }}>
                                  {excelPrizesImportEnabled
                                    ? 'Área de arrastar/soltar visível na coluna de prêmios'
                                    : 'Oculta — adicione os prêmios manualmente'}
                                </span>
                              </div>
                              <button
                                onClick={() => setExcelPrizesImportEnabled(!excelPrizesImportEnabled)}
                                style={{
                                  position: 'relative', flexShrink: 0,
                                  width: '42px', height: '22px', borderRadius: '11px',
                                  background: excelPrizesImportEnabled ? 'rgba(160,80,255,0.4)' : 'rgba(255,255,255,0.1)',
                                  border: `1px solid ${excelPrizesImportEnabled ? 'rgba(160,80,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
                                  cursor: 'pointer', transition: 'all 0.25s',
                                  boxShadow: excelPrizesImportEnabled ? '0 0 10px rgba(160,80,255,0.25)' : 'none',
                                }}
                              >
                                <motion.div
                                  animate={{ x: excelPrizesImportEnabled ? 21 : 2 }}
                                  transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                                  style={{
                                    position: 'absolute', top: '2px',
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    background: excelPrizesImportEnabled ? '#A050FF' : 'rgba(255,255,255,0.35)',
                                    boxShadow: excelPrizesImportEnabled ? '0 0 6px rgba(160,80,255,0.7)' : 'none',
                                    transition: 'background 0.25s, box-shadow 0.25s',
                                  }}
                                />
                              </button>
                            </div>
                            </div>
                          </motion.div>
                        )}

                        {settingsTab === 'geral' && (
                          <motion.div key="geral"
                            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                          >
                            <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)', marginBottom: '8px' }}>
                              TEMA
                            </p>
                            <TemaPanel themeColor={themeColor} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Footer — botão salvar presente em todas as abas */}
                  <div style={{ padding: '0 24px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    <motion.button
                      onClick={() => { saveConfigToDB(); setShowSettings(false); }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="font-rajdhani font-bold tracking-widest"
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '14px', lineHeight: 1, background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', cursor: 'pointer' }}
                    >
                      SALVAR
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {showCancelConfirm && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '16px',
                          background: 'rgba(5,8,22,0.92)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '20px',
                          zIndex: 10,
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: '0 32px' }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFD166">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                          </svg>
                          <p className="font-orbitron font-bold text-sm tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Tem certeza?
                          </p>
                          <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                            Todas as alterações serão descartadas.
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => setShowCancelConfirm(false)}
                            className="font-rajdhani font-bold tracking-widest"
                            style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                          >
                            CONTINUAR EDITANDO
                          </button>
                          <button
                            onClick={cancelSettings}
                            className="font-rajdhani font-bold tracking-widest"
                            style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.4)', color: '#FF4444', cursor: 'pointer' }}
                          >
                            SIM, CANCELAR
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}

          {/* Efeitos do Sorteio Modal */}
          {mounted && createPortal(
            <AnimatePresence>
              {showEfeitos && (
                <motion.div
                  className="fixed inset-0 px-4"
                  style={{ zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={e => { if (e.target === e.currentTarget) setShowEfeitos(false); }}
                >
                  <motion.div
                    style={{
                      position: 'relative', width: '100%', maxWidth: '960px',
                      borderRadius: '16px', overflow: 'hidden',
                      background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                      border: '1px solid rgba(0,229,255,0.3)',
                      boxShadow: '0 0 60px rgba(0,229,255,0.1)',
                    }}
                    initial={{ scale: 0.88, opacity: 0, y: 24 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.88, opacity: 0, y: 24 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 380 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Top accent bar */}
                    <div style={{ height: '3px', background: `linear-gradient(90deg, ${themeColor}, ${themeColor}55)` }} />

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={themeColor}>
                          <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6zm-2 16a2 2 0 110-4 2 2 0 010 4z"/>
                        </svg>
                        <span className="font-orbitron text-xs tracking-widest" style={{ color: themeColor }}>
                          EFEITOS DO SORTEIO
                        </span>
                      </div>
                      <button
                        onClick={() => setShowEfeitos(false)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '0 24px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>

                      {/* ── STAGE PREVIEW SCREEN ─────────────────────── */}
                      <div style={{
                        position: 'relative',
                        height: '258px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: '#000',
                        marginBottom: '20px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        {/* Wallpaper */}
                        <img
                          src={eventBackground ?? '/fundo-stage1.png'}
                          alt=""
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55, pointerEvents: 'none' }}
                        />
                        {/* Gradient overlay */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0.35) 100%)', pointerEvents: 'none' }} />

                        {/* Show de luzes — AnimationPreviewMini scaled to fill — só no hover */}
                        <AnimatePresence>
                          {stagePreviewStyle && (
                            <motion.div
                              key={previewStyleKey}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
                            >
                              <div style={{ transform: 'scale(4.5)', transformOrigin: 'center' }}>
                                <AnimationPreviewMini style={stagePreviewStyle} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* StageBase — scaled platform at bottom */}
                        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%) scale(0.32)', transformOrigin: 'bottom center', pointerEvents: 'none', zIndex: 2 }}>
                          <div style={{ position: 'relative', width: 720, height: 460 }}>
                            <StageBase />
                          </div>
                        </div>

                        {/* Mascot — scaled at bottom center */}
                        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%) scale(0.50)', transformOrigin: 'bottom center', width: 300, height: 380, pointerEvents: 'none', zIndex: 3 }}>
                          {currentUser?.mascot === 'careca'
                            ? <MascotNakelas status="idle" isExploding={false} isScorched={false} winnerNumber={null} />
                            : <MascotShadowGanjaK status="idle" isExploding={false} isScorched={false} winnerNumber={null} />
                          }
                        </div>

                        {/* Spin effect — só no hover */}
                        <AnimatePresence>
                          {stagePreviewSpin && (
                            <motion.div
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5 }}
                            >
                              {stagePreviewSpin === 'numbers'   && <PreviewNumbers key={previewSpinKey} />}
                              {stagePreviewSpin === 'name-reel' && <PreviewNameReel key={previewSpinKey} />}
                              {stagePreviewSpin === 'wheel'     && <PreviewWheel key={previewSpinKey} />}
                              {stagePreviewSpin === 'matrix'    && <PreviewMatrix key={previewSpinKey} />}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* SIMULAÇÃO label */}
                        <div style={{ position: 'absolute', top: 10, left: 12, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px', background: 'rgba(0,0,0,0.55)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.07)' }}>
                          <motion.div
                            animate={{ opacity: [1, 0.15, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                            style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF3A3A', boxShadow: '0 0 5px #FF3A3A' }}
                          />
                          <span className="font-orbitron" style={{ fontSize: 8, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.38)' }}>
                            SIMULAÇÃO AO VIVO
                          </span>
                        </div>

                        {/* Active effect badge */}
                        {eventEffect !== 'none' && (
                          <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 10, padding: '2px 8px', background: 'rgba(0,0,0,0.55)', borderRadius: 5, border: `1px solid ${themeColor}33` }}>
                            <span className="font-rajdhani font-bold" style={{ fontSize: 10, color: themeColor, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                              {eventEffect === 'confetti' ? '🎊 CONFETTI' : eventEffect === 'fireworks' ? '🎆 FOGOS' : '✨ SPARKLES'}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* ── END STAGE PREVIEW ───────────────────────── */}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', alignItems: 'start' }}>

                        {/* SONOROS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <p className="font-orbitron font-bold" style={{ fontSize: '8px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>SONOROS</p>
                          <MusicaPanel themeColor={themeColor} eventMusic={eventMusic} onSelect={playMusicPreview} />
                        </div>

                        {/* REPRODUÇÃO DO SORTEIO */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <p className="font-orbitron font-bold" style={{ fontSize: '8px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>REPRODUÇÃO DO SORTEIO</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {SPIN_EFFECTS.map(opt => {
                              const active = spinEffect === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => setSpinEffect(opt.id)}
                                  onMouseEnter={() => {
                                    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
                                    setPreviewSpinKey(k => k + 1);
                                    setStagePreviewSpin(opt.id);
                                    spinTimerRef.current = setTimeout(() => setStagePreviewSpin(null), 3000);
                                  }}
                                  onMouseLeave={() => {
                                    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
                                    setStagePreviewSpin(null);
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '10px',
                                    background: active ? `${themeColor}15` : 'rgba(255,255,255,0.03)',
                                    border: active ? `1.5px solid ${themeColor}` : '1px solid rgba(255,255,255,0.06)',
                                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                                  }}
                                >
                                  <div style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: `${themeColor}20`, border: `1px solid ${themeColor}40`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, fontSize: 16,
                                  }}>
                                    {opt.emoji}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.1em', color: active ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                                      {opt.name}
                                    </p>
                                    <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.35)', lineHeight: 1.3, marginTop: 1 }}>
                                      {opt.desc}
                                    </p>
                                  </div>
                                  {active && (
                                    <span className="font-orbitron font-bold" style={{ fontSize: 9, letterSpacing: '0.15em', color: themeColor, flexShrink: 0 }}>ATIVO</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* VISUAIS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <p className="font-orbitron font-bold" style={{ fontSize: '8px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>VISUAIS</p>
                          <EfeitosPanel themeColor={themeColor} eventEffect={eventEffect} setEventEffect={setEventEffect} onPreview={triggerPreview} />
                        </div>

                        {/* SHOW DE LUZES */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <p className="font-orbitron font-bold" style={{ fontSize: '8px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>SHOW DE LUZES</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {ANIMATION_STYLES.map(opt => {
                              const active = raffleAnimationStyle === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => setRaffleAnimationStyle(opt.id)}
                                  onMouseEnter={() => {
                                    if (styleTimerRef.current) clearTimeout(styleTimerRef.current);
                                    setPreviewStyleKey(k => k + 1);
                                    setStagePreviewStyle(opt.id);
                                    styleTimerRef.current = setTimeout(() => setStagePreviewStyle(null), 3000);
                                  }}
                                  onMouseLeave={() => {
                                    if (styleTimerRef.current) clearTimeout(styleTimerRef.current);
                                    setStagePreviewStyle(null);
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '10px',
                                    background: active ? `${themeColor}15` : 'rgba(255,255,255,0.03)',
                                    border: active ? `1.5px solid ${themeColor}` : '1px solid rgba(255,255,255,0.06)',
                                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                                  }}
                                >
                                  <div style={{
                                    width: 32, height: 32, borderRadius: 8,
                                    background: `${themeColor}20`, border: `1px solid ${themeColor}40`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, fontSize: 16,
                                  }}>
                                    {opt.emoji}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p className="font-orbitron font-bold" style={{ fontSize: '9px', letterSpacing: '0.1em', color: active ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                                      {opt.name}
                                    </p>
                                    <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.35)', lineHeight: 1.3, marginTop: 1 }}>
                                      {opt.desc}
                                    </p>
                                  </div>
                                  {active && (
                                    <span className="font-orbitron font-bold" style={{ fontSize: 9, letterSpacing: '0.15em', color: themeColor, flexShrink: 0 }}>ATIVO</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>
      </div>

      {/* Center — Stage 1 background (extends full height behind header too) */}
      {currentUser?.mascot !== 'careca' && (
        <div
          style={{
            position: 'absolute',
            top: 0, bottom: '20px',
            left: 'calc(24% + 27px)',
            right: 'calc(24% + 27px)',
            zIndex: 5,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <img
            src="/fundo-stage1.png"
            alt=""
            aria-hidden
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              opacity: 0.9,
            }}
          />
        </div>
      )}

      {/* 2 columns + mascot center */}
      <div className="relative flex justify-between flex-1 min-h-0 overflow-hidden">

        {/* Col 1 — Participants */}
        <div
          className="glass rounded-2xl flex flex-col overflow-hidden"
          style={{ width: '22%', minWidth: 0, border: '1px solid rgba(0,229,255,0.15)', marginLeft: '15px', marginRight: '15px', marginBottom: '20px' }}
        >
          {/* Accent bar */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #00E5FF, #1F8CFF55)', boxShadow: '0 0 12px rgba(0,229,255,0.6)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '20px 14px 0 14px' }}>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#00E5FF" style={{ flexShrink: 0, opacity: 0.85 }}>
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              <span className="font-orbitron font-bold text-sm tracking-widest text-white">Participantes</span>
              {excelImportEnabled && (
                <StructureTooltip
                  color="#00CFFF"
                  lines={[
                    'Estrutura esperada: Coluna A = Número | Coluna B = Nome',
                    'Cabeçalho é detectado automaticamente e ignorado',
                  ]}
                />
              )}
              <div className="flex-1" />
              <span
                className="font-orbitron font-bold text-xs px-2 py-0.5 rounded-md"
                style={{
                  color: '#00E5FF',
                  background: 'rgba(0,229,255,0.1)',
                  border: '1px solid rgba(0,229,255,0.3)',
                }}
              >
                {participants.length.toLocaleString()}
              </span>
            </div>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(0,229,255,0.3), transparent)', marginTop: '12px', marginBottom: '14px' }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, padding: '0 14px 12px 14px', display: 'flex', flexDirection: 'column' }}>
            <ParticipantImport />
          </div>
        </div>

        {/* Center — Mascot + action buttons */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0',
        }}>
          {/* Mascot */}
          <div style={{ pointerEvents: 'none' }}>
            {currentUser?.mascot !== 'careca' ? (
              <img
                src="/mascote-inicio-ganja.png"
                alt="ShadowGanjaK"
                draggable={false}
                style={{ width: '280px', height: '300px', objectFit: 'contain', objectPosition: 'bottom', userSelect: 'none' }}
              />
            ) : (
              <div style={{ transform: 'scale(1.17)', transformOrigin: 'center center', width: '280px', height: '300px' }}>
                <MascotContainer isExploding={false} isScorched={false} />
              </div>
            )}
          </div>
          {/* Event name + button below mascot */}
          <div style={{ width: '280px' }}>
            <EventHeader />
            <motion.button
              onClick={() => setRaffleStage(2)}
              disabled={!canStart}
              whileHover={canStart ? { scale: 1.04 } : {}}
              whileTap={canStart ? { scale: 0.96 } : {}}
              title={!canStart ? startLabel : 'Iniciar sorteio'}
              style={{
                marginTop: '12px',
                width: '100%',
                height: '44px',
                borderRadius: '12px',
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 900,
                fontSize: '13px',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: canStart ? 'pointer' : 'not-allowed',
                opacity: canStart ? 1 : 0.4,
                background: canStart
                  ? 'linear-gradient(135deg, #00E5FF 0%, #1F8CFF 60%, #00CFFF 100%)'
                  : 'rgba(255,255,255,0.05)',
                boxShadow: canStart ? '0 0 28px rgba(0,229,255,0.4), 0 0 60px rgba(0,229,255,0.15)' : 'none',
                color: canStart ? '#050816' : 'rgba(255,255,255,0.3)',
                border: 'none',
                whiteSpace: 'nowrap',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
              INICIAR SORTEIO
            </motion.button>
          </div>
        </div>

        {/* Col 2 — Prizes */}
        <div
          className="glass rounded-2xl flex flex-col overflow-hidden"
          style={{ width: '22%', minWidth: 0, border: '1px solid rgba(160,80,255,0.2)', marginLeft: '15px', marginRight: '15px', marginBottom: '20px' }}
        >
          {/* Accent bar */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #A050FF, #A050FF55)', boxShadow: '0 0 12px rgba(160,80,255,0.6)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '20px 14px 0 14px' }}>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.85 }}>
                <rect x="2" y="12" width="20" height="10" rx="1" fill="#A050FF"/>
                <rect x="1" y="8" width="22" height="4" rx="1" fill="#A050FF"/>
                <rect x="11" y="8" width="2" height="14" fill="rgba(255,255,255,0.15)"/>
                <path d="M12 8C10 6 7 5 6 3C6 1 9 1 11 3C11.5 5 12 8 12 8Z" fill="#A050FF"/>
                <path d="M12 8C14 6 17 5 18 3C18 1 15 1 13 3C12.5 5 12 8 12 8Z" fill="#A050FF"/>
              </svg>
              <span className="font-orbitron font-bold text-sm tracking-widest text-white">PRÊMIOS</span>
              {excelPrizesImportEnabled && (
                <StructureTooltip
                  color="#A050FF"
                  lines={[
                    'Estrutura esperada: Coluna A = Prêmio | Coluna B = Quantidade',
                    'A ordem das linhas define a sequência do sorteio',
                  ]}
                />
              )}
              <div className="flex-1" />
              <motion.button
                onClick={() => prizeManagerRef.current?.openAdd()}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-rajdhani font-bold text-xs tracking-widest transition-all"
                style={{
                  background: 'rgba(160,80,255,0.1)',
                  border: '1px solid rgba(160,80,255,0.35)',
                  color: '#A050FF',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '4px' }}>
                  <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
                </svg>
                <span style={{ marginTop: '5px', marginBottom: '5px', marginLeft: '4px', marginRight: '4px' }}>ADICIONAR</span>
              </motion.button>
            </div>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(160,80,255,0.4), transparent)', marginTop: '12px', marginBottom: '14px' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: prizes.some(p => p.pscValue !== undefined) ? '0 14px 8px 14px' : '0 14px 24px 14px' }}>
            <PrizeManager ref={prizeManagerRef} />
          </div>

          {/* Total PSC — apenas para afiliados */}
          {isAffiliate && prizes.some(p => p.pscValue !== undefined) && (
            <div style={{ padding: '0 10px 10px 10px', flexShrink: 0 }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: hasPscOverflow ? 'rgba(28,6,6,0.92)' : 'rgba(10,6,28,0.85)',
                border: `1px solid ${hasPscOverflow ? 'rgba(255,60,60,0.5)' : 'rgba(160,80,255,0.35)'}`,
                boxShadow: hasPscOverflow ? '0 -4px 24px rgba(255,60,60,0.18), 0 8px 24px rgba(0,0,0,0.5)' : '0 -4px 24px rgba(160,80,255,0.18), 0 8px 24px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)',
              }}>
                <div className="flex items-center justify-between">
                  <span className="font-orbitron text-xs tracking-widest" style={{ color: hasPscOverflow ? 'rgba(255,100,100,0.9)' : 'rgba(160,80,255,0.7)' }}>
                    TOTAL
                  </span>
                  <div className="flex items-center gap-1.5">
                    {hasPscOverflow && (
                      <span className="font-rajdhani font-bold text-xs" style={{ color: '#FF6060' }}>Saldo insuficiente</span>
                    )}
                    <span style={{ fontSize: '13px' }}>💠</span>
                    <span className="font-orbitron font-bold text-sm" style={{ color: hasPscOverflow ? '#FF6060' : '#00FFA3' }}>
                      {totalPscCost.toLocaleString('pt-BR')}
                    </span>
                    <span className="font-rajdhani text-xs tracking-widest" style={{ color: hasPscOverflow ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.3)' }}>PSC</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>


      </div>

    </div>
  );
}
