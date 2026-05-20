'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';

type PscEntry = {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: number;
};

type Period = 7 | 30 | 90 | 0;
type TipoFilter = 'all' | 'credit' | 'debit';

const PERIODS: { value: Period; label: string }[] = [
  { value: 7,  label: '7D'   },
  { value: 30, label: '30D'  },
  { value: 90, label: '90D'  },
  { value: 0,  label: 'TUDO' },
];

/* ── Dropdown genérico ───────────────────────────────────────────────── */
function Dropdown({
  value, label, options, onChange,
}: {
  value: string; label: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative" style={{ minWidth: 140 }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between gap-3 w-full px-3 py-2 rounded-lg font-rajdhani font-bold transition-all"
        style={{
          fontSize: 12, color: 'rgba(255,255,255,0.6)',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(0,255,163,0.3)' : 'rgba(255,255,255,0.1)'}`,
        }}
      >
        <span>{selected?.label ?? label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1 left-0 w-full z-50 rounded-lg overflow-hidden"
            style={{ background: 'rgba(6,9,24,0.98)', border: '1px solid rgba(0,255,163,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
          >
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 font-rajdhani transition-all"
                style={{
                  fontSize: 12,
                  color: o.value === value ? '#00FFA3' : 'rgba(255,255,255,0.6)',
                  background: o.value === value ? 'rgba(0,255,163,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}
              >
                {o.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */
export default function PscHistoryPage() {
  const { currentUser, pscBalance } = useStore();

  const [period, setPeriod]         = useState<Period>(0);
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('all');
  const [txFilter, setTxFilter]     = useState('all');
  const [entries, setEntries]       = useState<PscEntry[]>([]);
  const [apiBalance, setApiBalance] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const qs = period > 0 ? `&days=${period}` : '';
      const res = await fetch(`/api/streamer/psc-history?username=${currentUser.username}${qs}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      if (typeof data.balance === 'number') setApiBalance(data.balance);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, period]);

  useEffect(() => { load(); }, [load]);

  /* ── Filtros aplicados ── */
  const filtered = entries.filter(e => {
    if (tipoFilter !== 'all' && e.type !== tipoFilter) return false;
    if (txFilter !== 'all') {
      const d = e.description.toLowerCase();
      if (txFilter === 'venda'    && !d.includes('venda'))    return false;
      if (txFilter === 'sorteio'  && !d.includes('sorteio'))  return false;
      if (txFilter === 'bonus'    && !d.includes('bônus') && !d.includes('bonus')) return false;
      if (txFilter === 'resgate'  && !d.includes('resgate'))  return false;
    }
    return true;
  });

  /* ── Running saldo (newest → oldest from current balance) ── */
  const currentBal = apiBalance ?? pscBalance;
  const withSaldo = (() => {
    let bal = currentBal;
    return entries.map(e => {
      const saldo = bal;
      if (e.type === 'credit') bal -= e.amount;
      else bal += e.amount;
      return { ...e, saldo };
    });
  })();
  const filteredWithSaldo = withSaldo.filter(e => {
    if (tipoFilter !== 'all' && e.type !== tipoFilter) return false;
    if (txFilter !== 'all') {
      const d = e.description.toLowerCase();
      if (txFilter === 'venda'   && !d.includes('venda'))   return false;
      if (txFilter === 'sorteio' && !d.includes('sorteio')) return false;
      if (txFilter === 'bonus'   && !d.includes('bônus') && !d.includes('bonus')) return false;
      if (txFilter === 'resgate' && !d.includes('resgate')) return false;
    }
    return true;
  });

  /* ── Stats ── */
  const totalIn    = entries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
  const totalOut   = entries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0);
  const countIn    = entries.filter(e => e.type === 'credit').length;
  const countOut   = entries.filter(e => e.type === 'debit').length;
  const periodLabel = period > 0 ? ` (${period}D)` : ' (TOTAL)';

  /* ── Export CSV ── */
  const exportCSV = () => {
    const rows = [
      ['Data', 'Tipo', 'Descrição', 'Entrada', 'Saída', 'Saldo'],
      ...filteredWithSaldo.map(e => {
        const dt = new Date(e.timestamp).toLocaleString('pt-BR');
        const tipo = e.type === 'credit' ? 'Recebido' : 'Gasto';
        const entrada = e.type === 'credit' ? `+${e.amount}` : '';
        const saida   = e.type === 'debit'  ? `-${e.amount}` : '';
        return [dt, tipo, e.description, entrada, saida, String(e.saldo)];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psc-historico${period > 0 ? `-${period}d` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TX_OPTIONS = [
    { value: 'all',     label: 'Todas'            },
    { value: 'venda',   label: 'Venda na loja'    },
    { value: 'sorteio', label: 'Sorteio realizado' },
    { value: 'bonus',   label: 'Bônus'            },
    { value: 'resgate', label: 'Resgate'           },
  ];

  const TIPO_OPTIONS = [
    { value: 'all',    label: 'Todos'    },
    { value: 'credit', label: 'Recebido' },
    { value: 'debit',  label: 'Gasto'   },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="font-orbitron font-bold tracking-widest text-white" style={{ fontSize: 18 }}>
              HISTÓRICO PSC
            </h1>
            <p className="font-rajdhani text-white/30 tracking-widest mt-0.5" style={{ fontSize: 11 }}>
              Acompanhe todas as suas transações de PSC
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125 flex-shrink-0"
            style={{ fontSize: 10, color: '#00FFA3', background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            EXPORTAR
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-5">

          {/* SALDO ATUAL */}
          <div className="rounded-xl px-5 py-4"
            style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.2)' }}>
            <p className="font-orbitron text-white/40 tracking-widest mb-2" style={{ fontSize: 9 }}>SALDO ATUAL</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(0,255,163,0.15)', border: '1px solid rgba(0,255,163,0.3)' }}>
                <span style={{ fontSize: 16 }}>💠</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-orbitron font-bold" style={{ fontSize: 28, color: '#00FFA3', lineHeight: 1 }}>
                  {Math.ceil(currentBal).toLocaleString('pt-BR')}
                </span>
                <span className="font-orbitron text-white/40" style={{ fontSize: 12 }}>PSC</span>
              </div>
            </div>
          </div>

          {/* RECEBIDO */}
          <div className="rounded-xl px-5 py-4"
            style={{ background: 'rgba(0,255,163,0.03)', border: '1px solid rgba(0,255,163,0.12)' }}>
            <p className="font-orbitron text-white/40 tracking-widest mb-2" style={{ fontSize: 9 }}>
              RECEBIDO{periodLabel}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.25)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#00FFA3">
                  <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-orbitron font-bold" style={{ fontSize: 24, color: '#00FFA3', lineHeight: 1 }}>
                    +{totalIn.toLocaleString('pt-BR')}
                  </span>
                  <span className="font-orbitron text-white/40" style={{ fontSize: 12 }}>PSC</span>
                </div>
                <p className="font-rajdhani text-white/30 mt-0.5" style={{ fontSize: 11 }}>
                  (+{countIn} transaç{countIn === 1 ? 'ão' : 'ões'})
                </p>
              </div>
            </div>
          </div>

          {/* GASTO */}
          <div className="rounded-xl px-5 py-4"
            style={{ background: 'rgba(255,85,85,0.03)', border: '1px solid rgba(255,85,85,0.12)' }}>
            <p className="font-orbitron text-white/40 tracking-widest mb-2" style={{ fontSize: 9 }}>
              GASTO{periodLabel}
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,85,85,0.1)', border: '1px solid rgba(255,85,85,0.25)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF5555">
                  <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
                </svg>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-orbitron font-bold" style={{ fontSize: 24, color: '#FF5555', lineHeight: 1 }}>
                    -{totalOut.toLocaleString('pt-BR')}
                  </span>
                  <span className="font-orbitron text-white/40" style={{ fontSize: 12 }}>PSC</span>
                </div>
                <p className="font-rajdhani text-white/30 mt-0.5" style={{ fontSize: 11 }}>
                  (-{countOut} transaç{countOut === 1 ? 'ão' : 'ões'})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-end gap-6">

          {/* PERÍODO */}
          <div>
            <p className="font-orbitron text-white/30 tracking-widest mb-2" style={{ fontSize: 9 }}>PERÍODO</p>
            <div className="flex items-center gap-1">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className="px-3 py-1.5 rounded-lg font-orbitron font-bold transition-all"
                  style={{
                    fontSize: 10, letterSpacing: '0.06em',
                    color: period === p.value ? '#00FFA3' : 'rgba(255,255,255,0.3)',
                    background: period === p.value ? 'rgba(0,255,163,0.1)' : 'transparent',
                    border: period === p.value ? '1px solid rgba(0,255,163,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* TIPO */}
          <div>
            <p className="font-orbitron text-white/30 tracking-widest mb-2" style={{ fontSize: 9 }}>TIPO</p>
            <Dropdown value={tipoFilter} label="Tipo" options={TIPO_OPTIONS} onChange={v => setTipoFilter(v as TipoFilter)} />
          </div>

          {/* TRANSAÇÃO */}
          <div>
            <p className="font-orbitron text-white/30 tracking-widest mb-2" style={{ fontSize: 9 }}>TRANSAÇÃO</p>
            <Dropdown value={txFilter} label="Todas" options={TX_OPTIONS} onChange={setTxFilter} />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(0,255,163,0.2)', borderTopColor: '#00FFA3' }} />
                <span className="font-rajdhani text-white/25 text-xs tracking-widest">carregando...</span>
              </div>
            </motion.div>
          ) : filteredWithSaldo.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="text-5xl opacity-20">💠</div>
              <p className="font-rajdhani text-white/25 text-sm tracking-widest">
                Nenhuma movimentação encontrada
              </p>
            </motion.div>
          ) : (
            <motion.div key={`table-${period}-${tipoFilter}-${txFilter}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {[
                      { label: 'DATA',      w: 130 },
                      { label: 'TIPO',      w: 120 },
                      { label: 'DESCRIÇÃO', w: undefined },
                      { label: 'ENTRADA',   w: 100 },
                      { label: 'SAÍDA',     w: 100 },
                      { label: 'SALDO',     w: 110 },
                    ].map(h => (
                      <th key={h.label}
                        className="font-orbitron text-white/30 tracking-widest text-left px-5 py-3"
                        style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.02)', width: h.w }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWithSaldo.map((entry, i) => {
                    const isCredit = entry.type === 'credit';
                    const dt = new Date(entry.timestamp);
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.015, 0.25) }}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        }}
                      >
                        {/* DATA */}
                        <td className="px-5 py-3" style={{ minWidth: 130 }}>
                          <div className="flex flex-col">
                            <span className="font-rajdhani text-white/60" style={{ fontSize: 12 }}>
                              {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <span className="font-rajdhani text-white/30" style={{ fontSize: 11 }}>
                              {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* TIPO */}
                        <td className="px-5 py-3" style={{ minWidth: 120 }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                background: isCredit ? 'rgba(0,255,163,0.12)' : 'rgba(255,85,85,0.12)',
                                border: `1px solid ${isCredit ? 'rgba(0,255,163,0.25)' : 'rgba(255,85,85,0.25)'}`,
                              }}>
                              {isCredit ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#00FFA3">
                                  <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF5555">
                                  <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
                                </svg>
                              )}
                            </div>
                            <span className="font-rajdhani font-bold"
                              style={{ fontSize: 13, color: isCredit ? '#00FFA3' : '#FF5555' }}>
                              {isCredit ? 'Recebido' : 'Gasto'}
                            </span>
                          </div>
                        </td>

                        {/* DESCRIÇÃO */}
                        <td className="px-5 py-3">
                          <span className="font-rajdhani text-white/70" style={{ fontSize: 13 }}>
                            {entry.description}
                          </span>
                        </td>

                        {/* ENTRADA */}
                        <td className="px-5 py-3 text-right" style={{ minWidth: 100 }}>
                          {isCredit ? (
                            <span className="font-orbitron font-bold" style={{ fontSize: 13, color: '#00FFA3' }}>
                              +{entry.amount.toLocaleString('pt-BR')}
                            </span>
                          ) : (
                            <span className="font-rajdhani text-white/25" style={{ fontSize: 14 }}>—</span>
                          )}
                        </td>

                        {/* SAÍDA */}
                        <td className="px-5 py-3 text-right" style={{ minWidth: 100 }}>
                          {!isCredit ? (
                            <span className="font-orbitron font-bold" style={{ fontSize: 13, color: '#FF5555' }}>
                              -{entry.amount.toLocaleString('pt-BR')}
                            </span>
                          ) : (
                            <span className="font-rajdhani text-white/25" style={{ fontSize: 14 }}>—</span>
                          )}
                        </td>

                        {/* SALDO */}
                        <td className="px-5 py-3 text-right" style={{ minWidth: 110 }}>
                          <span className="font-orbitron font-bold text-white" style={{ fontSize: 13 }}>
                            {entry.saldo.toLocaleString('pt-BR')}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {!loading && filteredWithSaldo.length > 0 && (
        <div className="flex-shrink-0 px-6 py-2 flex items-center gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="font-rajdhani text-white/20 tracking-widest" style={{ fontSize: 10 }}>
            {filteredWithSaldo.length} movimentaç{filteredWithSaldo.length === 1 ? 'ão' : 'ões'}
          </span>
        </div>
      )}
    </div>
  );
}
