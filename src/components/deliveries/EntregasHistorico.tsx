'use client';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import type { DeliveryStatus, RaffleResult } from '@/types';

type DayStatus = 'finalizado' | 'em_andamento' | 'com_pendencias';
type FilterType = 'all' | DayStatus;

interface DayData {
  dateKey: string;
  displayDate: string;
  total: number;
  entregues: number;
  pendentes: number;
  pct: number;
  status: DayStatus;
}

const PAGE_SIZE = 12;

const STATUS_CONFIG: Record<DayStatus, { label: string; color: string; bg: string; border: string; cardBorder: string }> = {
  finalizado:     { label: 'FINALIZADO',     color: '#00FFA3', bg: 'rgba(0,255,163,0.08)',  border: 'rgba(0,255,163,0.3)',  cardBorder: 'rgba(0,255,163,0.15)'  },
  em_andamento:   { label: 'EM ANDAMENTO',   color: '#FFD166', bg: 'rgba(255,209,102,0.08)', border: 'rgba(255,209,102,0.3)', cardBorder: 'rgba(255,209,102,0.15)' },
  com_pendencias: { label: 'COM PENDÊNCIAS', color: '#FF5555', bg: 'rgba(255,85,85,0.08)',  border: 'rgba(255,85,85,0.3)',  cardBorder: 'rgba(255,85,85,0.15)'  },
};

function getLocalDateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayStatus(items: { deliveryStatus?: DeliveryStatus }[]): DayStatus {
  if (items.every(r => (r.deliveryStatus ?? 'novo') === 'entregue')) return 'finalizado';
  if (items.some(r => (r.deliveryStatus ?? 'novo') === 'novo')) return 'com_pendencias';
  return 'em_andamento';
}

function CircularProgress({ pct, color }: { pct: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 76, height: 76 }}>
      <svg width="76" height="76" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx="38" cy="38" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="flex flex-col items-center justify-center" style={{ zIndex: 1 }}>
        <span className="font-orbitron font-bold" style={{ fontSize: 13, color, lineHeight: 1 }}>{pct}%</span>
        <span className="font-rajdhani text-white/35 tracking-widest" style={{ fontSize: 8, marginTop: 1 }}>ENTREGUE</span>
      </div>
    </div>
  );
}

interface Props {
  onSelectDay: (dateKey: string) => void;
  historyOverride?: RaffleResult[];
}

export default function EntregasHistorico({ onSelectDay, historyOverride }: Props) {
  const { history, currentUser } = useStore();

  const myHistory = historyOverride ?? history.filter(r => r.streamer === currentUser?.username);

  const days = useMemo<DayData[]>(() => {
    const groups = new Map<string, typeof myHistory>();
    for (const r of myHistory) {
      const key = getLocalDateKey(r.timestamp);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries())
      .map(([dateKey, items]) => {
        const d = new Date(items[0].timestamp);
        const displayDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const total = items.length;
        const entregues = items.filter(r => (r.deliveryStatus ?? 'novo') === 'entregue').length;
        const pendentes = total - entregues;
        const pct = total > 0 ? Math.round((entregues / total) * 100) : 0;
        const status = getDayStatus(items);
        return { dateKey, displayDate, total, entregues, pendentes, pct, status };
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [myHistory]);

  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);

  const filtered = filter === 'all' ? days : days.filter(d => d.status === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalSorteios = days.length;
  const totalItens = myHistory.length;
  const totalEntregues = myHistory.filter(r => (r.deliveryStatus ?? 'novo') === 'entregue').length;
  const totalPendentes = totalItens - totalEntregues;
  const pctGeral = totalItens > 0 ? Math.round((totalEntregues / totalItens) * 100) : 0;

  const counts = {
    all: days.length,
    finalizado: days.filter(d => d.status === 'finalizado').length,
    em_andamento: days.filter(d => d.status === 'em_andamento').length,
    com_pendencias: days.filter(d => d.status === 'com_pendencias').length,
  };

  const FILTERS = [
    { key: 'all'           as const, label: 'TODOS',          color: 'rgba(255,255,255,0.6)',  activeBg: 'rgba(255,255,255,0.08)', activeBorder: 'rgba(255,255,255,0.2)' },
    { key: 'finalizado'    as const, label: 'FINALIZADOS',    color: STATUS_CONFIG.finalizado.color,     activeBg: STATUS_CONFIG.finalizado.bg,     activeBorder: STATUS_CONFIG.finalizado.border     },
    { key: 'em_andamento'  as const, label: 'EM ANDAMENTO',   color: STATUS_CONFIG.em_andamento.color,   activeBg: STATUS_CONFIG.em_andamento.bg,   activeBorder: STATUS_CONFIG.em_andamento.border   },
    { key: 'com_pendencias'as const, label: 'COM PENDÊNCIAS', color: STATUS_CONFIG.com_pendencias.color, activeBg: STATUS_CONFIG.com_pendencias.bg, activeBorder: STATUS_CONFIG.com_pendencias.border },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(0,229,255,0.08)' }}>

        {/* Title */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#00E5FF">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
          </div>
          <div>
            <h1 className="font-orbitron font-bold text-lg tracking-widest text-white">ENTREGAS</h1>
            <p className="font-rajdhani text-xs text-white/30 tracking-widest mt-0.5">
              Acompanhe o status de todos os sorteios realizados
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {([
            { label: 'TOTAL DE SORTEIOS', value: totalSorteios,        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.33C18 2.54 16.46 1 14.67 1c-1.14 0-2.03.63-2.67 1.47L12 2.5l-.07-.04C11.32 1.63 10.43 1 9.33 1 7.54 1 6 2.54 6 4.33c0 .45.11.89.18 1.33H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5.33-3c.92 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67H13V4.33C13 3.41 13.75 2.67 14.67 2.67zM9.33 2.67C10.25 2.67 11 3.41 11 4.33V6H9.33C8.41 6 7.67 5.25 7.67 4.33c0-.92.74-1.66 1.66-1.66zM4 11h7v8H4v-8zm9 8v-8h7v8h-7z"/></svg> },
            { label: 'ITENS SORTEADOS',   value: totalItens,           icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)"><path d="M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 12H4V9h16v10zM12 3H8V1H6v2H2v2h20V3z"/></svg> },
            { label: 'ITENS ENTREGUES',   value: totalEntregues,       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> },
            { label: 'PENDENTES',         value: totalPendentes,       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg> },
            { label: '% ENTREGUES',       value: `${pctGeral}%`,       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(0,255,163,0.5)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>, color: '#00FFA3' },
          ]).map((s, i) => (
            <div key={i} className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                {s.icon}
                <span className="font-rajdhani text-white/35 tracking-widest" style={{ fontSize: 9 }}>{s.label}</span>
              </div>
              <span className="font-orbitron font-bold" style={{ fontSize: 22, color: s.color ?? 'white', lineHeight: 1 }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-orbitron font-bold transition-all"
              style={{
                fontSize: 10, letterSpacing: '0.06em',
                color: filter === f.key ? f.color : 'rgba(255,255,255,0.25)',
                background: filter === f.key ? f.activeBg : 'transparent',
                border: filter === f.key ? `1px solid ${f.activeBorder}` : '1px solid rgba(255,255,255,0.06)',
              }}>
              {f.label}
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                background: filter === f.key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                color: filter === f.key ? f.color : 'rgba(255,255,255,0.3)',
              }}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-5xl opacity-20">📦</div>
            <p className="font-rajdhani text-white/25 text-sm tracking-widest">
              {myHistory.length === 0 ? 'Nenhum sorteio realizado ainda' : 'Nenhum sorteio encontrado'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {paginated.map((day, i) => {
              const scfg = STATUS_CONFIG[day.status];
              return (
                <motion.div key={day.dateKey}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl p-4 flex flex-col gap-3"
                  style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${scfg.cardBorder}` }}>

                  {/* Date */}
                  <p className="font-orbitron font-bold text-white/80 tracking-wider" style={{ fontSize: 11 }}>
                    SORTEIO – {day.displayDate}
                  </p>

                  {/* Progress circle + stats */}
                  <div className="flex items-center gap-3">
                    <CircularProgress pct={day.pct} color={scfg.color} />
                    <div className="flex flex-col gap-1">
                      <span className="font-rajdhani text-white/40 tracking-widest" style={{ fontSize: 11 }}>
                        {day.total} ITENS
                      </span>
                      <span className="font-rajdhani text-white/40 tracking-widest" style={{ fontSize: 11 }}>
                        {day.entregues} ENTREGUES
                      </span>
                      <span className="font-rajdhani text-white/40 tracking-widest" style={{ fontSize: 11 }}>
                        {day.pendentes} PENDENTES
                      </span>
                    </div>
                  </div>

                  {/* Status line */}
                  <div className="flex items-center gap-2">
                    <span className="font-rajdhani text-white/30 tracking-widest" style={{ fontSize: 10 }}>STATUS</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
                      style={{ background: scfg.bg, border: `1px solid ${scfg.border}` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: scfg.color }} />
                      <span className="font-orbitron font-bold" style={{ fontSize: 9, color: scfg.color, letterSpacing: '0.06em' }}>
                        {scfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Ver detalhes */}
                  <button
                    onClick={() => onSelectDay(day.dateKey)}
                    className="w-full py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125 flex items-center justify-center gap-2"
                    style={{ fontSize: 10, color: '#00E5FF', background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    VER DETALHES
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="font-rajdhani text-white/25 tracking-widest" style={{ fontSize: 11 }}>
            Mostrando {(page - 1) * PAGE_SIZE + 1} a {Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} sorteios
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              {'‹'}
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className="w-7 h-7 rounded-lg flex items-center justify-center font-orbitron transition-all"
                style={{
                  fontSize: 10,
                  background: n === page ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: n === page ? '1px solid rgba(0,229,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: n === page ? '#00E5FF' : 'rgba(255,255,255,0.4)',
                }}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              {'›'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
