'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import EntregasHistorico from './EntregasHistorico';
import type { DeliveryStatus, RaffleResult } from '@/types';

const ERROR_STATUSES: DeliveryStatus[] = ['erro_tradelink', 'erro_entrega', 'erro_compra'];
const STEAM_REGEX = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;

/* ── Status config ─────────────────────────────────────────────────── */
const STATUS: Record<DeliveryStatus, {
  label: string; sub: string | null;
  color: string; bg: string; border: string;
  isError: boolean;
  icon: React.ReactNode;
}> = {
  novo: {
    label: 'PENDENTE', sub: 'Aguardando trade link',
    color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)',
    isError: false,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
      </svg>
    ),
  },
  aguardando_tradelink: {
    label: 'AGUARD. TRADE LINK', sub: 'Esperando DM do vencedor',
    color: '#A855F7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)',
    isError: false,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
    ),
  },
  item_comprado: {
    label: 'ITEM COMPRADO', sub: 'Aguardando trade link',
    color: '#00E5FF', bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.25)',
    isError: false,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 5.9 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.43 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
    ),
  },
  tradelocked: {
    label: 'TRADE LOCK', sub: null,
    color: '#FFD166', bg: 'rgba(255,209,102,0.1)', border: 'rgba(255,209,102,0.3)',
    isError: false,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
      </svg>
    ),
  },
  entregue: {
    label: 'ENTREGUE', sub: null,
    color: '#00FFA3', bg: 'rgba(0,255,163,0.1)', border: 'rgba(0,255,163,0.3)',
    isError: false,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    ),
  },
  erro_tradelink: {
    label: 'ERRO TRADE LINK', sub: 'Erro ao receber trade link',
    color: '#FF4444', bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.35)',
    isError: true,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    ),
  },
  erro_entrega: {
    label: 'ERRO ENTREGA', sub: 'Erro ao enviar produto',
    color: '#FF4444', bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.35)',
    isError: true,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    ),
  },
  erro_compra: {
    label: 'PROBLEMA NA COMPRA', sub: 'Problema com a compra do produto',
    color: '#FF4444', bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.35)',
    isError: true,
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    ),
  },
};

const STATUS_ORDER: DeliveryStatus[] = [
  'novo', 'aguardando_tradelink', 'item_comprado', 'tradelocked', 'entregue',
  'erro_tradelink', 'erro_entrega', 'erro_compra',
];

type FilterKey = 'all' | DeliveryStatus | 'erro';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',                  label: 'TODOS'         },
  { key: 'aguardando_tradelink', label: 'AGUARD. LINK'  },
  { key: 'item_comprado',        label: 'ITEM COMPRADO' },
  { key: 'entregue',             label: 'ENTREGUES'     },
  { key: 'tradelocked',          label: 'TRADE LOCK'    },
  { key: 'novo',                 label: 'PENDENTES'     },
  { key: 'erro',                 label: 'ERROS'         },
];

/* ── Helpers ───────────────────────────────────────────────────────── */
function getLocalDateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CircularProgress({ pct }: { pct: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48 }}>
      <svg width="48" height="48" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="#00FFA3" strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ── Trade Lock countdown ───────────────────────────────────────────── */
const TRADE_LOCK_MS = 7 * 24 * 60 * 60 * 1000;

function TradeLockCountdown({ tradeLockAt }: { tradeLockAt: number }) {
  const calc = useCallback(() => {
    const diff = (tradeLockAt + TRADE_LOCK_MS) - Date.now();
    if (diff <= 0) return null;
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return { d, h, m, s };
  }, [tradeLockAt]);

  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    setRemaining(calc());
    const t = setInterval(() => setRemaining(calc()), 1_000);
    return () => clearInterval(t);
  }, [calc]);

  if (!remaining) {
    return (
      <span className="font-orbitron font-bold" style={{ fontSize: 9, color: 'rgba(255,100,100,0.8)', letterSpacing: '0.05em' }}>
        LOCK EXPIRADO
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,209,102,0.7)">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
      </svg>
      <span className="font-orbitron font-bold" style={{ fontSize: 10, color: 'rgba(255,209,102,0.9)', letterSpacing: '0.04em' }}>
        {remaining.d > 0 && `${remaining.d}d `}{remaining.h}h {remaining.m}m {String(remaining.s).padStart(2, '0')}s
      </span>
    </div>
  );
}

/* ── Trade link display (read-only) ─────────────────────────────────── */
function TradeLinkDisplay({ value, onInsertClick }: { value: string; onInsertClick: () => void }) {
  const copy = () => {
    if (value) navigator.clipboard.writeText(value).catch(() => {});
  };

  if (!value) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-rajdhani" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
          Trade link não informado
        </span>
        <button
          onClick={onInsertClick}
          className="flex-shrink-0 px-2 py-1 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125"
          style={{ fontSize: 9, color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}
        >
          INSERIR
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex-1 min-w-0 truncate font-mono" style={{ color: '#00E5FF', fontSize: 11 }} title={value}>
        {value}
      </span>
      <button
        onClick={copy}
        title="Copiar trade link"
        className="flex-shrink-0 p-1 rounded transition-all hover:bg-white/10"
        style={{ color: 'rgba(0,229,255,0.5)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>
    </div>
  );
}

/* ── Trade link modal ───────────────────────────────────────────────── */
function TradeLinkModal({ item, onConfirm, onClose }: {
  item: RaffleResult;
  onConfirm: (tradeLink: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!STEAM_REGEX.test(trimmed)) {
      setError('Link inválido. Formato esperado: https://steamcommunity.com/tradeoffer/new/?partner=XXXXXXXX&token=XXXXXXXX');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="rounded-2xl p-6 mx-4 w-full"
        style={{ maxWidth: 520, background: '#0d1117', border: '1px solid rgba(0,229,255,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#00E5FF">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
          <h2 className="font-orbitron font-bold tracking-widest text-white" style={{ fontSize: 13 }}>
            INSERIR TRADE LINK MANUALMENTE
          </h2>
        </div>

        {/* Item info */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {item.prize.imageUrl && (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={item.prize.imageUrl} alt="" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <p className="font-rajdhani font-bold text-white" style={{ fontSize: 13 }}>{item.prize.name}</p>
            <p className="font-rajdhani" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              Ganhador: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.winner.name}</span>
            </p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex gap-2.5 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,200,80,0.9)" className="flex-shrink-0 mt-0.5">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <p className="font-rajdhani" style={{ fontSize: 12, color: 'rgba(255,200,100,0.9)', lineHeight: 1.45 }}>
            Tenha certeza que o trade link é da pessoa correta, pois a entrega será feita logo após o salvamento.
          </p>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..."
          className="w-full px-3 py-2.5 rounded-xl font-mono mb-2 outline-none"
          style={{
            background: 'rgba(0,229,255,0.05)',
            border: `1px solid ${error ? 'rgba(255,68,68,0.5)' : 'rgba(0,229,255,0.2)'}`,
            color: '#00E5FF',
            fontSize: 11,
          }}
        />

        {error && (
          <p className="font-rajdhani mb-3" style={{ fontSize: 11, color: '#FF4444' }}>{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            CANCELAR
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-110"
            style={{ fontSize: 10, color: '#000', background: '#00E5FF', border: 'none' }}
          >
            SALVAR E ENTREGAR
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */
interface EntregasPageProps {
  historyOverride?: RaffleResult[];
  onHistoryRefresh?: () => Promise<void>;
  onUpdateDelivery?: (id: string, tradeLink?: string, deliveryStatus?: DeliveryStatus) => void;
}

export default function EntregasPage({ historyOverride, onHistoryRefresh, onUpdateDelivery }: EntregasPageProps = {}) {
  const { history, currentUser, updateDelivery } = useStore();

  const handleUpdateDelivery = onUpdateDelivery ?? updateDelivery;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter]             = useState<FilterKey>('all');
  const [search, setSearch]             = useState('');
  const [refreshing, setRefreshing]     = useState(false);
  const [tradeLinkModalId, setTradeLinkModalId] = useState<string | null>(null);

  const myHistory = (historyOverride ?? history.filter(r => r.streamer === currentUser?.username))
    .sort((a, b) => b.timestamp - a.timestamp);

  const dayHistory = selectedDate
    ? myHistory.filter(r => getLocalDateKey(r.timestamp) === selectedDate)
    : myHistory;

  useEffect(() => { setFilter('all'); setSearch(''); }, [selectedDate]);

  const filtered = dayHistory
    .filter(r => {
      if (filter === 'all') return true;
      if (filter === 'erro') return ERROR_STATUSES.includes((r.deliveryStatus ?? 'novo') as DeliveryStatus);
      return (r.deliveryStatus ?? 'novo') === filter;
    })
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.prize.name.toLowerCase().includes(q) || r.winner.name.toLowerCase().includes(q);
    });

  const counts: Record<FilterKey, number> = {
    all:                  dayHistory.length,
    entregue:             dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'entregue').length,
    tradelocked:          dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'tradelocked').length,
    aguardando_tradelink: dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'aguardando_tradelink').length,
    item_comprado:        dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'item_comprado').length,
    novo:                 dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'novo').length,
    erro:                 dayHistory.filter(r => ERROR_STATUSES.includes((r.deliveryStatus ?? 'novo') as DeliveryStatus)).length,
    erro_tradelink:       dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'erro_tradelink').length,
    erro_entrega:         dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'erro_entrega').length,
    erro_compra:          dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'erro_compra').length,
  };

  const pct = dayHistory.length > 0
    ? Math.round((counts.entregue / dayHistory.length) * 100)
    : 0;

  const exportCSV = () => {
    const rows = [
      ['Item', 'PSC', 'Ganhador', 'Trade Link', 'Status', 'Data'],
      ...dayHistory.map(r => [
        r.prize.name,
        r.prize.pscValue?.toString() ?? '',
        r.winner.name,
        r.tradeLink ?? '',
        STATUS[(r.deliveryStatus ?? 'novo') as DeliveryStatus]?.label ?? r.deliveryStatus ?? '',
        new Date(r.timestamp).toLocaleString('pt-BR'),
      ]),
    ];
    const csv = rows.map(row => row.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sorteio-${selectedDate ?? 'todos'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshHistory = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onHistoryRefresh) {
        await onHistoryRefresh();
      } else if (currentUser) {
        const res = await fetch(`/api/streamer/history?username=${currentUser.username}`);
        const data = await res.json();
        if (Array.isArray(data)) useStore.setState({ history: data });
      }
    } catch {}
    setRefreshing(false);
  };

  // Auto-polling quando há itens aguardando trade link
  useEffect(() => {
    if (!selectedDate) return;
    const hasWaiting = dayHistory.some(r => (r.deliveryStatus ?? 'novo') === 'aguardando_tradelink');
    if (!hasWaiting) return;
    const interval = setInterval(() => { refreshHistory(); }, 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, counts.aguardando_tradelink]);

  const modalItem = tradeLinkModalId ? dayHistory.find(r => r.id === tradeLinkModalId) : null;

  const handleModalConfirm = (tradeLink: string) => {
    if (!tradeLinkModalId) return;
    handleUpdateDelivery(tradeLinkModalId, tradeLink, undefined);
    setTradeLinkModalId(null);
  };

  const displayDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  /* ── Historico view (no date selected) ─── */
  if (!selectedDate) {
    return <EntregasHistorico onSelectDay={setSelectedDate} historyOverride={historyOverride} />;
  }

  /* ── Detail view ─── */
  return (
    <>
      <AnimatePresence>
        {modalItem && (
          <TradeLinkModal
            item={modalItem}
            onConfirm={handleModalConfirm}
            onClose={() => setTradeLinkModalId(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Title row */}
          <div className="flex items-start gap-4 mb-5">
            <button
              onClick={() => setSelectedDate(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125 flex-shrink-0 mt-0.5"
              style={{ fontSize: 9, color: '#00E5FF', background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.18)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              VOLTAR
            </button>

            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#00FFA3">
                  <path d="M20 6h-2.18c.07-.44.18-.88.18-1.33C18 2.54 16.46 1 14.67 1c-1.14 0-2.03.63-2.67 1.47L12 2.5l-.07-.04C11.32 1.63 10.43 1 9.33 1 7.54 1 6 2.54 6 4.33c0 .45.11.89.18 1.33H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5.33-3c.92 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67H13V4.33C13 3.41 13.75 2.67 14.67 2.67zM9.33 2.67C10.25 2.67 11 3.41 11 4.33V6H9.33C8.41 6 7.67 5.25 7.67 4.33c0-.92.74-1.66 1.66-1.66zM4 11h7v8H4v-8zm9 8v-8h7v8h-7z"/>
                </svg>
              </div>
              <div>
                <h1 className="font-orbitron font-bold tracking-widest text-white" style={{ fontSize: 15 }}>
                  ITENS DO SORTEIO
                </h1>
                <p className="font-rajdhani text-white/30 tracking-widest mt-0.5" style={{ fontSize: 11 }}>
                  Acompanhe o status de todos os prêmios do sorteio — {displayDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125"
                style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                EXPORTAR
              </button>
              <button
                onClick={refreshHistory}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125 disabled:opacity-60"
                style={{ fontSize: 10, color: '#00FFA3', background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
                  style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                ATUALIZAR
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>TOTAL DE ITENS</p>
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold text-white" style={{ fontSize: 26 }}>{dayHistory.length}</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
                  <path d="M20 6h-2.18c.07-.44.18-.88.18-1.33C18 2.54 16.46 1 14.67 1c-1.14 0-2.03.63-2.67 1.47L12 2.5l-.07-.04C11.32 1.63 10.43 1 9.33 1 7.54 1 6 2.54 6 4.33c0 .45.11.89.18 1.33H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5.33-3c.92 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67H13V4.33C13 3.41 13.75 2.67 14.67 2.67zM9.33 2.67C10.25 2.67 11 3.41 11 4.33V6H9.33C8.41 6 7.67 5.25 7.67 4.33c0-.92.74-1.66 1.66-1.66zM4 11h7v8H4v-8zm9 8v-8h7v8h-7z"/>
                </svg>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>ENTREGUES</p>
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold" style={{ fontSize: 26, color: '#00FFA3' }}>{counts.entregue}</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(0,255,163,0.3)">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>EM TRANSITO</p>
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold" style={{ fontSize: 26, color: '#FFD166' }}>{counts.tradelocked}</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,209,102,0.3)">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
                </svg>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3"
              style={{ background: counts.erro > 0 ? 'rgba(255,68,68,0.07)' : 'rgba(255,255,255,0.03)', border: counts.erro > 0 ? '1px solid rgba(255,68,68,0.2)' : '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-rajdhani tracking-widest mb-1" style={{ fontSize: 9, color: counts.erro > 0 ? 'rgba(255,100,100,0.6)' : 'rgba(255,255,255,0.35)' }}>ERROS</p>
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold" style={{ fontSize: 26, color: counts.erro > 0 ? '#FF4444' : 'rgba(255,255,255,0.3)' }}>{counts.erro}</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill={counts.erro > 0 ? 'rgba(255,68,68,0.4)' : 'rgba(255,255,255,0.1)'}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>% ENTREGUES</p>
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-bold" style={{ fontSize: 26, color: '#00FFA3' }}>{pct}%</span>
                <CircularProgress pct={pct} />
              </div>
            </div>
          </div>

          {/* Filters + search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {FILTERS.map(f => (
                <button key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-orbitron font-bold transition-all"
                  style={{
                    fontSize: 10, letterSpacing: '0.05em',
                    color: filter === f.key
                      ? (f.key === 'erro' ? '#FF4444' : '#00E5FF')
                      : 'rgba(255,255,255,0.3)',
                    background: filter === f.key
                      ? (f.key === 'erro' ? 'rgba(255,68,68,0.1)' : 'rgba(0,229,255,0.1)')
                      : 'transparent',
                    border: filter === f.key
                      ? (f.key === 'erro' ? '1px solid rgba(255,68,68,0.3)' : '1px solid rgba(0,229,255,0.3)')
                      : '1px solid rgba(255,255,255,0.07)',
                  }}>
                  {f.label}
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4,
                    background: filter === f.key
                      ? (f.key === 'erro' ? 'rgba(255,68,68,0.2)' : 'rgba(0,229,255,0.2)')
                      : 'rgba(255,255,255,0.07)',
                    color: filter === f.key
                      ? (f.key === 'erro' ? '#FF4444' : '#00E5FF')
                      : 'rgba(255,255,255,0.3)',
                  }}>
                    {counts[f.key]}
                  </span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 220 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar item ou ganhador..."
                className="bg-transparent outline-none font-rajdhani text-white/60"
                style={{ fontSize: 12, flex: 1 }}
              />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="text-5xl opacity-20">📦</div>
              <p className="font-rajdhani text-white/25 text-sm tracking-widest">Nenhum item encontrado</p>
            </div>
          ) : (
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['ITEM', 'GANHADOR', 'TRADE LINK', 'STATUS', 'DATA SORTEIO'].map(h => (
                    <th key={h} className="font-orbitron text-white/30 tracking-widest text-left px-4 py-3"
                      style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.02)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((r, i) => {
                    const status = (r.deliveryStatus ?? 'novo') as DeliveryStatus;
                    const cfg = STATUS[status] ?? STATUS.novo;
                    const hasPsc = (r.prize.pscValue ?? 0) > 0;
                    const dt = new Date(r.timestamp);

                    const rowBg = cfg.isError
                      ? 'rgba(255,68,68,0.06)'
                      : status === 'entregue'
                        ? 'rgba(0,255,163,0.07)'
                        : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
                    const rowBorder = cfg.isError
                      ? '1px solid rgba(255,68,68,0.15)'
                      : status === 'entregue'
                        ? '1px solid rgba(0,255,163,0.15)'
                        : '1px solid rgba(255,255,255,0.04)';

                    return (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        style={{ borderBottom: rowBorder, background: rowBg }}
                      >
                        {/* ITEM */}
                        <td className="px-4 py-3" style={{ minWidth: 220 }}>
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              {r.prize.imageUrl
                                ? <img src={r.prize.imageUrl} alt="" className="w-full h-full object-contain" />
                                : <span style={{ fontSize: 20 }}>🏆</span>
                              }
                            </div>
                            <div>
                              <p className="font-rajdhani font-bold text-white" style={{ fontSize: 13, lineHeight: 1.2 }}>
                                {r.prize.name}
                              </p>
                              {r.prize.description && (
                                <p className="font-rajdhani text-white/35" style={{ fontSize: 11 }}>
                                  {r.prize.description}
                                </p>
                              )}
                              {hasPsc ? (
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  <span style={{ fontSize: 11 }}>💠</span>
                                  <span className="font-orbitron font-bold text-neon-green" style={{ fontSize: 11 }}>
                                    {r.prize.pscValue?.toLocaleString('pt-BR')} PSC
                                  </span>
                                  <span className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(0,255,163,0.55)' }}>
                                    (Entrega por PlayerSkins)
                                  </span>
                                </div>
                              ) : (
                                <span className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                                  (Entrega pelo streamer)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* GANHADOR */}
                        <td className="px-4 py-3" style={{ minWidth: 140 }}>
                          <div className="flex items-center gap-2">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                            <span className="font-rajdhani text-white/70" style={{ fontSize: 13 }}>
                              {r.winner.name}
                            </span>
                          </div>
                        </td>

                        {/* TRADE LINK */}
                        <td className="px-4 py-3" style={{ minWidth: 200, maxWidth: 280 }}>
                          <TradeLinkDisplay
                            value={r.tradeLink ?? ''}
                            onInsertClick={() => setTradeLinkModalId(r.id)}
                          />
                        </td>

                        {/* STATUS */}
                        <td className="px-4 py-3" style={{ minWidth: 180 }}>
                          <div className="flex flex-col gap-1.5">
                            <div className="relative" style={{ opacity: hasPsc ? 0.5 : 1 }}>
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: cfg.color }}>
                                {cfg.icon}
                              </span>
                              <select
                                value={status}
                                disabled={hasPsc}
                                onChange={e => handleUpdateDelivery(r.id, undefined, e.target.value as DeliveryStatus)}
                                title={hasPsc ? 'Gerenciado pelo administrador' : undefined}
                                className="font-orbitron font-bold w-full pl-7 pr-6 py-2 rounded-lg appearance-none outline-none"
                                style={{
                                  fontSize: 10,
                                  color: cfg.color,
                                  background: cfg.bg,
                                  border: `1px solid ${cfg.border}`,
                                  cursor: hasPsc ? 'not-allowed' : 'pointer',
                                  letterSpacing: '0.05em',
                                }}
                              >
                                {STATUS_ORDER.map(s => (
                                  <option key={s} value={s} style={{ background: '#111827', color: STATUS[s].color }}>
                                    {STATUS[s].label}
                                    {STATUS[s].sub ? ` — ${STATUS[s].sub}` : ''}
                                  </option>
                                ))}
                              </select>
                              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill={cfg.color}>
                                <path d="M7 10l5 5 5-5z"/>
                              </svg>
                            </div>
                            {cfg.sub && (
                              <span className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                                {cfg.sub}
                              </span>
                            )}
                            {status === 'tradelocked' && r.tradeLockAt && (
                              <TradeLockCountdown tradeLockAt={r.tradeLockAt} />
                            )}
                            {status === 'tradelocked' && !r.tradeLockAt && (
                              <span className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(255,209,102,0.45)' }}>
                                horário não registrado
                              </span>
                            )}
                          </div>
                        </td>

                        {/* DATA SORTEIO */}
                        <td className="px-4 py-3" style={{ minWidth: 110 }}>
                          <div className="flex flex-col">
                            <span className="font-rajdhani text-white/60" style={{ fontSize: 12 }}>
                              {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <span className="font-rajdhani text-white/30" style={{ fontSize: 11 }}>
                              {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
