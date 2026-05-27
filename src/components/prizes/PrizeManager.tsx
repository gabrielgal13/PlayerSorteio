'use client';
import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import type { Prize, SavedPrizeList } from '@/types';
import CreateSavedListModal from './CreateSavedListModal';

interface CS2Item {
  name: string;
  price: number;   // centavos USD (Waxpeer)
  image: string;
}


function parseItemName(name: string) {
  const pipeIdx = name.indexOf(' | ');
  const parenStart = name.lastIndexOf(' (');
  const weapon = pipeIdx >= 0 ? name.slice(0, pipeIdx) : name;
  const skin = pipeIdx >= 0 ? (parenStart > pipeIdx ? name.slice(pipeIdx + 3, parenStart) : name.slice(pipeIdx + 3)) : '';
  const wearFull = parenStart >= 0 ? name.slice(parenStart + 2, name.length - 1) : '';
  const wearAbbr = wearFull.includes('Factory New') || wearFull.includes('Nova de Fábrica') ? 'FN'
    : wearFull.includes('Minimal Wear') || wearFull.includes('Pouco Usada') ? 'MW'
    : wearFull.includes('Field-Tested') || wearFull.includes('Testada em Campo') ? 'FT'
    : wearFull.includes('Well-Worn') || wearFull.includes('Bastante Desgastada') ? 'WW'
    : wearFull.includes('Battle-Scarred') || wearFull.includes('Deteriorada') ? 'BS'
    : '';
  return { weapon, skin, wearFull, wearAbbr };
}

const ALL_WEAPON_TYPES = [
  'Todos', 'AK-47', 'AWP', 'M4A4', 'M4A1-S', 'Desert Eagle', 'USP-S', 'Glock-18',
  'P250', 'Five-SeveN', 'Tec-9', 'CZ75-Auto', 'P2000', 'Dual Berettas', 'R8 Revolver',
  'MP9', 'MAC-10', 'PP-Bizon', 'P90', 'MP5-SD', 'MP7', 'UMP-45',
  'Nova', 'XM1014', 'MAG-7', 'Sawed-Off', 'M249', 'Negev',
  'FAMAS', 'Galil AR', 'AUG', 'SG 553', 'SSG 08', 'SCAR-20', 'G3SG1',
];

const EXTERIOR_LABELS: Record<string, string> = {
  FN: 'Factory New (FN)',
  MW: 'Minimal Wear (MW)',
  FT: 'Field-Tested (FT)',
  WW: 'Well-Worn (WW)',
  BS: 'Battle-Scarred (BS)',
};

const WEAR_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  FN: { bg: 'rgba(0,230,118,0.12)',  color: '#00E676', border: 'rgba(0,230,118,0.45)'  },
  MW: { bg: 'rgba(0,176,255,0.12)',  color: '#00B0FF', border: 'rgba(0,176,255,0.45)'  },
  FT: { bg: 'rgba(179,136,255,0.12)', color: '#B388FF', border: 'rgba(179,136,255,0.45)' },
  WW: { bg: 'rgba(255,179,0,0.12)',  color: '#FFB300', border: 'rgba(255,179,0,0.45)'  },
  BS: { bg: 'rgba(255,61,87,0.12)',  color: '#FF3D57', border: 'rgba(255,61,87,0.45)'  },
};

interface PrizeFormData {
  name: string;
  description: string;
  imageUrl: string;
  quantity: number;
  pscValue?: number;
  skipPsc?: boolean;
}

interface ImportError {
  row: number;
  message: string;
}

export interface PrizeManagerHandle {
  openAdd: () => void;
  openEdit: (prize: Prize) => void;
}

const EMPTY_FORM: PrizeFormData = { name: '', description: '', imageUrl: '', quantity: 1, pscValue: undefined, skipPsc: false };
const PRIZE_ICONS = ['🏆', '🎮', '💰', '🎁', '⚔️', '🔥', '💎', '🌟'];

const PrizeManager = forwardRef<PrizeManagerHandle, object>(function PrizeManager(_, ref) {
  const { prizes, addPrize, updatePrize, removePrize, clearPrizes, reorderPrizes, pscBalance, isAffiliate, excelPrizesImportEnabled, currentUser, setEventBackground } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PrizeFormData>(EMPTY_FORM);
  const [staged, setStaged] = useState<PrizeFormData[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Save list state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveListName, setSaveListName] = useState('');
  const [saveListLoading, setSaveListLoading] = useState(false);
  const [saveListError, setSaveListError] = useState<string | null>(null);
  const [saveListSuccess, setSaveListSuccess] = useState(false);
  const [stageQtyError, setStageQtyError] = useState(false);
  const [quickListDismissed, setQuickListDismissed] = useState(false);
  const [confirmClearStaged, setConfirmClearStaged] = useState(false);
  const [quickSaveItems, setQuickSaveItems] = useState<PrizeFormData[] | null>(null);

  // Load list state
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedPrizeList[]>([]);
  const [loadListsLoading, setLoadListsLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState<string | null>(null);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Create saved list modal
  const [showCreateListModal, setShowCreateListModal] = useState(false);

  // Exchange rate state
  const [usdToBrl, setUsdToBrl] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  // Admin products (custom products assigned by admin for this streamer)
  const [adminProducts, setAdminProducts] = useState<Array<{
    id: string; name: string; description: string | null; imageUrl: string | null;
    quantity: number; pscValue: number | null; skipPsc: boolean;
  }>>([]);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<CS2Item[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price');
  const [mostUsedSkins, setMostUsedSkins] = useState<CS2Item[]>([]);
  const [mostUsedVisible, setMostUsedVisible] = useState(4);
  const [waxpeerPool, setWaxpeerPool] = useState<CS2Item[]>([]);
  const [waxpeerLoading, setWaxpeerLoading] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const suggestionItemsRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const filterRowRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLDivElement>(null);
  const isSavingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterPopupPos, setFilterPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [filterWeapon, setFilterWeapon] = useState('Todos');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterExteriors, setFilterExteriors] = useState<string[]>([]);
  const [filterStatTrak, setFilterStatTrak] = useState(false);
  const activeFilterCount = [
    filterWeapon !== 'Todos',
    filterExteriors.length > 0,
    filterStatTrak,
    filterMinPrice !== '' || filterMaxPrice !== '',
  ].filter(Boolean).length;

  // Import state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importCount, setImportCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Import logic ─────────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setImportErrors([]);
    setImportFileName(file.name);
    setImportCount(0);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let rows: string[][] = [];

      if (ext === 'csv') {
        const text = await file.text();
        rows = text.split('\n').map(line =>
          line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        );
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
      } else {
        setImportErrors([{ row: 0, message: 'Formato inválido. Use .xlsx, .xls ou .csv' }]);
        setIsProcessing(false);
        return;
      }

      const errs: ImportError[] = [];
      const imported: Omit<Prize, 'id' | 'order'>[] = [];

      // detect header row
      let startRow = 0;
      if (rows[0]) {
        const first = String(rows[0][0]).toLowerCase();
        if (first.includes('premi') || first.includes('nome') || first.includes('prize') || first.includes('produto')) {
          startRow = 1;
        }
      }

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 1) continue;

        const rawName = String(row[0] ?? '').trim();
        const rawQty = String(row[1] ?? '1').trim();

        if (!rawName) continue;

        const qty = parseInt(rawQty, 10);
        if (rawQty && isNaN(qty)) {
          errs.push({ row: i + 1, message: `Linha ${i + 1}: quantidade inválida "${rawQty}" para "${rawName}"` });
          continue;
        }

        imported.push({
          name: rawName,
          quantity: isNaN(qty) ? 1 : Math.max(1, qty),
        });
      }

      if (imported.length === 0 && errs.length === 0) {
        errs.push({ row: 0, message: 'Arquivo vazio ou sem dados válidos' });
      }

      setImportErrors(errs);

      if (imported.length > 0) {
        imported.forEach(p => addPrize(p));
        setImportCount(imported.length);
      }
    } catch (e) {
      setImportErrors([{ row: 0, message: `Erro ao processar: ${e}` }]);
    } finally {
      setIsProcessing(false);
    }
  }, [addPrize]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Exchange rate ─────────────────────────────────────────────────────────────
  const fetchRate = useCallback(async () => {
    setRateLoading(true);
    try {
      const res = await fetch('/api/exchange-rate');
      if (!res.ok) throw new Error('HTTP error');
      const data = await res.json() as { rate?: number; error?: string };
      if (data.rate) setUsdToBrl(data.rate);
    } catch {
      // mantém cotação anterior se já tinha uma
    } finally {
      setRateLoading(false);
    }
  }, []);

  const loadAdminProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/streamer/admin-products');
      if (!res.ok) return;
      const data = await res.json();
      setAdminProducts(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  // ── Manual form ──────────────────────────────────────────────────────────────
  const fetchSavedLists = useCallback(async () => {
    if (!currentUser?.username) return;
    setLoadListsLoading(true);
    try {
      const res = await fetch(`/api/streamer/prize-lists?username=${encodeURIComponent(currentUser.username)}`);
      const data = await res.json() as SavedPrizeList[];
      setSavedLists(data);
    } catch {
      setSavedLists([]);
    } finally {
      setLoadListsLoading(false);
    }
  }, [currentUser?.username]);

  const loadMostUsedSkins = useCallback(() => {
    try {
      const stored = localStorage.getItem('ps_most_used_skins_v2');
      const top: CS2Item[] = stored ? JSON.parse(stored) : [];
      setMostUsedSkins(top.slice(0, 12));
    } catch {}
  }, []);

  const openAdd = () => {
    isSavingRef.current = false;
    setEditingId(null);
    setForm(EMPTY_FORM);
    setStaged([]);
    setSaveError(null);
    setQuickListDismissed(false);
    setConfirmClearStaged(false);
    setWaxpeerPool([]);
    setSuggestions([]);
    setTotalMatches(0);
    setShowForm(true);
    fetchRate();
    fetchSavedLists();
    loadMostUsedSkins();
    loadAdminProducts();
    // Pré-carrega 30 skins aleatórias para não iniciar vazio
    setTimeout(async () => {
      setWaxpeerLoading(true);
      try {
        const res = await fetch('/api/marketplace/browse?search=&limit=100');
        const data = await res.json() as { ok: boolean; items?: CS2Item[] };
        if (data.ok && data.items?.length) {
          // Embaralha e pega 30 aleatórios
          const shuffled = [...data.items].sort(() => Math.random() - 0.5).slice(0, 30);
          setWaxpeerPool(shuffled);
        }
      } catch { /* silencioso */ }
      finally { setWaxpeerLoading(false); }
    }, 0);
  };

  const closeForm = () => {
    isSavingRef.current = false;
    setShowForm(false);
    setStaged([]);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaveError(null);
    setQuickListDismissed(false);
    setConfirmClearStaged(false);
  };

  const openEdit = (prize: Prize) => {
    setEditingId(prize.id);
    setForm({
      name: prize.name,
      description: prize.description || '',
      imageUrl: prize.imageUrl || '',
      quantity: prize.quantity,
      pscValue: prize.pscValue,
      skipPsc: prize.skipPsc ?? false,
    });
    setWaxpeerPool([]);
    setSuggestions([]);
    setShowForm(true);
    fetchRate();
    fetchSavedLists();
    if (prize.name.length >= 2) {
      setTimeout(async () => {
        setWaxpeerLoading(true);
        try {
          const res = await fetch(`/api/marketplace/browse?search=${encodeURIComponent(prize.name)}`);
          const data = await res.json() as { ok: boolean; items?: CS2Item[] };
          setWaxpeerPool(data.ok ? (data.items ?? []) : []);
        } catch { setWaxpeerPool([]); }
        finally { setWaxpeerLoading(false); }
      }, 0);
    }
  };

  useImperativeHandle(ref, () => ({ openAdd, openEdit }));

  // ── Save / Load lists ─────────────────────────────────────────────────────────

  const openSaveModal = () => {
    setSaveListName('');
    setSaveListError(null);
    setShowSaveModal(true);
  };

  const handleSaveList = async () => {
    if (!saveListName.trim() || !currentUser?.username) return;
    setSaveListLoading(true);
    setSaveListError(null);
    try {
      const res = await fetch('/api/streamer/prize-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          name: saveListName.trim(),
          items: (quickSaveItems ?? prizes).map((p, idx) => ({
            name: p.name,
            description: p.description,
            imageUrl: p.imageUrl,
            quantity: p.quantity,
            pscValue: p.pscValue,
            skipPsc: p.skipPsc,
            order: 'order' in p ? (p as { order: number }).order : idx,
          })),
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar lista');
      setShowSaveModal(false);
      setQuickSaveItems(null);
      setSaveListSuccess(true);
      setTimeout(() => setSaveListSuccess(false), 2500);
      fetchSavedLists();
    } catch {
      setSaveListError('Não foi possível salvar a lista. Tente novamente.');
    } finally {
      setSaveListLoading(false);
    }
  };

  const handleLoadList = (list: SavedPrizeList) => {
    clearPrizes();
    list.items.forEach(item => {
      addPrize({
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        pscValue: item.pscValue,
        skipPsc: item.skipPsc,
      });
    });
    if (list.coverUrl) setEventBackground(list.coverUrl);
    setLoadSuccess(list.name);
    setTimeout(() => {
      setShowLoadModal(false);
      setLoadSuccess(null);
    }, 1200);
  };

  const handleDeleteList = async (id: string) => {
    if (!currentUser?.username) return;
    try {
      await fetch(`/api/streamer/prize-lists?id=${id}&username=${encodeURIComponent(currentUser.username)}`, {
        method: 'DELETE',
      });
      setSavedLists(prev => prev.filter(l => l.id !== id));
    } catch {
      // ignore
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const refreshSuggestions = useCallback((query: string) => {
    let items = waxpeerPool;
    if (filterWeapon !== 'Todos') {
      items = items.filter(item => {
        const { weapon } = parseItemName(item.name);
        const base = weapon.startsWith('StatTrak™ ') ? weapon.slice('StatTrak™ '.length) : weapon;
        return base === filterWeapon;
      });
    }
    if (filterStatTrak) {
      items = items.filter(item => item.name.includes('StatTrak™'));
    }
    if (filterExteriors.length > 0) {
      items = items.filter(item => filterExteriors.includes(parseItemName(item.name).wearAbbr));
    }
    if (usdToBrl) {
      const minP = filterMinPrice !== '' ? Number(filterMinPrice) : 0;
      const maxP = filterMaxPrice !== '' ? Number(filterMaxPrice) : Infinity;
      if (minP > 0 || maxP < Infinity) {
        items = items.filter(item => {
          const psc = Math.ceil((item.price / 100) * usdToBrl);
          return psc >= minP && psc <= maxP;
        });
      }
    }
    if (query.trim().length > 0) {
      const q = query.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(q));
    }
    setTotalMatches(items.length);
    setSuggestions(items.slice(0, 200));
  }, [waxpeerPool, filterWeapon, filterStatTrak, filterExteriors, filterMinPrice, filterMaxPrice, usdToBrl]);

  const handleNameChange = (value: string) => {
    setForm(f => ({ ...f, name: value, imageUrl: '', pscValue: undefined }));
    setActiveSuggestion(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      // Volta para o pool pré-carregado
      setSuggestions(waxpeerPool.slice(0, 200));
      setTotalMatches(waxpeerPool.length);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setWaxpeerLoading(true);
      try {
        const res = await fetch(`/api/marketplace/browse?search=${encodeURIComponent(value)}`);
        const data = await res.json() as { ok: boolean; items?: CS2Item[] };
        setWaxpeerPool(data.ok ? (data.items ?? []) : []);
      } catch { setWaxpeerPool([]); }
      finally { setWaxpeerLoading(false); }
    }, 400);
  };

  const handleNameFocus = () => { /* fetch is triggered on change, not focus */ };

  const pscNum = (usd: number) => Math.ceil(usd * (usdToBrl ?? 1));
  const pscFromCents = (cents: number) => Math.ceil((cents / 100) * (usdToBrl ?? 1));

  const applySuggestion = (item: CS2Item) => {
    const computed = usdToBrl ? pscFromCents(item.price) : undefined;
    if (computed !== undefined) {
      const newCost = computed * form.quantity;
      if (pscBalance - alreadySpent - stagedCost - newCost < 0) {
        setSaveError('Saldo insuficiente para adicionar este prêmio.');
        setTimeout(() => setSaveError(null), 4000);
        return;
      }
    }
    setStaged(s => {
      const idx = s.findIndex(p => p.name === item.name);
      if (idx >= 0) {
        return s.map((p, i) => i === idx ? { ...p, quantity: p.quantity + form.quantity } : p);
      }
      return [...s, {
        name: item.name,
        description: '',
        imageUrl: item.image,
        quantity: form.quantity,
        pscValue: computed,
        skipPsc: false,
      }];
    });
    trackUsage(item);
    setForm(f => ({ ...EMPTY_FORM, quantity: f.quantity }));
    setActiveSuggestion(-1);
    setTimeout(() => nameInputRef.current?.focus(), 160);
  };

  const applyAdminProduct = (item: typeof adminProducts[number]) => {
    if (!item.skipPsc && item.pscValue !== null) {
      const newCost = item.pscValue * form.quantity;
      if (pscBalance - alreadySpent - stagedCost - newCost < 0) {
        setSaveError('Saldo insuficiente para adicionar este prêmio.');
        setTimeout(() => setSaveError(null), 4000);
        return;
      }
    }
    setStaged(s => {
      const idx = s.findIndex(p => p.name === item.name);
      if (idx >= 0) {
        return s.map((p, i) => i === idx ? { ...p, quantity: p.quantity + form.quantity } : p);
      }
      return [...s, {
        name: item.name,
        description: item.description ?? '',
        imageUrl: item.imageUrl ?? '',
        quantity: form.quantity,
        pscValue: item.pscValue ?? undefined,
        skipPsc: item.skipPsc,
      }];
    });
    setForm(f => ({ ...EMPTY_FORM, quantity: f.quantity }));
    setTimeout(() => nameInputRef.current?.focus(), 160);
  };

  const trackUsage = useCallback((item: CS2Item) => {
    try {
      const stored = localStorage.getItem('ps_most_used_skins_v2');
      const current: CS2Item[] = stored ? JSON.parse(stored) : [];
      const updated = [item, ...current.filter(i => i.name !== item.name)];
      localStorage.setItem('ps_most_used_skins_v2', JSON.stringify(updated.slice(0, 20)));
    } catch {}
  }, []);

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) {
      if (e.key === 'Enter') handleSave();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0) {
        applySuggestion(suggestions[activeSuggestion]);
      } else {
        handleSave();
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveSuggestion(-1);
    }
  };

  useEffect(() => {
    if (activeSuggestion >= 0 && suggestionItemsRef.current) {
      const el = suggestionItemsRef.current.children[activeSuggestion] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeSuggestion]);


  useEffect(() => {
    fetchSavedLists();
  }, [fetchSavedLists]);

  // Re-filtra quando o pool muda (novo fetch) ou quando filtros mudam
  useEffect(() => {
    refreshSuggestions(form.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waxpeerPool, filterWeapon, filterStatTrak, filterExteriors, filterMinPrice, filterMaxPrice]);


  const totalPscSpent = prizes
    .filter(p => !p.skipPsc)
    .reduce((sum, p) => sum + (p.pscValue ?? 0) * p.quantity, 0);

  const alreadySpent = prizes
    .filter(p => (!editingId || p.id !== editingId) && !p.skipPsc)
    .reduce((sum, p) => sum + (p.pscValue ?? 0) * p.quantity, 0);

  const stagedCost = staged
    .filter(p => !p.skipPsc)
    .reduce((sum, p) => sum + (p.pscValue ?? 0) * p.quantity, 0);

  const handleSave = () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    // EDIT MODE: keep the original behavior — update in place + close
    if (editingId) {
      if (!form.name.trim()) { isSavingRef.current = false; return; }
      if (form.pscValue !== undefined && !form.skipPsc && pscBalance - alreadySpent - form.pscValue * form.quantity < 0) {
        setSaveError('Saldo insuficiente para adicionar este prêmio.');
        setTimeout(() => setSaveError(null), 4000);
        isSavingRef.current = false;
        return;
      }
      setSaveError(null);
      updatePrize(editingId, {
        ...form,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        pscValue: form.pscValue,
        skipPsc: form.skipPsc || undefined,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      return;
    }

    // NON-EDIT: commit all staged items (and the current form item, if filled) to prizes
    const toCommit: PrizeFormData[] = [...staged];
    if (form.name.trim()) toCommit.push(form);
    if (toCommit.length === 0) { isSavingRef.current = false; return; }

    const totalCost = toCommit
      .filter(p => !p.skipPsc)
      .reduce((sum, p) => sum + (p.pscValue ?? 0) * p.quantity, 0);
    if (pscBalance - alreadySpent - totalCost < 0) {
      setSaveError('Saldo insuficiente para adicionar estes prêmios.');
      setTimeout(() => setSaveError(null), 4000);
      isSavingRef.current = false;
      return;
    }

    setSaveError(null);
    toCommit.forEach(p => addPrize({
      ...p,
      description: p.description || undefined,
      imageUrl: p.imageUrl || undefined,
      pscValue: p.pscValue,
      skipPsc: p.skipPsc || undefined,
    }));

    setStaged([]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const removeStaged = (idx: number) => {
    setStaged(s => s.filter((_, i) => i !== idx));
  };

  const changeStageQty = (idx: number, delta: number) => {
    setStaged(s => {
      const item = s[idx];
      if (delta > 0 && item && !item.skipPsc && item.pscValue !== undefined) {
        const currentCost = s.filter(p => !p.skipPsc).reduce((sum, p) => sum + (p.pscValue ?? 0) * p.quantity, 0);
        if (pscBalance - alreadySpent - currentCost - item.pscValue < 0) {
          setStageQtyError(true);
          setTimeout(() => setStageQtyError(false), 3000);
          return s;
        }
      }
      return s.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p);
    });
  };

  const clearImport = () => {
    setImportCount(0);
    setImportFileName('');
    setImportErrors([]);
  };

  const fileImported = importCount > 0 && !isProcessing;

  return (
    <>
      {/* ── SAVE LIST MODAL ── */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            className="fixed inset-0 z-[300] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              className="relative w-full max-w-md mx-4 rounded-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                border: '1px solid rgba(0,255,163,0.2)',
                boxShadow: '0 0 80px rgba(0,255,163,0.08)',
              }}
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00FFA3, #00FFA355)', borderRadius: '16px 16px 0 0' }} />
              <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="flex items-center justify-between">
                  <span className="font-orbitron text-sm tracking-widest" style={{ color: '#00FFA3' }}>SALVAR LISTA</span>
                  <button onClick={() => setShowSaveModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="font-rajdhani text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Nome da lista</label>
                  <input
                    type="text"
                    value={saveListName}
                    onChange={e => setSaveListName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveList(); }}
                    placeholder="Ex: Lista de Skins CS2, Prêmios Especiais..."
                    className="input-neon w-full py-3 rounded-xl font-rajdhani text-base"
                    style={{ paddingLeft: '16px', paddingRight: '16px' }}
                    autoFocus
                  />
                </div>
                <div className="px-3 py-2 rounded-lg font-rajdhani text-xs" style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.1)', color: 'rgba(255,255,255,0.35)' }}>
                  {prizes.length} prêmio{prizes.length !== 1 ? 's' : ''} serão salvos nesta lista
                </div>
                <AnimatePresence>
                  {saveListError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="px-3 py-2.5 rounded-lg font-rajdhani text-sm font-semibold"
                      style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: 'rgba(255,120,120,0.95)' }}>
                      {saveListError}
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.button
                  onClick={handleSaveList}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!saveListName.trim() || saveListLoading}
                  className="w-full py-4 rounded-xl font-rajdhani font-bold tracking-widest text-base disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #00FFA3 0%, #00CC82 100%)', color: '#050816' }}
                >
                  {saveListLoading ? (
                    <motion.div className="w-4 h-4 rounded-full border-2 border-black/20 border-t-black/60" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                      SALVAR LISTA
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOAD LIST MODAL ── */}
      <AnimatePresence>
        {showLoadModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setShowLoadModal(false)}
          >
            <motion.div
              className="relative w-full max-w-lg mx-4 rounded-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                border: '1px solid rgba(0,229,255,0.2)',
                boxShadow: '0 0 80px rgba(0,229,255,0.08)',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
              }}
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00E5FF, #00E5FF55)', borderRadius: '16px 16px 0 0', flexShrink: 0 }} />
              <div style={{ padding: '28px 28px 0', flexShrink: 0 }}>
                <div className="flex items-center justify-between mb-5">
                  <span className="font-orbitron text-sm text-neon-cyan tracking-widest">MINHAS LISTAS</span>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={() => { setShowLoadModal(false); openSaveModal(); }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      disabled={prizes.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-rajdhani font-bold text-xs tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)', color: '#00FFA3' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                      SALVAR LISTA
                    </motion.button>
                    <button onClick={() => setShowLoadModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 28px 28px', overflowY: 'auto', flex: 1 }}>
                {loadSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="mb-4 px-4 py-3 rounded-xl font-rajdhani text-sm font-bold flex items-center gap-2"
                    style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)', color: '#00FFA3' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                    Lista &quot;{loadSuccess}&quot; carregada!
                  </motion.div>
                )}
                {loadListsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <motion.div className="w-6 h-6 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  </div>
                ) : savedLists.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-3xl mb-3">📋</div>
                    <p className="font-rajdhani text-white/25 text-sm tracking-widest">Nenhuma lista salva ainda</p>
                    <p className="font-rajdhani text-white/15 text-xs mt-1">Adicione prêmios e salve uma lista para começar</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {savedLists.map(list => (
                      <motion.div
                        key={list.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-xl px-4 py-3 flex items-center gap-3"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-rajdhani font-bold text-white/85 text-sm truncate">{list.name}</p>
                          <p className="font-rajdhani text-xs text-white/30 mt-0.5">
                            {list.items.length} prêmio{list.items.length !== 1 ? 's' : ''} · {new Date(list.updatedAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        {confirmDeleteId === list.id ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-rajdhani text-xs text-white/30">Excluir?</span>
                            <button
                              onClick={() => handleDeleteList(list.id)}
                              className="font-rajdhani text-xs font-bold px-2 py-1 rounded transition-all"
                              style={{ color: '#FF4444', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)' }}
                            >
                              SIM
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="font-rajdhani text-xs px-2 py-1 rounded transition-all"
                              style={{ color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
                            >
                              NÃO
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <motion.button
                              onClick={() => handleLoadList(list)}
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              className="font-rajdhani text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                              style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}
                            >
                              CARREGAR
                            </motion.button>
                            <button
                              onClick={() => setConfirmDeleteId(list.id)}
                              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FORM MODAL ── */}
      {createPortal(
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="fixed inset-0 z-[150] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={closeForm}
          >
            <motion.div
              className="relative w-full max-w-[1144px] mx-4 rounded-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(10,14,40,0.99), rgba(5,8,22,0.99))',
                border: '1px solid rgba(0,229,255,0.2)',
                boxShadow: '0 0 80px rgba(0,229,255,0.1), 0 0 160px rgba(0,229,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                maxHeight: '90vh',
              }}
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 24 }}
              transition={{ type: 'spring', damping: 26, stiffness: 380 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Accent top bar */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00E5FF, #00E5FF55)', flexShrink: 0 }} />

              {/* ── Full-width header ── */}
              <div style={{
                padding: '16px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                flexShrink: 0,
                gap: '16px',
              }}>
                {/* Gift icon + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <svg width="22" height="20" viewBox="0 0 1280 1194">
                    <g transform="translate(0,1194) scale(0.1,-0.1)" fill="#00E5FF">
                      <path d="M3600 11930 c-484 -60 -920 -326 -1186 -725 -162 -244 -251 -498 -273 -785 -36 -446 -35 -545 4 -729 120 -572 567 -1018 1143 -1141 l101 -22 2853 -4 c1569 -2 2923 -5 3008 -6 177 -2 271 13 441 68 598 193 1016 757 1023 1379 1 181 -20 462 -45 594 -121 624 -588 1135 -1202 1312 -190 55 -259 63 -547 63 -287 1 -367 -7 -593 -55 -636 -138 -1210 -530 -1575 -1075 -133 -198 -259 -464 -323 -681 -13 -46 -26 -83 -29 -83 -3 0 -18 44 -35 98 -191 624 -623 1156 -1202 1480 -263 147 -570 250 -887 298 -120 18 -566 27 -676 14z m375 -851 c288 -24 564 -117 790 -266 463 -305 738 -778 780 -1341 l7 -93 -969 3 -968 3 -80 27 c-130 45 -220 101 -316 197 -182 183 -244 362 -234 681 5 154 26 252 75 351 141 282 402 445 715 448 44 0 134 -4 200 -10z m5195 -20 c151 -39 292 -121 401 -235 154 -162 221 -316 240 -554 21 -279 -48 -479 -230 -661 -96 -96 -186 -152 -316 -197 l-80 -27 -968 -3 -969 -3 7 93 c29 394 170 740 420 1030 134 156 352 323 538 412 316 151 703 209 957 145z"/>
                      <path d="M0 6825 l0 -855 2775 0 2775 0 -2 853 -3 852 -2772 3 -2773 2 0 -855z"/>
                      <path d="M7257 7673 c-4 -3 -7 -388 -7 -855 l0 -848 2775 0 2775 0 0 855 0 855 -2768 0 c-1523 0 -2772 -3 -2775 -7z"/>
                      <path d="M857 5113 c-11 -11 -8 -3857 3 -3958 13 -114 24 -167 61 -281 61 -188 157 -342 309 -494 184 -185 379 -292 650 -356 70 -17 186 -18 1873 -21 l1797 -3 -2 2557 -3 2558 -2341 3 c-1287 1 -2344 -1 -2347 -5z"/>
                      <path d="M7257 5113 c-4 -3 -7 -1155 -7 -2560 l0 -2553 1798 3 c1981 3 1825 -2 2022 63 379 126 690 439 813 819 66 203 62 52 62 2245 l0 1985 -2341 3 c-1287 1 -2344 -1 -2347 -5z"/>
                    </g>
                  </svg>
                  <span className="font-orbitron text-sm text-white/90 tracking-widest">PRÊMIOS</span>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '28px', flexShrink: 0 }}>
                  <button
                    className="font-orbitron text-xs tracking-widest"
                    style={{ paddingBottom: '4px', color: '#00E5FF', borderBottom: '2px solid #00E5FF', background: 'none', outline: 'none', cursor: 'default' }}
                  >
                    {editingId ? 'EDITAR PRÊMIO' : 'ADICIONAR PRÊMIO'}
                  </button>
                  <button
                    onClick={() => { closeForm(); setShowCreateListModal(true); }}
                    className="font-orbitron text-xs tracking-widest transition-colors hover:text-white/55"
                    style={{ paddingBottom: '4px', color: 'rgba(255,255,255,0.3)', borderBottom: '2px solid transparent', background: 'none', outline: 'none' }}
                  >
                    CRIAR LISTA
                  </button>
                </div>

                {/* Close */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={closeForm} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  </button>
                </div>
              </div>

              {/* Body: two columns */}
              <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* LEFT: form */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, padding: '24px 28px 8px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

                  {/* Search + filter button */}
                  <div ref={filterRowRef} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexShrink: 0 }}>
                    <div ref={inputWrapperRef} style={{ flex: 1, position: 'relative' }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                          </svg>
                        </span>
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={form.name}
                          onChange={e => handleNameChange(e.target.value)}
                          onKeyDown={handleNameKeyDown}
                          onClick={handleNameFocus}
                          placeholder="Buscar skin pelo nome, coleção ou float..."
                          className="input-neon w-full font-rajdhani"
                          style={{ paddingLeft: '40px', paddingRight: '16px', paddingTop: '14px', paddingBottom: '14px', borderRadius: '12px', fontSize: '14px' }}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    {/* Filter / sliders button */}
                    <div ref={filterBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (showFilters) {
                            setShowFilters(false);
                            setFilterPopupPos(null);
                          } else {
                            const rect = filterBtnRef.current?.getBoundingClientRect();
                            if (rect) setFilterPopupPos({ top: rect.bottom + 8, left: rect.left });
                            setShowFilters(true);
                          }
                        }}
                        style={{
                          height: '52px', borderRadius: '12px',
                          background: showFilters || activeFilterCount > 0 ? 'rgba(0,229,255,0.1)' : 'transparent',
                          border: `2px solid ${showFilters || activeFilterCount > 0 ? '#00E5FF' : 'rgba(0,229,255,0.5)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          cursor: 'pointer', transition: 'all 0.15s',
                          padding: '0 14px',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round">
                          <line x1="3" y1="5" x2="21" y2="5"/>
                          <circle cx="8" cy="5" r="2.5" fill="rgba(10,14,40,1)"/>
                          <line x1="3" y1="12" x2="21" y2="12"/>
                          <circle cx="15" cy="12" r="2.5" fill="rgba(10,14,40,1)"/>
                          <line x1="3" y1="19" x2="21" y2="19"/>
                          <circle cx="10" cy="19" r="2.5" fill="rgba(10,14,40,1)"/>
                        </svg>
                        <span className="font-orbitron" style={{ fontSize: '10px', color: '#00E5FF', letterSpacing: '0.1em' }}>FILTRAR</span>
                      </button>
                      {activeFilterCount > 0 && (
                        <div style={{
                          position: 'absolute', top: '-6px', right: '-6px',
                          width: '18px', height: '18px', borderRadius: '50%',
                          background: '#00E5FF', color: '#000',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 'bold', fontFamily: 'var(--font-orbitron)',
                          pointerEvents: 'none',
                        }}>
                          {activeFilterCount}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── MAIS USADAS (flutuando no popup) ── */}
                  <AnimatePresence>
                    {mostUsedSkins.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: '8px',
                          padding: '4px 0 8px', flexShrink: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,200,0,0.55)">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                          </svg>
                          <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em' }}>
                            MAIS USADAS
                          </span>
                        </div>
                        {(() => {
                          const ROW_SIZE = [
                            // row 0 — largest
                            { imgW: 52, imgH: 36, padV: 7, padH: 10, gap: '8px' },
                            // row 1 — smallest
                            { imgW: 26, imgH: 36, padV: 7, padH: 5,  gap: '5px' },
                            // row 2 — medium
                            { imgW: 40, imgH: 36, padV: 7, padH: 8,  gap: '6px' },
                          ];
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                              {mostUsedSkins.slice(0, mostUsedVisible).map((item, idx) => {
                                const { weapon, skin, wearAbbr } = parseItemName(item.name);
                                const psc = usdToBrl ? pscFromCents(item.price) : null;
                                const sz = ROW_SIZE[Math.min(Math.floor(idx / 4), ROW_SIZE.length - 1)];
                                return (
                                  <div
                                    key={item.name}
                                    onMouseDown={() => applySuggestion(item)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: sz.gap,
                                      padding: `${sz.padV}px ${sz.padH}px`, borderRadius: '8px', cursor: 'pointer',
                                      background: 'transparent', minWidth: 0,
                                      border: '1px solid rgba(255,255,255,0.06)',
                                      transition: 'background 0.1s, box-shadow 0.1s, border-color 0.1s',
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.background = 'rgba(0,229,255,0.05)';
                                      e.currentTarget.style.borderColor = 'rgba(0,229,255,0.18)';
                                      e.currentTarget.style.boxShadow = 'inset 3px 0 0 #00E5FF';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    <img src={item.image} alt={item.name} style={{ width: sz.imgW, height: sz.imgH, objectFit: 'contain', flexShrink: 0 }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                                      <span className="font-rajdhani font-bold" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {weapon}
                                      </span>
                                      <span className="font-rajdhani" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {skin}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {wearAbbr && WEAR_BADGE[wearAbbr] && (
                                          <span className="font-orbitron" style={{
                                            fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em',
                                            padding: '2px 5px', borderRadius: '4px',
                                            background: WEAR_BADGE[wearAbbr].bg,
                                            color: WEAR_BADGE[wearAbbr].color,
                                            border: `1px solid ${WEAR_BADGE[wearAbbr].border}`,
                                            flexShrink: 0,
                                          }}>
                                            {wearAbbr}
                                          </span>
                                        )}
                                        {psc !== null && (
                                          <span className="font-orbitron" style={{ fontSize: '9px', color: '#00E5FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            💠 {psc}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {(mostUsedVisible < mostUsedSkins.length || mostUsedVisible > 4) && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            {mostUsedVisible < mostUsedSkins.length && (
                              <button
                                type="button"
                                onMouseDown={e => { e.preventDefault(); setMostUsedVisible(v => Math.min(v + 4, mostUsedSkins.length)); }}
                                className="font-orbitron"
                                style={{ fontSize: '9px', color: '#00E5FF', background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.06em' }}
                              >
                                VER +{Math.min(4, mostUsedSkins.length - mostUsedVisible)}
                              </button>
                            )}
                            {mostUsedVisible > 4 && (
                              <button
                                type="button"
                                onMouseDown={e => { e.preventDefault(); setMostUsedVisible(4); }}
                                className="font-orbitron"
                                style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.06em' }}
                              >
                                VER MENOS
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Filter panel moved to portal below */}
                  {false && <div style={{
                          background: 'rgba(8,12,32,0.98)',
                          border: '1px solid rgba(0,229,255,0.2)',
                          borderRadius: '14px',
                          padding: '16px 18px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 32px rgba(0,229,255,0.06)',
                        }}>
                          {/* Row 1: Tipo de Arma + Faixa de Preço */}
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>TIPO DE ARMA</span>
                              <select
                                value={filterWeapon}
                                onChange={e => setFilterWeapon(e.target.value)}
                                style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: '1px solid rgba(255,255,255,0.12)',
                                  borderRadius: '8px',
                                  color: 'rgba(255,255,255,0.85)',
                                  padding: '8px 10px',
                                  fontSize: '13px',
                                  fontFamily: 'var(--font-rajdhani)',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  width: '100%',
                                }}
                              >
                                {ALL_WEAPON_TYPES.map(w => (
                                  <option key={w} value={w} style={{ background: '#0A0E28' }}>{w}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>FAIXA DE PREÇO (EM 💠)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="number"
                                  placeholder="Mínimo"
                                  value={filterMinPrice}
                                  onChange={e => setFilterMinPrice(e.target.value)}
                                  min={0}
                                  style={{
                                    flex: 1, background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '8px', color: 'rgba(255,255,255,0.85)',
                                    padding: '8px 10px', fontSize: '13px',
                                    fontFamily: 'var(--font-rajdhani)', outline: 'none', width: 0,
                                  }}
                                />
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', flexShrink: 0 }}>—</span>
                                <input
                                  type="number"
                                  placeholder="Máximo"
                                  value={filterMaxPrice}
                                  onChange={e => setFilterMaxPrice(e.target.value)}
                                  min={0}
                                  style={{
                                    flex: 1, background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '8px', color: 'rgba(255,255,255,0.85)',
                                    padding: '8px 10px', fontSize: '13px',
                                    fontFamily: 'var(--font-rajdhani)', outline: 'none', width: 0,
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Exterior + StatTrak */}
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>EXTERIOR (DESGASTE)</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {(['FN', 'MW', 'FT', 'WW', 'BS'] as const).map(ext => (
                                  <label key={ext} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                                    <div
                                      onClick={() => setFilterExteriors(prev =>
                                        prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
                                      )}
                                      style={{
                                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                                        border: filterExteriors.includes(ext) ? '2px solid #00E5FF' : '2px solid rgba(255,255,255,0.2)',
                                        background: filterExteriors.includes(ext) ? 'rgba(0,229,255,0.2)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', transition: 'all 0.12s',
                                      }}
                                    >
                                      {filterExteriors.includes(ext) && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#00E5FF">
                                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                        </svg>
                                      )}
                                    </div>
                                    <span className="font-rajdhani" style={{ fontSize: '13px', color: filterExteriors.includes(ext) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
                                      {EXTERIOR_LABELS[ext]}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>STATTRAK™</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                  type="button"
                                  onClick={() => setFilterStatTrak(s => !s)}
                                  style={{
                                    width: '42px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                                    background: filterStatTrak ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.07)',
                                    border: `1px solid ${filterStatTrak ? '#00E5FF' : 'rgba(255,255,255,0.15)'}`,
                                    transition: 'all 0.18s', flexShrink: 0,
                                  }}
                                >
                                  <div style={{
                                    position: 'absolute', top: '3px',
                                    left: filterStatTrak ? 'calc(100% - 20px)' : '3px',
                                    width: '16px', height: '16px', borderRadius: '50%',
                                    background: filterStatTrak ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                                    transition: 'left 0.18s',
                                  }}/>
                                </button>
                                <span className="font-rajdhani" style={{ fontSize: '13px', color: filterStatTrak ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                                  {filterStatTrak ? 'Apenas StatTrak™' : 'Todos'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Active filter chips + actions */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                              {filterWeapon !== 'Todos' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                                  <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{filterWeapon}</span>
                                  <button type="button" onClick={() => setFilterWeapon('Todos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                                  </button>
                                </div>
                              )}
                              {filterExteriors.map(ext => (
                                <div key={ext} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                                  <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{ext}</span>
                                  <button type="button" onClick={() => setFilterExteriors(prev => prev.filter(e => e !== ext))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                                  </button>
                                </div>
                              ))}
                              {filterStatTrak && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                                  <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>StatTrak™</span>
                                  <button type="button" onClick={() => setFilterStatTrak(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                                  </button>
                                </div>
                              )}
                              {(filterMinPrice !== '' || filterMaxPrice !== '') && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                                  <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                                    💠 {filterMinPrice || '0'} – {filterMaxPrice || '∞'}
                                  </span>
                                  <button type="button" onClick={() => { setFilterMinPrice(''); setFilterMaxPrice(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                                  </button>
                                </div>
                              )}
                              {activeFilterCount === 0 && (
                                <span className="font-rajdhani" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>Nenhum filtro ativo</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              {activeFilterCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => { setFilterWeapon('Todos'); setFilterMinPrice(''); setFilterMaxPrice(''); setFilterExteriors([]); setFilterStatTrak(false); }}
                                  style={{
                                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'rgba(255,255,255,0.5)', fontSize: '11px',
                                    fontFamily: 'var(--font-orbitron)', letterSpacing: '0.08em',
                                  }}
                                >
                                  LIMPAR TUDO
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { setShowFilters(false); if (!form.imageUrl) refreshSuggestions(form.name); }}
                                style={{
                                  padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                                  background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)',
                                  color: '#00E5FF', fontSize: '11px',
                                  fontFamily: 'var(--font-orbitron)', letterSpacing: '0.08em',
                                }}
                              >
                                APLICAR ({totalMatches})
                              </button>
                            </div>
                          </div>
                        </div>}

                  {/* Results - inline, fills available space */}
                  <AnimatePresence>
                    {(suggestions.length > 0 || adminProducts.length > 0) && (
                      <motion.div
                        ref={suggestionsRef}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          background: 'rgba(5,8,22,0.99)',
                          border: '1px solid rgba(0,229,255,0.2)',
                          borderRadius: '16px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Results header */}
                        <div style={{
                          padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          flexShrink: 0,
                          background: 'rgba(5,8,22,0.99)',
                        }}>
                          <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em' }}>
                            RESULTADOS ({totalMatches + adminProducts.length})
                          </span>
                          {suggestions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSortBy(s => s === 'price' ? 'name' : 'price')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                            >
                              <span className="font-orbitron" style={{ fontSize: '9px', color: '#00E5FF', letterSpacing: '0.08em' }}>
                                ORDENAR POR: {sortBy === 'price' ? 'PREÇO' : 'NOME'} ↕
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Result rows */}
                        <div ref={suggestionItemsRef} style={{ overflowY: 'auto', maxHeight: '400px' }}>

                          {/* ── Produtos exclusivos do admin ── */}
                          {adminProducts.map(item => (
                            <div
                              key={item.id}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,180,0,0.06)';
                                e.currentTarget.style.borderColor = 'rgba(255,180,0,0.25)';
                                e.currentTarget.style.boxShadow = 'inset 3px 0 0 #FFB300';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'rgba(255,180,0,0.08)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '14px',
                                padding: '10px 14px', cursor: 'default',
                                background: 'transparent',
                                border: '1px solid rgba(255,180,0,0.08)',
                                borderRadius: '10px',
                                margin: '2px 6px',
                                transition: 'background 0.1s, box-shadow 0.1s, border-color 0.1s',
                              }}
                            >
                              <div style={{ width: '77px', height: '55px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.imageUrl
                                  ? <img src={item.imageUrl} alt={item.name} style={{ maxWidth: '77px', maxHeight: '55px', objectFit: 'contain' }} />
                                  : <span style={{ fontSize: '28px' }}>🎁</span>
                                }
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="font-rajdhani font-bold" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                  {item.name}
                                </p>
                                {item.description && (
                                  <p className="font-rajdhani" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                    {item.description}
                                  </p>
                                )}
                                <span className="font-orbitron" style={{ fontSize: '8px', color: '#FFB300', letterSpacing: '0.12em', opacity: 0.7 }}>EXCLUSIVO</span>
                              </div>
                              {isAffiliate && item.pscValue !== null && !item.skipPsc && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                  <svg width="10" height="14" viewBox="0 0 9 12" fill="#00FFA3"><path d="M4.5 0L9 5L4.5 12L0 5Z"/></svg>
                                  <span className="font-orbitron font-bold" style={{ fontSize: '17px', color: '#00FFA3' }}>
                                    {item.pscValue}
                                  </span>
                                </div>
                              )}
                              {item.skipPsc && (
                                <span className="font-orbitron" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>GRÁTIS</span>
                              )}
                              <button
                                type="button"
                                onMouseDown={e => { e.stopPropagation(); e.preventDefault(); applyAdminProduct(item); }}
                                style={{
                                  width: '41px', height: '41px', borderRadius: '10px', flexShrink: 0,
                                  background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.3)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,180,0,0.22)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,180,0,0.08)')}
                              >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="#FFB300"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                              </button>
                            </div>
                          ))}

                          {/* ── Divisor entre exclusivos e CS2 ── */}
                          {adminProducts.length > 0 && suggestions.length > 0 && (
                            <div style={{ margin: '4px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }} />
                          )}

                          {/* ── Itens CS2 (Waxpeer live) ── */}
                          {waxpeerLoading && suggestions.length === 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '10px' }}>
                              <motion.div className="w-4 h-4 rounded-full border-2 border-neon-cyan/20 border-t-neon-cyan" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                              <span className="font-rajdhani text-white/30 text-sm tracking-widest">Buscando no Waxpeer...</span>
                            </div>
                          )}
                          {[...suggestions]
                            .sort((a, b) => sortBy === 'price' ? a.price - b.price : a.name.localeCompare(b.name))
                            .map((item, idx) => {
                              const { weapon, skin, wearAbbr } = parseItemName(item.name);
                              return (
                                <div
                                  key={item.name}
                                  onMouseEnter={e => {
                                    setActiveSuggestion(idx);
                                    e.currentTarget.style.background = 'rgba(0,229,255,0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(0,229,255,0.18)';
                                    e.currentTarget.style.boxShadow = 'inset 3px 0 0 #00E5FF';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '10px 14px', cursor: 'default',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '10px',
                                    margin: '2px 6px',
                                    transition: 'background 0.1s, box-shadow 0.1s, border-color 0.1s',
                                  }}
                                >
                                  <div style={{ width: '77px', height: '55px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={item.image} alt={item.name} style={{ maxWidth: '77px', maxHeight: '55px', objectFit: 'contain' }} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p className="font-rajdhani font-bold" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                      {weapon}{skin ? ` | ${skin}` : ''}
                                    </p>
                                  </div>
                                  {wearAbbr && WEAR_BADGE[wearAbbr] && (
                                    <span className="font-orbitron" style={{
                                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                                      padding: '3px 7px', borderRadius: '6px', flexShrink: 0,
                                      background: WEAR_BADGE[wearAbbr].bg,
                                      color: WEAR_BADGE[wearAbbr].color,
                                      border: `1px solid ${WEAR_BADGE[wearAbbr].border}`,
                                    }}>
                                      {wearAbbr}
                                    </span>
                                  )}
                                  {isAffiliate && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                      <svg width="10" height="14" viewBox="0 0 9 12" fill="#00E5FF"><path d="M4.5 0L9 5L4.5 12L0 5Z"/></svg>
                                      <span className="font-orbitron font-bold" style={{ fontSize: '17px', color: '#00E5FF' }}>
                                        {usdToBrl ? pscFromCents(item.price) : '...'}
                                      </span>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onMouseDown={e => { e.stopPropagation(); e.preventDefault(); applySuggestion(item); }}
                                    style={{
                                      width: '41px', height: '41px', borderRadius: '10px', flexShrink: 0,
                                      background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.2)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.08)')}
                                  >
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="#00E5FF"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                                  </button>
                                </div>
                              );
                            })}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
                            {totalMatches + adminProducts.length} RESULTADO{(totalMatches + adminProducts.length) !== 1 ? 'S' : ''}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Checkbox: sortear sem PSC — só exibe quando o item tem valor em PSC e é afiliado */}
                  {isAffiliate && form.pscValue !== undefined && <label style={{
                    display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer',
                    userSelect: 'none' as const,
                    padding: '16px 18px', borderRadius: '14px',
                    background: form.skipPsc ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${form.skipPsc ? 'rgba(0,229,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '4px', marginTop: '1px', flexShrink: 0,
                      background: form.skipPsc ? '#ffffff' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${form.skipPsc ? '#ffffff' : 'rgba(255,255,255,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {form.skipPsc && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#050816">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={form.skipPsc ?? false}
                      onChange={e => setForm(f => ({ ...f, skipPsc: e.target.checked }))}
                      style={{ display: 'none' }}
                    />
                    <div>
                      <span className="font-rajdhani font-bold text-sm" style={{ color: form.skipPsc ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)' }}>
                        Sortear sem usar PSC
                      </span>
                      <span className="font-rajdhani text-xs" style={{ color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: '4px', lineHeight: 1.5 }}>
                        A entrega do produto fica por conta do streamer.<br/>Nenhum PSC será debitado.
                      </span>
                    </div>
                  </label>}

                </div>

                {/* Sticky footer */}
                <div style={{
                  flexShrink: 0,
                  padding: '12px 28px 20px',
                  background: 'linear-gradient(to top, rgba(5,8,22,1) 70%, rgba(5,8,22,0))',
                  boxShadow: '0 -8px 24px rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <AnimatePresence>
                    {saveError && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                        className="px-3 py-2.5 rounded-lg font-rajdhani text-sm font-semibold tracking-wide"
                        style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: 'rgba(255,120,120,0.95)' }}>
                        {saveError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {(() => {
                    const pendingCount = staged.length + (form.name.trim() ? 1 : 0);
                    const canCommit = editingId ? !!form.name.trim() : pendingCount > 0;
                    const label = editingId
                      ? 'SALVAR ALTERAÇÕES'
                      : pendingCount > 1
                        ? `ADICIONAR ${pendingCount} PRÊMIOS`
                        : 'ADICIONAR PRÊMIO';
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <motion.button
                          onClick={handleSave}
                          whileHover={{ background: 'linear-gradient(90deg, #1976D2 0%, #7B1FA2 100%)' } as never}
                          whileTap={{ scale: 0.98 }}
                          disabled={!canCommit}
                          className="w-full rounded-xl font-rajdhani font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: 'linear-gradient(90deg, #1565C0 0%, #6A1B9A 100%)',
                            boxShadow: canCommit ? '0 4px 24px rgba(21,101,192,0.35), 0 4px 32px rgba(106,27,154,0.25)' : 'none',
                            color: '#fff', fontSize: '13px', letterSpacing: '0.18em',
                            padding: '12px 0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                          }}
                        >
                          <svg width="18" height="17" viewBox="0 0 1280 1194" style={{ flexShrink: 0 }}>
                            <g transform="translate(0,1194) scale(0.1,-0.1)" fill="white">
                              <path d="M3600 11930 c-484 -60 -920 -326 -1186 -725 -162 -244 -251 -498 -273 -785 -36 -446 -35 -545 4 -729 120 -572 567 -1018 1143 -1141 l101 -22 2853 -4 c1569 -2 2923 -5 3008 -6 177 -2 271 13 441 68 598 193 1016 757 1023 1379 1 181 -20 462 -45 594 -121 624 -588 1135 -1202 1312 -190 55 -259 63 -547 63 -287 1 -367 -7 -593 -55 -636 -138 -1210 -530 -1575 -1075 -133 -198 -259 -464 -323 -681 -13 -46 -26 -83 -29 -83 -3 0 -18 44 -35 98 -191 624 -623 1156 -1202 1480 -263 147 -570 250 -887 298 -120 18 -566 27 -676 14z m375 -851 c288 -24 564 -117 790 -266 463 -305 738 -778 780 -1341 l7 -93 -969 3 -968 3 -80 27 c-130 45 -220 101 -316 197 -182 183 -244 362 -234 681 5 154 26 252 75 351 141 282 402 445 715 448 44 0 134 -4 200 -10z m5195 -20 c151 -39 292 -121 401 -235 154 -162 221 -316 240 -554 21 -279 -48 -479 -230 -661 -96 -96 -186 -152 -316 -197 l-80 -27 -968 -3 -969 -3 7 93 c29 394 170 740 420 1030 134 156 352 323 538 412 316 151 703 209 957 145z"/>
                              <path d="M0 6825 l0 -855 2775 0 2775 0 -2 853 -3 852 -2772 3 -2773 2 0 -855z"/>
                              <path d="M7257 7673 c-4 -3 -7 -388 -7 -855 l0 -848 2775 0 2775 0 0 855 0 855 -2768 0 c-1523 0 -2772 -3 -2775 -7z"/>
                              <path d="M857 5113 c-11 -11 -8 -3857 3 -3958 13 -114 24 -167 61 -281 61 -188 157 -342 309 -494 184 -185 379 -292 650 -356 70 -17 186 -18 1873 -21 l1797 -3 -2 2557 -3 2558 -2341 3 c-1287 1 -2344 -1 -2347 -5z"/>
                              <path d="M7257 5113 c-4 -3 -7 -1155 -7 -2560 l0 -2553 1798 3 c1981 3 1825 -2 2022 63 379 126 690 439 813 819 66 203 62 52 62 2245 l0 1985 -2341 3 c-1287 1 -2344 -1 -2347 -5z"/>
                            </g>
                          </svg>
                          {label}
                        </motion.button>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                          <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.02em' }}>
                            Seguro e justo: nossos sorteios são verificados e 100% transparentes.
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                </div>

                {/* Divider */}
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />

                {/* RIGHT: Resumo da premiação */}
                <div style={{ width: '35%', flexShrink: 0, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.18)', overflowY: 'auto' }}>

                  {/* ITENS ADICIONADOS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em' }}>
                        ITENS ADICIONADOS ({staged.reduce((sum, p) => sum + p.quantity, 0)})
                      </span>
                      <AnimatePresence mode="wait">
                        {confirmClearStaged ? (
                          <motion.div
                            key="confirm"
                            initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <span className="font-rajdhani font-bold" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Apagar tudo?</span>
                            <button
                              type="button"
                              onClick={() => { setStaged([]); setConfirmClearStaged(false); }}
                              style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,68,68,0.15)', border: '1px solid rgba(255,68,68,0.4)', color: '#FF6B6B', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearStaged(false)}
                              style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                            >
                              Não
                            </button>
                          </motion.div>
                        ) : staged.length > 0 ? (
                          <motion.button
                            key="trash"
                            type="button"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            onClick={() => setConfirmClearStaged(true)}
                            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center' }}
                            whileHover={{ color: '#FF6B6B' } as never}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 3v1H4v2h1l1 14h12l1-14h1V4h-5V3H9zm0 5h2v9H9V8zm4 0h2v9h-2V8z"/>
                            </svg>
                          </motion.button>
                        ) : null}
                      </AnimatePresence>
                    </div>
                    {staged.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0 8px', gap: '8px' }}>
                        <span style={{ fontSize: '28px' }}>🏆</span>
                        <p className="font-rajdhani text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>Nenhum prêmio<br/>adicionado</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '380px' }}>
                        {staged.map((item, idx) => {
                          const { weapon, skin, wearAbbr } = parseItemName(item.name);
                          return (
                            <div key={`${item.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                              {/* image */}
                              <div style={{ width: '48px', height: '34px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.imageUrl
                                  ? <img src={item.imageUrl} alt={item.name} style={{ maxWidth: '48px', maxHeight: '34px', objectFit: 'contain' }} />
                                  : <span style={{ fontSize: '18px' }}>🏆</span>
                                }
                              </div>
                              {/* name + meta */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <p className="font-rajdhani font-bold" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', margin: 0 }}>
                                    {weapon}{skin ? ` | ${skin}` : ''}
                                  </p>
                                  {wearAbbr && WEAR_BADGE[wearAbbr] && (
                                    <span className="font-orbitron" style={{ fontSize: '8px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', flexShrink: 0, background: WEAR_BADGE[wearAbbr].bg, color: WEAR_BADGE[wearAbbr].color, border: `1px solid ${WEAR_BADGE[wearAbbr].border}` }}>
                                      {wearAbbr}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                  <span className="font-rajdhani" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Qtd: {item.quantity}</span>
                                  {isAffiliate && item.pscValue !== undefined && !item.skipPsc && (
                                    <>
                                      <svg width="6" height="9" viewBox="0 0 8 11" fill="#00E5FF"><path d="M4 0L8 4.5L4 11L0 4.5Z"/></svg>
                                      <span className="font-orbitron font-bold" style={{ fontSize: '10px', color: '#00E5FF' }}>{item.pscValue.toLocaleString('pt-BR')}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {/* qty controls */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <button type="button" onClick={() => changeStageQty(idx, -1)}
                                  style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', transition: 'background 0.12s, color 0.12s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                                >
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
                                </button>
                                <span className="font-orbitron font-bold" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', minWidth: '16px', textAlign: 'center' }}>{item.quantity}</span>
                                <button type="button" onClick={() => changeStageQty(idx, 1)}
                                  style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00E5FF', transition: 'background 0.12s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.18)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.07)'; }}
                                >
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                                </button>
                              </div>
                              {/* trash */}
                              <button type="button" onClick={() => removeStaged(idx)}
                                style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,68,68,0.4)', transition: 'color 0.15s, background 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,68,68,0.9)'; e.currentTarget.style.background = 'rgba(255,68,68,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,68,68,0.4)'; e.currentTarget.style.background = 'transparent'; }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <AnimatePresence>
                      {stageQtyError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                          <span className="font-rajdhani font-bold" style={{ fontSize: '11px', color: '#FF6B6B', letterSpacing: '0.02em' }}>
                            Saldo insuficiente para adicionar este prêmio.
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* RESUMO DA PREMIAÇÃO */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span className="font-orbitron text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em' }}>RESUMO DA PREMIAÇÃO</span>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Itens adicionados</span>
                        <span className="font-orbitron font-bold" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>{staged.reduce((sum, p) => sum + p.quantity, 0)}</span>
                      </div>
                      {isAffiliate && (<>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Valor total</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className="font-orbitron font-bold" style={{ fontSize: '13px', color: '#00E5FF' }}>
                            {stagedCost.toLocaleString('pt-BR')}
                          </span>
                          <svg width="8" height="11" viewBox="0 0 8 11" fill="#00E5FF"><path d="M4 0L8 4.5L4 11L0 4.5Z"/></svg>
                        </div>
                      </div>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="font-rajdhani text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Saldo restante</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className="font-orbitron font-bold" style={{ fontSize: '13px', color: (pscBalance - alreadySpent - stagedCost) >= 0 ? '#00FFA3' : '#FF6B6B' }}>
                            {(pscBalance - alreadySpent - stagedCost).toLocaleString('pt-BR')}
                          </span>
                          <svg width="8" height="11" viewBox="0 0 8 11" fill="#00FFA3"><path d="M4 0L8 4.5L4 11L0 4.5Z"/></svg>
                        </div>
                      </div>
                      </>)}
                  </div>

                  {/* ── TRANSFORMAR EM LISTA RÁPIDA ── */}
                  <AnimatePresence>
                    {staged.length >= 3 && !quickListDismissed && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', borderRadius: '10px', flexShrink: 0,
                          background: 'rgba(160,80,255,0.07)',
                          border: '1px solid rgba(160,80,255,0.25)',
                          position: 'relative',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="font-rajdhani font-bold" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.3 }}>
                            ⚡ {staged.reduce((sum, p) => sum + p.quantity, 0)} itens — transformar em lista?
                          </p>
                          <p className="font-rajdhani" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', margin: 0, lineHeight: 1.4 }}>
                            Crie uma lista rápida e sorteie em segundos.
                          </p>
                        </div>
                        <motion.button
                          onClick={() => { setSaveListName(''); setQuickSaveItems([...staged]); setShowSaveModal(true); }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className="font-rajdhani font-bold tracking-widest flex-shrink-0"
                          style={{
                            fontSize: '12px', padding: '10px 16px', borderRadius: '8px',
                            background: 'rgba(160,80,255,0.2)', border: '1px solid rgba(160,80,255,0.5)',
                            color: '#C080FF', cursor: 'pointer', letterSpacing: '0.06em',
                            alignSelf: 'stretch', display: 'flex', alignItems: 'center',
                          }}
                        >
                          Criar
                        </motion.button>
                        <button
                          type="button"
                          onClick={() => setQuickListDismissed(true)}
                          style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '5px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', transition: 'color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}

      {/* ── FILTER POPUP PORTAL ── */}
      {createPortal(
        <AnimatePresence>
          {showFilters && filterPopupPos && (
            <>
              {/* backdrop — closes popup on outside click */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => { setShowFilters(false); setFilterPopupPos(null); }}
              />
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed',
                  top: filterPopupPos.top,
                  left: filterPopupPos.left,
                  zIndex: 9999,
                  minWidth: '520px',
                  background: 'rgba(8,12,32,0.98)',
                  border: '1px solid rgba(0,229,255,0.2)',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 32px rgba(0,229,255,0.06)',
                }}
              >
                {/* Row 1: Tipo de Arma + Faixa de Preço */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>TIPO DE ARMA</span>
                    <select
                      value={filterWeapon}
                      onChange={e => setFilterWeapon(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px', color: 'rgba(255,255,255,0.85)',
                        padding: '8px 10px', fontSize: '13px',
                        fontFamily: 'var(--font-rajdhani)', cursor: 'pointer', outline: 'none', width: '100%',
                      }}
                    >
                      {ALL_WEAPON_TYPES.map(w => (
                        <option key={w} value={w} style={{ background: '#0A0E28' }}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>FAIXA DE PREÇO (EM 💠)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number" placeholder="Mínimo" value={filterMinPrice}
                        onChange={e => setFilterMinPrice(e.target.value)} min={0}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'rgba(255,255,255,0.85)', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-rajdhani)', outline: 'none', width: 0 }}
                      />
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', flexShrink: 0 }}>—</span>
                      <input
                        type="number" placeholder="Máximo" value={filterMaxPrice}
                        onChange={e => setFilterMaxPrice(e.target.value)} min={0}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'rgba(255,255,255,0.85)', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-rajdhani)', outline: 'none', width: 0 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Exterior + StatTrak */}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>EXTERIOR (DESGASTE)</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(['FN', 'MW', 'FT', 'WW', 'BS'] as const).map(ext => (
                        <label key={ext} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                          <div
                            onClick={() => setFilterExteriors(prev => prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext])}
                            style={{
                              width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                              border: filterExteriors.includes(ext) ? '2px solid #00E5FF' : '2px solid rgba(255,255,255,0.2)',
                              background: filterExteriors.includes(ext) ? 'rgba(0,229,255,0.2)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'all 0.12s',
                            }}
                          >
                            {filterExteriors.includes(ext) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="#00E5FF">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            )}
                          </div>
                          <span className="font-rajdhani" style={{ fontSize: '13px', color: filterExteriors.includes(ext) ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
                            {EXTERIOR_LABELS[ext]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span className="font-orbitron" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>STATTRAK™</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setFilterStatTrak(s => !s)}
                        style={{
                          width: '42px', height: '24px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                          background: filterStatTrak ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.07)',
                          border: `1px solid ${filterStatTrak ? '#00E5FF' : 'rgba(255,255,255,0.15)'}`,
                          transition: 'all 0.18s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: '3px',
                          left: filterStatTrak ? 'calc(100% - 20px)' : '3px',
                          width: '16px', height: '16px', borderRadius: '50%',
                          background: filterStatTrak ? '#00E5FF' : 'rgba(255,255,255,0.35)',
                          transition: 'left 0.18s',
                        }}/>
                      </button>
                      <span className="font-rajdhani" style={{ fontSize: '13px', color: filterStatTrak ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
                        {filterStatTrak ? 'Apenas StatTrak™' : 'Todos'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active filter chips + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                    {filterWeapon !== 'Todos' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                        <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{filterWeapon}</span>
                        <button type="button" onClick={() => setFilterWeapon('Todos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      </div>
                    )}
                    {filterExteriors.map(ext => (
                      <div key={ext} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                        <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{ext}</span>
                        <button type="button" onClick={() => setFilterExteriors(prev => prev.filter(e => e !== ext))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      </div>
                    ))}
                    {filterStatTrak && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                        <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>StatTrak™</span>
                        <button type="button" onClick={() => setFilterStatTrak(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      </div>
                    )}
                    {(filterMinPrice !== '' || filterMaxPrice !== '') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)' }}>
                        <span className="font-rajdhani" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
                          💠 {filterMinPrice || '0'} – {filterMaxPrice || '∞'}
                        </span>
                        <button type="button" onClick={() => { setFilterMinPrice(''); setFilterMaxPrice(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: '0 0 0 2px', lineHeight: 1, display: 'flex' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                      </div>
                    )}
                    {activeFilterCount === 0 && (
                      <span className="font-rajdhani" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>Nenhum filtro ativo</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => { setFilterWeapon('Todos'); setFilterMinPrice(''); setFilterMaxPrice(''); setFilterExteriors([]); setFilterStatTrak(false); }}
                        style={{ padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.08em' }}
                      >
                        LIMPAR TUDO
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setShowFilters(false); setFilterPopupPos(null); if (!form.imageUrl) refreshSuggestions(form.name); }}
                      style={{ padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)', color: '#00E5FF', fontSize: '11px', fontFamily: 'var(--font-orbitron)', letterSpacing: '0.08em' }}
                    >
                      APLICAR ({totalMatches})
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      , document.body)}

      {/* ── CREATE SAVED LIST MODAL ── */}
      <CreateSavedListModal
        isOpen={showCreateListModal}
        onClose={() => setShowCreateListModal(false)}
      />

      {/* ── MAIN CONTENT ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── SAVED LISTS (compact grid) ── */}
        {savedLists.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {savedLists.length <= 2 ? (
              /* 1–2 listas: centralizadas */
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                {savedLists.slice(0, 2).map(list => (
                  <motion.button
                    key={list.id}
                    onClick={() => handleLoadList(list)}
                    whileHover={{ borderColor: 'rgba(160,80,255,0.65)', boxShadow: '0 0 14px rgba(160,80,255,0.18)', scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    style={{ flex: '0 0 calc((100% - 4px) / 3)', padding: '2px 2px', borderRadius: '4px', background: 'rgba(255,255,255,0.025)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.08)', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', overflow: 'hidden' }}
                  >
                    <p className="font-rajdhani font-bold truncate w-full text-center" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, margin: 0 }}>{list.name}</p>
                    <p className="font-rajdhani" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{list.items.length} {list.items.length !== 1 ? 'itens' : 'item'}</p>
                  </motion.button>
                ))}
              </div>
            ) : (
              <>
                {/* row 1: primeiros 3 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                  {savedLists.slice(0, 3).map(list => (
                    <motion.button
                      key={list.id}
                      onClick={() => handleLoadList(list)}
                      whileHover={{ borderColor: 'rgba(160,80,255,0.65)', boxShadow: '0 0 14px rgba(160,80,255,0.18)', scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      style={{ padding: '2px 2px', borderRadius: '4px', background: 'rgba(255,255,255,0.025)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.08)', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', overflow: 'hidden' }}
                    >
                      <p className="font-rajdhani font-bold truncate w-full text-center" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, margin: 0 }}>{list.name}</p>
                      <p className="font-rajdhani" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{list.items.length} {list.items.length !== 1 ? 'itens' : 'item'}</p>
                    </motion.button>
                  ))}
                </div>
                {/* row 2: itens 4–5, centralizados */}
                {savedLists.length > 3 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                    {savedLists.slice(3, 5).map(list => (
                      <motion.button
                        key={list.id}
                        onClick={() => handleLoadList(list)}
                        whileHover={{ borderColor: 'rgba(160,80,255,0.65)', boxShadow: '0 0 14px rgba(160,80,255,0.18)', scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        style={{ flex: '0 0 calc((100% - 4px) / 3)', padding: '2px 2px', borderRadius: '4px', background: 'rgba(255,255,255,0.025)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.08)', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', overflow: 'hidden' }}
                      >
                        <p className="font-rajdhani font-bold truncate w-full text-center" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, margin: 0 }}>{list.name}</p>
                        <p className="font-rajdhani" style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{list.items.length} {list.items.length !== 1 ? 'itens' : 'item'}</p>
                      </motion.button>
                    ))}
                  </div>
                )}
              </>
            )}
            {/* VER TODOS — só quando há mais de 5 listas */}
            {savedLists.length > 5 && (
              <motion.button
                onClick={() => setShowLoadModal(true)}
                whileHover={{ color: '#00E5FF' }}
                transition={{ duration: 0.15 }}
                style={{ fontSize: '10px', color: '#00B8CC', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', letterSpacing: '0.1em', textAlign: 'center', width: '100%' }}
                className="font-rajdhani font-bold"
              >
                + VER TODOS &gt;
              </motion.button>
            )}
          </div>
        )}

        {/* ── QUICK LIST SUCCESS TOAST ── */}
        <AnimatePresence>
          {saveListSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-rajdhani text-xs font-bold tracking-widest"
              style={{ background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.25)', color: '#00FFA3' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              LISTA CRIADA!
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FILE IMPORT ── */}
        <AnimatePresence mode="wait">
          {fileImported ? (
            <motion.div
              key="imported"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl"
              style={{ background: 'rgba(0,255,163,0.05)', border: '1px solid rgba(0,255,163,0.2)', padding: '20px 24px' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(0,255,163,0.12)', border: '1px solid rgba(0,255,163,0.25)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#00FFA3">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-rajdhani text-xs text-white/35 tracking-widest uppercase mb-0.5">Arquivo importado</p>
                    <p className="font-rajdhani font-bold text-white/80 text-sm">{importFileName}</p>
                    <p className="font-orbitron text-neon-green font-bold text-base mt-0.5">
                      {importCount} <span className="font-rajdhani text-white/35 text-xs font-normal">prêmio{importCount > 1 ? 's' : ''}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearImport}
                  className="font-rajdhani text-xs tracking-widest px-3 py-2 rounded-lg transition-all"
                  style={{ color: 'rgba(255,68,68,0.6)', border: '1px solid rgba(255,68,68,0.15)' }}
                >
                  TROCAR
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              {excelPrizesImportEnabled && (
                <motion.div
                  className="relative rounded-xl border-2 border-dashed text-center cursor-pointer transition-all duration-300"
                  style={{
                    padding: '20px 16px',
                    borderColor: isDragging ? '#FFD166' : 'rgba(255,255,255,0.08)',
                    background: isDragging ? 'rgba(255,209,102,0.06)' : 'rgba(255,255,255,0.02)',
                    boxShadow: isDragging ? '0 0 30px rgba(255,209,102,0.15)' : 'none',
                  }}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
                  <AnimatePresence mode="wait">
                    {isProcessing ? (
                      <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-3">
                        <motion.div
                          className="w-5 h-5 rounded-full border-2 border-neon-gold/30 border-t-neon-gold"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        />
                        <span className="font-rajdhani text-neon-gold text-sm tracking-widest">PROCESSANDO...</span>
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-3">
                        <motion.div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(255,209,102,0.1)', border: '1px solid rgba(255,209,102,0.2)' }}
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFD166">
                            <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                          </svg>
                        </motion.div>
                        <div className="text-left">
                          <p className="font-rajdhani text-white/60 text-sm">
                            {isDragging ? 'Solte o arquivo aqui' : 'Arraste ou clique para importar prêmios'}
                          </p>
                          <p className="font-rajdhani text-white/25 text-xs tracking-wider">.XLSX · .XLS · .CSV</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
              <AnimatePresence>
                {importErrors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl p-3 space-y-1"
                    style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)' }}
                  >
                    <p className="font-rajdhani text-xs font-bold tracking-wider mb-1.5" style={{ color: '#FF4444' }}>
                      {importErrors.length} aviso{importErrors.length > 1 ? 's' : ''}
                    </p>
                    {importErrors.slice(0, 4).map((err, i) => (
                      <p key={i} className="font-rajdhani text-xs" style={{ color: 'rgba(255,68,68,0.8)' }}>{err.message}</p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PRIZE LIST ── */}
        <div className="space-y-2">
          {prizes.length > 0 && (
            <div className="flex justify-end">
              <AnimatePresence mode="wait">
                {confirmClear ? (
                  <motion.div key="confirm" initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2">
                    <span className="font-rajdhani text-xs text-white/30 tracking-widest">Tem certeza?</span>
                    <button
                      onClick={() => { clearPrizes(); setConfirmClear(false); clearImport(); }}
                      className="font-rajdhani text-xs font-bold tracking-widest px-2 py-1 rounded transition-all"
                      style={{ color: '#FF4444', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)' }}
                    >
                      SIM, REMOVER
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="font-rajdhani text-xs tracking-widest px-2 py-1 rounded transition-all"
                      style={{ color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      CANCELAR
                    </button>
                  </motion.div>
                ) : (
                  <motion.button key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setConfirmClear(true)}
                    className="font-rajdhani text-xs text-white/25 hover:text-red-400 transition-colors tracking-widest px-2 py-1 rounded hover:bg-red-500/10"
                  >
                    REMOVER TUDO
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
          <AnimatePresence>
            {prizes.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                <div className="text-4xl mb-3">🏆</div>
                <p className="font-rajdhani text-white/25 text-sm tracking-widest">Nenhum prêmio adicionado</p>
              </motion.div>
            ) : (
              prizes.filter(p => p.quantity > 0).slice(0, visibleCount).map((prize, i) => {
                const isDragging = dragIndex === i;
                const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
                return (
                  <div key={prize.id} style={{ position: 'relative' }}>
                    {isOver && (
                      <div style={{
                        position: 'absolute', top: '-2px', left: 0, right: 0,
                        height: '3px', borderRadius: '2px',
                        background: 'linear-gradient(90deg, #00E5FF, #00E5FF44)',
                        zIndex: 10, pointerEvents: 'none',
                      }} />
                    )}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: i * 0.04 }}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== i) reorderPrizes(dragIndex, i);
                        setDragIndex(null); setOverIndex(null);
                      }}
                      onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                      className="flex items-center gap-4 rounded-xl px-5 py-4 transition-all"
                      style={{
                        background: isOver ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.02)',
                        border: isOver ? '1px solid rgba(0,229,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
                        opacity: isDragging ? 0.35 : 1,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        transition: 'opacity 0.15s, background 0.15s, border-color 0.15s',
                      }}
                    >
                      <div className="flex-shrink-0 flex flex-col gap-1 opacity-25" style={{ width: '14px' }}>
                        {[0,1,2].map(r => (
                          <div key={r} style={{ display: 'flex', gap: '3px' }}>
                            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'white' }} />
                            <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'white' }} />
                          </div>
                        ))}
                      </div>
                      <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <span className="font-orbitron text-white/30 font-bold" style={{ fontSize: '13px' }}>{i + 1}</span>
                      </div>
                      <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: 'rgba(255,209,102,0.1)', border: '1px solid rgba(255,209,102,0.15)' }}>
                        {prize.imageUrl ? (
                          <img src={prize.imageUrl} alt={prize.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{PRIZE_ICONS[i % PRIZE_ICONS.length]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-rajdhani font-bold text-base text-white truncate">{prize.name}</p>
                        {prize.description && (
                          <p className="font-rajdhani text-sm text-white/35 truncate">{prize.description}</p>
                        )}
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => updatePrize(prize.id, { quantity: Math.max(1, prize.quantity - 1) })}
                            style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', lineHeight: 1, flexShrink: 0 }}
                          >−</button>
                          <span className="font-orbitron font-bold" style={{ fontSize: '13px', color: '#FFD166', minWidth: '22px', textAlign: 'center' }}>{prize.quantity}</span>
                          {(() => {
                            const canAdd = !isAffiliate || prize.skipPsc || prize.pscValue == null || pscBalance - totalPscSpent - prize.pscValue >= 0;
                            return (
                              <button
                                onClick={() => { if (canAdd) updatePrize(prize.id, { quantity: prize.quantity + 1 }); }}
                                style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: canAdd ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.15)', cursor: canAdd ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', lineHeight: 1, flexShrink: 0 }}
                              >+</button>
                            );
                          })()}
                        </div>
                      </div>
                      {isAffiliate && prize.pscValue != null && (
                        <div className="flex-shrink-0">
                          <p className="font-orbitron text-sm" style={{ color: '#00FFA3', opacity: 0.7 }}>
                            💠 {prize.pscValue.toLocaleString('pt-BR')}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(prize)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-neon-gold hover:bg-neon-gold/10 transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 000-1.42l-2.34-2.34a1 1 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => removePrize(prize.id)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })
            )}
          </AnimatePresence>
          {prizes.filter(p => p.quantity > 0).length > visibleCount && (
            <motion.button
              onClick={() => setVisibleCount(c => c + 10)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl font-rajdhani font-bold tracking-widest text-sm flex items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
            >
              VER MAIS
              <span className="font-rajdhani text-xs font-normal" style={{ color: 'rgba(255,255,255,0.25)' }}>
                ({prizes.filter(p => p.quantity > 0).length - visibleCount} restantes)
              </span>
            </motion.button>
          )}
        </div>

      </div>
    </>
  );
});

export default PrizeManager;
