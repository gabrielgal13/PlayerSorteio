'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

const PRESETS = [
  { label: 'Hoje',    days: 0 },
  { label: '3 dias',  days: 3 },
  { label: '7 dias',  days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
  { label: '365 dias',days: 365 },
];

function getPresetRange(days: number): { from: Date; to: Date } {
  const now = new Date();
  const to = endOfDay(now);
  const from = days === 0
    ? startOfDay(now)
    : startOfDay(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  return { from, to };
}

export default function HistoryPanel() {
  const { history, clearHistory, currentUser } = useStore();
  const myHistory = history.filter(r => r.streamer === currentUser?.username);

  const [activePreset, setActivePreset] = useState<number>(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [fromDate, setFromDate] = useState(() => toInputDate(getPresetRange(0).from));
  const [toDate, setToDate]   = useState(() => toInputDate(getPresetRange(0).to));

  const exportPDF = (filtered: typeof myHistory, from: string, to: string) => {
    const uniqueWinners = new Set(filtered.map(r => r.winner.name)).size;

    const prizeMap = new Map<string, number>();
    for (const r of filtered) {
      prizeMap.set(r.prize.name, (prizeMap.get(r.prize.name) ?? 0) + 1);
    }
    const prizeRows = [...prizeMap.entries()].sort((a, b) => b[1] - a[1]);

    const formatDate = (d: string) => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório de Sorteios</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;padding:40px 50px}
  h1{font-size:22px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:#050816;margin-bottom:4px}
  .subtitle{font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px}
  .period{font-size:12px;color:#444;margin-bottom:24px;border-left:3px solid #00c8ff;padding-left:10px}
  .stats{display:flex;gap:16px;margin-bottom:28px}
  .stat{flex:1;border:1px solid #e0e0e0;border-radius:10px;padding:14px 18px;text-align:center}
  .stat-value{font-size:28px;font-weight:800;color:#050816}
  .stat-label{font-size:10px;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px}
  h2{font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#333;margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:6px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:8px 12px;background:#f5f5f5;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:10px;color:#555}
  td{padding:9px 12px;border-bottom:1px solid #f0f0f0;color:#222}
  tr:last-child td{border-bottom:none}
  .count{font-weight:800;color:#050816;text-align:right}
  .rank{color:#aaa;font-size:11px;text-align:center;width:32px}
  .winner-list{font-size:11px;color:#444;line-height:1.8}
  .footer{margin-top:32px;font-size:10px;color:#bbb;text-align:center;letter-spacing:1px}
  @media print{body{padding:20px 30px}}
</style>
</head>
<body>
<h1>Relatório de Sorteios</h1>
<div class="subtitle">PlayerSKIN — ${currentUser?.displayName ?? currentUser?.username ?? ''}</div>
<div class="period">Período: <strong>${formatDate(from)}</strong> até <strong>${formatDate(to)}</strong></div>

<div class="stats">
  <div class="stat">
    <div class="stat-value">${filtered.length}</div>
    <div class="stat-label">Sorteios realizados</div>
  </div>
  <div class="stat">
    <div class="stat-value">${uniqueWinners}</div>
    <div class="stat-label">Ganhadores únicos</div>
  </div>
  <div class="stat">
    <div class="stat-value">${prizeRows.length}</div>
    <div class="stat-label">Prêmios diferentes</div>
  </div>
</div>

<h2>Prêmios sorteados por item</h2>
<table>
  <thead><tr><th class="rank">#</th><th>Prêmio</th><th style="text-align:right">Qtd. sorteada</th></tr></thead>
  <tbody>
    ${prizeRows.map(([name, count], i) => `
    <tr>
      <td class="rank">${i + 1}</td>
      <td>${name}</td>
      <td class="count">${count}x</td>
    </tr>`).join('')}
  </tbody>
</table>

${filtered.length > 0 ? `
<br/>
<h2>Ganhadores do período</h2>
<table>
  <thead><tr><th>Ganhador</th><th>Prêmio</th><th>Data</th><th style="text-align:center">Confirmado</th></tr></thead>
  <tbody>
    ${filtered.map(r => `
    <tr>
      <td>${r.winner.name}</td>
      <td>${r.prize.name}</td>
      <td>${new Date(r.timestamp).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
      <td style="text-align:center">${r.confirmed ? '✓' : '—'}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

<div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')} · PlayerSKIN Raffle Platform</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const applyPreset = (days: number) => {
    const { from, to } = getPresetRange(days);
    setFromDate(toInputDate(from));
    setToDate(toInputDate(to));
    setActivePreset(days);
    setShowDropdown(false);
  };

  const handleFromChange = (val: string) => {
    setFromDate(val);
    setActivePreset(-1);
  };

  const handleToChange = (val: string) => {
    setToDate(val);
    setActivePreset(-1);
  };

  const filtered = myHistory.filter(r => {
    const ts = r.timestamp;
    const from = fromDate ? startOfDay(new Date(fromDate + 'T00:00:00')).getTime() : 0;
    const to   = toDate   ? endOfDay(new Date(toDate + 'T00:00:00')).getTime()     : Infinity;
    return ts >= from && ts <= to;
  });

  const activeLabel = PRESETS.find(p => p.days === activePreset)?.label ?? 'Personalizado';

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '12px',
    fontFamily: 'inherit',
    padding: '6px 10px',
    outline: 'none',
    colorScheme: 'dark',
    cursor: 'pointer',
  };

  return (
    <div className="space-y-4">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Preset dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-rajdhani font-bold text-xs tracking-widest transition-all"
            style={{
              background: 'rgba(0,229,255,0.08)',
              border: '1px solid rgba(0,229,255,0.2)',
              color: '#00E5FF',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
            </svg>
            {activeLabel}
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"
              style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(6,9,24,0.98)',
                  border: '1px solid rgba(0,229,255,0.18)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  minWidth: '130px',
                }}
              >
                {PRESETS.map(p => (
                  <button
                    key={p.days}
                    onClick={() => applyPreset(p.days)}
                    className="w-full text-left px-4 py-2 font-rajdhani text-xs tracking-widest transition-all"
                    style={{
                      color: activePreset === p.days ? '#00E5FF' : 'rgba(255,255,255,0.5)',
                      background: activePreset === p.days ? 'rgba(0,229,255,0.08)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = activePreset === p.days ? 'rgba(0,229,255,0.08)' : 'transparent')}
                  >
                    {p.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Calendar inputs */}
        <div className="flex items-center gap-2">
          <span className="font-rajdhani text-xs text-white/25 tracking-widest">DE</span>
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={e => handleFromChange(e.target.value)}
            style={inputStyle}
          />
          <span className="font-rajdhani text-xs text-white/25 tracking-widest">ATÉ</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={e => handleToChange(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Spacer + count + actions */}
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-purple" />
            <span className="font-rajdhani text-xs text-white/40 tracking-widest uppercase">
              {filtered.length} sorteio{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
          {filtered.length > 0 && (
            <button
              onClick={() => exportPDF(filtered, fromDate, toDate)}
              className="flex items-center gap-1.5 font-rajdhani font-bold text-xs tracking-widest px-3 py-1.5 rounded-xl transition-all"
              style={{
                background: 'rgba(0,255,163,0.08)',
                border: '1px solid rgba(0,255,163,0.25)',
                color: '#00FFA3',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,255,163,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,255,163,0.08)')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              PDF
            </button>
          )}
          {myHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="font-rajdhani text-xs text-white/25 hover:text-red-400 transition-colors tracking-widest px-2 py-1 rounded hover:bg-red-500/10"
            >
              LIMPAR
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <AnimatePresence>
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-4xl mb-3">📋</div>
            <p className="font-rajdhani text-white/25 text-sm tracking-widest">
              {history.length === 0 ? 'Nenhum sorteio realizado' : 'Nenhum sorteio neste período'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {filtered.map((result, i) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
                className="relative rounded-xl px-4 py-3 overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {/* Accent line */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl"
                  style={{ background: result.confirmed ? '#00FFA3' : '#00E5FF' }} />

                <div className="flex items-center gap-4">
                  {/* Prize image */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{ background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.15)' }}>
                    {result.prize.imageUrl ? (
                      <img src={result.prize.imageUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xl">🏆</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-rajdhani font-bold text-sm text-white truncate">{result.winner.name}</p>
                      {result.confirmed && (
                        <span className="text-xs font-orbitron px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(0,255,163,0.15)', color: '#00FFA3', fontSize: '9px' }}>
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="font-rajdhani text-xs text-neon-gold/70 truncate">{result.prize.name}</p>
                    <p className="font-rajdhani text-xs text-white/25">{formatTime(result.timestamp)}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
