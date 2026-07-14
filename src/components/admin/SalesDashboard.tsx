'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Sale {
  id: string;
  orderNumber: string;
  date: string;
  contactName: string;
  cpfCnpj: string;
  email: string | null;
  city: string | null;
  state: string | null;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  shipping: number;
  status: string;
  affiliateUsername: string | null;
  trackingCode: string | null;
  observations: string | null;
  source: string | null;
  createdAt: string;
}

/* ── Paleta ── */
const C = {
  blue: '#3B82F6',
  green: '#22C55E',
  purple: '#A855F7',
  orange: '#F59E0B',
  cyan: '#06B6D4',
  red: '#EF4444',
};
const CARD_BG = 'rgba(255,255,255,0.025)';
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)';
const OPT: React.CSSProperties = { background: '#0d1f3d', color: 'rgba(255,255,255,0.9)' }; // fundo azul das opções do dropdown
const INP: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none', width: '100%' };

/* ── Helpers ── */
const DAY = 86400000;
function parseBR(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec((s || '').trim());
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}
function saleDate(s: Sale): Date {
  return parseBR(s.date) || new Date(s.createdAt);
}
function isExpense(s: Sale): boolean {
  return s.status === 'Despesa Afiliado' || s.status === 'Despesa';
}
function brl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function money(n: number): string {
  return `${n < 0 ? '- ' : ''}R$ ${brl(Math.abs(n))}`;
}
function cleanProduct(d: string): string {
  // Remove o prefixo "Venda online de peças de <tipo> - " e mantém só o resto do nome
  if (/^venda online de pe[çc]as/i.test(d.trim())) {
    const m = /\s[-–]\s/.exec(d);
    if (m) return d.slice(m.index + m[0].length).trim();
  }
  return d;
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function pct(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  const v = ((cur - prev) / Math.abs(prev)) * 100;
  return isFinite(v) ? v : 0;
}
interface Metrics { count: number; qty: number; net: number; ticket: number; gross: number; expense: number; }
function metrics(arr: Sale[]): Metrics {
  const count = arr.length;
  const qty = arr.reduce((a, s) => a + s.quantity, 0);
  const gross = arr.filter(s => !isExpense(s)).reduce((a, s) => a + s.totalPrice, 0);
  const expense = arr.filter(isExpense).reduce((a, s) => a + s.totalPrice, 0);
  const net = gross - expense;
  const ticket = count ? net / count : 0;
  return { count, qty, net, ticket, gross, expense };
}

// Lucro PlayerSkins: 50% das vendas de afiliado (só receita) + 100% das demais receitas. Despesas não entram.
function lucroPlayerSkins(arr: Sale[], affByName: Map<string, number>): number {
  return arr.reduce((sum, s) => {
    if (isExpense(s)) return sum;
    const pct = affByName.get(s.contactName.trim().toLowerCase());
    return sum + (pct !== undefined ? s.totalPrice * 0.5 : s.totalPrice);
  }, 0);
}

/* ── Ícones ── */
function IBag({ c }: { c: string }) { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>); }
function IBox({ c }: { c: string }) { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96L12 12.01l8.73-5.05" /><path d="M12 22.08V12" /></svg>); }
function IDollar({ c }: { c: string }) { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>); }
function ITrend({ c }: { c: string }) { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>); }
function ICloud({ c }: { c: string }) { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16l-4-4-4 4" /><path d="M12 12v9" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>); }
function IUsers({ c }: { c: string }) { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>); }
function ICal({ c }: { c: string }) { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>); }

/* ── Gráfico de área (SVG) ── */
function AreaChart({ series }: { series: { label: string; qty: number; rev: number }[] }) {
  const W = 720, H = 200, padT = 14, padB = 26, padL = 8, padR = 8;
  const cw = W - padL - padR, chH = H - padT - padB;
  const n = series.length;
  const maxRev = Math.max(1, ...series.map(d => d.rev));
  const maxQty = Math.max(1, ...series.map(d => d.qty));
  const X = (i: number) => n <= 1 ? padL + cw / 2 : padL + (i / (n - 1)) * cw;
  const Yr = (v: number) => padT + chH - (v / maxRev) * chH;
  const Yq = (v: number) => padT + chH - (v / maxQty) * chH;
  const revLine = series.map((d, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)},${Yr(d.rev).toFixed(1)}`).join(' ');
  const revArea = `${revLine} L ${X(n - 1).toFixed(1)},${(padT + chH).toFixed(1)} L ${X(0).toFixed(1)},${(padT + chH).toFixed(1)} Z`;
  const qtyLine = series.map((d, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)},${Yq(d.qty).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="revgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.32" />
          <stop offset="100%" stopColor={C.cyan} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
        <line key={i} x1={padL} x2={W - padR} y1={padT + chH * g} y2={padT + chH * g} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <path d={revArea} fill="url(#revgrad)" />
      <path d={revLine} fill="none" stroke={C.cyan} strokeWidth="2" />
      <path d={qtyLine} fill="none" stroke={C.blue} strokeWidth="2" />
      {series.map((d, i) => (<circle key={'q' + i} cx={X(i)} cy={Yq(d.qty)} r="3" fill={C.blue} />))}
      {series.map((d, i) => (
        <text key={'t' + i} x={X(i)} y={H - 7} fill="rgba(255,255,255,0.4)" fontSize="11" textAnchor="middle">{d.label}</text>
      ))}
    </svg>
  );
}

/* ── Card de estatística ── */
function StatCard({ icon, color, label, value, cur, prev }: {
  icon: React.ReactNode; color: string; label: string; value: string; cur: number; prev: number;
}) {
  const p = pct(cur, prev);
  const up = p >= 0;
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: CARD_BG, border: CARD_BORDER }}>
      <div className="flex items-start justify-between">
        <span className="font-rajdhani text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, background: `${color}22` }}>{icon}</div>
      </div>
      <span className="font-orbitron font-bold text-white" style={{ fontSize: 22 }}>{value}</span>
      <span className="font-rajdhani text-xs flex items-center gap-1" style={{ color: up ? C.green : C.red }}>
        {up ? '▲' : '▼'} {Math.abs(p).toFixed(0)}%
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>vs período anterior</span>
      </span>
    </div>
  );
}

/* ── Mini valor (quebra de lucro do afiliado) ── */
function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-end" style={{ lineHeight: 1.15 }}>
      <span style={{ fontSize: 8, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>R$ {value}</span>
    </div>
  );
}

interface Affiliate { name: string; display: string; username: string; pct: number; }

interface Seller { name: string; pct: number; ganhou: number; gastou: number; camisas: number; saldo: number; count: number; tx: Sale[]; }

/* ── Linha de vendedor (ranking de saldo) ── */
function SellerRow({ s, rank, firstColor, onDetails }: { s: Seller; rank: number; firstColor: string; onDetails: () => void }) {
  const pos = s.saldo >= 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-orbitron font-bold flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 24, height: 24, fontSize: 11, background: 'rgba(255,255,255,0.06)', color: rank === 1 ? firstColor : 'rgba(255,255,255,0.6)' }}>
          {rank}
        </span>
        <span className="font-rajdhani text-sm font-semibold truncate flex-1" style={{ color: 'rgba(255,255,255,0.85)' }} title={s.name}>{s.name}</span>
        <span className="font-rajdhani text-sm font-bold flex-shrink-0" style={{ color: pos ? C.green : C.red }}>{money(s.saldo)}</span>
        <button onClick={onDetails} title="Ver transações" className="flex-shrink-0 transition" style={{ color: 'rgba(255,255,255,0.4)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </div>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 ml-9 font-rajdhani" style={{ fontSize: 11 }}>
        <span style={{ color: C.green }}>ganhou R$ {brl(s.ganhou)}</span>
        <span style={{ color: C.red }}>gastou R$ {brl(s.gastou)}</span>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>👕 {s.camisas}</span>
      </div>
    </div>
  );
}

export default function SalesDashboard({ showUpload = true, ignoreAffiliateExpenses = false, scope = 'vendas' }: { showUpload?: boolean; ignoreAffiliateExpenses?: boolean; scope?: string } = {}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [chartDays, setChartDays] = useState(7);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>('month'); // 'today' | '7' | '15' | '30' | '60' | '90' | '180' | '365' | 'month'
  const [month, setMonth] = useState<string>(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [manualOpen, setManualOpen] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [manualForm, setManualForm] = useState<{ type: 'receita' | 'despesa'; description: string; value: string; date: string; observations: string }>(
    { type: 'receita', description: '', value: '', date: isoDay(new Date()), observations: '' },
  );
  const [noteModal, setNoteModal] = useState<{ saleId: string; affiliateUsername: string | null; note: string } | null>(null);
  const [detailModal, setDetailModal] = useState<Seller | null>(null);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({ date: '', contactName: '', productDescription: '', quantity: '1', unitPrice: '0', status: 'Em aberto', observations: '' });

  useEffect(() => { fetchSales(); fetchAffiliates(); }, []);

  async function fetchAffiliates() {
    try {
      const res = await fetch('/api/admin/affiliate-proposals');
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      // Afiliados ativos = propostas aceitas. "Felipe Paiva (ShadowGanjaK)" -> nome + username.
      const list: Affiliate[] = data
        .filter((p: { status?: string }) => p.status === 'accepted')
        .map((p: { streamerName?: string; profitPct?: number }) => {
          const raw = String(p.streamerName || '');
          const mm = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(raw);
          const display = (mm ? mm[1] : raw).trim();
          const username = mm ? mm[2].trim() : '';
          return { name: display.toLowerCase(), display, username, pct: Number(p.profitPct) || 0 };
        })
        .filter((a: Affiliate) => a.name);
      setAffiliates(list);
    } catch { /* silencioso */ }
  }

  async function fetchSales() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sales');
      if (!res.ok) throw new Error('Erro ao carregar vendas');
      setSales(await res.json());
    } catch (e) {
      setBanner({ type: 'err', msg: e instanceof Error ? e.message : 'Erro desconhecido' });
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setBanner(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/sales/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) { setBanner({ type: 'err', msg: result.error || 'Erro no upload' }); return; }
      setBanner({ type: 'ok', msg: `${result.inserted} vendas adicionadas, ${result.duplicates} duplicadas ignoradas` });
      await fetchSales();
    } catch (e) {
      setBanner({ type: 'err', msg: e instanceof Error ? e.message : 'Erro no upload' });
    } finally {
      setUploading(false);
    }
  }

  async function clearAllSales() {
    if (!confirm('Tem certeza que deseja limpar os dados DESTE dashboard? Esta ação não pode ser desfeita!')) return;
    try {
      const res = await fetch(`/api/admin/sales/clear?scope=${scope}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao limpar vendas');
      const result = await res.json();
      setBanner({ type: 'ok', msg: `${result.deleted} vendas deletadas` });
      await fetchSales();
    } catch (e) {
      setBanner({ type: 'err', msg: e instanceof Error ? e.message : 'Erro ao limpar' });
    }
  }

  async function patchSale(saleId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/sales/${saleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Erro ao atualizar');
  }

  async function updateSaleStatus(saleId: string, newStatus: string) {
    setEditingId(null);
    try {
      // Despesa Afiliado: busca o afiliado e abre o modal pedindo a observação da despesa
      if (newStatus === 'Despesa Afiliado') {
        const sale = sales.find(s => s.id === saleId);
        let affiliateUsername: string | null = null;
        if (sale) {
          const res = await fetch(`/api/admin/find-affiliate?name=${encodeURIComponent(sale.contactName)}`);
          if (res.ok) affiliateUsername = (await res.json()).username;
          else setBanner({ type: 'err', msg: `Afiliado "${sale.contactName}" não encontrado. Cadastre o NOME REAL do streamer.` });
        }
        setNoteModal({ saleId, affiliateUsername, note: sale?.observations || '' });
        return;
      }
      await patchSale(saleId, { status: newStatus });
      await fetchSales();
    } catch (e) {
      setBanner({ type: 'err', msg: e instanceof Error ? e.message : 'Erro ao atualizar' });
    }
  }

  async function confirmExpenseNote() {
    if (!noteModal) return;
    try {
      await patchSale(noteModal.saleId, {
        status: 'Despesa Afiliado',
        affiliateUsername: noteModal.affiliateUsername,
        observations: noteModal.note,
      });
      setNoteModal(null);
      await fetchSales();
    } catch (e) {
      setBanner({ type: 'err', msg: e instanceof Error ? e.message : 'Erro ao salvar observação' });
    }
  }

  function openEdit(sale: Sale) {
    setEditSale(sale);
    setEditForm({
      date: sale.date,
      contactName: sale.contactName,
      productDescription: sale.productDescription,
      quantity: String(sale.quantity),
      unitPrice: String(sale.unitPrice),
      status: sale.status,
      observations: sale.observations || '',
    });
  }

  async function saveEdit() {
    if (!editSale) return;
    const qty = parseInt(editForm.quantity) || 1;
    const unit = parseFloat(editForm.unitPrice.replace(',', '.')) || 0;
    try {
      const body: Record<string, unknown> = {
        date: editForm.date,
        contactName: editForm.contactName,
        productDescription: editForm.productDescription,
        quantity: qty,
        unitPrice: unit,
        totalPrice: unit * qty,
        status: editForm.status,
        observations: editForm.observations,
      };
      // Se virou Despesa Afiliado, tenta achar o afiliado pelo nome do cliente
      if (editForm.status === 'Despesa Afiliado') {
        const res = await fetch(`/api/admin/find-affiliate?name=${encodeURIComponent(editForm.contactName)}`);
        body.affiliateUsername = res.ok ? (await res.json()).username : null;
      }
      await patchSale(editSale.id, body);
      setEditSale(null);
      await fetchSales();
    } catch (e) {
      setBanner({ type: 'err', msg: e instanceof Error ? e.message : 'Erro ao salvar' });
    }
  }

  async function submitManual() {
    if (!manualForm.description.trim()) { setBanner({ type: 'err', msg: 'Informe a descrição.' }); return; }
    const val = parseFloat(manualForm.value.replace(',', '.'));
    if (!isFinite(val) || val <= 0) { setBanner({ type: 'err', msg: 'Informe um valor válido.' }); return; }
    setSavingManual(true);
    try {
      const [y, mo, d] = manualForm.date.split('-');
      const brDate = (y && mo && d) ? `${d}/${mo}/${y}` : new Date().toLocaleDateString('pt-BR');
      const res = await fetch('/api/admin/sales/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: manualForm.type, description: manualForm.description.trim(), value: val, date: brDate, observations: manualForm.observations.trim(), source: scope }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao lançar');
      setManualOpen(false);
      setManualForm({ type: 'receita', description: '', value: '', date: isoDay(new Date()), observations: '' });
      setBanner({ type: 'ok', msg: 'Lançamento registrado.' });
      await fetchSales();
    } catch (e) {
      setBanner({ type: 'err', msg: e instanceof Error ? e.message : 'Erro ao lançar' });
    } finally {
      setSavingManual(false);
    }
  }

  /* ── Cálculos ── */
  const { startMs, endMs } = useMemo(() => {
    if (preset === 'month') {
      const [y, mo] = month.split('-').map(Number);
      return {
        startMs: new Date(y, mo - 1, 1, 0, 0, 0, 0).getTime(),
        endMs: new Date(y, mo, 0, 23, 59, 59, 999).getTime(), // dia 0 do mês seguinte = último dia do mês
      };
    }
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = new Date();
    if (preset === 'today') start.setHours(0, 0, 0, 0);
    else { start.setDate(start.getDate() - (Number(preset) - 1)); start.setHours(0, 0, 0, 0); }
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [preset, month]);

  // Filtra: ignora "Despesa Afiliado" (Dashboard Vendas) e lançamentos manuais de OUTRO dashboard
  const baseSales = useMemo(
    () => sales.filter(s => {
      if (ignoreAffiliateExpenses && s.status === 'Despesa Afiliado') return false;
      if (s.source && s.source !== scope) return false; // lançamento manual de outro dashboard
      return true;
    }),
    [sales, ignoreAffiliateExpenses, scope],
  );
  const currentSales = useMemo(
    () => baseSales.filter(s => { const t = saleDate(s).getTime(); return t >= startMs && t <= endMs; }),
    [baseSales, startMs, endMs],
  );
  const prevSales = useMemo(
    () => baseSales.filter(s => { const t = saleDate(s).getTime(); return t >= startMs - 30 * DAY && t <= endMs - 30 * DAY; }),
    [baseSales, startMs, endMs],
  );

  const m = useMemo(() => metrics(currentSales), [currentSales]);
  const pm = useMemo(() => metrics(prevSales), [prevSales]);

  // Mapa: nome do afiliado (lowercase) -> % de lucro do streamer (do painel de afiliados)
  const affByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of affiliates) if (a.name && !map.has(a.name)) map.set(a.name, a.pct);
    return map;
  }, [affiliates]);

  const lucroPS = useMemo(() => lucroPlayerSkins(currentSales, affByName), [currentSales, affByName]);
  const prevLucroPS = useMemo(() => lucroPlayerSkins(prevSales, affByName), [prevSales, affByName]);

  const uniqueClients = useMemo(
    () => new Set(currentSales.map(s => s.contactName.trim().toLowerCase())).size,
    [currentSales],
  );
  const prevUniqueClients = useMemo(
    () => new Set(prevSales.map(s => s.contactName.trim().toLowerCase())).size,
    [prevSales],
  );

  // Saldo por afiliado: comissão (% só em vendas normais) − despesas (100% do valor sai do saldo)
  const sellers = useMemo<Seller[]>(() => {
    return affiliates
      .map(a => {
        const theirs = currentSales.filter(s =>
          s.contactName.trim().toLowerCase() === a.name ||
          (!!a.username && (s.affiliateUsername || '').toLowerCase() === a.username.toLowerCase())
        );
        const nonExp = theirs.filter(s => !isExpense(s));
        const exp = theirs.filter(isExpense);
        const ganhou = nonExp.reduce((x, s) => x + s.totalPrice * a.pct / 100, 0);
        const gastou = exp.reduce((x, s) => x + s.totalPrice, 0); // despesa = 100% do valor
        const camisas = nonExp.reduce((x, s) => x + s.quantity, 0);
        return { name: a.display, pct: a.pct, ganhou, gastou, camisas, saldo: ganhou - gastou, count: theirs.length, tx: theirs };
      })
      .filter(s => s.count > 0);
  }, [affiliates, currentSales]);
  // Cada vendedor entra só em UM ranking: saldo >= 0 -> Top, saldo < 0 -> Piores
  const topSellers = useMemo(() => sellers.filter(s => s.saldo >= 0).sort((a, b) => b.saldo - a.saldo).slice(0, 6), [sellers]);
  const worstSellers = useMemo(() => sellers.filter(s => s.saldo < 0).sort((a, b) => a.saldo - b.saldo).slice(0, 6), [sellers]);

  const chartSeries = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: chartDays }, (_, k) => {
      const d = new Date(today); d.setDate(today.getDate() - (chartDays - 1 - k));
      return { t: d.getTime(), label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, qty: 0, rev: 0 };
    });
    for (const s of baseSales) {
      const sd = saleDate(s); sd.setHours(0, 0, 0, 0);
      const b = buckets.find(x => x.t === sd.getTime());
      if (b) { b.qty += s.quantity; if (!isExpense(s)) b.rev += s.totalPrice; }
    }
    return buckets;
  }, [baseSales, chartDays]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; rev: number }>();
    for (const s of currentSales) {
      const cur = map.get(s.productDescription) || { qty: 0, rev: 0 };
      cur.qty += s.quantity;
      if (!isExpense(s)) cur.rev += s.totalPrice;
      map.set(s.productDescription, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name: cleanProduct(name), qty: v.qty, rev: v.rev }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);
  }, [currentSales]);
  const maxProdRev = Math.max(1, ...topProducts.map(p => p.rev));

  const tableSales = useMemo(() => {
    const t = searchTerm.toLowerCase();
    const f = currentSales.filter(s => !t ||
      s.orderNumber.toLowerCase().includes(t) ||
      s.contactName.toLowerCase().includes(t) ||
      s.productDescription.toLowerCase().includes(t));
    return [...f].sort((a, b) => saleDate(b).getTime() - saleDate(a).getTime());
  }, [currentSales, searchTerm]);
  const visibleSales = showAll ? tableSales : tableSales.slice(0, 6);

  function statusBadge(status: string) {
    if (status === 'Finalizado' || status === 'Receita') return { bg: 'rgba(34,197,94,0.15)', color: C.green };
    if (status === 'Despesa Afiliado' || status === 'Despesa') return { bg: 'rgba(239,68,68,0.18)', color: C.red };
    return { bg: 'rgba(245,158,11,0.15)', color: C.orange };
  }

  const dateInputStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.8)', colorScheme: 'dark', background: 'transparent' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-5">
      {/* Banner */}
      {banner && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{
          background: banner.type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${banner.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          <span className="font-rajdhani text-sm" style={{ color: banner.type === 'ok' ? C.green : C.red }}>
            {banner.type === 'ok' ? '✅ ' : '⚠️ '}{banner.msg}
          </span>
          <button onClick={() => setBanner(null)} className="text-sm opacity-60 hover:opacity-100" style={{ color: 'rgba(255,255,255,0.7)' }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-orbitron font-bold text-white flex items-center gap-2" style={{ fontSize: 22 }}>Olá, Admin! <span>👋</span></h2>
          <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Bem-vindo de volta ao seu painel de vendas.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setManualOpen(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 font-orbitron text-xs font-bold tracking-wide transition hover:brightness-125"
            style={{ background: 'rgba(59,130,246,0.14)', border: `1px solid ${C.blue}55`, color: C.blue }}>
            + Lançar despesa/receita
          </button>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: CARD_BG, border: CARD_BORDER }}>
            <ICal c="rgba(255,255,255,0.5)" />
            <select value={preset} onChange={e => setPreset(e.target.value)} className="text-sm outline-none font-rajdhani" style={dateInputStyle}>
              <option value="today" style={OPT}>Hoje</option>
              <option value="7" style={OPT}>Últimos 7 dias</option>
              <option value="15" style={OPT}>Últimos 15 dias</option>
              <option value="30" style={OPT}>Últimos 30 dias</option>
              <option value="60" style={OPT}>Últimos 60 dias</option>
              <option value="90" style={OPT}>Últimos 90 dias</option>
              <option value="180" style={OPT}>Últimos 180 dias</option>
              <option value="365" style={OPT}>Últimos 365 dias</option>
              <option value="month" style={OPT}>Por mês</option>
            </select>
            {preset === 'month' && (
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="text-sm outline-none font-rajdhani" style={dateInputStyle} />
            )}
          </div>
        </div>
      </div>

      {/* Stat cards (+ Upload) */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${scope === 'playerskins' ? 'xl:grid-cols-3' : 'xl:grid-cols-5'} gap-4`}>
        <StatCard icon={<IBag c={C.blue} />} color={C.blue} label="Total de Vendas" value={String(m.count)} cur={m.count} prev={pm.count} />
        {scope !== 'playerskins' && (
          <StatCard icon={<IBox c={C.green} />} color={C.green} label="Quantidade Total" value={String(m.qty)} cur={m.qty} prev={pm.qty} />
        )}
        <StatCard icon={<IDollar c={C.purple} />} color={C.purple} label="Receita Total" value={money(m.net)} cur={m.net} prev={pm.net} />
        {scope !== 'playerskins' && (
          <StatCard icon={<ITrend c={C.orange} />} color={C.orange} label="Ticket Médio" value={money(m.ticket)} cur={m.ticket} prev={pm.ticket} />
        )}
        {scope === 'playerskins' && (
          <StatCard icon={<IDollar c={C.cyan} />} color={C.cyan} label="Lucro PlayerSkins" value={money(lucroPS)} cur={lucroPS} prev={prevLucroPS} />
        )}
        {showUpload && (
          <label className="rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition hover:brightness-125"
            style={{ background: `${C.cyan}14`, border: `1px solid ${C.cyan}55` }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}>
            <input type="file" accept=".csv" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <ICloud c={C.cyan} />
            <span className="font-orbitron text-xs font-bold tracking-wide text-center" style={{ color: C.cyan }}>
              {uploading ? 'Processando...' : 'Upload de Vendas'}
            </span>
          </label>
        )}
      </div>

      {/* Evolução + Top Produtos (oculto no Dashboard PlayerSkins) */}
      {scope !== 'playerskins' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Evolução de Vendas */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: CARD_BG, border: CARD_BORDER }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-orbitron font-bold text-white text-sm tracking-wide">Evolução de Vendas</h3>
            <select value={chartDays} onChange={e => setChartDays(Number(e.target.value))}
              className="rounded-lg text-xs font-rajdhani outline-none px-2 py-1"
              style={{ background: 'rgba(255,255,255,0.05)', border: CARD_BORDER, color: 'rgba(255,255,255,0.7)', colorScheme: 'dark' }}>
              <option value={7} style={OPT}>Últimos 7 dias</option>
              <option value={14} style={OPT}>Últimos 14 dias</option>
              <option value={30} style={OPT}>Últimos 30 dias</option>
            </select>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <span className="flex items-center gap-1.5 font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <span style={{ width: 10, height: 3, background: C.blue, borderRadius: 2 }} /> Quantidade de Vendas
            </span>
            <span className="flex items-center gap-1.5 font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <span style={{ width: 10, height: 3, background: C.cyan, borderRadius: 2 }} /> Receita (R$)
            </span>
          </div>
          <AreaChart series={chartSeries} />
        </div>

        {/* Top Produtos */}
        <div className="rounded-2xl p-5" style={{ background: CARD_BG, border: CARD_BORDER }}>
          <h3 className="font-orbitron font-bold text-white text-sm tracking-wide mb-4">Top Produtos</h3>
          {topProducts.length === 0 ? (
            <div className="py-6 text-center font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Sem dados</div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="font-orbitron font-bold flex items-center justify-center rounded-lg flex-shrink-0"
                    style={{ width: 24, height: 24, fontSize: 11, background: 'rgba(255,255,255,0.06)', color: i === 0 ? C.orange : 'rgba(255,255,255,0.6)' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-rajdhani text-sm truncate" style={{ color: 'rgba(255,255,255,0.8)' }} title={p.name}>{p.name}</span>
                      <span className="font-rajdhani text-xs font-semibold flex-shrink-0" style={{ color: C.cyan }}>R$ {brl(p.rev)}</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ width: `${(p.rev / maxProdRev) * 100}%`, height: '100%', background: C.cyan, borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Últimas Vendas + Top Vendedores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Últimas Vendas */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: CARD_BG, border: CARD_BORDER }}>
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="font-orbitron font-bold text-white text-sm tracking-wide flex-shrink-0">Últimas Vendas</h3>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="rounded-lg text-xs font-rajdhani outline-none px-3 py-1.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: CARD_BORDER, color: 'rgba(255,255,255,0.8)', width: 140 }} />
              {sales.length > 0 && (
                <button onClick={clearAllSales} className="font-rajdhani text-xs transition hover:opacity-100 opacity-60" style={{ color: C.red }}>
                  Limpar tudo
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-10 text-center font-rajdhani" style={{ color: 'rgba(255,255,255,0.4)' }}>Carregando...</div>
            ) : visibleSales.length === 0 ? (
              <div className="py-10 text-center font-rajdhani" style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhuma venda no período</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.4)' }} className="font-rajdhani text-xs">
                    <th className="px-2 py-2 text-left font-semibold">Data</th>
                    <th className="px-2 py-2 text-left font-semibold">Cliente</th>
                    <th className="px-2 py-2 text-left font-semibold">Produto</th>
                    <th className="px-2 py-2 text-center font-semibold">Qtd</th>
                    <th className="px-2 py-2 text-right font-semibold">Valor Unit.</th>
                    <th className="px-2 py-2 text-right font-semibold">Total</th>
                    <th className="px-2 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSales.map(sale => {
                    const b = statusBadge(sale.status);
                    const totalVal = isExpense(sale) ? -sale.totalPrice : sale.totalPrice;
                    return (
                      <tr key={sale.id} className="border-t font-rajdhani" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <td className="px-2 py-2.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{sale.date}</td>
                        <td className="px-2 py-2.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{sale.contactName}</td>
                        <td className="px-2 py-2.5 max-w-[220px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          <div className="truncate" title={sale.productDescription}>{cleanProduct(sale.productDescription)}</div>
                          {sale.observations && (
                            <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }} title={sale.observations}>📝 {sale.observations}</div>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center text-white">{sale.quantity}</td>
                        {(() => {
                          const pctAff = affByName.get(sale.contactName.trim().toLowerCase());
                          if (pctAff !== undefined && !isExpense(sale)) {
                            const lucro = sale.totalPrice;
                            return (
                              <td colSpan={2} className="px-2 py-2.5">
                                <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
                                  <Mini label="Lucro" value={brl(lucro)} color="#fff" />
                                  <Mini label={`Streamer ${pctAff}%`} value={brl(lucro * pctAff / 100)} color={C.green} />
                                  <Mini label="PlayerSkins 50%" value={brl(lucro * 0.5)} color={C.cyan} />
                                  <Mini label="Sorteio 10%" value={brl(lucro * 0.1)} color={C.purple} />
                                </div>
                              </td>
                            );
                          }
                          return (
                            <>
                              <td className="px-2 py-2.5 text-right" style={{ color: 'rgba(255,255,255,0.6)' }}>R$ {brl(sale.unitPrice)}</td>
                              <td className="px-2 py-2.5 text-right font-semibold" style={{ color: totalVal < 0 ? C.red : '#fff' }}>{money(totalVal)}</td>
                            </>
                          );
                        })()}
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            {editingId === sale.id ? (
                              <select autoFocus defaultValue={sale.status}
                                onChange={e => updateSaleStatus(sale.id, e.target.value)}
                                onBlur={() => setEditingId(null)}
                                className="rounded text-xs outline-none px-2 py-1"
                                style={{ background: '#0d1424', border: CARD_BORDER, color: '#fff', colorScheme: 'dark' }}>
                                <option value="Em aberto" style={OPT}>Em aberto</option>
                                <option value="Finalizado" style={OPT}>Finalizado</option>
                                <option value="Despesa Afiliado" style={OPT}>Despesa Afiliado</option>
                                <option value="Receita" style={OPT}>Receita</option>
                                <option value="Despesa" style={OPT}>Despesa</option>
                              </select>
                            ) : (
                              <button onClick={() => setEditingId(sale.id)}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition hover:opacity-80"
                                style={{ background: b.bg, color: b.color }}>
                                {sale.status}
                              </button>
                            )}
                            <button onClick={() => openEdit(sale)} title="Editar" className="flex-shrink-0 transition" style={{ color: 'rgba(255,255,255,0.4)' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {tableSales.length > 6 && (
            <div className="flex justify-center mt-4">
              <button onClick={() => setShowAll(v => !v)}
                className="font-orbitron text-xs font-bold tracking-widest px-4 py-2 rounded-lg transition"
                style={{ background: 'rgba(59,130,246,0.12)', border: `1px solid ${C.blue}55`, color: C.blue }}>
                {showAll ? 'Ver menos ▴' : 'Ver todas as vendas ▾'}
              </button>
            </div>
          )}
        </div>

        {/* Top + Piores Vendedores (por saldo) */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5" style={{ background: CARD_BG, border: CARD_BORDER }}>
            <h3 className="font-orbitron font-bold text-white text-sm tracking-wide mb-4">{scope === 'playerskins' ? 'Top Streamers' : 'Top Vendedores'}</h3>
            {topSellers.length === 0 ? (
              <div className="py-6 text-center font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum no positivo</div>
            ) : (
              <div className="flex flex-col gap-4">
                {topSellers.map((s, i) => <SellerRow key={i} s={s} rank={i + 1} firstColor={C.orange} onDetails={() => setDetailModal(s)} />)}
              </div>
            )}
          </div>
          <div className="rounded-2xl p-5" style={{ background: CARD_BG, border: CARD_BORDER }}>
            <h3 className="font-orbitron font-bold text-white text-sm tracking-wide mb-4">{scope === 'playerskins' ? 'Piores Streamers' : 'Piores Vendedores'}</h3>
            {worstSellers.length === 0 ? (
              <div className="py-6 text-center font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Nenhum no negativo</div>
            ) : (
              <div className="flex flex-col gap-4">
                {worstSellers.map((s, i) => <SellerRow key={i} s={s} rank={i + 1} firstColor={C.red} onDetails={() => setDetailModal(s)} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards inferiores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: CARD_BG, border: CARD_BORDER }}>
          <div className="rounded-xl flex items-center justify-center" style={{ width: 42, height: 42, background: `${C.blue}22` }}><IUsers c={C.blue} /></div>
          <div className="flex flex-col">
            <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Clientes Únicos</span>
            <span className="font-orbitron font-bold text-white" style={{ fontSize: 20 }}>{uniqueClients}</span>
            <span className="font-rajdhani text-xs flex items-center gap-1" style={{ color: pct(uniqueClients, prevUniqueClients) >= 0 ? C.green : C.red }}>
              {pct(uniqueClients, prevUniqueClients) >= 0 ? '▲' : '▼'} {Math.abs(pct(uniqueClients, prevUniqueClients)).toFixed(0)}% <span style={{ color: 'rgba(255,255,255,0.35)' }}>vs período anterior</span>
            </span>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: CARD_BG, border: CARD_BORDER }}>
          <div className="rounded-xl flex items-center justify-center" style={{ width: 42, height: 42, background: `${C.green}22` }}><IBox c={C.green} /></div>
          <div className="flex flex-col">
            <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Produtos Vendidos</span>
            <span className="font-orbitron font-bold text-white" style={{ fontSize: 20 }}>{m.qty}</span>
            <span className="font-rajdhani text-xs flex items-center gap-1" style={{ color: pct(m.qty, pm.qty) >= 0 ? C.green : C.red }}>
              {pct(m.qty, pm.qty) >= 0 ? '▲' : '▼'} {Math.abs(pct(m.qty, pm.qty)).toFixed(0)}% <span style={{ color: 'rgba(255,255,255,0.35)' }}>vs período anterior</span>
            </span>
          </div>
        </div>
      </div>

      {/* Modal: Lançamento manual de despesa/receita */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setManualOpen(false)}>
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
            className="rounded-2xl p-6 w-full max-w-md flex flex-col gap-4" style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="font-orbitron font-bold text-white text-base">Lançamento Manual</h3>
            <div className="flex gap-2">
              <button onClick={() => setManualForm(f => ({ ...f, type: 'receita' }))} className="flex-1 py-2 rounded-lg font-rajdhani text-sm font-semibold transition"
                style={{ background: manualForm.type === 'receita' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${manualForm.type === 'receita' ? C.green : 'rgba(255,255,255,0.1)'}`, color: manualForm.type === 'receita' ? C.green : 'rgba(255,255,255,0.5)' }}>
                Receita (+)
              </button>
              <button onClick={() => setManualForm(f => ({ ...f, type: 'despesa' }))} className="flex-1 py-2 rounded-lg font-rajdhani text-sm font-semibold transition"
                style={{ background: manualForm.type === 'despesa' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${manualForm.type === 'despesa' ? C.red : 'rgba(255,255,255,0.1)'}`, color: manualForm.type === 'despesa' ? C.red : 'rgba(255,255,255,0.5)' }}>
                Despesa (−)
              </button>
            </div>
            <input value={manualForm.description} onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descrição (ex: Investimento inicial)" className="font-rajdhani outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
            <div className="flex gap-2">
              <input value={manualForm.value} onChange={e => setManualForm(f => ({ ...f, value: e.target.value }))} inputMode="decimal"
                placeholder="Valor R$" className="font-rajdhani outline-none flex-1"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
              <input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
                className="font-rajdhani outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '10px 12px', fontSize: 14, colorScheme: 'dark' }} />
            </div>
            <textarea value={manualForm.observations} onChange={e => setManualForm(f => ({ ...f, observations: e.target.value }))}
              placeholder="Observação (opcional)" rows={2} className="font-rajdhani outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setManualOpen(false)} className="font-rajdhani text-sm px-4 py-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>Cancelar</button>
              <button onClick={submitManual} disabled={savingManual} className="font-orbitron text-xs font-bold tracking-wide px-5 py-2 rounded-lg"
                style={{ background: 'rgba(59,130,246,0.2)', border: `1px solid ${C.blue}`, color: C.blue, opacity: savingManual ? 0.5 : 1 }}>
                {savingManual ? 'SALVANDO...' : 'SALVAR'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Observação da despesa de afiliado */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setNoteModal(null)}>
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
            className="rounded-2xl p-6 w-full max-w-md flex flex-col gap-4" style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="font-orbitron font-bold text-white text-base">Observação da Despesa</h3>
            <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Sobre o que foi essa despesa de afiliado?</p>
            <div className="flex gap-2">
              {['Sorteio', 'Investimento inicial'].map(opt => (
                <button key={opt} onClick={() => setNoteModal(n => n && { ...n, note: opt })}
                  className="flex-1 py-2 rounded-lg font-rajdhani text-sm font-semibold transition"
                  style={{ background: noteModal.note === opt ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${noteModal.note === opt ? C.blue : 'rgba(255,255,255,0.1)'}`, color: noteModal.note === opt ? C.blue : 'rgba(255,255,255,0.55)' }}>
                  {opt}
                </button>
              ))}
            </div>
            <textarea value={noteModal.note} onChange={e => setNoteModal(n => n && { ...n, note: e.target.value })}
              placeholder="Descreva a despesa..." rows={2} autoFocus className="font-rajdhani outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', borderRadius: 10, padding: '10px 12px', fontSize: 14 }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNoteModal(null)} className="font-rajdhani text-sm px-4 py-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>Cancelar</button>
              <button onClick={confirmExpenseNote} className="font-orbitron text-xs font-bold tracking-wide px-5 py-2 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.18)', border: `1px solid ${C.red}`, color: C.red }}>
                CONFIRMAR DESPESA
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Transações do vendedor */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setDetailModal(null)}>
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
            className="rounded-2xl p-6 w-full max-w-lg flex flex-col gap-4" style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron font-bold text-white text-base">Transações — {detailModal.name}</h3>
              <button onClick={() => setDetailModal(null)} className="opacity-60 hover:opacity-100" style={{ color: 'rgba(255,255,255,0.7)' }}>✕</button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-rajdhani text-sm">
              <span style={{ color: C.green }}>Ganhou R$ {brl(detailModal.ganhou)}</span>
              <span style={{ color: C.red }}>Gastou R$ {brl(detailModal.gastou)}</span>
              <span style={{ color: detailModal.saldo >= 0 ? C.green : C.red, fontWeight: 700 }}>Saldo {money(detailModal.saldo)}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>👕 {detailModal.camisas} camisas</span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 360 }}>
              {[...detailModal.tx].sort((a, b) => saleDate(b).getTime() - saleDate(a).getTime()).map(t => {
                const exp = isExpense(t);
                const impact = exp ? -t.totalPrice : t.totalPrice * detailModal.pct / 100;
                const bd = statusBadge(t.status);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="min-w-0 flex-1">
                      <div className="font-rajdhani text-sm truncate" style={{ color: 'rgba(255,255,255,0.85)' }} title={t.productDescription}>{cleanProduct(t.productDescription)}</div>
                      <div className="flex items-center flex-wrap gap-2 mt-0.5">
                        <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{t.date}</span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: bd.bg, color: bd.color }}>{t.status}</span>
                        {t.observations && <span className="font-rajdhani text-xs italic truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>📝 {t.observations}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-rajdhani text-sm font-bold" style={{ color: impact < 0 ? C.red : C.green }}>
                        {impact < 0 ? money(impact) : `+ R$ ${brl(impact)}`}
                      </div>
                      <div className="font-rajdhani" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>venda R$ {brl(t.totalPrice)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Editar lançamento */}
      {editSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setEditSale(null)}>
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}
            className="rounded-2xl p-6 w-full max-w-md flex flex-col gap-3" style={{ background: '#0d1424', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron font-bold text-white text-base">Editar Lançamento</h3>
              <button onClick={() => setEditSale(null)} className="opacity-60 hover:opacity-100" style={{ color: 'rgba(255,255,255,0.7)' }}>✕</button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Data</label>
              <input value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} placeholder="DD/MM/AAAA" className="font-rajdhani" style={INP} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Cliente</label>
              <input value={editForm.contactName} onChange={e => setEditForm(f => ({ ...f, contactName: e.target.value }))} className="font-rajdhani" style={INP} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Produto</label>
              <input value={editForm.productDescription} onChange={e => setEditForm(f => ({ ...f, productDescription: e.target.value }))} className="font-rajdhani" style={INP} />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1" style={{ width: 90 }}>
                <label className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Qtd</label>
                <input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} className="font-rajdhani" style={INP} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Valor unit. (R$)</label>
                <input inputMode="decimal" value={editForm.unitPrice} onChange={e => setEditForm(f => ({ ...f, unitPrice: e.target.value }))} className="font-rajdhani" style={INP} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Status</label>
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="font-rajdhani" style={{ ...INP, colorScheme: 'dark' }}>
                <option value="Em aberto" style={OPT}>Em aberto</option>
                <option value="Finalizado" style={OPT}>Finalizado</option>
                <option value="Despesa Afiliado" style={OPT}>Despesa Afiliado</option>
                <option value="Receita" style={OPT}>Receita</option>
                <option value="Despesa" style={OPT}>Despesa</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Observação</label>
              <textarea rows={2} value={editForm.observations} onChange={e => setEditForm(f => ({ ...f, observations: e.target.value }))} className="font-rajdhani resize-none" style={INP} />
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button onClick={() => setEditSale(null)} className="font-rajdhani text-sm px-4 py-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>Cancelar</button>
              <button onClick={saveEdit} className="font-orbitron text-xs font-bold tracking-wide px-5 py-2 rounded-lg"
                style={{ background: 'rgba(59,130,246,0.2)', border: `1px solid ${C.blue}`, color: C.blue }}>SALVAR</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
