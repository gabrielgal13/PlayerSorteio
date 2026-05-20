'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import type { SavedPrizeList } from '@/types';
import cs2Items from '@/data/cs2_items.json';

interface CS2Item {
  name: string;
  min_price_usd: number;
  image_url: string;
}

interface WorkingItem {
  localId: string;
  name: string;
  wearName: string;
  wearAbbr: string;
  imageUrl: string;
  pscValue: number;
  quantity: number;
}

const WEAR_MAP: Record<string, string> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

function parseCS2Name(fullName: string): { name: string; wearName: string; wearAbbr: string } {
  const m = fullName.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (m) return { name: m[1].trim(), wearName: m[2], wearAbbr: WEAR_MAP[m[2]] ?? '' };
  return { name: fullName, wearName: '', wearAbbr: '' };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateSavedListModal({ isOpen, onClose }: Props) {
  const { pscBalance, currentUser } = useStore();
  const [usdToBrl, setUsdToBrl] = useState<number | null>(null);

  // Form
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [coverData, setCoverData] = useState('');
  const coverRef = useRef<HTMLInputElement>(null);

  // Working items
  const [items, setItems] = useState<WorkingItem[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Search
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<CS2Item[]>([]);
  const [activeSug, setActiveSug] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const sugItemsRef = useRef<HTMLDivElement>(null);

  // Saved lists
  const [savedLists, setSavedLists] = useState<SavedPrizeList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Multiple add modal
  const [showMultiple, setShowMultiple] = useState(false);
  const [multiText, setMultiText] = useState('');

  // Computed
  const totalItems = items.length;
  const totalValue = items.reduce((s, i) => s + i.pscValue * i.quantity, 0);
  const remaining = pscBalance - totalValue;

  const pscNum = useCallback(
    (usd: number) => (usdToBrl ? Math.ceil(usd * usdToBrl) : Math.round(usd)),
    [usdToBrl],
  );

  const fetchLists = useCallback(async () => {
    if (!currentUser?.username) return;
    setLoadingLists(true);
    try {
      const r = await fetch(`/api/streamer/prize-lists?username=${encodeURIComponent(currentUser.username)}`);
      const d = (await r.json()) as SavedPrizeList[];
      setSavedLists(Array.isArray(d) ? d : []);
    } catch {
      setSavedLists([]);
    } finally {
      setLoadingLists(false);
    }
  }, [currentUser?.username]);

  useEffect(() => {
    if (!isOpen) return;
    fetchLists();
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then((d: { rate?: number }) => { if (d.rate) setUsdToBrl(d.rate); })
      .catch(() => {});
  }, [isOpen, fetchLists]);

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const h = () => setMenuOpenId(null);
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, [menuOpenId]);

  // Scroll active suggestion into view
  useEffect(() => {
    if (activeSug >= 0 && sugItemsRef.current) {
      const el = sugItemsRef.current.children[activeSug] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeSug]);

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = (val: string) => {
    setSearch(val);
    setActiveSug(-1);
    const q = val.toLowerCase().trim();
    if (!q) {
      setSuggestions((cs2Items as CS2Item[]).slice(0, 30));
      return;
    }
    setSuggestions((cs2Items as CS2Item[]).filter(i => i.name.toLowerCase().includes(q)).slice(0, 30));
  };

  const addItem = (cs2: CS2Item) => {
    const parsed = parseCS2Name(cs2.name);
    const pscValue = pscNum(cs2.min_price_usd);
    setItems(prev => {
      const ex = prev.findIndex(i => i.name === parsed.name && i.wearName === parsed.wearName);
      if (ex >= 0) return prev.map((item, idx) => idx === ex ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { localId: genId(), ...parsed, imageUrl: cs2.image_url, pscValue, quantity: 1 }];
    });
    setSearch('');
    setSuggestions([]);
    setActiveSug(-1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeSug >= 0) addItem(suggestions[activeSug]); }
    else if (e.key === 'Escape') { setSuggestions([]); setActiveSug(-1); }
  };

  // ── Items ────────────────────────────────────────────────────────────────────
  const changeQty = (localId: string, delta: number) =>
    setItems(prev => prev.map(i => i.localId !== localId ? i : { ...i, quantity: Math.max(1, i.quantity + delta) }));

  const removeItem = (localId: string) => setItems(prev => prev.filter(i => i.localId !== localId));

  const reorder = (from: number, to: number) =>
    setItems(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });

  // ── Save / Load / Delete ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!listName.trim() || !currentUser?.username) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        username: currentUser.username,
        name: listName.trim(),
        description: listDesc || undefined,
        coverUrl: coverData || undefined,
        items: items.map((item, i) => ({
          name: item.wearName ? `${item.name} (${item.wearName})` : item.name,
          imageUrl: item.imageUrl || undefined,
          quantity: item.quantity,
          pscValue: item.pscValue || undefined,
          order: i,
        })),
      };
      const url = editingListId ? `/api/streamer/prize-lists?id=${editingListId}` : '/api/streamer/prize-lists';
      const method = editingListId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as SavedPrizeList;
      if (!editingListId) setEditingListId(saved.id);
      setSaveSuccess(true);
      await fetchLists();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      setSaveError(`Erro: ${e instanceof Error ? e.message : 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  };

  const loadList = (list: SavedPrizeList) => {
    setListName(list.name);
    setListDesc(list.description ?? '');
    setCoverData(list.coverUrl ?? '');
    setCoverPreview(list.coverUrl ?? '');
    setEditingListId(list.id);
    setItems(
      list.items.map(item => {
        const parsed = parseCS2Name(item.name);
        return { localId: genId(), ...parsed, imageUrl: item.imageUrl ?? '', pscValue: item.pscValue ?? 0, quantity: item.quantity };
      }),
    );
    setMenuOpenId(null);
    setSaveError(null);
    setSaveSuccess(false);
    setConfirmClear(false);
  };

  const newList = () => {
    setListName(''); setListDesc('');
    setCoverData(''); setCoverPreview(''); setEditingListId(null);
    setItems([]); setSaveError(null); setSaveSuccess(false); setConfirmClear(false);
  };

  const deleteList = async (id: string) => {
    if (!currentUser?.username) return;
    await fetch(`/api/streamer/prize-lists?id=${id}&username=${encodeURIComponent(currentUser.username)}`, { method: 'DELETE' }).catch(() => {});
    setSavedLists(prev => prev.filter(l => l.id !== id));
    if (editingListId === id) newList();
    setConfirmDeleteId(null);
    setMenuOpenId(null);
  };

  const handleCoverFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target?.result as string;
      setCoverData(url);
      setCoverPreview(url);
    };
    reader.readAsDataURL(file);
  };

  const handleAddMultiple = () => {
    multiText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => {
        const found = (cs2Items as CS2Item[]).find(i => i.name.toLowerCase().includes(line.toLowerCase()));
        if (found) {
          addItem(found);
        } else {
          const parsed = parseCS2Name(line);
          setItems(prev => {
            const ex = prev.findIndex(i => i.name === parsed.name && i.wearName === parsed.wearName);
            if (ex >= 0) return prev.map((item, idx) => idx === ex ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, { localId: genId(), ...parsed, imageUrl: '', pscValue: 0, quantity: 1 }];
          });
        }
      });
    setMultiText('');
    setShowMultiple(false);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.82)' }}
            onClick={onClose}
          >
            <motion.div
              className="relative w-full rounded-2xl flex flex-col"
              style={{
                maxWidth: '1100px',
                background: 'linear-gradient(145deg, rgba(8,12,30,0.99), rgba(4,7,18,0.99))',
                border: '1px solid rgba(0,255,163,0.18)',
                boxShadow: '0 0 100px rgba(0,255,163,0.07)',
                maxHeight: '92vh',
              }}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00FFA3, #00FFA340)', borderRadius: '16px 16px 0 0', flexShrink: 0 }} />

              {/* Header */}
              <div
                className="flex items-center justify-between"
                style={{ padding: '18px 32px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-orbitron text-sm tracking-widest" style={{ color: '#00FFA3' }}>
                    {editingListId ? 'EDITAR LISTA' : 'CRIAR LISTA'}
                  </span>
                  {editingListId && (
                    <motion.button
                      onClick={newList}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="font-rajdhani font-bold text-xs px-3 py-1.5 rounded-lg tracking-widest flex items-center gap-1.5"
                      style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)', color: '#00E5FF' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                      NOVA LISTA
                    </motion.button>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                </button>
              </div>

              {/* Body */}
              <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* ── LEFT COLUMN ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

                  {/* DADOS DA LISTA */}
                  <div style={{ marginBottom: '24px' }}>
                    <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em' }}>
                      DADOS DA LISTA
                    </span>

                    {/* Row 1: Nome + Descrição */}
                    <div style={{ marginTop: '18px', display: 'flex', gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <label className="font-rajdhani text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>
                          NOME DA LISTA <span style={{ color: '#00FFA3' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={listName}
                          onChange={e => setListName(e.target.value)}
                          placeholder="Ex: AK PACK"
                          className="input-neon w-full mt-2 py-3 rounded-xl font-rajdhani text-base"
                          style={{ paddingLeft: '16px', paddingRight: '16px' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="font-rajdhani text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>
                          DESCRIÇÃO{' '}
                          <span style={{ color: 'rgba(255,255,255,0.2)', textTransform: 'none', letterSpacing: 'normal' }}>(OPCIONAL)</span>
                        </label>
                        <div style={{ position: 'relative', marginTop: '8px' }}>
                          <input
                            type="text"
                            value={listDesc}
                            onChange={e => setListDesc(e.target.value.slice(0, 80))}
                            placeholder="Ex: Itens de AK-47 para sortear..."
                            className="input-neon w-full py-3 rounded-xl font-rajdhani text-base"
                            style={{ paddingLeft: '16px', paddingRight: '44px' }}
                          />
                          <span className="font-rajdhani text-xs absolute right-3" style={{ top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }}>
                            {listDesc.length}/80
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FUNDO DO SORTEIO */}
                    <div style={{ marginTop: '16px' }}>
                      <label className="font-rajdhani text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        FUNDO DO SORTEIO{' '}
                        <span style={{ color: 'rgba(255,255,255,0.2)', textTransform: 'none', letterSpacing: 'normal' }}>(OPCIONAL)</span>
                      </label>
                      <div
                        style={{
                          marginTop: '8px', height: '72px', borderRadius: '12px',
                          border: `2px dashed ${coverPreview ? 'rgba(0,255,163,0.3)' : 'rgba(255,255,255,0.09)'}`,
                          background: coverPreview ? 'transparent' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer', position: 'relative', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onClick={() => coverRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCoverFile(f); }}
                      >
                        <input
                          ref={coverRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); e.target.value = ''; }}
                        />
                        {coverPreview ? (
                          <>
                            <img src={coverPreview} alt="fundo" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <span className="font-rajdhani text-xs font-bold" style={{ color: '#00FFA3' }}>✓ Fundo configurado</span>
                            </div>
                            <button
                              onClick={ev => { ev.stopPropagation(); setCoverData(''); setCoverPreview(''); }}
                              style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.72)', borderRadius: '6px', padding: '4px', color: 'rgba(255,255,255,0.8)', lineHeight: 1 }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-3 px-4">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.18)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                            <div>
                              <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>Clique ou arraste uma imagem para o fundo do sorteio (stage 2)</p>
                              <p className="font-rajdhani" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.14)', marginTop: '2px' }}>PNG, JPG até 2MB</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '24px' }} />

                  {/* ITENS DA LISTA */}
                  <div>
                    {/* Section header */}
                    <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                      <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em' }}>ITENS DA LISTA</span>
                      <motion.button
                        onClick={() => setShowMultiple(true)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="flex items-center gap-2 font-rajdhani font-bold text-xs tracking-widest px-3 py-2 rounded-lg transition-all"
                        style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.18)', color: '#00E5FF' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" /></svg>
                        ADICIONAR MÚLTIPLOS
                      </motion.button>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '12px' }}>
                      <div style={{ position: 'relative' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.28)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                        <input
                          ref={searchRef}
                          type="text"
                          value={search}
                          onChange={e => handleSearch(e.target.value)}
                          onFocus={() => { if (!suggestions.length) handleSearch(search); }}
                          onKeyDown={handleSearchKeyDown}
                          onBlur={() => setTimeout(() => { setSuggestions([]); setActiveSug(-1); }, 150)}
                          placeholder="Buscar skin pelo nome, coleção ou float..."
                          className="input-neon w-full py-3 rounded-xl font-rajdhani text-sm"
                          style={{ paddingLeft: '42px', paddingRight: '16px' }}
                          autoComplete="off"
                        />
                      </div>

                      {/* Autocomplete */}
                      <AnimatePresence>
                        {suggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            style={{
                              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px',
                              maxHeight: '240px', overflowY: 'auto', background: 'rgba(8,12,32,0.98)',
                              border: '1px solid rgba(0,229,255,0.2)', borderRadius: '12px',
                              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                            }}
                          >
                            <div ref={sugItemsRef}>
                              {suggestions.map((item, idx) => (
                                <div
                                  key={item.name}
                                  onMouseDown={() => addItem(item)}
                                  onMouseEnter={() => setActiveSug(idx)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', cursor: 'pointer',
                                    background: activeSug === idx ? 'rgba(0,229,255,0.08)' : 'transparent',
                                    borderLeft: activeSug === idx ? '2px solid rgba(0,229,255,0.5)' : '2px solid transparent',
                                  }}
                                >
                                  <div style={{ width: '36px', height: '28px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                  </div>
                                  <span className="font-rajdhani text-white/80 flex-1 text-sm truncate">{item.name}</span>
                                  <span className="font-orbitron text-xs flex-shrink-0" style={{ color: '#00FFA3' }}>
                                    {pscNum(item.min_price_usd).toLocaleString('pt-BR')} 💠
                                  </span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Table header */}
                    {items.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '14px 52px 1fr 72px 100px 72px 32px', gap: '8px', alignItems: 'center', padding: '0 6px 8px' }}>
                        <span />
                        <span />
                        <span className="font-orbitron text-white/20" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>ITEM</span>
                        <span className="font-orbitron text-white/20 text-right" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>PREÇO</span>
                        <span className="font-orbitron text-white/20 text-center" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>QUANTIDADE</span>
                        <span className="font-orbitron text-white/20 text-right" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>TOTAL</span>
                        <span />
                      </div>
                    )}

                    {/* Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <AnimatePresence>
                        {items.length === 0 ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ textAlign: 'center', padding: '36px 0' }}
                          >
                            <div style={{ fontSize: '30px', marginBottom: '10px' }}>🎮</div>
                            <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>Nenhum item adicionado</p>
                            <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.12)', marginTop: '4px' }}>Use a busca acima para adicionar skins à lista</p>
                          </motion.div>
                        ) : (
                          items.map((item, i) => {
                            const isDragging = dragIdx === i;
                            const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
                            return (
                              <div key={item.localId} style={{ position: 'relative' }}>
                                {isOver && (
                                  <div style={{ position: 'absolute', top: '-2px', left: 0, right: 0, height: '3px', borderRadius: '2px', background: 'linear-gradient(90deg, #00E5FF, #00E5FF44)', zIndex: 10, pointerEvents: 'none' }} />
                                )}
                                <motion.div
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  draggable
                                  onDragStart={() => setDragIdx(i)}
                                  onDragOver={e => { e.preventDefault(); setOverIdx(i); }}
                                  onDrop={e => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) reorder(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '14px 52px 1fr 72px 100px 72px 32px',
                                    gap: '8px', alignItems: 'center', padding: '9px 6px',
                                    borderRadius: '12px',
                                    background: isOver ? 'rgba(0,229,255,0.05)' : 'rgba(255,255,255,0.02)',
                                    border: isOver ? '1px solid rgba(0,229,255,0.22)' : '1px solid rgba(255,255,255,0.04)',
                                    opacity: isDragging ? 0.35 : 1,
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    transition: 'opacity 0.15s, background 0.15s',
                                  }}
                                >
                                  {/* Drag grip */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', opacity: 0.22 }}>
                                    {[0, 1, 2].map(r => (
                                      <div key={r} style={{ display: 'flex', gap: '2px' }}>
                                        <div style={{ width: '2.5px', height: '2.5px', borderRadius: '50%', background: 'white' }} />
                                        <div style={{ width: '2.5px', height: '2.5px', borderRadius: '50%', background: 'white' }} />
                                      </div>
                                    ))}
                                  </div>

                                  {/* Image */}
                                  <div style={{ width: '48px', height: '38px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                      <span style={{ fontSize: '18px' }}>🎮</span>
                                    )}
                                  </div>

                                  {/* Name + wear */}
                                  <div style={{ minWidth: 0 }}>
                                    <p className="font-rajdhani font-bold text-sm text-white/85 truncate">{item.name}</p>
                                    {item.wearName && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                                        <span className="font-rajdhani text-xs truncate" style={{ color: 'rgba(255,255,255,0.32)' }}>{item.wearName}</span>
                                        {item.wearAbbr && (
                                          <span className="font-orbitron flex-shrink-0" style={{ fontSize: '8px', color: '#00FFA3', background: 'rgba(0,255,163,0.1)', padding: '1px 4px', borderRadius: '4px' }}>
                                            {item.wearAbbr}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Price */}
                                  <div style={{ textAlign: 'right' }}>
                                    <p className="font-orbitron text-sm font-bold" style={{ color: '#00FFA3' }}>
                                      {item.pscValue.toLocaleString('pt-BR')}
                                    </p>
                                    <p className="font-rajdhani" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)' }}>💠</p>
                                  </div>

                                  {/* Quantity controls */}
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    onMouseDown={e => e.stopPropagation()}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => changeQty(item.localId, -1)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-all hover:bg-white/10"
                                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' }}
                                    >
                                      −
                                    </button>
                                    <span className="font-orbitron text-sm font-bold text-white" style={{ minWidth: '18px', textAlign: 'center' }}>
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() => changeQty(item.localId, 1)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-all hover:bg-white/10"
                                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' }}
                                    >
                                      +
                                    </button>
                                  </div>

                                  {/* Total */}
                                  <div style={{ textAlign: 'right' }}>
                                    <p className="font-orbitron text-sm font-bold" style={{ color: '#00E5FF' }}>
                                      {(item.pscValue * item.quantity).toLocaleString('pt-BR')}
                                    </p>
                                    <p className="font-rajdhani" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)' }}>💠</p>
                                  </div>

                                  {/* Delete */}
                                  <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => removeItem(item.localId)}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/22 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                    </button>
                                  </div>
                                </motion.div>
                              </div>
                            );
                          })
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Add item shortcut */}
                    {items.length > 0 && (
                      <button
                        onClick={() => searchRef.current?.focus()}
                        className="w-full mt-3 py-2.5 rounded-xl font-rajdhani text-sm tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-white/[0.03]"
                        style={{ border: '1px dashed rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.28)' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                        + Adicionar item
                      </button>
                    )}

                    {/* Footer: clear + total */}
                    {items.length > 0 && (
                      <div className="flex items-center justify-between" style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <AnimatePresence mode="wait">
                          {confirmClear ? (
                            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                              <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Limpar tudo?</span>
                              <button
                                onClick={() => { setItems([]); setConfirmClear(false); }}
                                className="font-rajdhani text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
                                style={{ color: '#FF4444', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)' }}
                              >SIM</button>
                              <button
                                onClick={() => setConfirmClear(false)}
                                className="font-rajdhani text-xs px-2.5 py-1 rounded-lg transition-all"
                                style={{ color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
                              >NÃO</button>
                            </motion.div>
                          ) : (
                            <motion.button
                              key="idle"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setConfirmClear(true)}
                              className="font-rajdhani text-xs tracking-widest flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
                              style={{ color: 'rgba(255,80,80,0.5)', border: '1px solid rgba(255,80,80,0.13)' }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                              LIMPAR LISTA
                            </motion.button>
                          )}
                        </AnimatePresence>
                        <div className="flex items-center gap-2">
                          <span className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>TOTAL DA LISTA</span>
                          <span className="font-orbitron font-bold text-base" style={{ color: '#00FFA3' }}>
                            {totalValue.toLocaleString('pt-BR')}
                          </span>
                          <span style={{ fontSize: '16px' }}>💠</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />

                {/* ── RIGHT COLUMN ── */}
                <div style={{ width: '296px', flexShrink: 0, overflowY: 'auto', padding: '28px 22px', background: 'rgba(0,0,0,0.16)' }}>

                  {/* RESUMO DA LISTA */}
                  <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em' }}>RESUMO DA LISTA</span>

                  <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '16px' }}>
                    {[
                      { label: 'Itens adicionados', value: totalItems, psc: false },
                      { label: 'Valor total', value: totalValue, psc: true, color: '#00E5FF' },
                      { label: 'Saldo restante', value: remaining, psc: true, color: remaining >= 0 ? '#00E5FF' : '#FF6B6B' },
                    ].map(({ label, value, psc, color }, idx) => (
                      <div key={label} className="flex items-center justify-between" style={{ marginBottom: idx < 2 ? '10px' : 0 }}>
                        <span className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>{label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-orbitron font-bold text-sm" style={{ color: color ?? 'rgba(255,255,255,0.8)' }}>
                            {value.toLocaleString('pt-BR')}
                          </span>
                          {psc && <span style={{ fontSize: '13px' }}>💠</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save feedback */}
                  <AnimatePresence>
                    {saveError && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mt-3 px-3 py-2.5 rounded-lg font-rajdhani text-xs font-bold"
                        style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: 'rgba(255,120,120,0.95)' }}>
                        {saveError}
                      </motion.div>
                    )}
                    {saveSuccess && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mt-3 px-3 py-2.5 rounded-lg font-rajdhani text-xs font-bold flex items-center gap-2"
                        style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)', color: '#00FFA3' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                        Lista salva com sucesso!
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Save button */}
                  <motion.button
                    onClick={handleSave}
                    disabled={!listName.trim() || saving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full mt-4 py-3.5 rounded-xl font-rajdhani font-bold tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #00FFA3 0%, #00CC82 100%)', color: '#050816' }}
                  >
                    {saving ? (
                      <motion.div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" /></svg>
                        {editingListId ? 'ATUALIZAR LISTA' : 'SALVAR LISTA'}
                      </>
                    )}
                  </motion.button>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '22px 0' }} />

                  {/* LISTAS SALVAS */}
                  <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.28)', letterSpacing: '0.14em' }}>LISTAS SALVAS</span>

                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {loadingLists ? (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <motion.div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/35 mx-auto" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                      </div>
                    ) : savedLists.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Nenhuma lista salva ainda</p>
                      </div>
                    ) : (
                      savedLists.map(list => {
                        const listTotal = list.items.reduce((s, i) => s + (i.pscValue ?? 0) * i.quantity, 0);
                        const isActive = editingListId === list.id;
                        return (
                          <div key={list.id} style={{ position: 'relative' }}>
                            {confirmDeleteId === list.id ? (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                                style={{ background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)' }}
                              >
                                <span className="font-rajdhani text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                  Excluir &quot;{list.name}&quot;?
                                </span>
                                <button
                                  onClick={() => deleteList(list.id)}
                                  className="font-rajdhani text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 transition-all"
                                  style={{ color: '#FF4444', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)' }}
                                >SIM</button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="font-rajdhani text-xs px-2 py-1 rounded-lg flex-shrink-0 transition-all"
                                  style={{ color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
                                >NÃO</button>
                              </motion.div>
                            ) : (
                              <div
                                onClick={() => loadList(list)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                                  background: isActive ? 'rgba(0,255,163,0.06)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${isActive ? 'rgba(0,255,163,0.22)' : 'rgba(255,255,255,0.05)'}`,
                                  transition: 'all 0.15s',
                                }}
                              >
                                {isActive && (
                                  <div style={{ width: '3px', height: '30px', borderRadius: '2px', background: '#00FFA3', flexShrink: 0 }} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p className="font-rajdhani font-bold text-sm truncate" style={{ color: isActive ? '#00FFA3' : 'rgba(255,255,255,0.78)' }}>
                                    {list.name}
                                  </p>
                                  <div className="flex items-center gap-1.5" style={{ marginTop: '2px' }}>
                                    <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                      {list.items.length} {list.items.length === 1 ? 'item' : 'itens'}
                                    </span>
                                    {listTotal > 0 && (
                                      <>
                                        <span style={{ color: 'rgba(255,255,255,0.14)', fontSize: '10px' }}>·</span>
                                        <span className="font-orbitron text-xs" style={{ color: '#00FFA3' }}>
                                          {listTotal.toLocaleString('pt-BR')} 💠
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* 3-dot menu */}
                                <div
                                  style={{ position: 'relative', flexShrink: 0 }}
                                  onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === list.id ? null : list.id); }}
                                >
                                  <button className="w-7 h-7 rounded-lg flex items-center justify-center text-white/22 hover:text-white/55 hover:bg-white/5 transition-all">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                    </svg>
                                  </button>
                                  <AnimatePresence>
                                    {menuOpenId === list.id && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                        transition={{ duration: 0.1 }}
                                        style={{
                                          position: 'absolute', right: 0, top: '100%', zIndex: 200, marginTop: '4px',
                                          background: 'rgba(8,12,32,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                                          borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: '148px', overflow: 'hidden',
                                        }}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => loadList(list)}
                                          className="w-full flex items-center gap-2 px-3 py-2.5 font-rajdhani text-sm text-left transition-all hover:bg-white/5"
                                          style={{ color: 'rgba(255,255,255,0.68)' }}
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13z" /></svg>
                                          Carregar lista
                                        </button>
                                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                                        <button
                                          onClick={() => { setConfirmDeleteId(list.id); setMenuOpenId(null); }}
                                          className="w-full flex items-center gap-2 px-3 py-2.5 font-rajdhani text-sm text-left transition-all hover:bg-red-500/10"
                                          style={{ color: 'rgba(255,80,80,0.78)' }}
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                                          Excluir lista
                                        </button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Nova lista button */}
                  <motion.button
                    onClick={newList}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full mt-4 py-3 rounded-xl font-rajdhani font-bold text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.14)', color: '#00E5FF' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                    + NOVA LISTA
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADICIONAR MÚLTIPLOS modal */}
      <AnimatePresence>
        {isOpen && showMultiple && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowMultiple(false)}
          >
            <motion.div
              className="relative w-full max-w-md rounded-2xl"
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              style={{ background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))', border: '1px solid rgba(0,229,255,0.2)' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00E5FF, #00E5FF55)', borderRadius: '16px 16px 0 0' }} />
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="flex items-center justify-between">
                  <span className="font-orbitron text-sm tracking-widest" style={{ color: '#00E5FF' }}>ADICIONAR MÚLTIPLOS</span>
                  <button onClick={() => setShowMultiple(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                  </button>
                </div>
                <p className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Cole os nomes das skins, um por linha. O sistema buscará preço e imagem automaticamente.
                </p>
                <textarea
                  value={multiText}
                  onChange={e => setMultiText(e.target.value)}
                  placeholder={"AK-47 | Vulcan (Field-Tested)\nAWP | Asiimov (Field-Tested)\nM4A4 | Howl (Factory New)"}
                  className="input-neon w-full font-rajdhani text-sm rounded-xl resize-none"
                  style={{ padding: '14px 16px', minHeight: '140px' }}
                  autoFocus
                />
                <motion.button
                  onClick={handleAddMultiple}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!multiText.trim()}
                  className="w-full py-3.5 rounded-xl font-rajdhani font-bold tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #00E5FF 0%, #0099CC 100%)', color: '#050816' }}
                >
                  ADICIONAR ITENS
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
