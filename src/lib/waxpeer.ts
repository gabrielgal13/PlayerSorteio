// Waxpeer REST API v1 client
// Docs: https://api.waxpeer.com/docs  (verifique endpoints se precisar ajustar)
// Auth: query param `api=KEY` em todas as chamadas

const BASE = 'https://api.waxpeer.com/v1';
const key = () => process.env.WAXPEER_API_KEY ?? '';

function url(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ api: key(), ...params });
  return `${BASE}${path}?${q}`;
}

export interface WaxpeerListing {
  item_id: string;   // ID do listing (usado para comprar)
  name: string;
  price: number;     // preço em centavos de USD (ex: 599 = $5.99)
  image: string;
}

export interface WaxpeerPriceItem {
  name: string;
  price: number;  // centavos USD
  image: string;
}

// Armas CS2 válidas para filtro (exclui music kits, cases, stickers, etc.)
const WEAPON_PREFIXES = new Set([
  'AK-47','AWP','M4A4','M4A1-S','Desert Eagle','USP-S','Glock-18','P250',
  'Five-SeveN','Tec-9','CZ75-Auto','P2000','Dual Berettas','R8 Revolver',
  'MP9','MAC-10','PP-Bizon','P90','MP5-SD','MP7','UMP-45',
  'Nova','XM1014','MAG-7','Sawed-Off','M249','Negev',
  'FAMAS','Galil AR','AUG','SG 553','SSG 08','SCAR-20','G3SG1',
  'Karambit','M9 Bayonet','Butterfly Knife','Bayonet','Flip Knife','Gut Knife',
  'Falchion Knife','Shadow Daggers','Bowie Knife','Huntsman Knife','Stiletto Knife',
  'Navaja Knife','Ursus Knife','Talon Knife','Nomad Knife','Skeleton Knife',
  'Paracord Knife','Survival Knife','Classic Knife',
]);

function isWeaponSkin(name: string): boolean {
  const clean = name.startsWith('StatTrak™ ') ? name.slice(10) : name;
  const isKnife = clean.startsWith('★ ');
  const base = isKnife ? clean.slice(2) : clean;
  const pipeIdx = base.indexOf(' | ');
  if (pipeIdx < 0) return false;
  if (isKnife) return true;
  return WEAPON_PREFIXES.has(base.slice(0, pipeIdx));
}

function extractPrice(r: Record<string, unknown>): number {
  // Waxpeer pode retornar o preço em campos diferentes dependendo do endpoint
  for (const field of ['price', 'avg', 'cheapest_price', 'min', 'min_price']) {
    const val = r[field];
    if (val !== undefined && val !== null) {
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return 0;
}

/** Busca items no marketplace com o mais barato por nome (para browse/autocomplete). */
export async function browseItems(search: string, limit = 200): Promise<WaxpeerPriceItem[]> {
  const params: Record<string, string> = { game: 'csgo', sort: 'price', order: 'asc' };
  if (search) params.search = search;
  const res = await fetch(url('/prices', params));
  if (!res.ok) return [];
  const data = await res.json() as { success?: boolean; items?: unknown };
  if (!data.items) return [];

  let raw: WaxpeerPriceItem[];
  if (Array.isArray(data.items)) {
    raw = (data.items as Record<string, unknown>[]).map(r => ({
      name: String(r.name ?? ''),
      price: extractPrice(r),
      image: String(r.img ?? r.image ?? ''),
    }));
  } else {
    raw = Object.entries(data.items as Record<string, Record<string, unknown>>).map(([name, r]) => ({
      name,
      price: extractPrice(r),
      image: String(r.img ?? r.image ?? ''),
    }));
  }

  // Deduplica por nome mantendo o mais barato, filtra só armas
  const map = new Map<string, WaxpeerPriceItem>();
  for (const item of raw) {
    if (!isWeaponSkin(item.name)) continue;
    const ex = map.get(item.name);
    if (!ex || item.price < ex.price) map.set(item.name, item);
  }
  return Array.from(map.values()).sort((a, b) => a.price - b.price).slice(0, limit);
}

export interface WaxpeerSearchResult {
  success: boolean;
  items: WaxpeerListing[];
}

export interface WaxpeerBuyResult {
  success: boolean;
  id: string;        // ID do item comprado (usado para withdraw)
  msg: string;
}

export interface WaxpeerWithdrawResult {
  success: boolean;
  msg: string;
}

/** Busca listings disponíveis pelo market hash name (ex: "AK-47 | Redline (Field-Tested)") */
export async function checkStock(marketHashName: string): Promise<WaxpeerListing[]> {
  const res = await fetch(
    url('/search-items-by-name', { game: 'csgo', sort: 'price', order: 'asc' })
    + `&names[]=${encodeURIComponent(marketHashName)}`,
  );
  if (!res.ok) throw new Error(`Waxpeer search HTTP ${res.status}`);
  const data = await res.json() as WaxpeerSearchResult;
  if (!data.success) return [];
  return data.items ?? [];
}

/** Compra o listing mais barato disponível para o item. Retorna o item_id comprado. */
export async function buyItem(listing: WaxpeerListing): Promise<WaxpeerBuyResult> {
  const res = await fetch(
    url('/buy-one-p2p-item', {
      id: listing.item_id,
      price: String(listing.price),
    }),
  );
  if (!res.ok) throw new Error(`Waxpeer buy HTTP ${res.status}`);
  const data = await res.json() as WaxpeerBuyResult;
  return data;
}

/** Envia o item comprado para o trade link do vencedor. */
export async function withdrawItem(itemId: string, tradeLink: string): Promise<WaxpeerWithdrawResult> {
  const res = await fetch(
    url('/withdraw-items', {
      id: itemId,
      trade_link: tradeLink,
    }),
  );
  if (!res.ok) throw new Error(`Waxpeer withdraw HTTP ${res.status}`);
  const data = await res.json() as WaxpeerWithdrawResult;
  return data;
}

/** Verifica saldo disponível na conta Waxpeer. */
export async function getBalance(): Promise<number> {
  const res = await fetch(url('/get-my-steam-id'));
  if (!res.ok) return 0;
  const data = await res.json() as { success: boolean; user?: { wallet?: number } };
  return data.user?.wallet ?? 0;
}
