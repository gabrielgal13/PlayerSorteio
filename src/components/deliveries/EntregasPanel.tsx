'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import type { DeliveryStatus } from '@/types';

const STATUS: Record<DeliveryStatus, { label: string; color: string; bg: string; border: string }> = {
  novo:        { label: 'NOVO',            color: '#00E5FF', bg: 'rgba(0,229,255,0.12)',   border: 'rgba(0,229,255,0.35)'   },
  tradelocked: { label: 'TRADE LOCK 7D',   color: '#FFD166', bg: 'rgba(255,209,102,0.12)', border: 'rgba(255,209,102,0.35)' },
  entregue:    { label: 'ENTREGUE',        color: '#00FFA3', bg: 'rgba(0,255,163,0.12)',   border: 'rgba(0,255,163,0.35)'   },
};

const STATUS_ORDER: DeliveryStatus[] = ['novo', 'tradelocked', 'entregue'];

interface Props {
  onClose: () => void;
}

export default function EntregasPanel({ onClose }: Props) {
  const { history, currentUser, updateDelivery } = useStore();

  const myHistory = history
    .filter(r => r.streamer === currentUser?.username)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Local state para os inputs de trade link (evita re-render a cada tecla)
  const [tradeLinkDraft, setTradeLinkDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(myHistory.map(r => [r.id, r.tradeLink ?? '']))
  );

  // Sincroniza caso o histórico mude externamente
  useEffect(() => {
    setTradeLinkDraft(prev => {
      const next = { ...prev };
      for (const r of myHistory) {
        if (!(r.id in next)) next[r.id] = r.tradeLink ?? '';
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length]);

  const panelRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const cycleStatus = (id: string, current: DeliveryStatus | undefined) => {
    const cur = current ?? 'novo';
    const idx = STATUS_ORDER.indexOf(cur);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    updateDelivery(id, undefined, next);
  };

  const commitTradeLink = (id: string) => {
    const value = tradeLinkDraft[id] ?? '';
    updateDelivery(id, value, undefined);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(5,8,22,0.6)', backdropFilter: 'blur(2px)' }}
    >
      <motion.div
        ref={panelRef}
        className="relative h-full flex flex-col"
        style={{
          width: '420px',
          maxWidth: '95vw',
          background: 'rgba(6,9,24,0.97)',
          borderLeft: '1px solid rgba(0,229,255,0.15)',
          boxShadow: '-12px 0 48px rgba(0,0,0,0.6)',
        }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* Header do painel */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(0,229,255,0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#00E5FF">
                <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-orbitron font-bold text-sm tracking-widest text-white">ENTREGAS</h2>
              <p className="font-rajdhani text-xs text-white/30 tracking-widest mt-0.5">
                {myHistory.length} item{myHistory.length !== 1 ? 's' : ''} sorteado{myHistory.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <AnimatePresence initial={false}>
            {myHistory.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-48 gap-3"
              >
                <div className="text-4xl opacity-30">📦</div>
                <p className="font-rajdhani text-white/25 text-sm tracking-widest text-center">
                  Nenhum sorteio realizado ainda
                </p>
              </motion.div>
            ) : (
              myHistory.map((r, i) => {
                const status = (r.deliveryStatus ?? 'novo') as DeliveryStatus;
                const cfg = STATUS[status];
                const hasPsc = (r.prize.pscValue ?? 0) > 0;

                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {/* Linha superior: imagem + info + status */}
                    <div className="flex items-center gap-3 p-3">
                      {/* Imagem do prêmio */}
                      <div
                        className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center"
                        style={{ background: 'rgba(255,209,102,0.07)', border: '1px solid rgba(255,209,102,0.15)' }}
                      >
                        {r.prize.imageUrl ? (
                          <img src={r.prize.imageUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-2xl">🏆</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-rajdhani font-bold text-sm text-white truncate leading-tight">
                          {r.prize.name}
                        </p>
                        {hasPsc && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span style={{ fontSize: '11px' }}>💠</span>
                            <span className="font-orbitron text-neon-green font-bold" style={{ fontSize: '11px' }}>
                              {r.prize.pscValue?.toLocaleString('pt-BR')} PSC
                            </span>
                          </div>
                        )}
                        <p className="font-rajdhani text-xs text-white/35 mt-0.5 truncate">
                          Ganhador: <span className="text-white/60">{r.winner.name}</span>
                        </p>
                        <p className="font-rajdhani text-white/20 mt-0.5" style={{ fontSize: '10px' }}>
                          {new Date(r.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Status pill (clicável — cicla) */}
                      <button
                        onClick={() => cycleStatus(r.id, status)}
                        title="Clique para mudar status"
                        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg font-orbitron font-bold transition-all"
                        style={{
                          fontSize: '9px',
                          letterSpacing: '0.08em',
                          color: cfg.color,
                          background: cfg.bg,
                          border: `1px solid ${cfg.border}`,
                        }}
                      >
                        {cfg.label}
                      </button>
                    </div>

                    {/* Linha inferior: trade link */}
                    <div
                      className="px-3 pb-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      {hasPsc ? (
                        <div className="flex items-center gap-2 pt-2.5">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" className="flex-shrink-0">
                            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
                          </svg>
                          <input
                            type="text"
                            placeholder="Trade link do ganhador..."
                            value={tradeLinkDraft[r.id] ?? ''}
                            onChange={e => setTradeLinkDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onBlur={() => commitTradeLink(r.id)}
                            className="flex-1 font-rajdhani text-xs text-white/70 outline-none rounded-lg px-2.5 py-1.5 transition-all"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              fontSize: '11px',
                            }}
                            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)')}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-2.5">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(0,255,163,0.5)" className="flex-shrink-0">
                            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
                          </svg>
                          <span className="font-rajdhani text-neon-green/60 tracking-wide" style={{ fontSize: '11px' }}>
                            Envio pelo streamer
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Legenda de status */}
        <div
          className="flex-shrink-0 px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="font-rajdhani text-white/20 text-xs tracking-widest">STATUS:</span>
          {STATUS_ORDER.map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[s].color }} />
              <span className="font-rajdhani text-white/30 tracking-wide" style={{ fontSize: '10px' }}>
                {STATUS[s].label}
              </span>
            </div>
          ))}
          <span className="font-rajdhani text-white/15 ml-auto" style={{ fontSize: '10px' }}>
            clique no status para avançar
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
