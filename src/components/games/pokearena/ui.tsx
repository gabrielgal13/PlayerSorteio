/* ============================================================================
 * POKÉARENA LIVE — peças de interface compartilhadas
 * ========================================================================== */
'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ALL_SPECIES, ITEMS, STYLES, TYPE_COLOR, TYPE_LABEL, species,
  spriteUrl, staticSpriteUrl, xpToNext,
  type PType,
} from './data';
import {
  pokeStore, scoreCreature,
  type Creature, type RankKind, type Trainer,
} from './storage';
import { RANK_LABEL } from './storage';
import type { FeedItem } from './engine';
import type { ChatMessage } from '@/types';

/* --------------------------------------------------------------- sprites --- */

export function Sprite({ sid, shiny, size = 48, animated = true, className, style }: {
  sid: number; shiny?: boolean; size?: number; animated?: boolean;
  className?: string; style?: React.CSSProperties;
}) {
  // GIF animado → PNG estático → PNG normal (algumas espécies não têm shiny animado).
  const primary = animated ? spriteUrl(sid, shiny) : staticSpriteUrl(sid, shiny);
  const [broken, setBroken] = useState<Record<string, number>>({});
  const level = broken[primary] ?? 0;
  const src = level === 0 ? primary : level === 1 ? staticSpriteUrl(sid, shiny) : staticSpriteUrl(sid, false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={species(sid).name}
      width={size}
      height={size}
      draggable={false}
      onError={() => setBroken(b => ({ ...b, [primary]: Math.min(2, (b[primary] ?? 0) + 1) }))}
      className={className}
      style={{ imageRendering: 'pixelated', objectFit: 'contain', ...style }}
    />
  );
}

/* --------------------------------------------------------------- básicos --- */

export function CtrlButton({ children, onClick, color, disabled, title }: {
  children: React.ReactNode; onClick: () => void; color: string; disabled?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded-lg transition-all disabled:opacity-40"
      style={{ background: `${color}1f`, border: `1px solid ${color}66`, color, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );
}

export function PowerButton({ emoji, label, color, desc, onClick, disabled, active }: {
  emoji: string; label: string; color: string; desc: string;
  onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <div className="relative group">
      <button onClick={onClick} disabled={disabled}
        className="w-full flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 transition-all"
        style={{
          background: active ? `${color}33` : disabled ? 'rgba(255,255,255,0.03)' : `${color}12`,
          border: `1px solid ${active ? color : disabled ? 'rgba(255,255,255,0.08)' : color + '55'}`,
          boxShadow: active ? `0 0 14px ${color}55` : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
        }}>
        <span className="text-lg leading-none">{emoji}</span>
        <span className="font-orbitron font-bold tracking-wide text-center leading-tight px-1"
          style={{ fontSize: 7, color: disabled ? 'rgba(255,255,255,0.4)' : color }}>{label}</span>
      </button>
      <Tip>{desc}</Tip>
    </div>
  );
}

export function MiniButton({ emoji, label, color, desc, onClick, active, disabled }: {
  emoji: string; label: string; color: string; desc: string;
  onClick: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <div className="relative group">
      <button onClick={onClick} disabled={disabled}
        className="w-full flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition-all"
        style={{
          background: active ? `${color}33` : 'rgba(255,255,255,0.03)',
          border: `1px solid ${active ? color : 'rgba(255,255,255,0.09)'}`,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}>
        <span className="text-sm leading-none">{emoji}</span>
        <span className="font-orbitron font-bold tracking-wide text-center leading-tight"
          style={{ fontSize: 6, color: active ? color : 'rgba(255,255,255,0.55)' }}>{label}</span>
      </button>
      <Tip>{desc}</Tip>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-left"
      style={{ width: 190 }}>
      <div className="rounded-lg px-2.5 py-2 font-rajdhani text-[11px] leading-snug text-white/75"
        style={{ background: 'rgba(6,16,32,0.97)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 6px 20px rgba(0,0,0,0.55)' }}>
        {children}
      </div>
    </div>
  );
}

export function TypeChip({ type, small }: { type: PType; small?: boolean }) {
  const c = TYPE_COLOR[type];
  return (
    <span className="font-orbitron font-bold rounded-md"
      style={{
        fontSize: small ? 7 : 8, letterSpacing: '0.08em',
        padding: small ? '2px 4px' : '3px 6px',
        background: `${c}26`, border: `1px solid ${c}77`, color: c,
      }}>
      {TYPE_LABEL[type].toUpperCase()}
    </span>
  );
}

export function HpBar({ value, max, color = '#7CFFB2', height = 6, showText }: {
  value: number; max: number; color?: string; height?: number; showText?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const c = pct > 50 ? color : pct > 22 ? '#FFD24A' : '#FF6B6B';
  return (
    <div className="w-full rounded-full overflow-hidden relative" style={{ height, background: 'rgba(255,255,255,0.1)' }}>
      <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.25 }}
        style={{ height: '100%', background: c, boxShadow: `0 0 8px ${c}88` }} />
      {showText && (
        <span className="absolute inset-0 flex items-center justify-center font-orbitron font-bold text-[8px] text-white"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
          {Math.max(0, Math.round(value))} / {Math.round(max)}
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- painel direito */

export type PanelTab = 'chat' | 'trainers' | 'pokedex' | 'feed';

export function RightPanel({
  tab, onTab, messages, chatEndRef, feedItems, version,
}: {
  tab: PanelTab; onTab: (t: PanelTab) => void;
  messages: ChatMessage[];
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  feedItems: FeedItem[];
  version: number;
}) {
  const TABS: { key: PanelTab; label: string; emoji: string }[] = [
    { key: 'chat', label: 'CHAT', emoji: '💬' },
    { key: 'trainers', label: 'TREINADORES', emoji: '🏆' },
    { key: 'pokedex', label: 'POKÉDEX', emoji: '📕' },
    { key: 'feed', label: 'EVENTOS', emoji: '📜' },
  ];
  return (
    <div className="flex flex-col flex-shrink-0"
      style={{ width: 400, background: 'rgba(5,14,28,0.94)', borderLeft: '1px solid rgba(255,255,255,0.09)' }}>
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => onTab(t.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 font-orbitron text-[9px] tracking-widest transition-all"
            style={{
              color: tab === t.key ? '#00E5FF' : 'rgba(255,255,255,0.35)',
              background: tab === t.key ? 'rgba(0,229,255,0.07)' : 'transparent',
              borderBottom: `2px solid ${tab === t.key ? '#00E5FF' : 'transparent'}`,
            }}>
            <span className="text-xs">{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && <ChatList messages={messages} endRef={chatEndRef} />}
      {tab === 'trainers' && <TrainersList version={version} />}
      {tab === 'pokedex' && <PokedexGrid version={version} />}
      {tab === 'feed' && <FeedList items={feedItems} />}
    </div>
  );
}

function ChatList({ messages, endRef }: { messages: ChatMessage[]; endRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex-1 overflow-y-auto space-y-2.5 min-h-0" style={{ padding: '14px 18px', scrollbarWidth: 'none' }}>
      {messages.length === 0 ? (
        <p className="font-rajdhani text-white/20 text-center tracking-wider leading-relaxed text-xs mt-6">aguardando mensagens...</p>
      ) : messages.slice(-60).map(msg => (
        <div key={msg.id} className="leading-relaxed break-words text-xs">
          <span className="font-rajdhani font-bold" style={{ color: msg.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <SourceIcon source={msg.source} />
            {msg.username}
          </span>
          <span className="font-rajdhani text-white/25">: </span>
          <span className="font-rajdhani text-white/65">{msg.text}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

export function SourceIcon({ source }: { source: 'twitch' | 'kick' | 'youtube' }) {
  if (source === 'twitch') return <svg width="10" height="10" viewBox="0 0 24 24" fill="#9147FF" style={{ flexShrink: 0 }}><path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29l-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.89V3.43h11.25z" /></svg>;
  if (source === 'kick') return <svg width="10" height="10" viewBox="0 0 24 24" fill="#53FC1C" style={{ flexShrink: 0 }}><path d="M4 3h4v7.5L12.5 3H18l-6 9 6 9h-5.5L8 13.5V21H4V3z" /></svg>;
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg>;
}

function FeedList({ items }: { items: FeedItem[] }) {
  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '12px 14px', scrollbarWidth: 'none' }}>
      {items.length === 0 ? (
        <p className="font-rajdhani text-white/20 text-center text-xs tracking-wider mt-6">nada aconteceu ainda...</p>
      ) : [...items].reverse().map(it => (
        <div key={it.id} className="flex items-start gap-2 py-2 px-2 rounded-lg mb-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-sm leading-none mt-0.5">{it.icon}</span>
          <span className="font-rajdhani text-xs leading-snug flex-1" style={{ color: it.color }}>{it.text}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------- lista de treino */

function TrainersList({ version }: { version: number }) {
  const [kind, setKind] = useState<RankKind>('level');
  const [query, setQuery] = useState('');
  const [openNick, setOpenNick] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = pokeStore.ranking(kind, 200);
    if (!query.trim()) return list.slice(0, 100);
    const q = query.trim().toLowerCase();
    return list.filter(t => t.nick.includes(q)).slice(0, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, query, version]);

  const kinds: RankKind[] = ['level', 'captures', 'shinies', 'legendaries', 'wins', 'damage', 'streak'];
  const valueOf = (t: Trainer) => {
    switch (kind) {
      case 'level': return `Lv ${t.lvl}`;
      case 'captures': return `${t.captures}`;
      case 'shinies': return `${t.shinies}`;
      case 'legendaries': return `${t.legendaries}`;
      case 'wins': return `${t.wins}`;
      case 'damage': return `${t.damage}`;
      case 'streak': return `${t.bestStreak}`;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-shrink-0 px-3 pt-3">
        <div className="flex flex-wrap gap-1">
          {kinds.map(k => (
            <button key={k} onClick={() => setKind(k)}
              className="font-orbitron text-[8px] tracking-wider px-2 py-1 rounded-md transition-all"
              style={{
                background: kind === k ? 'rgba(255,210,74,0.16)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${kind === k ? 'rgba(255,210,74,0.6)' : 'rgba(255,255,255,0.08)'}`,
                color: kind === k ? '#FFD24A' : 'rgba(255,255,255,0.45)',
              }}>
              {RANK_LABEL[k].emoji} {RANK_LABEL[k].label}
            </button>
          ))}
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="buscar treinador..."
          className="w-full mt-2 font-rajdhani text-xs px-2.5 py-1.5 rounded-lg text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
        <p className="font-rajdhani text-[10px] text-white/30 mt-1.5">
          {pokeStore.trainers.size} treinadores salvos nesta comunidade
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 mt-2" style={{ padding: '0 10px 10px', scrollbarWidth: 'none' }}>
        {rows.length === 0 ? (
          <p className="font-rajdhani text-white/20 text-center text-xs tracking-wider mt-6">ninguém jogou ainda...</p>
        ) : rows.map((t, i) => {
          const fav = pokeStore.fighterOf(t);
          const open = openNick === t.nick;
          return (
            <div key={t.nick}>
              <button onClick={() => setOpenNick(open ? null : t.nick)}
                className="w-full flex items-center gap-2 py-2 px-2 rounded-lg mb-1 text-left transition-all"
                style={{ background: i === 0 ? 'rgba(255,210,74,0.09)' : 'rgba(255,255,255,0.02)' }}>
                <span className="font-orbitron text-xs w-5 text-center flex-shrink-0"
                  style={{ color: i === 0 ? '#FFD24A' : i < 3 ? '#00E5FF' : 'rgba(255,255,255,0.35)' }}>{i + 1}</span>
                {fav ? <Sprite sid={fav.sid} shiny={fav.shiny} size={30} animated={false} /> : <span style={{ width: 30 }} />}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1">
                    <SourceIcon source={t.source} />
                    <span className="font-rajdhani font-bold text-xs text-white truncate">{t.display}</span>
                    {t.shinies > 0 && <span className="text-[9px]" title="tem shiny">✨</span>}
                    {t.legendaries > 0 && <span className="text-[9px]" title="tem lendário">👑</span>}
                  </span>
                  <span className="font-rajdhani text-[10px] text-white/35 block truncate">
                    Lv {t.lvl} · {t.team.length} pokémon · {t.captures} capturas
                  </span>
                </span>
                <span className="font-orbitron text-[11px] flex-shrink-0" style={{ color: '#FFD24A' }}>{valueOf(t)}</span>
              </button>
              {open && <TrainerDetail trainer={t} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrainerDetail({ trainer }: { trainer: Trainer }) {
  const team = [...trainer.team].sort((a, b) => scoreCreature(b) - scoreCreature(a));
  return (
    <div className="rounded-lg mb-2 p-3" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.15)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-orbitron text-[9px] tracking-widest text-white/45">EQUIPE</span>
        <span className="font-rajdhani text-[10px] text-white/30">
          {trainer.wins} vitórias · {trainer.damage} de dano · seq. {trainer.bestStreak}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(Object.keys(ITEMS) as (keyof typeof ITEMS)[]).map(k => {
          const n = trainer.items[k] ?? 0;
          if (n <= 0) return null;
          return (
            <span key={k} className="font-rajdhani text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: `${ITEMS[k].color}1a`, border: `1px solid ${ITEMS[k].color}55`, color: ITEMS[k].color }}>
              {ITEMS[k].emoji} {n}
            </span>
          );
        })}
      </div>
      {team.length === 0 ? (
        <p className="font-rajdhani text-[11px] text-white/25">nenhum pokémon ainda</p>
      ) : (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
          {team.slice(0, 24).map(c => <CreatureChip key={c.uid} c={c} favorite={c.uid === trainer.favorite} />)}
        </div>
      )}
    </div>
  );
}

export function CreatureChip({ c, favorite }: { c: Creature; favorite?: boolean }) {
  const sp = species(c.sid);
  return (
    <div className="flex flex-col items-center rounded-lg p-1.5 relative"
      style={{
        background: c.shiny ? 'rgba(255,210,74,0.09)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${c.shiny ? 'rgba(255,210,74,0.45)' : favorite ? 'rgba(0,229,255,0.45)' : 'rgba(255,255,255,0.07)'}`,
      }}>
      {favorite && <span className="absolute -top-1 -right-1 text-[10px]">⭐</span>}
      {c.shiny && <span className="absolute -top-1 -left-1 text-[10px]">✨</span>}
      <Sprite sid={c.sid} shiny={c.shiny} size={38} animated={false} />
      <span className="font-rajdhani font-bold text-[10px] text-white truncate w-full text-center leading-tight">{sp.name}</span>
      <span className="font-orbitron text-[8px]" style={{ color: TYPE_COLOR[sp.types[0]] }}>Lv {c.lvl}</span>
      <div className="w-full mt-1"><HpBar value={c.xp} max={xpToNext(c.lvl)} color="#00E5FF" height={3} /></div>
    </div>
  );
}

/* ------------------------------------------------------------------ dex --- */

function PokedexGrid({ version }: { version: number }) {
  const [filter, setFilter] = useState<'all' | 'caught' | 'seen' | 'shiny' | 'legendary'>('all');
  const dex = pokeStore.dex;

  const list = useMemo(() => {
    return ALL_SPECIES.filter(s => {
      if (filter === 'caught') return dex.caught.includes(s.id);
      if (filter === 'seen') return dex.seen.includes(s.id) && !dex.caught.includes(s.id);
      if (filter === 'shiny') return dex.shiny.includes(s.id);
      if (filter === 'legendary') return s.legendary;
      return true;
    }).sort((a, b) => a.id - b.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, version]);

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'TODOS' },
    { key: 'caught', label: `CAPTURADOS ${dex.caught.length}` },
    { key: 'seen', label: `ENCONTRADOS ${dex.seen.length}` },
    { key: 'shiny', label: `SHINYS ${dex.shiny.length}` },
    { key: 'legendary', label: `LENDÁRIOS ${dex.legendary.length}` },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex flex-wrap gap-1 flex-shrink-0 px-3 pt-3">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="font-orbitron text-[8px] tracking-wider px-2 py-1 rounded-md"
            style={{
              background: filter === f.key ? 'rgba(0,229,255,0.14)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f.key ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
              color: filter === f.key ? '#00E5FF' : 'rgba(255,255,255,0.45)',
            }}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="font-rajdhani text-[10px] text-white/30 px-3 mt-1.5 flex-shrink-0">
        {dex.caught.length} de {ALL_SPECIES.length} capturados nesta comunidade
      </p>
      <div className="flex-1 overflow-y-auto min-h-0 mt-2" style={{ padding: '0 10px 12px', scrollbarWidth: 'none' }}>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))' }}>
          {list.map(s => {
            const caught = dex.caught.includes(s.id);
            const seen = dex.seen.includes(s.id);
            const shiny = dex.shiny.includes(s.id);
            return (
              <div key={s.id} title={`#${s.id} ${s.name}`}
                className="flex flex-col items-center rounded-lg py-1.5 relative"
                style={{
                  background: caught ? (shiny ? 'rgba(255,210,74,0.08)' : 'rgba(124,255,178,0.06)') : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${caught ? (shiny ? 'rgba(255,210,74,0.4)' : 'rgba(124,255,178,0.25)') : 'rgba(255,255,255,0.06)'}`,
                }}>
                {shiny && <span className="absolute top-0.5 right-0.5 text-[8px]">✨</span>}
                {s.legendary && <span className="absolute top-0.5 left-0.5 text-[8px]">👑</span>}
                <Sprite sid={s.id} shiny={shiny} size={34} animated={false}
                  style={{ filter: caught ? 'none' : seen ? 'brightness(0.35) contrast(0.4)' : 'brightness(0) opacity(0.28)' }} />
                <span className="font-rajdhani text-[8px] truncate w-full text-center leading-none"
                  style={{ color: caught ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}>
                  {caught || seen ? s.name : `#${String(s.id).padStart(3, '0')}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- cartão de consulta */

export function TrainerCardOverlay({ nick }: { nick: string }) {
  const t = pokeStore.get(nick);
  if (!t) return null;
  const fav = pokeStore.fighterOf(t);
  const team = [...t.team].sort((a, b) => scoreCreature(b) - scoreCreature(a)).slice(0, 6);
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
      className="absolute bottom-4 left-4 rounded-2xl p-3 pointer-events-none"
      style={{ background: 'rgba(6,16,32,0.94)', border: '1px solid rgba(0,229,255,0.4)', boxShadow: '0 0 26px rgba(0,229,255,0.22)', width: 300 }}>
      <div className="flex items-center gap-2 mb-2">
        {fav && <Sprite sid={fav.sid} shiny={fav.shiny} size={40} />}
        <div className="min-w-0">
          <div className="font-orbitron font-bold text-xs text-white truncate flex items-center gap-1">
            <SourceIcon source={t.source} />{t.display}
          </div>
          <div className="font-rajdhani text-[10px] text-white/45">
            Nível {t.lvl} · {t.captures} capturas · {t.wins} vitórias
          </div>
        </div>
        <span className="ml-auto font-orbitron text-[9px] px-2 py-1 rounded-md"
          style={{ background: `${STYLES[t.style].color}22`, border: `1px solid ${STYLES[t.style].color}66`, color: STYLES[t.style].color }}>
          {STYLES[t.style].emoji} {STYLES[t.style].label}
        </span>
      </div>
      <div className="flex gap-1">
        {team.map(c => (
          <div key={c.uid} className="flex flex-col items-center rounded-lg px-1 py-1 flex-1"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.uid === t.favorite ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.07)'}` }}>
            <Sprite sid={c.sid} shiny={c.shiny} size={28} animated={false} />
            <span className="font-orbitron text-[7px] text-white/60">Lv{c.lvl}</span>
          </div>
        ))}
        {team.length === 0 && <span className="font-rajdhani text-[11px] text-white/30">sem pokémon ainda</span>}
      </div>
    </motion.div>
  );
}
