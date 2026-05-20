'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import EntregasHistorico from './EntregasHistorico';
import type { DeliveryStatus, RaffleResult } from '@/types';

/* ── Status config ─────────────────────────────────────────────────── */
const STATUS: Record<DeliveryStatus, {
  label: string; sub: string | null;
  color: string; bg: string; border: string;
  icon: React.ReactNode;
}> = {
  novo: {
    label: 'PENDENTE', sub: 'Aguardando trade link',
    color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
      </svg>
    ),
  },
  tradelocked: {
    label: 'TRADE LOCK', sub: null,
    color: '#FFD166', bg: 'rgba(255,209,102,0.1)', border: 'rgba(255,209,102,0.3)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
      </svg>
    ),
  },
  entregue: {
    label: 'ENTREGUE', sub: null,
    color: '#00FFA3', bg: 'rgba(0,255,163,0.1)', border: 'rgba(0,255,163,0.3)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    ),
  },
};

const STATUS_ORDER: DeliveryStatus[] = ['novo', 'tradelocked', 'entregue'];

type FilterKey = 'all' | DeliveryStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',         label: 'TODOS'       },
  { key: 'entregue',    label: 'ENTREGUES'   },
  { key: 'tradelocked', label: 'TRADE LOCK'  },
  { key: 'novo',        label: 'PENDENTES'   },
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

/* ── Inline trade-link cell ─────────────────────────────────────────── */
function TradeLinkCell({ id, value, onChange, onCommit }: {
  id: string; value: string;
  onChange: (v: string) => void; onCommit: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const copy = () => {
    if (value) navigator.clipboard.writeText(value).catch(() => {});
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => { setEditing(false); onCommit(); }}
            onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onCommit(); } }}
            className="w-full font-rajdhani text-xs outline-none rounded px-2 py-1"
            style={{
              background: 'rgba(0,229,255,0.06)',
              border: '1px solid rgba(0,229,255,0.3)',
              color: '#00E5FF',
              fontSize: 11,
            }}
            placeholder="https://steamcommunity.com/tradeoffer/new/?..."
          />
        ) : value ? (
          <button
            onClick={() => setEditing(true)}
            className="text-left truncate block w-full hover:underline"
            style={{ color: '#00E5FF', fontSize: 11 }}
            title={value}
          >
            {value}
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-left"
            style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}
          >
            Trade link não informado
          </button>
        )}
      </div>
      <button
        onClick={copy}
        title="Copiar trade link"
        className="flex-shrink-0 p-1 rounded transition-all hover:bg-white/10"
        style={{ color: value ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.15)' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>
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

  const myHistory = (historyOverride ?? history.filter(r => r.streamer === currentUser?.username))
    .sort((a, b) => b.timestamp - a.timestamp);

  const dayHistory = selectedDate
    ? myHistory.filter(r => getLocalDateKey(r.timestamp) === selectedDate)
    : myHistory;

  const [tradeDraft, setTradeDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(myHistory.map(r => [r.id, r.tradeLink ?? '']))
  );

  useEffect(() => {
    setTradeDraft(prev => {
      const next = { ...prev };
      for (const r of myHistory) {
        if (!(r.id in next)) next[r.id] = r.tradeLink ?? '';
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  useEffect(() => { setFilter('all'); setSearch(''); }, [selectedDate]);

  const filtered = dayHistory
    .filter(r => filter === 'all' || (r.deliveryStatus ?? 'novo') === filter)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.prize.name.toLowerCase().includes(q) || r.winner.name.toLowerCase().includes(q);
    });

  const counts: Record<FilterKey, number> = {
    all:         dayHistory.length,
    entregue:    dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'entregue').length,
    tradelocked: dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'tradelocked').length,
    novo:        dayHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'novo').length,
  };

  const pct = dayHistory.length > 0
    ? Math.round((counts.entregue / dayHistory.length) * 100)
    : 0;

  const cycleStatus = (id: string, current: DeliveryStatus | undefined) => {
    const cur = current ?? 'novo';
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(cur) + 1) % STATUS_ORDER.length];
    handleUpdateDelivery(id, undefined, next);
  };

  const exportCSV = () => {
    const rows = [
      ['Item', 'PSC', 'Ganhador', 'Trade Link', 'Status', 'Data'],
      ...dayHistory.map(r => [
        r.prize.name,
        r.prize.pscValue?.toString() ?? '',
        r.winner.name,
        r.tradeLink ?? '',
        STATUS[r.deliveryStatus ?? 'novo'].label,
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

  const displayDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  /* ── Historico view (no date selected) ─── */
  if (!selectedDate) {
    return <EntregasHistorico onSelectDay={setSelectedDate} historyOverride={historyOverride} />;
  }

  /* ── Detail view ─── */
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Title row */}
        <div className="flex items-start gap-4 mb-5">
          {/* Back */}
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

          {/* Icon + title */}
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

          {/* Actions */}
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
          {/* TOTAL */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>TOTAL DE ITENS</p>
            <div className="flex items-center justify-between">
              <span className="font-orbitron font-bold text-white" style={{ fontSize: 26 }}>{dayHistory.length}</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
                <path d="M20 6h-2.18c.07-.44.18-.88.18-1.33C18 2.54 16.46 1 14.67 1c-1.14 0-2.03.63-2.67 1.47L12 2.5l-.07-.04C11.32 1.63 10.43 1 9.33 1 7.54 1 6 2.54 6 4.33c0 .45.11.89.18 1.33H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5.33-3c.92 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67H13V4.33C13 3.41 13.75 2.67 14.67 2.67zM9.33 2.67C10.25 2.67 11 3.41 11 4.33V6H9.33C8.41 6 7.67 5.25 7.67 4.33c0-.92.74-1.66 1.66-1.66zM4 11h7v8H4v-8zm9 8v-8h7v8h-7z"/>
              </svg>
            </div>
          </div>
          {/* ENTREGUES */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>ENTREGUES</p>
            <div className="flex items-center justify-between">
              <span className="font-orbitron font-bold" style={{ fontSize: 26, color: '#00FFA3' }}>{counts.entregue}</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(0,255,163,0.3)">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          </div>
          {/* EM TRANSITO */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>EM TRANSITO</p>
            <div className="flex items-center justify-between">
              <span className="font-orbitron font-bold" style={{ fontSize: 26, color: '#FFD166' }}>{counts.tradelocked}</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,209,102,0.3)">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
              </svg>
            </div>
          </div>
          {/* PENDENTES */}
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="font-rajdhani text-white/35 tracking-widest mb-1" style={{ fontSize: 9 }}>PENDENTES</p>
            <div className="flex items-center justify-between">
              <span className="font-orbitron font-bold text-white" style={{ fontSize: 26 }}>{counts.novo}</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)">
                <path d="M6 2v6l2 2-2 2v6h12v-6l-2-2 2-2V2H6zm10 14.5V20H8v-3.5l2-2v-1l-2-2V4h8v7.5l-2 2v1l2 2z"/>
              </svg>
            </div>
          </div>
          {/* % ENTREGUES */}
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
          <div className="flex items-center gap-1">
            {FILTERS.map(f => (
              <button key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-orbitron font-bold transition-all"
                style={{
                  fontSize: 10, letterSpacing: '0.05em',
                  color: filter === f.key ? '#00E5FF' : 'rgba(255,255,255,0.3)',
                  background: filter === f.key ? 'rgba(0,229,255,0.1)' : 'transparent',
                  border: filter === f.key ? '1px solid rgba(0,229,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
                }}>
                {f.label}
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 4,
                  background: filter === f.key ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.07)',
                  color: filter === f.key ? '#00E5FF' : 'rgba(255,255,255,0.3)',
                }}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
          {/* Search */}
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
                  const cfg = STATUS[status];
                  const hasPsc = (r.prize.pscValue ?? 0) > 0;
                  const dt = new Date(r.timestamp);

                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                      style={{
                        borderBottom: status === 'entregue' ? '1px solid rgba(0,255,163,0.18)' : '1px solid rgba(255,255,255,0.04)',
                        background: status === 'entregue'
                          ? 'rgba(0,255,163,0.22)'
                          : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      }}
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
                        <TradeLinkCell
                          id={r.id}
                          value={tradeDraft[r.id] ?? ''}
                          onChange={v => setTradeDraft(prev => ({ ...prev, [r.id]: v }))}
                          onCommit={() => handleUpdateDelivery(r.id, tradeDraft[r.id] ?? '', undefined)}
                        />
                      </td>

                      {/* STATUS */}
                      <td className="px-4 py-3" style={{ minWidth: 160 }}>
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
                                </option>
                              ))}
                            </select>
                            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill={cfg.color}>
                              <path d="M7 10l5 5 5-5z"/>
                            </svg>
                          </div>
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
  );
}
