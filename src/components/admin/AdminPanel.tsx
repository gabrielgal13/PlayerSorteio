'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import EntregasPage from '@/components/deliveries/EntregasPage';
import AdminDeliveriesDashboard from '@/components/admin/AdminDeliveriesDashboard';
import MarketingSection from '@/components/admin/MarketingSection';
import type { RaffleResult, DeliveryStatus } from '@/types';

interface StreamerRow { username: string; displayName: string | null; pscBalance: number; isAffiliate: boolean; }
interface AdminProduct { id: string; name: string; description: string | null; imageUrl: string | null; quantity: number; pscValue: number | null; skipPsc: boolean; }
interface EditProfile { displayName: string; newPassword: string; twitchChannel: string; kickChannel: string; youtubeChannel: string; themeColor: string; chatWarsSprite: string; forceFirstAccess: boolean; currentForcePasswordChange: boolean; }
type Section = 'psc' | 'criar-streamer' | 'entregas' | 'editar-streamer' | 'marketing' | 'bots';

const COLOR_PRESETS = ['#BF5AF2', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#00E5FF', '#00FFA3'];

const STAGE_THEMES = [
  { id: 'cyber-purple', label: 'Cyber Purple', image: '/Cyber Purple.png' },
  { id: 'neon-blue',    label: 'Neon Blue',    image: '/Neon Blue.png' },
  { id: 'dark-forest',  label: 'Dark Forest',  image: '/Dark Forest.png' },
  { id: 'inferno',      label: 'Inferno',       image: '/Inferno.png' },
  { id: 'arctic',       label: 'Arctic',        image: '/Arctic.png' },
];

const MAX_FRAMES = 8;
const DEFAULT_TIMINGS = [0, 2.0, 3.5, 5.5, 6.3, 7.5, 9.0, 11.0];

// ── Frame Animation Builder ───────────────────────────────────────────────────
function FrameBuilder({
  frames, timings, onFramesChange, onTimingsChange,
}: {
  frames: (string | null)[];
  timings: number[];
  onFramesChange: (f: (string | null)[]) => void;
  onTimingsChange: (t: number[]) => void;
}) {
  const [previewIdx, setPreviewIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uploadedCount = frames.filter(Boolean).length;

  const handleFileChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const next = [...frames];
      next[idx] = ev.target?.result as string;
      onFramesChange(next);
    };
    reader.readAsDataURL(file);
  };

  const removeFrame = (idx: number) => {
    const next = [...frames];
    next[idx] = null;
    const compacted = [...next.filter(Boolean), ...Array(MAX_FRAMES).fill(null)].slice(0, MAX_FRAMES);
    onFramesChange(compacted);
  };

  const playPreview = () => {
    if (uploadedCount < 2) return;
    const filled = frames.map((f, i) => ({ f, i })).filter(x => x.f !== null);
    let step = 0;
    setPreviewIdx(filled[0].i);
    setPlaying(true);

    const next = () => {
      step++;
      if (step >= filled.length) { setPlaying(false); setPreviewIdx(0); return; }
      setPreviewIdx(filled[step].i);
      const delay = (timings[filled[step].i] - timings[filled[step - 1].i]) * 1000;
      playRef.current = setTimeout(next, Math.max(delay, 300));
    };
    playRef.current = setTimeout(next, 800);
  };

  useEffect(() => () => { if (playRef.current) clearTimeout(playRef.current); }, []);

  return (
    <div className="flex flex-col gap-5">

      {/* Frame grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            FRAMES DA ANIMAÇÃO
          </p>
          <span className="font-orbitron text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {uploadedCount}/{MAX_FRAMES} frames
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: MAX_FRAMES }).map((_, i) => {
            const img = frames[i];
            const isActive = previewIdx === i && playing;
            return (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden flex flex-col items-center justify-center"
                style={{
                  aspectRatio: '1 / 1.2',
                  background: img ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.02)',
                  border: isActive
                    ? '2px solid #00E5FF'
                    : img
                    ? '1px solid rgba(255,255,255,0.15)'
                    : '1px dashed rgba(255,255,255,0.1)',
                  boxShadow: isActive ? '0 0 12px rgba(0,229,255,0.4)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                {img ? (
                  <>
                    <img src={img} alt={`frame ${i + 1}`} className="w-full h-full object-contain" />
                    <div
                      className="absolute top-1 left-1 font-orbitron text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.7)', color: isActive ? '#00E5FF' : 'rgba(255,255,255,0.6)', fontSize: 9 }}
                    >
                      F{i + 1}
                    </div>
                    <button
                      onClick={() => removeFrame(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center transition-all"
                      style={{ background: 'rgba(255,50,50,0.7)' }}
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-1.5">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                    <span className="font-orbitron" style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
                      F{i + 1}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(i, e)} />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview player */}
      {uploadedCount > 0 && (
        <div className="flex gap-4 items-start">
          <div
            className="rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{
              width: 120, height: 150,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {frames[previewIdx] ? (
              <img src={frames[previewIdx]!} alt="preview" className="w-full h-full object-contain" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.1)">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"/>
              </svg>
            )}
          </div>

          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={playPreview}
                disabled={playing || uploadedCount < 2}
                className="flex items-center gap-2 px-3 py-2 rounded-lg font-orbitron text-xs font-bold tracking-widest transition-all"
                style={{
                  background: playing ? 'rgba(255,255,255,0.04)' : 'rgba(0,229,255,0.1)',
                  border: playing ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,229,255,0.3)',
                  color: playing ? 'rgba(255,255,255,0.3)' : 'rgba(0,229,255,0.9)',
                  cursor: playing || uploadedCount < 2 ? 'not-allowed' : 'pointer',
                }}
              >
                {playing ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
                {playing ? 'PLAYING...' : 'PREVIEW'}
              </button>
              <div className="flex gap-1">
                {frames.map((f, i) => f ? (
                  <button
                    key={i}
                    onClick={() => { if (!playing) setPreviewIdx(i); }}
                    className="rounded-full transition-all"
                    style={{
                      width: previewIdx === i ? 10 : 6,
                      height: previewIdx === i ? 10 : 6,
                      background: previewIdx === i ? '#00E5FF' : 'rgba(255,255,255,0.2)',
                    }}
                  />
                ) : null)}
              </div>
            </div>
            <p className="font-orbitron text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
              Frame {previewIdx + 1} de {MAX_FRAMES} • {uploadedCount} carregados
            </p>
          </div>
        </div>
      )}

      {/* Timing editor */}
      {uploadedCount >= 2 && (
        <div className="flex flex-col gap-2">
          <p className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            TIMING DAS TRANSIÇÕES (segundos desde o início)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {frames.map((f, i) => !f ? null : (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="font-orbitron text-xs font-bold" style={{ color: 'rgba(0,229,255,0.6)', minWidth: 24, fontSize: 10 }}>
                  F{i + 1}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={timings[i]}
                  onChange={e => {
                    const next = [...timings];
                    next[i] = parseFloat(e.target.value) || 0;
                    onTimingsChange(next);
                  }}
                  className="flex-1 rounded-lg font-orbitron text-xs outline-none px-2 py-1 text-center"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                />
                <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>s</span>
              </div>
            ))}
          </div>
          <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            Cada valor é o momento (em segundos) em que aquele frame aparece durante o sorteio.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// ── BotCard ───────────────────────────────────────────────────────────────────
function BotCard({
  platform, color, authUrl, statusUrl, icon, description, note,
}: {
  platform: string;
  color: string;
  authUrl: string;
  statusUrl: string;
  icon: React.ReactNode;
  description: string;
  note: string;
}) {
  const [status, setStatus] = useState<{ connected: boolean; label: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(statusUrl)
      .then(r => r.json())
      .then((data: { connected: boolean; channelName?: string; username?: string }) => {
        setStatus({ connected: data.connected, label: data.channelName ?? data.username ?? null });
      })
      .catch(() => setStatus({ connected: false, label: null }))
      .finally(() => setLoading(false));
  }, [statusUrl]);

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="font-orbitron text-sm font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {platform}
            </p>
            <p className="font-rajdhani text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {loading ? (
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
          ) : status?.connected ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {status.label ?? 'Conectado'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Desconectado
              </span>
            </div>
          )}

          <a
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg font-orbitron text-xs font-bold tracking-widest transition-all"
            style={{
              background: `rgba(${hexToRgbInline(color)},0.12)`,
              border: `1px solid rgba(${hexToRgbInline(color)},0.3)`,
              color,
            }}
          >
            {status?.connected ? 'RECONECTAR' : 'CONECTAR'}
          </a>
        </div>
      </div>

      <p className="font-rajdhani text-xs mt-3 pl-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
        ⚠ {note}
      </p>
    </div>
  );
}

function hexToRgbInline(hex: string): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  return `${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)}`;
}

// ── KickTokenCard ─────────────────────────────────────────────────────────────
function KickTokenCard() {
  const [status, setStatus] = useState<{ connected: boolean; label: string | null } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const color = '#53FC18';

  const refresh = useCallback(() => {
    setLoadingStatus(true);
    fetch('/api/kick/status')
      .then(r => r.json())
      .then((data: { connected: boolean; username?: string }) => {
        setStatus({ connected: data.connected, label: data.username ?? null });
      })
      .catch(() => setStatus({ connected: false, label: null }))
      .finally(() => setLoadingStatus(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/kick/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json() as { ok: boolean; username?: string; error?: string };
      if (data.ok) {
        setSaveMsg(`✅ Conectado como ${data.username}`);
        setToken('');
        refresh();
      } else {
        setSaveMsg(`❌ ${data.error ?? 'Erro desconhecido'}`);
      }
    } catch {
      setSaveMsg('❌ Erro de rede');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#53FC18">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4-3h-2v-2h2v-2h-2V8h2l2 2.5L15 13z"/>
          </svg>
          <div>
            <p className="font-orbitron text-sm font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>Kick</p>
            <p className="font-rajdhani text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Bot envia mensagem de ganhador + responde comandos do chat da Kick.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {loadingStatus ? (
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
          ) : status?.connected ? (
            <>
              <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{status.label ?? 'Conectado'}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Desconectado</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="password"
          placeholder="Cole o Bearer token da conta bot aqui..."
          value={token}
          onChange={e => setToken(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg font-rajdhani text-sm"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !token.trim()}
          className="px-4 py-2 rounded-lg font-orbitron text-xs font-bold tracking-widest transition-all"
          style={{
            background: 'rgba(83,252,24,0.12)',
            border: '1px solid rgba(83,252,24,0.3)',
            color,
            opacity: saving || !token.trim() ? 0.4 : 1,
            cursor: saving || !token.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '...' : 'SALVAR'}
        </button>
      </div>

      {saveMsg && (
        <p className="font-rajdhani text-xs mt-2 pl-1" style={{ color: saveMsg.startsWith('❌') ? '#FF5555' : color }}>
          {saveMsg}
        </p>
      )}

      <p className="font-rajdhani text-xs mt-3 pl-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
        ⚠ Como obter: faça login em kick.com como a conta bot → DevTools (F12) → Network → qualquer request → header{' '}
        <span style={{ fontFamily: 'monospace' }}>Authorization: Bearer ...</span>
      </p>
    </div>
  );
}

function BotMuteToggle() {
  const [muted, setMuted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/bot-config')
      .then(r => r.json())
      .then((d: { muted: boolean }) => setMuted(d.muted))
      .catch(() => setMuted(false));
  }, []);

  const toggle = async () => {
    if (muted === null) return;
    setSaving(true);
    const next = !muted;
    try {
      await fetch('/api/admin/bot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: next }),
      });
      setMuted(next);
    } finally {
      setSaving(false);
    }
  };

  const on = muted === false;

  return (
    <div
      className="rounded-2xl mb-6 flex items-center justify-between gap-4 px-5 py-4"
      style={{
        background: muted ? 'rgba(255,61,87,0.07)' : 'rgba(0,229,255,0.05)',
        border: muted ? '1px solid rgba(255,61,87,0.3)' : '1px solid rgba(0,229,255,0.18)',
      }}
    >
      <div>
        <p className="font-orbitron font-bold text-sm tracking-widest" style={{ color: muted ? '#FF3D57' : 'rgba(255,255,255,0.85)' }}>
          {muted ? '🔇 MENSAGENS SILENCIADAS' : '🔊 MENSAGENS ATIVAS'}
        </p>
        <p className="font-rajdhani text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {muted ? 'Os bots não enviam mensagens em nenhum chat.' : 'Os bots enviam mensagens normalmente em todos os chats.'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving || muted === null}
        style={{
          flexShrink: 0,
          width: 52, height: 28,
          borderRadius: 14,
          background: on ? '#00E5FF' : 'rgba(255,255,255,0.12)',
          border: on ? '1px solid rgba(0,229,255,0.6)' : '1px solid rgba(255,255,255,0.15)',
          position: 'relative',
          cursor: saving || muted === null ? 'wait' : 'pointer',
          transition: 'background 0.2s, border 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3, left: on ? 26 : 3,
            width: 20, height: 20,
            borderRadius: '50%',
            background: on ? '#050816' : 'rgba(255,255,255,0.5)',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
}

export default function AdminPanel() {
  const logout = useStore(s => s.logout);
  const addPscToAll = useStore(s => s.addPscToAll);

  const [activeSection, setActiveSection] = useState<Section>('psc');

  // PSC state
  const [streamers, setStreamers] = useState<StreamerRow[]>([]);
  const [amount, setAmount] = useState('');
  const [pscFeedback, setPscFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Criar streamer state
  const [form, setForm] = useState({ username: '', displayName: '', password: '', mascot: 'dreads', themeColor: '#BF5AF2', pscBalance: 0, stageTheme: 'cyber-purple', twitchChannel: '', kickChannel: '', youtubeChannel: '' });
  const [mascotImg, setMascotImg] = useState<string | null>(null);
  const [animFrames, setAnimFrames] = useState<(string | null)[]>(Array(MAX_FRAMES).fill(null));
  const [animTimings, setAnimTimings] = useState<number[]>([...DEFAULT_TIMINGS]);
  const [createFeedback, setCreateFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAnimModal, setShowAnimModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [raffleMascotImg, setRaffleMascotImg] = useState<string | null>(null);
  const [stageBgImg, setStageBgImg] = useState<string | null>(null);
  const [configBgImg, setConfigBgImg] = useState<string | null>(null);

  // Editar streamer state
  const [editStreamer, setEditStreamer] = useState<string>('');
  const [editData, setEditData] = useState<StreamerRow | null>(null);
  const [editPscInput, setEditPscInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [adminProducts, setAdminProducts] = useState<AdminProduct[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [newProd, setNewProd] = useState({ name: '', description: '', quantity: 1, pscValue: '', skipPsc: false });
  const [addingProd, setAddingProd] = useState(false);

  const [botCommands, setBotCommands] = useState<{ id: string; command: string; response: string }[]>([]);
  const [botCmdLoading, setBotCmdLoading] = useState(false);
  const [newBotCmd, setNewBotCmd] = useState({ command: '', response: '' });
  const [addingBotCmd, setAddingBotCmd] = useState(false);

  const [editProfile, setEditProfile] = useState<EditProfile>({ displayName: '', newPassword: '', twitchChannel: '', kickChannel: '', youtubeChannel: '', themeColor: '#00E5FF', chatWarsSprite: '', forceFirstAccess: false, currentForcePasswordChange: false });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editProfileLoading, setEditProfileLoading] = useState(false);

  // Entregas admin state
  const [entregasTab, setEntregasTab] = useState<'dashboard' | 'streamer'>('dashboard');
  const [entregasStreamer, setEntregasStreamer] = useState<string>('');
  const [entregasHistory, setEntregasHistory] = useState<RaffleResult[]>([]);
  const [entregasLoading, setEntregasLoading] = useState(false);

  const loadEntregasHistory = useCallback(async (username: string) => {
    if (!username) return;
    setEntregasLoading(true);
    try {
      const res = await fetch(`/api/streamer/history?username=${username}`);
      const data = await res.json();
      if (Array.isArray(data)) setEntregasHistory(data);
    } catch {}
    setEntregasLoading(false);
  }, []);

  const handleEntregasUpdateDelivery = useCallback((id: string, tradeLink?: string, deliveryStatus?: DeliveryStatus) => {
    const now = Date.now();
    setEntregasHistory(prev => prev.map(r => r.id === id ? {
      ...r,
      ...(tradeLink !== undefined && { tradeLink }),
      ...(deliveryStatus !== undefined && { deliveryStatus }),
      ...(deliveryStatus === 'tradelocked' && !r.tradeLockAt && { tradeLockAt: now }),
    } : r));
    fetch('/api/streamer/delivery', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historyId: id, tradeLink, deliveryStatus }),
    }).catch(() => {});
  }, []);

  const loadStreamers = useCallback(() => {
    fetch('/api/admin/streamers')
      .then(r => r.json())
      .then(setStreamers)
      .catch(() => {});
  }, []);

  useEffect(() => { loadStreamers(); }, [loadStreamers]);

  const handleAddPsc = () => {
    const value = Number(amount);
    if (!amount || isNaN(value) || value <= 0) {
      setPscFeedback({ type: 'error', msg: 'Informe um valor válido maior que zero.' });
      setTimeout(() => setPscFeedback(null), 3000);
      return;
    }
    addPscToAll(value);
    setPscFeedback({ type: 'success', msg: `+${value.toLocaleString('pt-BR')} PSC adicionados para todos os streamers.` });
    setAmount('');
    setTimeout(() => { setPscFeedback(null); loadStreamers(); }, 2000);
  };

  const loadAdminProducts = useCallback(async (username: string) => {
    if (!username) return;
    setProdLoading(true);
    try {
      const res = await fetch(`/api/admin/streamers/${username}/products`);
      const data = await res.json();
      if (Array.isArray(data)) setAdminProducts(data);
    } catch {}
    setProdLoading(false);
  }, []);

  const loadBotCommands = useCallback(async (username: string) => {
    if (!username) return;
    setBotCmdLoading(true);
    try {
      const res = await fetch(`/api/admin/streamers/${username}/bot-commands`);
      const data = await res.json();
      if (Array.isArray(data)) setBotCommands(data);
    } catch {}
    setBotCmdLoading(false);
  }, []);

  const loadEditStreamer = useCallback(async (username: string) => {
    const row = streamers.find(s => s.username === username) ?? null;
    setEditData(row);
    setEditPscInput(row ? String(row.pscBalance) : '');
    setAdminProducts([]);
    setBotCommands([]);
    setEditProfile({ displayName: '', newPassword: '', twitchChannel: '', kickChannel: '', youtubeChannel: '', themeColor: '#00E5FF', chatWarsSprite: '', forceFirstAccess: false, currentForcePasswordChange: false });
    if (username) {
      loadAdminProducts(username);
      loadBotCommands(username);
      setEditProfileLoading(true);
      try {
        const res = await fetch(`/api/admin/streamers/${username}`);
        const fullData = await res.json();
        if (!fullData.error) {
          setEditProfile({
            displayName: fullData.displayName ?? '',
            newPassword: '',
            twitchChannel: fullData.twitchChannel ?? '',
            kickChannel: fullData.kickChannel ?? '',
            youtubeChannel: fullData.youtubeChannel ?? '',
            themeColor: fullData.themeColor ?? '#00E5FF',
            chatWarsSprite: fullData.chatWarsSprite ?? '',
            forceFirstAccess: false,
            currentForcePasswordChange: fullData.forcePasswordChange ?? false,
          });
        }
      } catch {}
      setEditProfileLoading(false);
    }
  }, [streamers, loadAdminProducts, loadBotCommands]);

  const handleEditSelectStreamer = (username: string) => {
    setEditStreamer(username);
    loadEditStreamer(username);
    setEditFeedback(null);
  };

  const handleToggleAffiliate = () => {
    if (!editData) return;
    setEditData(d => d ? { ...d, isAffiliate: !d.isAffiliate } : d);
  };

  const handleSaveAll = async () => {
    if (!editData) return;
    const pscValue = Number(editPscInput);
    if (isNaN(pscValue) || pscValue < 0) {
      setEditFeedback({ type: 'error', msg: 'Valor PSC inválido.' });
      setTimeout(() => setEditFeedback(null), 3000);
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        isAffiliate: editData.isAffiliate,
        pscBalance: pscValue,
        themeColor: editProfile.themeColor,
        twitchChannel: editProfile.twitchChannel || null,
        kickChannel: editProfile.kickChannel || null,
        youtubeChannel: editProfile.youtubeChannel || null,
        displayName: editProfile.displayName.trim() || null,
        chatWarsSprite: editProfile.chatWarsSprite || null,
      };
      if (editProfile.forceFirstAccess) {
        body.forcePasswordChange = true;
      } else if (editProfile.newPassword.trim()) {
        body.password = editProfile.newPassword.trim();
      }
      const res = await fetch(`/api/admin/streamers/${editData.username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data: Record<string, unknown>;
      try {
        data = await res.json();
      } catch {
        setEditFeedback({ type: 'error', msg: `Erro no servidor (HTTP ${res.status}).` });
        return;
      }
      if (!res.ok) {
        setEditFeedback({ type: 'error', msg: (data.error as string) ?? 'Erro ao salvar.' });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEditData(data as any);
        setEditPscInput(String(data.pscBalance));
        setStreamers(prev => prev.map(s => s.username === editData.username
          ? { ...s, displayName: data.displayName as string | null, pscBalance: data.pscBalance as number, isAffiliate: data.isAffiliate as boolean }
          : s
        ));
        setEditProfile(p => ({
          ...p,
          newPassword: '',
          forceFirstAccess: false,
          currentForcePasswordChange: (data.forcePasswordChange as boolean | undefined) ?? p.currentForcePasswordChange,
          displayName: (data.displayName as string | null | undefined) ?? p.displayName,
        }));
        setEditFeedback({ type: 'success', msg: 'Alterações salvas com sucesso.' });
      }
    } catch {
      setEditFeedback({ type: 'error', msg: 'Erro de conexão.' });
    } finally {
      setEditSaving(false);
      setTimeout(() => setEditFeedback(null), 3000);
    }
  };

  const handleAddProduct = async () => {
    if (!editData || !newProd.name.trim()) return;
    setAddingProd(true);
    try {
      const res = await fetch(`/api/admin/streamers/${editData.username}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProd.name,
          description: newProd.description || null,
          quantity: newProd.quantity,
          pscValue: newProd.pscValue !== '' ? Number(newProd.pscValue) : null,
          skipPsc: newProd.skipPsc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditFeedback({ type: 'error', msg: data.error ?? 'Erro ao adicionar produto.' });
      } else {
        setAdminProducts(prev => [...prev, data]);
        setNewProd({ name: '', description: '', quantity: 1, pscValue: '', skipPsc: false });
        setEditFeedback({ type: 'success', msg: `Produto "${data.name}" adicionado.` });
      }
    } catch {
      setEditFeedback({ type: 'error', msg: 'Erro de conexão.' });
    } finally {
      setAddingProd(false);
      setTimeout(() => setEditFeedback(null), 3000);
    }
  };

  const handleDeleteProduct = async (itemId: string) => {
    if (!editData) return;
    try {
      await fetch(`/api/admin/streamers/${editData.username}/products?itemId=${itemId}`, { method: 'DELETE' });
      setAdminProducts(prev => prev.filter(p => p.id !== itemId));
    } catch {}
  };

  const handleAddBotCmd = async () => {
    if (!editData || !newBotCmd.command.trim() || !newBotCmd.response.trim()) return;
    setAddingBotCmd(true);
    try {
      const res = await fetch(`/api/admin/streamers/${editData.username}/bot-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: newBotCmd.command.trim(), response: newBotCmd.response.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditFeedback({ type: 'error', msg: data.error ?? 'Erro ao adicionar comando.' });
      } else {
        setBotCommands(prev => [...prev, data]);
        setNewBotCmd({ command: '', response: '' });
        setEditFeedback({ type: 'success', msg: `Comando "${data.command}" adicionado.` });
      }
    } catch {
      setEditFeedback({ type: 'error', msg: 'Erro de conexão.' });
    } finally {
      setAddingBotCmd(false);
      setTimeout(() => setEditFeedback(null), 3000);
    }
  };

  const handleDeleteBotCmd = async (id: string) => {
    if (!editData) return;
    try {
      await fetch(`/api/admin/streamers/${editData.username}/bot-commands?id=${id}`, { method: 'DELETE' });
      setBotCommands(prev => prev.filter(c => c.id !== id));
    } catch {}
  };

  const handleMascotImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setMascotImg(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRaffleMascotImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setRaffleMascotImg(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleStageBgImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setStageBgImg(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfigBgImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setConfigBgImg(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreateStreamer = async () => {
    if (!form.username || !form.password) {
      setCreateFeedback({ type: 'error', msg: 'Username e senha são obrigatórios.' });
      setTimeout(() => setCreateFeedback(null), 3000);
      return;
    }
    setCreating(true);
    try {
      const uploadedFrames = animFrames.filter(Boolean);
      const res = await fetch('/api/admin/streamers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          mascotImg,
          raffleMascotImg,
          animFrames: uploadedFrames,
          animTimings: animTimings.slice(0, uploadedFrames.length),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateFeedback({ type: 'error', msg: data.error || 'Erro ao criar streamer.' });
      } else {
        setCreateFeedback({ type: 'success', msg: `Streamer "${data.username}" criado com sucesso!` });
        setForm({ username: '', displayName: '', password: '', mascot: 'dreads', themeColor: '#BF5AF2', pscBalance: 0, stageTheme: 'cyber-purple', twitchChannel: '', kickChannel: '', youtubeChannel: '' });
        setMascotImg(null);
        setRaffleMascotImg(null);
        setStageBgImg(null);
        setConfigBgImg(null);
        setAnimFrames(Array(MAX_FRAMES).fill(null));
        setAnimTimings([...DEFAULT_TIMINGS]);
        loadStreamers();
      }
    } catch {
      setCreateFeedback({ type: 'error', msg: 'Erro de conexão.' });
    } finally {
      setCreating(false);
      setTimeout(() => setCreateFeedback(null), 4000);
    }
  };

  const SIDEBAR_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
    {
      id: 'psc',
      label: 'DISTRIBUIÇÃO PSC',
      icon: <span style={{ fontSize: 15 }}>💠</span>,
    },
    {
      id: 'criar-streamer',
      label: 'CRIAR STREAMER',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
      ),
    },
    {
      id: 'editar-streamer' as Section,
      label: 'EDITAR STREAMER',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      ),
    },
    {
      id: 'entregas' as Section,
      label: 'ENTREGAS',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      ),
    },
    {
      id: 'marketing' as Section,
      label: 'MARKETING',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-5-7l-3 3.72L11 13l-4 5h14l-4-5z"/>
        </svg>
      ),
    },
    {
      id: 'bots' as Section,
      label: 'BOTS DE CHAT',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 10H7v-2h10v2zm0-3H7V7h10v2z"/>
        </svg>
      ),
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #050816 0%, #0a0f2e 50%, #050816 100%)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(5,8,22,0.8)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.25)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,180,0,0.9)" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(255,180,0,0.9)' }}>
              ADMIN
            </span>
          </div>
          <span className="font-orbitron text-base font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
            PAINEL DE ADMINISTRAÇÃO
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ddK
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-orbitron text-xs font-bold tracking-widest transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,60,60,0.12)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,60,60,0.3)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,100,100,0.9)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            SAIR
          </button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT SIDEBAR */}
        <aside
          className="flex flex-col gap-1 p-4 flex-shrink-0"
          style={{
            width: 220,
            background: 'rgba(5,8,22,0.6)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p className="font-orbitron text-xs tracking-widest mb-3 px-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            MENU
          </p>
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl font-orbitron text-xs font-bold tracking-wider transition-all text-left"
              style={{
                background: activeSection === item.id ? 'rgba(255,180,0,0.1)' : 'transparent',
                border: activeSection === item.id ? '1px solid rgba(255,180,0,0.25)' : '1px solid transparent',
                color: activeSection === item.id ? 'rgba(255,180,0,0.9)' : 'rgba(255,255,255,0.35)',
              }}
              onMouseEnter={e => {
                if (activeSection !== item.id)
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)';
              }}
              onMouseLeave={e => {
                if (activeSection !== item.id)
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)';
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main className={activeSection === 'entregas' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-y-auto px-8 py-10'}>
          <AnimatePresence mode="wait">

            {/* ── PSC DISTRIBUTION ── */}
            {activeSection === 'psc' && (
              <motion.div
                key="psc"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                className="w-full max-w-2xl flex flex-col gap-6"
              >
                <motion.div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="flex items-center gap-3 px-6 py-4 border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(100,160,255,0.12)', border: '1px solid rgba(100,160,255,0.25)' }}
                    >
                      <span style={{ fontSize: 16 }}>💠</span>
                    </div>
                    <div>
                      <p className="font-orbitron text-sm font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        DISTRIBUIÇÃO DE PSC
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Adicionar PlayerSkins Coins para todos os streamers
                      </p>
                    </div>
                  </div>

                  <div className="px-6 py-4 flex flex-col gap-2">
                    {streamers.map(streamer => (
                      <div
                        key={streamer.username}
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-orbitron text-xs font-bold"
                            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                          >
                            {streamer.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-orbitron text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                            {streamer.displayName || streamer.username}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 13 }}>💠</span>
                          <span className="font-orbitron text-sm font-bold" style={{ color: 'rgba(100,180,255,0.9)' }}>
                            {streamer.pscBalance.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 px-6 pb-5">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: 14, pointerEvents: 'none' }}>💠</span>
                      <input
                        type="number"
                        min="1"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddPsc()}
                        placeholder="Quantidade de PSC"
                        className="w-full rounded-xl font-orbitron text-sm outline-none pl-9 pr-4 py-3"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                      />
                    </div>
                    <motion.button
                      onClick={handleAddPsc}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="px-5 py-3 rounded-xl font-orbitron text-xs font-bold tracking-widest whitespace-nowrap"
                      style={{
                        background: 'linear-gradient(135deg, rgba(100,160,255,0.25), rgba(60,100,220,0.2))',
                        border: '1px solid rgba(100,160,255,0.35)',
                        color: 'rgba(140,190,255,0.95)',
                      }}
                    >
                      ADICIONAR PARA TODOS
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {pscFeedback && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="mx-6 mb-5 px-4 py-3 rounded-xl text-xs font-orbitron font-semibold tracking-wide"
                        style={{
                          background: pscFeedback.type === 'success' ? 'rgba(60,200,120,0.1)' : 'rgba(255,80,80,0.1)',
                          border: `1px solid ${pscFeedback.type === 'success' ? 'rgba(60,200,120,0.3)' : 'rgba(255,80,80,0.3)'}`,
                          color: pscFeedback.type === 'success' ? 'rgba(80,220,140,0.9)' : 'rgba(255,120,120,0.9)',
                        }}
                      >
                        {pscFeedback.msg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            )}

            {/* ── CRIAR STREAMER ── */}
            {activeSection === 'criar-streamer' && (
              <motion.div
                key="criar"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                className="w-full flex gap-8 items-start"
              >
                {/* Left: Form */}
                <div className="flex-1 min-w-0 flex flex-col gap-8">
                {/* Page title */}
                <div>
                  <h2 className="font-orbitron text-lg font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    CRIAR NOVO STREAMER
                  </h2>
                  <p className="font-rajdhani text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Configure todos os detalhes do streamer e personalize sua experiência na plataforma.
                  </p>
                </div>

                {/* ── 1. IDENTIDADE DO STREAMER ── */}
                <div className="flex flex-col gap-4">
                  <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(255,180,0,0.85)' }}>
                    1. IDENTIDADE DO STREAMER
                  </span>

                  <div className="flex gap-6">
                    {/* Left: inputs */}
                    <div className="flex-1 flex flex-col gap-4">
                      <div className="flex gap-3">
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>USERNAME</label>
                          <input
                            type="text"
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            placeholder="ex: shadowganjaking"
                            className="rounded-xl font-rajdhani text-sm outline-none px-4 py-3"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5">
                          <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>NOME DE EXIBIÇÃO</label>
                          <input
                            type="text"
                            value={form.displayName}
                            onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                            placeholder="ex: ShadowGanjaKing"
                            className="rounded-xl font-rajdhani text-sm outline-none px-4 py-3"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>SENHA</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="••••••••••••"
                            className="w-full rounded-xl font-rajdhani text-sm outline-none px-4 py-3 pr-12"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(p => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-all"
                            style={{ color: showPassword ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}
                          >
                            {showPassword ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Mascote Principal */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0" style={{ width: 138 }}>
                      <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>MASCOTE PRINCIPAL</label>
                      <div
                        className="w-full rounded-xl overflow-hidden flex items-center justify-center"
                        style={{ height: 148, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {mascotImg ? (
                          <img src={mascotImg} alt="mascote" className="w-full h-full object-contain" />
                        ) : (
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.08)">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        )}
                      </div>
                      <label
                        className="w-full flex items-center justify-center py-2 rounded-xl font-orbitron text-xs font-bold tracking-widest cursor-pointer transition-all"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}
                      >
                        ALTERAR
                        <input type="file" accept="image/*" className="hidden" onChange={handleMascotImgChange} />
                      </label>
                    </div>
                  </div>
                </div>

                {/* ── 2. EXPERIÊNCIA VISUAL DO SORTEIO ── */}
                <div className="flex flex-col gap-5">
                  <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(255,180,0,0.85)' }}>
                    2. EXPERIÊNCIA VISUAL DO SORTEIO
                  </span>

                  {/* Color theme */}
                  <div className="flex flex-col gap-2">
                    <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>COR DE TEMA INICIAL</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button
                          key={c}
                          onClick={() => setForm(f => ({ ...f, themeColor: c }))}
                          className="relative rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            width: 28, height: 28,
                            background: c,
                            border: form.themeColor === c ? '2px solid white' : '2px solid transparent',
                            boxShadow: form.themeColor === c ? `0 0 10px ${c}99` : 'none',
                          }}
                        >
                          {form.themeColor === c && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                          )}
                        </button>
                      ))}
                      <input
                        type="color"
                        value={form.themeColor}
                        onChange={e => setForm(f => ({ ...f, themeColor: e.target.value }))}
                        title="Cor personalizada"
                        className="rounded-full cursor-pointer flex-shrink-0"
                        style={{ width: 28, height: 28, border: '1px dashed rgba(255,255,255,0.2)', padding: 2, background: 'rgba(255,255,255,0.05)' }}
                      />
                    </div>
                  </div>

                  {/* Mascote do Sorteio */}
                  <div className="flex flex-col gap-2">
                    <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>MASCOTE DO SORTEIO</label>
                    <div className="flex items-center gap-4">
                      <div
                        className="rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0"
                        style={{ width: 100, height: 120, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {raffleMascotImg ? (
                          <img src={raffleMascotImg} alt="mascote sorteio" className="w-full h-full object-contain" />
                        ) : (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.08)">
                            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-widest cursor-pointer transition-all"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}
                        >
                          {raffleMascotImg ? 'ALTERAR' : 'ADICIONAR'}
                          <input type="file" accept="image/*" className="hidden" onChange={handleRaffleMascotImgChange} />
                        </label>
                        {raffleMascotImg && (
                          <button
                            onClick={() => setRaffleMascotImg(null)}
                            className="px-4 py-2 rounded-xl font-orbitron text-xs tracking-widest transition-all"
                            style={{ background: 'rgba(255,50,50,0.06)', border: '1px solid rgba(255,50,50,0.15)', color: 'rgba(255,100,100,0.6)' }}
                          >
                            REMOVER
                          </button>
                        )}
                        <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                          Aparece durante o sorteio
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fundo do Palco de Sorteio (reflete no Stage 2) */}
                  <div className="flex flex-col gap-2">
                    <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>FUNDO DO PALCO DE SORTEIO</label>
                    <div className="flex items-start gap-4 flex-wrap">
                      {/* Dropdown de tema */}
                      <div className="relative" style={{ minWidth: 180 }}>
                        <select
                          value={form.stageTheme}
                          onChange={e => setForm(f => ({ ...f, stageTheme: e.target.value }))}
                          className="w-full rounded-xl font-rajdhani text-sm outline-none px-4 py-3 appearance-none cursor-pointer"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
                        >
                          {STAGE_THEMES.map(t => (
                            <option key={t.id} value={t.id} style={{ background: '#080d24' }}>{t.label}</option>
                          ))}
                        </select>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <path d="M7 10l5 5 5-5z"/>
                        </svg>
                      </div>

                      {/* Upload de fundo personalizado */}
                      <div className="flex items-center gap-3">
                        <div
                          className="rounded-xl overflow-hidden flex-shrink-0"
                          style={{
                            width: 60,
                            height: 44,
                            background: stageBgImg ? 'transparent' : 'rgba(255,255,255,0.04)',
                            border: stageBgImg ? '1px solid rgba(255,255,255,0.15)' : '1px dashed rgba(255,255,255,0.12)',
                          }}
                        >
                          {stageBgImg ? (
                            <img src={stageBgImg} alt="fundo" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.12)">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-orbitron text-xs font-bold tracking-widest cursor-pointer transition-all whitespace-nowrap"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', fontSize: 9 }}
                          >
                            {stageBgImg ? 'ALTERAR' : 'PERSONALIZADO'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleStageBgImgChange} />
                          </label>
                          {stageBgImg && (
                            <button
                              onClick={() => setStageBgImg(null)}
                              className="px-3 py-1 rounded-lg font-orbitron tracking-widest transition-all"
                              style={{ background: 'rgba(255,50,50,0.06)', border: '1px solid rgba(255,50,50,0.15)', color: 'rgba(255,100,100,0.6)', fontSize: 9 }}
                            >
                              REMOVER
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {stageBgImg && (
                      <p className="font-rajdhani text-xs" style={{ color: `${form.themeColor}99`, fontSize: 10 }}>
                        Fundo personalizado ativo — sobrepõe o tema selecionado
                      </p>
                    )}
                  </div>

                  {/* Fundo do Palco de Configuração (reflete no Stage 1) */}
                  <div className="flex flex-col gap-2">
                    <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>FUNDO DO PALCO DE CONFIGURAÇÃO</label>
                    <div className="flex items-center gap-3">
                      <div
                        className="rounded-xl overflow-hidden flex-shrink-0"
                        style={{
                          width: 60,
                          height: 44,
                          background: configBgImg ? 'transparent' : 'rgba(255,255,255,0.04)',
                          border: configBgImg ? '1px solid rgba(255,255,255,0.15)' : '1px dashed rgba(255,255,255,0.12)',
                        }}
                      >
                        {configBgImg ? (
                          <img src={configBgImg} alt="fundo configuração" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.12)">
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-orbitron text-xs font-bold tracking-widest cursor-pointer transition-all whitespace-nowrap"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', fontSize: 9 }}
                        >
                          {configBgImg ? 'ALTERAR' : 'PERSONALIZADO'}
                          <input type="file" accept="image/*" className="hidden" onChange={handleConfigBgImgChange} />
                        </label>
                        {configBgImg && (
                          <button
                            onClick={() => setConfigBgImg(null)}
                            className="px-3 py-1 rounded-lg font-orbitron tracking-widest transition-all"
                            style={{ background: 'rgba(255,50,50,0.06)', border: '1px solid rgba(255,50,50,0.15)', color: 'rgba(255,100,100,0.6)', fontSize: 9 }}
                          >
                            REMOVER
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                      Aparece atrás da tela de configuração do sorteio (Stage 1)
                    </p>
                  </div>

                  {/* Animation button */}
                  <button
                    onClick={() => setShowAnimModal(true)}
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl transition-all"
                    style={{
                      background: animFrames.some(Boolean) ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.03)',
                      border: animFrames.some(Boolean) ? '1px solid rgba(0,229,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: animFrames.some(Boolean) ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.05)',
                          border: animFrames.some(Boolean) ? '1px solid rgba(0,229,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={animFrames.some(Boolean) ? 'rgba(0,229,255,0.8)' : 'rgba(255,255,255,0.25)'}>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                      </div>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: animFrames.some(Boolean) ? 'rgba(0,229,255,0.85)' : 'rgba(255,255,255,0.5)' }}>
                          PERSONALIZAR ANIMAÇÃO DO SORTEIO
                        </span>
                        <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {animFrames.filter(Boolean).length > 0
                            ? `${animFrames.filter(Boolean).length} frame${animFrames.filter(Boolean).length > 1 ? 's' : ''} configurado${animFrames.filter(Boolean).length > 1 ? 's' : ''}`
                            : 'Nenhum frame configurado'}
                        </span>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)" className="flex-shrink-0">
                      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                    </svg>
                  </button>
                </div>

                {/* ── 3. INTEGRAÇÕES ── */}
                <div className="flex flex-col gap-4">
                  <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(255,180,0,0.85)' }}>
                    3. INTEGRAÇÕES
                  </span>
                  <div className="flex gap-3">
                    {/* Twitch */}
                    <div
                      className="flex-1 flex flex-col items-center gap-3 px-4 py-5 rounded-xl"
                      style={{ background: 'rgba(145,70,255,0.06)', border: '1px solid rgba(145,70,255,0.2)' }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#9146FF">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                      </svg>
                      <span className="font-orbitron text-xs font-bold tracking-wide" style={{ color: 'rgba(145,70,255,0.85)' }}>TWITCH</span>
                      <input
                        type="text"
                        value={form.twitchChannel}
                        onChange={e => setForm(f => ({ ...f, twitchChannel: e.target.value }))}
                        placeholder="canal"
                        className="w-full rounded-lg font-rajdhani text-sm outline-none px-3 py-2 text-center"
                        style={{ background: 'rgba(145,70,255,0.1)', border: '1px solid rgba(145,70,255,0.25)', color: 'rgba(255,255,255,0.8)' }}
                      />
                    </div>
                    {/* Kick */}
                    <div
                      className="flex-1 flex flex-col items-center gap-3 px-4 py-5 rounded-xl"
                      style={{ background: 'rgba(83,252,20,0.04)', border: '1px solid rgba(83,252,20,0.2)' }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#53FC14">
                        <path d="M2 2h6v8.5l4-4.5h7l-6 7 6 7H12l-4-4.5V22H2V2z"/>
                      </svg>
                      <span className="font-orbitron text-xs font-bold tracking-wide" style={{ color: 'rgba(83,252,20,0.85)' }}>KICK</span>
                      <input
                        type="text"
                        value={form.kickChannel}
                        onChange={e => setForm(f => ({ ...f, kickChannel: e.target.value }))}
                        placeholder="canal"
                        className="w-full rounded-lg font-rajdhani text-sm outline-none px-3 py-2 text-center"
                        style={{ background: 'rgba(83,252,20,0.08)', border: '1px solid rgba(83,252,20,0.25)', color: 'rgba(255,255,255,0.8)' }}
                      />
                    </div>
                    {/* YouTube */}
                    <div
                      className="flex-1 flex flex-col items-center gap-3 px-4 py-5 rounded-xl"
                      style={{ background: 'rgba(255,0,0,0.04)', border: '1px solid rgba(255,60,60,0.2)' }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF0000">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      <span className="font-orbitron text-xs font-bold tracking-wide" style={{ color: 'rgba(255,80,80,0.85)' }}>YOUTUBE</span>
                      <input
                        type="text"
                        value={form.youtubeChannel}
                        onChange={e => setForm(f => ({ ...f, youtubeChannel: e.target.value }))}
                        placeholder="@canal"
                        className="w-full rounded-lg font-rajdhani text-sm outline-none px-3 py-2 text-center"
                        style={{ background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,60,60,0.25)', color: 'rgba(255,255,255,0.8)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── 4. ECONOMIA PSC ── */}
                <div className="flex flex-col gap-4">
                  <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(255,180,0,0.85)' }}>
                    4. ECONOMIA PSC
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>SALDO INICIAL (PSC)</label>
                    <div className="relative" style={{ width: 160 }}>
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ fontSize: 14 }}>💠</span>
                      <input
                        type="number"
                        min="0"
                        value={form.pscBalance}
                        onChange={e => setForm(f => ({ ...f, pscBalance: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="w-full rounded-xl font-orbitron text-sm outline-none pl-9 pr-4 py-3"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Feedback */}
                <AnimatePresence>
                  {createFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="px-4 py-3 rounded-xl text-xs font-orbitron font-semibold tracking-wide"
                      style={{
                        background: createFeedback.type === 'success' ? 'rgba(60,200,120,0.1)' : 'rgba(255,80,80,0.1)',
                        border: `1px solid ${createFeedback.type === 'success' ? 'rgba(60,200,120,0.3)' : 'rgba(255,80,80,0.3)'}`,
                        color: createFeedback.type === 'success' ? 'rgba(80,220,140,0.9)' : 'rgba(255,120,120,0.9)',
                      }}
                    >
                      {createFeedback.msg}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.button
                  onClick={handleCreateStreamer}
                  disabled={creating}
                  whileHover={{ scale: creating ? 1 : 1.02 }}
                  whileTap={{ scale: creating ? 1 : 0.98 }}
                  className="w-full py-4 rounded-xl font-orbitron text-sm font-bold tracking-widest flex items-center justify-center gap-3"
                  style={{
                    background: creating
                      ? 'rgba(255,255,255,0.05)'
                      : 'linear-gradient(135deg, rgba(60,200,80,0.3), rgba(20,150,50,0.25))',
                    border: creating
                      ? '1px solid rgba(255,255,255,0.1)'
                      : '1px solid rgba(60,200,80,0.4)',
                    color: creating ? 'rgba(255,255,255,0.3)' : 'rgba(100,240,120,0.95)',
                    cursor: creating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {!creating && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.5c-1.5 0-3 .5-4.2 1.5L3.5 8.2C2.5 9.4 2 10.9 2 12.5v1c0 1.6.5 3.1 1.5 4.3l1.5 1.8c.7.8 1.7 1.4 2.8 1.4h8.4c1.1 0 2.1-.6 2.8-1.4l1.5-1.8c1-1.2 1.5-2.7 1.5-4.3v-1c0-1.6-.5-3.1-1.5-4.3L16.2 4c-1.2-1-2.7-1.5-4.2-1.5zM12 15a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
                    </svg>
                  )}
                  {creating ? 'CRIANDO...' : 'ATIVAR STREAMER'}
                </motion.button>
                </div>

                {/* ── PREVIEW DO STREAMER ── */}
                <div className="flex-shrink-0 sticky top-8 flex flex-col gap-3" style={{ width: 300 }}>
                  <p className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(255,180,0,0.85)' }}>
                    PREVIEW DO STREAMER
                  </p>
                  <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)', marginTop: -4 }}>
                    Veja como ficará o streamer na plataforma
                  </p>

                  <div className="rounded-2xl overflow-hidden" style={{ background: '#050816', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Stage */}
                    <div
                      className="relative flex items-end justify-center overflow-hidden"
                      style={{
                        height: 260,
                        background: (() => {
                          const img = stageBgImg ?? STAGE_THEMES.find(t => t.id === form.stageTheme)?.image ?? null;
                          return img
                            ? `url('${img}') center/cover no-repeat`
                            : [
                                `radial-gradient(ellipse at 25% 0%, ${form.themeColor}55 0%, transparent 55%)`,
                                `radial-gradient(ellipse at 75% 0%, ${form.themeColor}33 0%, transparent 55%)`,
                                `radial-gradient(ellipse at 50% 0%, ${form.themeColor}22 0%, transparent 45%)`,
                                'linear-gradient(to bottom, #0a0520 0%, #050816 100%)',
                              ].join(', ');
                        })(),
                      }}
                    >
                      {/* Overlay sobre imagem de fundo */}
                      {(stageBgImg || STAGE_THEMES.find(t => t.id === form.stageTheme)?.image) && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            background: [
                              'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%)',
                              `radial-gradient(ellipse at 25% 0%, ${form.themeColor}33 0%, transparent 50%)`,
                              `radial-gradient(ellipse at 75% 0%, ${form.themeColor}22 0%, transparent 50%)`,
                            ].join(', '),
                          }}
                        />
                      )}
                      {/* P watermark */}
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
                        style={{ paddingBottom: 20 }}
                      >
                        <span
                          style={{
                            fontFamily: 'Orbitron, sans-serif',
                            fontSize: 160,
                            fontWeight: 900,
                            color: 'transparent',
                            WebkitTextStroke: `2px ${form.themeColor}22`,
                            textShadow: `0 0 80px ${form.themeColor}33`,
                            lineHeight: 1,
                            userSelect: 'none',
                          }}
                        >
                          P
                        </span>
                      </div>

                      {/* Floor glow */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
                        style={{ background: `linear-gradient(to right, transparent, ${form.themeColor}55, transparent)` }}
                      />

                      {/* Mascot */}
                      <div
                        className="relative z-10 flex items-end justify-center"
                        style={{ height: '88%' }}
                      >
                        {mascotImg ? (
                          <img
                            src={mascotImg}
                            alt="preview"
                            style={{
                              height: '100%',
                              width: 'auto',
                              objectFit: 'contain',
                              filter: `drop-shadow(0 4px 28px ${form.themeColor}66)`,
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 pb-5">
                            <div
                              className="rounded-2xl flex items-center justify-center"
                              style={{
                                width: 110,
                                height: 140,
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px dashed ${form.themeColor}44`,
                              }}
                            >
                              <svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.06)">
                                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                              </svg>
                            </div>
                            <span className="font-orbitron" style={{ fontSize: 9, color: `${form.themeColor}66` }}>SEM MASCOTE</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Name & status bar */}
                    <div
                      className="px-5 py-4"
                      style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-orbitron text-sm font-bold" style={{ color: 'rgba(255,255,255,0.92)' }}>
                          {form.displayName || form.username || 'NomeDoStreamer'}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: form.themeColor, boxShadow: `0 0 8px ${form.themeColor}80` }}
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: '#4ADE80', boxShadow: '0 0 5px #4ADE8099' }}
                        />
                        <span
                          className="font-rajdhani text-xs font-semibold tracking-wider"
                          style={{ color: 'rgba(74,222,128,0.8)' }}
                        >
                          ONLINE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── EDITAR STREAMER ── */}
            {activeSection === 'editar-streamer' && (
              <motion.div
                key="editar-streamer"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {/* Streamer selector bar */}
                <div
                  className="flex-shrink-0 flex items-center gap-4 px-8 py-4"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,8,22,0.4)' }}
                >
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(191,90,242,0.1)', border: '1px solid rgba(191,90,242,0.25)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#BF5AF2">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </div>
                    <span className="font-orbitron text-xs font-bold tracking-widest" style={{ color: 'rgba(191,90,242,0.85)' }}>
                      EDITAR STREAMER
                    </span>
                  </div>
                  <div className="relative" style={{ minWidth: 220 }}>
                    <select
                      value={editStreamer}
                      onChange={e => handleEditSelectStreamer(e.target.value)}
                      className="w-full rounded-xl font-rajdhani text-sm outline-none px-4 py-2.5 appearance-none cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: editStreamer ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}
                    >
                      <option value="" style={{ background: '#080d24' }}>Selecionar streamer...</option>
                      {streamers.map(s => (
                        <option key={s.username} value={s.username} style={{ background: '#080d24' }}>
                          {s.displayName || s.username}
                        </option>
                      ))}
                    </select>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </div>

                  {/* Feedback */}
                  <AnimatePresence>
                    {editFeedback && (
                      <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                        style={{
                          background: editFeedback.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                          border: `1px solid ${editFeedback.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}
                      >
                        <span className="font-rajdhani text-xs font-semibold" style={{ color: editFeedback.type === 'success' ? 'rgba(74,222,128,0.9)' : 'rgba(239,68,68,0.9)' }}>
                          {editFeedback.msg}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Botão SALVAR unificado */}
                  {editStreamer && (
                    <button
                      onClick={handleSaveAll}
                      disabled={editSaving}
                      className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-widest transition-all ml-auto"
                      style={{
                        background: editSaving ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, rgba(191,90,242,0.25), rgba(120,50,200,0.15))',
                        border: `1px solid ${editSaving ? 'rgba(255,255,255,0.08)' : 'rgba(191,90,242,0.5)'}`,
                        color: editSaving ? 'rgba(255,255,255,0.25)' : 'rgba(191,90,242,1)',
                        cursor: editSaving ? 'not-allowed' : 'pointer',
                        boxShadow: editSaving ? 'none' : '0 0 20px rgba(191,90,242,0.15)',
                      }}
                    >
                      {editSaving ? (
                        <>
                          <motion.span
                            className="inline-block w-3 h-3 border-2 rounded-full"
                            style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: 'rgba(255,255,255,0.4)' }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          />
                          SALVANDO...
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                          </svg>
                          SALVAR
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Content */}
                {!editStreamer ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.12)">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </div>
                    <p className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      SELECIONE UM STREAMER
                    </p>
                    <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
                      Escolha um streamer acima para editar suas configurações
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">

                    {/* ── INFORMAÇÕES DO STREAMER ── */}
                    <div
                      className="rounded-2xl p-6 flex flex-col gap-6"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div>
                        <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          INFORMAÇÕES DO STREAMER
                        </span>
                        <p className="font-rajdhani text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          Perfil, visual e integrações
                        </p>
                      </div>

                      {editProfileLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(0,229,255,0.5)" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                          </svg>
                          <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando perfil...</span>
                        </div>
                      ) : (
                        <>
                          {/* IDENTIDADE */}
                          <div className="flex flex-col gap-3">
                            <span className="font-orbitron font-bold tracking-widest" style={{ fontSize: 10, color: 'rgba(191,90,242,0.7)' }}>IDENTIDADE</span>
                            <div className="flex gap-3">
                              <div className="flex-1 flex flex-col gap-1.5">
                                <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>NOME DE EXIBIÇÃO</label>
                                <input
                                  type="text"
                                  value={editProfile.displayName}
                                  onChange={e => setEditProfile(p => ({ ...p, displayName: e.target.value }))}
                                  placeholder="Nome de exibição..."
                                  className="rounded-xl font-rajdhani text-sm outline-none px-4 py-3"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                                />
                              </div>
                              <div className="flex-1 flex flex-col gap-1.5">
                                <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
                                  {editProfile.forceFirstAccess ? 'PRIMEIRO ACESSO (ativado)' : 'NOVA SENHA (opcional)'}
                                </label>
                                {editProfile.forceFirstAccess ? (
                                  /* Primeiro acesso ativo */
                                  <div className="flex flex-col gap-2">
                                    <div
                                      className="w-full rounded-xl px-4 py-3 flex items-center gap-2"
                                      style={{ background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.35)' }}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(191,90,242,0.9)">
                                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                                      </svg>
                                      <span className="font-rajdhani text-xs" style={{ color: 'rgba(191,90,242,0.9)' }}>
                                        Senha será <strong>123</strong> — alteração obrigatória no 1º login
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setEditProfile(p => ({ ...p, forceFirstAccess: false }))}
                                      className="text-left font-rajdhani text-xs tracking-wide transition-opacity opacity-50 hover:opacity-80"
                                      style={{ color: 'rgba(255,255,255,0.6)' }}
                                    >
                                      ↩ Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  /* Campo de senha normal + botão primeiro acesso */
                                  <div className="flex flex-col gap-2">
                                    {editProfile.currentForcePasswordChange && (
                                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(191,90,242,0.06)', border: '1px solid rgba(191,90,242,0.2)' }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(191,90,242,0.7)">
                                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                                        </svg>
                                        <span className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(191,90,242,0.75)' }}>Aguardando 1º acesso do streamer</span>
                                      </div>
                                    )}
                                    <div className="relative">
                                      <input
                                        type={showEditPassword ? 'text' : 'password'}
                                        value={editProfile.newPassword}
                                        onChange={e => setEditProfile(p => ({ ...p, newPassword: e.target.value }))}
                                        placeholder="••••••••"
                                        className="w-full rounded-xl font-rajdhani text-sm outline-none px-4 py-3 pr-12"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setShowEditPassword(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-all"
                                        style={{ color: showEditPassword ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}
                                      >
                                        {showEditPassword ? (
                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                          </svg>
                                        ) : (
                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                          </svg>
                                        )}
                                      </button>
                                    </div>
                                    {/* Separator + Primeiro Acesso button */}
                                    <button
                                      type="button"
                                      onClick={() => setEditProfile(p => ({ ...p, newPassword: '', forceFirstAccess: true }))}
                                      className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all group"
                                      style={{ background: 'rgba(191,90,242,0.06)', border: '1px solid rgba(191,90,242,0.2)' }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(191,90,242,0.7)">
                                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                                      </svg>
                                      <span className="font-orbitron font-bold tracking-widest group-hover:opacity-90" style={{ fontSize: 9, color: 'rgba(191,90,242,0.75)' }}>
                                        PRIMEIRO ACESSO
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* VISUAL */}
                          <div className="flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
                            <span className="font-orbitron font-bold tracking-widest" style={{ fontSize: 10, color: 'rgba(191,90,242,0.7)' }}>VISUAL</span>
                            <div className="flex flex-col gap-2">
                              <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>COR DE TEMA</label>
                              <div className="flex items-center gap-2 flex-wrap">
                                {COLOR_PRESETS.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setEditProfile(p => ({ ...p, themeColor: c }))}
                                    className="relative rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                      width: 28, height: 28,
                                      background: c,
                                      border: editProfile.themeColor === c ? '2px solid white' : '2px solid transparent',
                                      boxShadow: editProfile.themeColor === c ? `0 0 10px ${c}99` : 'none',
                                    }}
                                  >
                                    {editProfile.themeColor === c && (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                      </svg>
                                    )}
                                  </button>
                                ))}
                                <input
                                  type="color"
                                  value={editProfile.themeColor}
                                  onChange={e => setEditProfile(p => ({ ...p, themeColor: e.target.value }))}
                                  title="Cor personalizada"
                                  className="rounded-full cursor-pointer flex-shrink-0"
                                  style={{ width: 28, height: 28, border: '1px dashed rgba(255,255,255,0.2)', padding: 2, background: 'rgba(255,255,255,0.05)' }}
                                />
                              </div>
                            </div>

                            {/* SPRITE CHAT WARS */}
                            <div className="flex flex-col gap-2" style={{ marginTop: 8 }}>
                              <label className="font-orbitron tracking-widest" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>SPRITE CHAT WARS (bola neutra)</label>
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 rounded-full"
                                  style={{
                                    width: 56, height: 56,
                                    border: '1px solid rgba(145,70,255,0.4)',
                                    background: editProfile.chatWarsSprite
                                      ? `#0a0c1c center/cover no-repeat url(${editProfile.chatWarsSprite})`
                                      : 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18), rgba(145,70,255,0.12))',
                                    boxShadow: '0 0 12px rgba(145,70,255,0.25)',
                                  }} />
                                <div className="flex flex-col gap-1.5">
                                  <label className="cursor-pointer font-orbitron font-bold tracking-widest text-center rounded-lg px-3 py-2"
                                    style={{ fontSize: 9, color: 'rgba(145,70,255,0.9)', background: 'rgba(145,70,255,0.1)', border: '1px solid rgba(145,70,255,0.3)' }}>
                                    {editProfile.chatWarsSprite ? 'TROCAR IMAGEM' : 'ENVIAR IMAGEM'}
                                    <input type="file" accept="image/png,image/webp,image/jpeg" className="hidden"
                                      onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        const r = new FileReader();
                                        r.onload = ev => setEditProfile(p => ({ ...p, chatWarsSprite: ev.target?.result as string }));
                                        r.readAsDataURL(f);
                                        e.target.value = '';
                                      }} />
                                  </label>
                                  {editProfile.chatWarsSprite && (
                                    <button type="button" onClick={() => setEditProfile(p => ({ ...p, chatWarsSprite: '' }))}
                                      className="font-rajdhani text-xs tracking-wide opacity-50 hover:opacity-80 transition-opacity text-left"
                                      style={{ color: 'rgba(255,120,120,0.9)' }}>
                                      ✕ Remover
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>
                                Imagem sem rosto — só a bola/textura. O jogo aplica a cor de cada jogador, o rosto e os efeitos por cima.
                              </p>
                            </div>
                          </div>

                          {/* INTEGRAÇÕES */}
                          <div className="flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20 }}>
                            <span className="font-orbitron font-bold tracking-widest" style={{ fontSize: 10, color: 'rgba(191,90,242,0.7)' }}>INTEGRAÇÕES</span>
                            <div className="flex gap-3">
                              <div className="flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-xl"
                                style={{ background: 'rgba(145,70,255,0.06)', border: '1px solid rgba(145,70,255,0.2)' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#9146FF">
                                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                                </svg>
                                <span className="font-orbitron font-bold tracking-wide" style={{ fontSize: 10, color: 'rgba(145,70,255,0.85)' }}>TWITCH</span>
                                <input
                                  type="text"
                                  value={editProfile.twitchChannel}
                                  onChange={e => setEditProfile(p => ({ ...p, twitchChannel: e.target.value }))}
                                  placeholder="canal"
                                  className="w-full rounded-lg font-rajdhani text-sm outline-none px-3 py-2 text-center"
                                  style={{ background: 'rgba(145,70,255,0.1)', border: '1px solid rgba(145,70,255,0.25)', color: 'rgba(255,255,255,0.8)' }}
                                />
                              </div>
                              <div className="flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-xl"
                                style={{ background: 'rgba(83,252,20,0.04)', border: '1px solid rgba(83,252,20,0.2)' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#53FC14">
                                  <path d="M2 2h6v8.5l4-4.5h7l-6 7 6 7H12l-4-4.5V22H2V2z"/>
                                </svg>
                                <span className="font-orbitron font-bold tracking-wide" style={{ fontSize: 10, color: 'rgba(83,252,20,0.85)' }}>KICK</span>
                                <input
                                  type="text"
                                  value={editProfile.kickChannel}
                                  onChange={e => setEditProfile(p => ({ ...p, kickChannel: e.target.value }))}
                                  placeholder="canal"
                                  className="w-full rounded-lg font-rajdhani text-sm outline-none px-3 py-2 text-center"
                                  style={{ background: 'rgba(83,252,20,0.08)', border: '1px solid rgba(83,252,20,0.25)', color: 'rgba(255,255,255,0.8)' }}
                                />
                              </div>
                              <div className="flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-xl"
                                style={{ background: 'rgba(255,0,0,0.04)', border: '1px solid rgba(255,60,60,0.2)' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF0000">
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                                <span className="font-orbitron font-bold tracking-wide" style={{ fontSize: 10, color: 'rgba(255,80,80,0.85)' }}>YOUTUBE</span>
                                <input
                                  type="text"
                                  value={editProfile.youtubeChannel}
                                  onChange={e => setEditProfile(p => ({ ...p, youtubeChannel: e.target.value }))}
                                  placeholder="@canal"
                                  className="w-full rounded-lg font-rajdhani text-sm outline-none px-3 py-2 text-center"
                                  style={{ background: 'rgba(255,0,0,0.08)', border: '1px solid rgba(255,60,60,0.25)', color: 'rgba(255,255,255,0.8)' }}
                                />
                              </div>
                            </div>
                          </div>

                        </>
                      )}
                    </div>

                    {/* ── AFILIADO TOGGLE ── */}
                    <div
                      className="rounded-2xl p-6 flex items-center justify-between gap-6"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          STATUS DE AFILIADO
                        </span>
                        <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Afiliados têm acesso ao sistema PSC e saldo de moedas
                        </span>
                        {editData && (
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{
                                background: editData.isAffiliate ? '#4ADE80' : 'rgba(255,255,255,0.2)',
                                boxShadow: editData.isAffiliate ? '0 0 6px #4ADE8099' : 'none',
                              }}
                            />
                            <span className="font-orbitron text-xs font-bold tracking-widest"
                              style={{ color: editData.isAffiliate ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.25)' }}>
                              {editData.isAffiliate ? 'AFILIADO ATIVO' : 'NÃO AFILIADO'}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleToggleAffiliate}
                        disabled={!editData}
                        className="relative flex-shrink-0 rounded-full transition-all"
                        style={{
                          width: 56,
                          height: 30,
                          background: editData?.isAffiliate ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)',
                          border: `2px solid ${editData?.isAffiliate ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.15)'}`,
                          cursor: !editData ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div
                          className="absolute top-1/2 rounded-full transition-all"
                          style={{
                            width: 20,
                            height: 20,
                            transform: 'translateY(-50%)',
                            left: editData?.isAffiliate ? 'calc(100% - 24px)' : '2px',
                            background: editData?.isAffiliate ? '#4ADE80' : 'rgba(255,255,255,0.3)',
                            boxShadow: editData?.isAffiliate ? '0 0 8px #4ADE8066' : 'none',
                          }}
                        />
                      </button>
                    </div>

                    {/* ── PSC BALANCE ── */}
                    <div
                      className="rounded-2xl p-6 flex flex-col gap-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          SALDO PSC
                        </span>
                        {editData && (
                          <div className="px-2 py-0.5 rounded-md"
                            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
                            <span className="font-orbitron text-xs font-bold" style={{ color: 'rgba(0,229,255,0.8)' }}>
                              ATUAL: {editData.pscBalance.toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={editPscInput}
                        onChange={e => setEditPscInput(e.target.value)}
                        placeholder="Novo saldo..."
                        className="rounded-xl font-orbitron text-sm outline-none px-4 py-3"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                      />
                      <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Define o saldo absoluto. A diferença será registrada como transação PSC.
                      </p>
                    </div>

                    {/* ── PRODUTOS CUSTOMIZADOS ── */}
                    <div
                      className="rounded-2xl p-6 flex flex-col gap-5"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            PRODUTOS EXCLUSIVOS
                          </span>
                          <p className="font-rajdhani text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            Prêmios personalizados disponíveis somente para este streamer
                          </p>
                        </div>
                        <div className="px-2 py-1 rounded-lg" style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)' }}>
                          <span className="font-orbitron text-xs font-bold" style={{ color: 'rgba(255,180,0,0.8)' }}>
                            {adminProducts.length} item{adminProducts.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Existing products list */}
                      {prodLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(0,229,255,0.5)" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                          </svg>
                          <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando produtos...</span>
                        </div>
                      ) : adminProducts.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {adminProducts.map(prod => (
                            <div
                              key={prod.id}
                              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,180,0,0.7)">
                                    <path d="M20 6h-2.18c.07-.44.18-.88.18-1.38C18 2.06 15.94 0 13.38 0c-1.3 0-2.48.49-3.38 1.28C9.1.49 7.92 0 6.62 0 4.06 0 2 2.06 2 4.62c0 .5.11.94.18 1.38H0v14h24V6h-4zm-4-1.38C16 3.25 16.85 2 18.12 2c.83 0 1.5.67 1.5 1.5S18.95 5 18.12 5H16v-.38zM8.5 3.5c0-.83.67-1.5 1.5-1.5 1.27 0 2.12 1.25 2.12 3H9.88C9.15 5 8.5 4.33 8.5 3.5z"/>
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-orbitron text-xs font-bold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                    {prod.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                      Qtd: {prod.quantity}
                                    </span>
                                    {prod.pscValue != null && (
                                      <span className="font-rajdhani text-xs font-semibold" style={{ color: 'rgba(0,229,255,0.6)' }}>
                                        • {prod.pscValue.toLocaleString('pt-BR')} PSC
                                      </span>
                                    )}
                                    {prod.skipPsc && (
                                      <span className="font-orbitron text-xs" style={{ color: 'rgba(255,180,0,0.5)', fontSize: 9 }}>
                                        SEM PSC
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.6)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.9)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.6)'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="font-rajdhani text-xs py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          Nenhum produto exclusivo cadastrado.
                        </p>
                      )}

                      {/* Add new product form */}
                      <div
                        className="flex flex-col gap-3 pt-4"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <p className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          ADICIONAR PRODUTO
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={newProd.name}
                            onChange={e => setNewProd(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nome do produto *"
                            className="rounded-xl font-rajdhani text-sm outline-none px-4 py-2.5 col-span-2"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                          />
                          <input
                            type="text"
                            value={newProd.description}
                            onChange={e => setNewProd(p => ({ ...p, description: e.target.value }))}
                            placeholder="Descrição (opcional)"
                            className="rounded-xl font-rajdhani text-sm outline-none px-4 py-2.5 col-span-2"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                          />
                          <div className="flex flex-col gap-1">
                            <label className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>QUANTIDADE</label>
                            <input
                              type="number"
                              min="1"
                              value={newProd.quantity}
                              onChange={e => setNewProd(p => ({ ...p, quantity: Math.max(1, Number(e.target.value)) }))}
                              className="rounded-xl font-orbitron text-sm outline-none px-4 py-2.5"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>VALOR PSC (opcional)</label>
                            <input
                              type="number"
                              min="0"
                              value={newProd.pscValue}
                              onChange={e => setNewProd(p => ({ ...p, pscValue: e.target.value }))}
                              placeholder="0"
                              className="rounded-xl font-orbitron text-sm outline-none px-4 py-2.5"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <div
                              onClick={() => setNewProd(p => ({ ...p, skipPsc: !p.skipPsc }))}
                              className="w-4 h-4 rounded flex items-center justify-center"
                              style={{
                                background: newProd.skipPsc ? 'rgba(255,180,0,0.3)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${newProd.skipPsc ? 'rgba(255,180,0,0.6)' : 'rgba(255,255,255,0.12)'}`,
                              }}
                            >
                              {newProd.skipPsc && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,180,0,0.9)">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                              )}
                            </div>
                            <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              Ignorar PSC (não desconta do saldo)
                            </span>
                          </label>
                          <button
                            onClick={handleAddProduct}
                            disabled={addingProd || !newProd.name.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-widest transition-all"
                            style={{
                              background: addingProd || !newProd.name.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(255,180,0,0.12)',
                              border: `1px solid ${addingProd || !newProd.name.trim() ? 'rgba(255,255,255,0.08)' : 'rgba(255,180,0,0.35)'}`,
                              color: addingProd || !newProd.name.trim() ? 'rgba(255,255,255,0.2)' : 'rgba(255,180,0,0.9)',
                              cursor: addingProd || !newProd.name.trim() ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            {addingProd ? 'ADICIONANDO...' : 'ADICIONAR'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── COMANDOS DO BOT ── */}
                    <div
                      className="rounded-2xl p-6 flex flex-col gap-5"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            COMANDOS DO BOT
                          </span>
                          <p className="font-rajdhani text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            Respostas automáticas do bot no chat ao digitar um comando
                          </p>
                        </div>
                        <div className="px-2 py-1 rounded-lg" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.18)' }}>
                          <span className="font-orbitron text-xs font-bold" style={{ color: 'rgba(0,229,255,0.7)' }}>
                            {botCommands.length} cmd{botCommands.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Command list */}
                      {botCmdLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(0,229,255,0.5)" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                          </svg>
                          <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando comandos...</span>
                        </div>
                      ) : botCommands.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {botCommands.map(cmd => (
                            <div
                              key={cmd.id}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-3">
                                <span
                                  className="font-mono font-bold flex-shrink-0 px-2 py-0.5 rounded"
                                  style={{ fontSize: 12, color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}
                                >
                                  {cmd.command}
                                </span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)" className="flex-shrink-0">
                                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                                </svg>
                                <span className="font-rajdhani text-sm truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                  {cmd.response}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteBotCmd(cmd.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.6)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.9)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.6)'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="font-rajdhani text-xs py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          Nenhum comando cadastrado.
                        </p>
                      )}

                      {/* Add new command form */}
                      <div
                        className="flex flex-col gap-3 pt-4"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <p className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          ADICIONAR COMANDO
                        </p>
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={newBotCmd.command}
                            onChange={e => setNewBotCmd(p => ({ ...p, command: e.target.value }))}
                            placeholder="!comando"
                            className="rounded-xl font-mono text-sm outline-none px-4 py-2.5"
                            style={{ width: 140, flexShrink: 0, background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.2)', color: '#00E5FF' }}
                          />
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)" className="flex-shrink-0">
                            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                          </svg>
                          <input
                            type="text"
                            value={newBotCmd.response}
                            onChange={e => setNewBotCmd(p => ({ ...p, response: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleAddBotCmd()}
                            placeholder="Resposta do bot..."
                            className="flex-1 rounded-xl font-rajdhani text-sm outline-none px-4 py-2.5"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
                          />
                          <button
                            onClick={handleAddBotCmd}
                            disabled={addingBotCmd || !newBotCmd.command.trim() || !newBotCmd.response.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-orbitron text-xs font-bold tracking-widest transition-all flex-shrink-0"
                            style={{
                              background: addingBotCmd || !newBotCmd.command.trim() || !newBotCmd.response.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(0,229,255,0.12)',
                              border: `1px solid ${addingBotCmd || !newBotCmd.command.trim() || !newBotCmd.response.trim() ? 'rgba(255,255,255,0.08)' : 'rgba(0,229,255,0.35)'}`,
                              color: addingBotCmd || !newBotCmd.command.trim() || !newBotCmd.response.trim() ? 'rgba(255,255,255,0.2)' : 'rgba(0,229,255,0.9)',
                              cursor: addingBotCmd || !newBotCmd.command.trim() || !newBotCmd.response.trim() ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            {addingBotCmd ? 'ADICIONANDO...' : 'ADICIONAR'}
                          </button>
                        </div>
                        <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          O bot responde somente na Twitch. Use <span style={{ color: 'rgba(0,229,255,0.5)', fontFamily: 'monospace' }}>!comando</span> exato (case insensitive).
                        </p>
                      </div>
                    </div>

                  </div>
                )}
              </motion.div>
            )}

            {/* ── ENTREGAS ── */}
            {activeSection === 'entregas' && (
              <motion.div
                key="entregas"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {/* Sub-tab bar */}
                <div className="flex-shrink-0 flex items-center gap-2 px-8 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,8,22,0.4)' }}>
                  {([
                    { key: 'dashboard', label: 'DASHBOARD GLOBAL' },
                    { key: 'streamer',  label: 'POR STREAMER'     },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setEntregasTab(tab.key)}
                      className="px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all"
                      style={{
                        fontSize: 10,
                        color: entregasTab === tab.key ? '#00E5FF' : 'rgba(255,255,255,0.3)',
                        background: entregasTab === tab.key ? 'rgba(0,229,255,0.1)' : 'transparent',
                        border: entregasTab === tab.key ? '1px solid rgba(0,229,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* DASHBOARD tab */}
                {entregasTab === 'dashboard' && (
                  <div className="flex-1 overflow-y-auto px-8 py-6">
                    <AdminDeliveriesDashboard />
                  </div>
                )}

                {/* POR STREAMER tab */}
                {entregasTab === 'streamer' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Streamer selector bar */}
                    <div className="flex-shrink-0 flex items-center gap-4 px-8 py-3"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="relative" style={{ minWidth: 220 }}>
                        <select
                          value={entregasStreamer}
                          onChange={e => {
                            const val = e.target.value;
                            setEntregasStreamer(val);
                            setEntregasHistory([]);
                            if (val) loadEntregasHistory(val);
                          }}
                          className="w-full rounded-xl font-rajdhani text-sm outline-none px-4 py-2.5 appearance-none cursor-pointer"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: entregasStreamer ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}
                        >
                          <option value="" style={{ background: '#080d24' }}>Selecionar streamer...</option>
                          {streamers.map(s => (
                            <option key={s.username} value={s.username} style={{ background: '#080d24' }}>
                              {s.displayName || s.username}
                            </option>
                          ))}
                        </select>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <path d="M7 10l5 5 5-5z"/>
                        </svg>
                      </div>
                      {entregasStreamer && (
                        <button
                          onClick={() => loadEntregasHistory(entregasStreamer)}
                          disabled={entregasLoading}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125 disabled:opacity-60"
                          style={{ fontSize: 10, color: '#00FFA3', background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                            style={{ animation: entregasLoading ? 'spin 1s linear infinite' : 'none' }}>
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                          </svg>
                          ATUALIZAR
                        </button>
                      )}
                    </div>

                    {/* Content */}
                    {!entregasStreamer ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.12)">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        <p className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          SELECIONE UM STREAMER
                        </p>
                      </div>
                    ) : entregasLoading ? (
                      <div className="flex-1 flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(0,229,255,0.5)"
                          style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                      </div>
                    ) : (
                      <EntregasPage
                        historyOverride={entregasHistory}
                        onHistoryRefresh={() => loadEntregasHistory(entregasStreamer)}
                        onUpdateDelivery={handleEntregasUpdateDelivery}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── MARKETING ── */}
            {activeSection === 'marketing' && (
              <motion.div
                key="marketing"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                <MarketingSection />
              </motion.div>
            )}

            {/* ── BOTS DE CHAT ── */}
            {activeSection === 'bots' && (
              <motion.div
                key="bots"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
                className="max-w-2xl"
              >
                <h2 className="font-orbitron text-xl font-bold tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  BOTS DE CHAT
                </h2>
                <p className="font-rajdhani text-sm mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Conecte as contas de bot para enviar mensagens automáticas de ganhador no chat de cada plataforma.
                </p>

                <BotMuteToggle />

                <div className="space-y-4">
                  {/* Twitch */}
                  <BotCard
                    platform="Twitch"
                    color="#9147FF"
                    authUrl="/api/twitch/eventsub/auth"
                    statusUrl="/api/twitch/status"
                    icon={
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#9147FF">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                      </svg>
                    }
                    description="Bot envia mensagem de ganhador + responde comandos do chat."
                    note="Acesse /api/twitch/eventsub/auth enquanto estiver logado com a conta do bot."
                  />

                  {/* YouTube */}
                  <BotCard
                    platform="YouTube"
                    color="#FF0000"
                    authUrl="/api/youtube/auth"
                    statusUrl="/api/youtube/status"
                    icon={
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF0000">
                        <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
                      </svg>
                    }
                    description="Bot envia mensagem de ganhador no live chat do YouTube."
                    note="Requer YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET no .env (Google Cloud Console → OAuth 2.0)."
                  />

                  {/* Kick */}
                  <KickTokenCard />
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* ── Animation Modal ── */}
      <AnimatePresence>
        {showAnimModal && (
          <motion.div
            key="anim-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          >
            <motion.div
              key="anim-modal"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-xl rounded-2xl flex flex-col overflow-hidden"
              style={{ background: '#080d24', border: '1px solid rgba(0,229,255,0.2)', maxHeight: '90vh' }}
            >
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(0,229,255,0.1)', background: 'rgba(0,229,255,0.04)' }}
              >
                <div className="flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(0,229,255,0.7)">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                  <span className="font-orbitron text-sm font-bold tracking-widest" style={{ color: 'rgba(0,229,255,0.85)' }}>
                    ANIMAÇÃO PERSONALIZADA DO SORTEIO
                  </span>
                </div>
                <button
                  onClick={() => setShowAnimModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,60,60,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,100,100,0.9)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
                <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Sobe os frames em ordem. O mascote vai percorrer eles em sequência durante o sorteio, igual ao ShadowGanjaKing.
                </p>
                <FrameBuilder
                  frames={animFrames}
                  timings={animTimings}
                  onFramesChange={setAnimFrames}
                  onTimingsChange={setAnimTimings}
                />
              </div>

              {/* Modal footer */}
              <div
                className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <button
                  onClick={() => { setAnimFrames(Array(MAX_FRAMES).fill(null)); setAnimTimings([...DEFAULT_TIMINGS]); }}
                  className="px-4 py-2 rounded-xl font-orbitron text-xs tracking-widest transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
                >
                  LIMPAR
                </button>
                <button
                  onClick={() => setShowAnimModal(false)}
                  className="px-5 py-2 rounded-xl font-orbitron text-xs font-bold tracking-widest transition-all"
                  style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: 'rgba(0,229,255,0.9)' }}
                >
                  CONFIRMAR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
