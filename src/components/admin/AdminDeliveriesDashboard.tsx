'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDeliveryMode } from '@/lib/prizeDelivery';
import type { DeliveryStatus } from '@/types';

const STEAM_REGEX = /https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=[\w-]+/;
const ERROR_STATUSES: DeliveryStatus[] = ['erro_tradelink', 'erro_entrega', 'erro_compra'];

const STATUS_CFG: Record<string, { label: string; sub: string | null; color: string; bg: string; border: string; isError: boolean }> = {
  novo:                { label: 'PENDENTE',           sub: 'Aguardando trade link',              color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)',  border: 'rgba(255,255,255,0.12)', isError: false },
  aguardando_tradelink:{ label: 'AGUARD. TRADE LINK', sub: 'Esperando DM do vencedor',           color: '#A855F7',              bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.3)',   isError: false },
  item_comprado:       { label: 'ITEM COMPRADO',       sub: 'Aguardando trade link',              color: '#00E5FF',              bg: 'rgba(0,229,255,0.08)',   border: 'rgba(0,229,255,0.25)',   isError: false },
  tradelocked:         { label: 'TRADE LOCK',          sub: null,                                 color: '#FFD166',              bg: 'rgba(255,209,102,0.1)', border: 'rgba(255,209,102,0.3)', isError: false },
  aguardando_endereco: { label: 'AGUARD. ENDEREÇO',    sub: 'Esperando mensagem do vencedor',    color: '#A855F7',              bg: 'rgba(168,85,247,0.1)',   border: 'rgba(168,85,247,0.3)',   isError: false },
  endereco_recebido:   { label: 'ENDEREÇO RECEBIDO',   sub: 'Aguardando envio pelo streamer',    color: '#00E5FF',              bg: 'rgba(0,229,255,0.08)',   border: 'rgba(0,229,255,0.25)',   isError: false },
  entregue:            { label: 'ENTREGUE',            sub: null,                                 color: '#00FFA3',              bg: 'rgba(0,255,163,0.1)',   border: 'rgba(0,255,163,0.3)',   isError: false },
  erro_tradelink:      { label: 'ERRO TRADE LINK',     sub: 'Erro ao receber trade link',         color: '#FF4444',              bg: 'rgba(255,68,68,0.12)',  border: 'rgba(255,68,68,0.35)',  isError: true  },
  erro_entrega:        { label: 'ERRO ENTREGA',        sub: 'Erro ao enviar produto',             color: '#FF4444',              bg: 'rgba(255,68,68,0.12)',  border: 'rgba(255,68,68,0.35)',  isError: true  },
  erro_compra:         { label: 'PROBLEMA NA COMPRA',  sub: 'Problema com a compra do produto',  color: '#FF4444',              bg: 'rgba(255,68,68,0.12)',  border: 'rgba(255,68,68,0.35)',  isError: true  },
};

const STATUS_ORDER = [
  'novo', 'aguardando_tradelink', 'item_comprado', 'tradelocked',
  'aguardando_endereco', 'endereco_recebido', 'entregue',
  'erro_tradelink', 'erro_entrega', 'erro_compra',
];

interface DeliveryItem {
  id: string;
  winnerName: string;
  winnerSource: string | null;
  prizeName: string;
  prizeDescription: string | null;
  prizeImageUrl: string | null;
  prizePscValue: number | null;
  tradeLink: string | null;
  deliveryAddress: string | null;
  deliveryStatus: string;
  tradeLockAt: number | null;
  timestamp: number;
  streamerUsername: string;
  streamerDisplayName: string | null;
}

interface DashboardCounts {
  pending: number;
  error: number;
  undelivered: number;
  total: number;
}

type ActiveFilter = 'all' | 'pending' | 'error' | 'undelivered';

/* ── Trade link modal ───────────────────────────────────────────────── */
function TradeLinkModal({ item, onConfirm, onClose }: {
  item: DeliveryItem;
  onConfirm: (tradeLink: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(item.tradeLink ?? '');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!STEAM_REGEX.test(trimmed)) {
      setError('Link inválido. Formato: https://steamcommunity.com/tradeoffer/new/?partner=XXXXXXXX&token=XXXXXXXX');
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#00E5FF">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
          <h2 className="font-orbitron font-bold tracking-widest text-white" style={{ fontSize: 13 }}>
            {item.tradeLink ? 'EDITAR TRADE LINK' : 'INSERIR TRADE LINK'}
          </h2>
        </div>

        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {item.prizeImageUrl && (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <img src={item.prizeImageUrl} alt="" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <p className="font-rajdhani font-bold text-white" style={{ fontSize: 13 }}>{item.prizeName}</p>
            <p className="font-rajdhani" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              Ganhador: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.winnerName}</span>
              {' · '}
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.streamerDisplayName || item.streamerUsername}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,200,80,0.9)" className="flex-shrink-0 mt-0.5">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <p className="font-rajdhani" style={{ fontSize: 12, color: 'rgba(255,200,100,0.9)', lineHeight: 1.45 }}>
            Tenha certeza que o trade link é da pessoa correta, pois a entrega será feita logo após o salvamento.
          </p>
        </div>

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
            color: '#00E5FF', fontSize: 11,
          }}
        />
        {error && <p className="font-rajdhani mb-3" style={{ fontSize: 11, color: '#FF4444' }}>{error}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            CANCELAR
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-110"
            style={{ fontSize: 10, color: '#000', background: '#00E5FF', border: 'none' }}>
            SALVAR
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Address modal (prêmios "Camisa") ───────────────────────────────── */
function AddressModal({ item, onConfirm, onClose }: {
  item: DeliveryItem;
  onConfirm: (address: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(item.deliveryAddress ?? '');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mode = getDeliveryMode(item.prizeName);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Informe o endereço completo.');
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
        style={{ maxWidth: 520, background: '#0d1117', border: '1px solid rgba(255,180,0,0.25)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFB300">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
          </div>
          <h2 className="font-orbitron font-bold tracking-widest text-white" style={{ fontSize: 13 }}>
            {item.deliveryAddress ? 'EDITAR ENDEREÇO' : 'INSERIR ENDEREÇO'}
          </h2>
        </div>

        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {item.prizeImageUrl && (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <img src={item.prizeImageUrl} alt="" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <p className="font-rajdhani font-bold text-white" style={{ fontSize: 13 }}>{item.prizeName}</p>
            <p className="font-rajdhani" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              Ganhador: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.winnerName}</span>
              {' · '}
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.streamerDisplayName || item.streamerUsername}</span>
            </p>
          </div>
        </div>

        <textarea
          ref={inputRef}
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          placeholder={mode === 'address_and_shirt'
            ? 'Endereço completo (com CEP) e qual camisa a pessoa escolheu...'
            : 'Endereço completo (com CEP)...'}
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl font-rajdhani mb-2 outline-none resize-none"
          style={{
            background: 'rgba(255,180,0,0.05)',
            border: `1px solid ${error ? 'rgba(255,68,68,0.5)' : 'rgba(255,180,0,0.2)'}`,
            color: 'rgba(255,255,255,0.85)', fontSize: 12,
          }}
        />
        {error && <p className="font-rajdhani mb-3" style={{ fontSize: 11, color: '#FF4444' }}>{error}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125"
            style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            CANCELAR
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-110"
            style={{ fontSize: 10, color: '#000', background: '#FFB300', border: 'none' }}>
            SALVAR
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main dashboard ─────────────────────────────────────────────────── */
export default function AdminDeliveriesDashboard() {
  const [counts, setCounts] = useState<DashboardCounts>({ pending: 0, error: 0, undelivered: 0, total: 0 });
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState<DeliveryItem | null>(null);
  const [addressModalItem, setAddressModalItem] = useState<DeliveryItem | null>(null);
  const currentFilterRef = useRef<ActiveFilter | null>(null);

  const load = useCallback(async (filter: ActiveFilter | null) => {
    setLoading(true);
    try {
      const qs = filter ? `?filter=${filter}` : '';
      const res = await fetch(`/api/admin/deliveries${qs}`);
      if (!res.ok) return;
      const data = await res.json() as { items: DeliveryItem[]; counts: DashboardCounts };
      setItems(data.items);
      setCounts(data.counts);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  const handleCardClick = (filter: ActiveFilter) => {
    const next = activeFilter === filter ? null : filter;
    setActiveFilter(next);
    currentFilterRef.current = next;
    load(next);
    setSearch('');
  };

  const handleStatusChange = async (id: string, deliveryStatus: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, deliveryStatus } : it));
    try {
      const res = await fetch(`/api/admin/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryStatus }),
      });
      if (res.ok) {
        const d = await res.json() as { tradeLockAt?: number | null };
        if (d.tradeLockAt != null) {
          setItems(prev => prev.map(it => it.id === id ? { ...it, tradeLockAt: d.tradeLockAt ?? null } : it));
        }
      }
    } catch {}
  };

  const handleTradeLinkSave = async (id: string, tradeLink: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, tradeLink } : it));
    setModalItem(null);
    try {
      await fetch(`/api/admin/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeLink }),
      });
    } catch {}
  };

  const handleAddressSave = async (id: string, deliveryAddress: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, deliveryAddress, deliveryStatus: 'endereco_recebido' } : it));
    setAddressModalItem(null);
    try {
      await fetch(`/api/admin/deliveries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryAddress, deliveryStatus: 'endereco_recebido' }),
      });
    } catch {}
  };

  const displayed = items.filter(it => {
    if (!search) return true;
    const q = search.toLowerCase();
    return it.prizeName.toLowerCase().includes(q)
      || it.winnerName.toLowerCase().includes(q)
      || (it.streamerDisplayName ?? it.streamerUsername).toLowerCase().includes(q);
  });

  const CARDS: { key: ActiveFilter; label: string; value: number; sub: string; color: string; activeBg: string; activeBorder: string }[] = [
    {
      key: 'pending', label: 'PENDENTES DE ENTREGA',
      value: counts.pending,
      sub: 'Aguardando trade link do ganhador',
      color: '#A855F7', activeBg: 'rgba(168,85,247,0.1)', activeBorder: 'rgba(168,85,247,0.3)',
    },
    {
      key: 'error', label: 'COM ERRO',
      value: counts.error,
      sub: 'Erro na compra, entrega ou trade link',
      color: '#FF4444', activeBg: 'rgba(255,68,68,0.1)', activeBorder: 'rgba(255,68,68,0.3)',
    },
    {
      key: 'undelivered', label: 'TOTAL NÃO ENTREGUES',
      value: counts.undelivered,
      sub: 'Todos os itens sem status de entregue',
      color: '#FFD166', activeBg: 'rgba(255,209,102,0.1)', activeBorder: 'rgba(255,209,102,0.3)',
    },
  ];

  return (
    <>
      <AnimatePresence>
        {modalItem && (
          <TradeLinkModal
            item={modalItem}
            onConfirm={tl => handleTradeLinkSave(modalItem.id, tl)}
            onClose={() => setModalItem(null)}
          />
        )}
        {addressModalItem && (
          <AddressModal
            item={addressModalItem}
            onConfirm={addr => handleAddressSave(addressModalItem.id, addr)}
            onClose={() => setAddressModalItem(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-6">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-3 gap-4">
          {CARDS.map(card => {
            const isActive = activeFilter === card.key;
            return (
              <button
                key={card.key}
                onClick={() => handleCardClick(card.key)}
                className="rounded-2xl p-5 text-left transition-all hover:brightness-110"
                style={{
                  background: isActive ? card.activeBg : 'rgba(255,255,255,0.03)',
                  border: isActive ? `1px solid ${card.activeBorder}` : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: isActive ? `0 0 20px ${card.activeBg}` : 'none',
                }}
              >
                <p className="font-orbitron font-bold tracking-wider mb-1" style={{ fontSize: 9, color: isActive ? card.color : 'rgba(255,255,255,0.3)' }}>
                  {card.label}
                </p>
                <p className="font-orbitron font-bold" style={{ fontSize: 36, color: isActive ? card.color : 'rgba(255,255,255,0.8)', lineHeight: 1 }}>
                  {loading && !items.length ? '—' : card.value}
                </p>
                <p className="font-rajdhani mt-1" style={{ fontSize: 11, color: isActive ? card.color : 'rgba(255,255,255,0.25)' }}>
                  {card.sub}
                </p>
                <p className="font-orbitron mt-2" style={{ fontSize: 9, color: isActive ? card.color : 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
                  {isActive ? '▲ VER MENOS' : '▼ VER LISTA'}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Table section ── */}
        {activeFilter !== null && (
          <motion.div
            key={activeFilter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}
          >
            {/* Table header */}
            <div className="px-5 py-3 flex items-center gap-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <span className="font-orbitron font-bold tracking-widest text-white/60" style={{ fontSize: 10 }}>
                {displayed.length} ITEM{displayed.length !== 1 ? 'S' : ''}
              </span>

              {loading && (
                <motion.div
                  className="w-3 h-3 rounded-full border border-neon-purple/40 border-t-neon-purple"
                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              )}

              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minWidth: 240 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar item, ganhador ou streamer..."
                  className="bg-transparent outline-none font-rajdhani text-white/60"
                  style={{ fontSize: 12, flex: 1 }}
                />
              </div>

              <button
                onClick={() => load(activeFilter)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125 disabled:opacity-60"
                style={{ fontSize: 9, color: '#00FFA3', background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
                  style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                ATUALIZAR
              </button>
            </div>

            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="text-4xl opacity-20">📦</div>
                <p className="font-rajdhani text-white/25 text-sm tracking-widest">
                  {loading ? 'Carregando...' : 'Nenhum item encontrado'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['ITEM', 'GANHADOR', 'STREAMER', 'ENTREGA', 'STATUS', 'DATA'].map(h => (
                        <th key={h} className="font-orbitron text-white/25 tracking-widest text-left px-4 py-3"
                          style={{ fontSize: 9, fontWeight: 700 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((item, i) => {
                      const cfg = STATUS_CFG[item.deliveryStatus] ?? STATUS_CFG.novo;
                      const isAddressMode = getDeliveryMode(item.prizeName) !== 'trade_link';
                      const dt = new Date(item.timestamp);

                      const rowBg = cfg.isError
                        ? 'rgba(255,68,68,0.06)'
                        : item.deliveryStatus === 'entregue'
                          ? 'rgba(0,255,163,0.06)'
                          : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
                      const rowBorder = cfg.isError
                        ? '1px solid rgba(255,68,68,0.12)'
                        : item.deliveryStatus === 'entregue'
                          ? '1px solid rgba(0,255,163,0.12)'
                          : '1px solid rgba(255,255,255,0.04)';

                      return (
                        <tr key={item.id} style={{ borderBottom: rowBorder, background: rowBg }}>

                          {/* ITEM */}
                          <td className="px-4 py-3" style={{ minWidth: 200 }}>
                            <div className="flex items-center gap-2">
                              {item.prizeImageUrl && (
                                <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                  <img src={item.prizeImageUrl} alt="" className="w-full h-full object-contain" />
                                </div>
                              )}
                              <div>
                                <p className="font-rajdhani font-bold text-white" style={{ fontSize: 12 }}>{item.prizeName}</p>
                                {item.prizePscValue && (
                                  <div className="flex items-center gap-1">
                                    <span style={{ fontSize: 10 }}>💠</span>
                                    <span className="font-orbitron font-bold text-neon-green" style={{ fontSize: 10 }}>
                                      {item.prizePscValue} PSC
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* GANHADOR */}
                          <td className="px-4 py-3" style={{ minWidth: 130 }}>
                            <div>
                              <p className="font-rajdhani text-white/70" style={{ fontSize: 12 }}>{item.winnerName}</p>
                              {item.winnerSource && (
                                <span className="font-orbitron px-1.5 py-0.5 rounded"
                                  style={{
                                    fontSize: 9,
                                    color: item.winnerSource === 'youtube' ? '#FF4444' : item.winnerSource === 'kick' ? '#53FC1C' : '#9147FF',
                                    background: item.winnerSource === 'youtube' ? 'rgba(255,0,0,0.1)' : item.winnerSource === 'kick' ? 'rgba(83,252,28,0.1)' : 'rgba(145,71,255,0.1)',
                                  }}>
                                  {item.winnerSource.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* STREAMER */}
                          <td className="px-4 py-3" style={{ minWidth: 120 }}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)' }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(0,229,255,0.7)">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                </svg>
                              </div>
                              <div>
                                <p className="font-rajdhani text-white/70" style={{ fontSize: 12 }}>
                                  {item.streamerDisplayName || item.streamerUsername}
                                </p>
                                {item.streamerDisplayName && (
                                  <p className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                                    @{item.streamerUsername}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* ENTREGA (trade link ou endereço, dependendo do prêmio) */}
                          <td className="px-4 py-3" style={{ minWidth: 180, maxWidth: 240 }}>
                            {isAddressMode ? (
                              item.deliveryAddress ? (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="flex-1 min-w-0 truncate font-rajdhani" style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }} title={item.deliveryAddress}>
                                    {item.deliveryAddress}
                                  </span>
                                  <button
                                    onClick={() => setAddressModalItem(item)}
                                    title="Editar"
                                    className="flex-shrink-0 p-1 rounded transition-all hover:bg-white/10"
                                    style={{ color: 'rgba(255,180,0,0.5)' }}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(item.deliveryAddress!).catch(() => {})}
                                    title="Copiar"
                                    className="flex-shrink-0 p-1 rounded transition-all hover:bg-white/10"
                                    style={{ color: 'rgba(255,180,0,0.5)' }}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-rajdhani" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                                    Não informado
                                  </span>
                                  <button
                                    onClick={() => setAddressModalItem(item)}
                                    className="flex-shrink-0 px-2 py-1 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125"
                                    style={{ fontSize: 9, color: '#FFB300', background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)' }}
                                  >
                                    INSERIR
                                  </button>
                                </div>
                              )
                            ) : item.tradeLink ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="flex-1 min-w-0 truncate font-mono" style={{ fontSize: 10, color: '#00E5FF' }} title={item.tradeLink}>
                                  {item.tradeLink}
                                </span>
                                <button
                                  onClick={() => setModalItem(item)}
                                  title="Editar"
                                  className="flex-shrink-0 p-1 rounded transition-all hover:bg-white/10"
                                  style={{ color: 'rgba(0,229,255,0.4)' }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={() => navigator.clipboard.writeText(item.tradeLink!).catch(() => {})}
                                  title="Copiar"
                                  className="flex-shrink-0 p-1 rounded transition-all hover:bg-white/10"
                                  style={{ color: 'rgba(0,229,255,0.4)' }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-rajdhani" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
                                  Não informado
                                </span>
                                <button
                                  onClick={() => setModalItem(item)}
                                  className="flex-shrink-0 px-2 py-1 rounded-lg font-orbitron font-bold tracking-wider transition-all hover:brightness-125"
                                  style={{ fontSize: 9, color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}
                                >
                                  INSERIR
                                </button>
                              </div>
                            )}
                          </td>

                          {/* STATUS */}
                          <td className="px-4 py-3" style={{ minWidth: 180 }}>
                            <div className="flex flex-col gap-1">
                              <div className="relative">
                                <select
                                  value={item.deliveryStatus}
                                  onChange={e => handleStatusChange(item.id, e.target.value)}
                                  className="font-orbitron font-bold w-full px-3 py-2 rounded-lg appearance-none outline-none"
                                  style={{
                                    fontSize: 10,
                                    color: cfg.color,
                                    background: cfg.bg,
                                    border: `1px solid ${cfg.border}`,
                                    cursor: 'pointer',
                                    letterSpacing: '0.05em',
                                    paddingRight: '1.5rem',
                                  }}
                                >
                                  {STATUS_ORDER.map(s => (
                                    <option key={s} value={s} style={{ background: '#111827', color: STATUS_CFG[s]?.color }}>
                                      {STATUS_CFG[s]?.label ?? s}
                                    </option>
                                  ))}
                                </select>
                                <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 24 24" fill={cfg.color}>
                                  <path d="M7 10l5 5 5-5z"/>
                                </svg>
                              </div>
                              {cfg.sub && (
                                <span className="font-rajdhani" style={{ fontSize: 10, color: cfg.isError ? 'rgba(255,68,68,0.7)' : 'rgba(255,255,255,0.3)' }}>
                                  {cfg.sub}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* DATA */}
                          <td className="px-4 py-3" style={{ minWidth: 100 }}>
                            <div className="flex flex-col">
                              <span className="font-rajdhani text-white/50" style={{ fontSize: 12 }}>
                                {dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                              <span className="font-rajdhani text-white/30" style={{ fontSize: 11 }}>
                                {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty state if no filter selected yet and no data */}
        {activeFilter === null && (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="font-rajdhani text-white/25 tracking-widest text-sm">
              Clique em um dos cards acima para ver a lista de itens
            </p>
          </div>
        )}

      </div>
    </>
  );
}
