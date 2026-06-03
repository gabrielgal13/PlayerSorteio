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

const WEAR_STRINGS: Record<string, string> = {
  FN: '(Factory New)',
  MW: '(Minimal Wear)',
  FT: '(Field-Tested)',
  WW: '(Well-Worn)',
  BS: '(Battle-Scarred)',
};

/** Busca items no marketplace com o mais barato por nome (para browse/autocomplete).
 *  Preços em milli-dólares: 1000 = $1.00 = 1 PSC. */
export async function browseItems(
  search: string,
  limit = 200,
  minPriceMilli = 0,
  maxPriceMilli = 0,
  wears: string[] = [],
  weaponType = '',
  statTrakOnly = false,
): Promise<WaxpeerPriceItem[]> {
  const params: Record<string, string> = { game: 'csgo', sort: 'price', order: 'asc' };
  // Passa weapon type ou search para a Waxpeer tentar filtrar no lado deles
  const waxpeerSearch = weaponType || search;
  if (waxpeerSearch) params.search = waxpeerSearch;
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

  // Deduplica por nome mantendo o mais barato, aplica filtros de preço
  const map = new Map<string, WaxpeerPriceItem>();
  for (const item of raw) {
    if (!isWeaponSkin(item.name)) continue;
    if (minPriceMilli > 0 && item.price < minPriceMilli) continue;
    if (maxPriceMilli > 0 && item.price > maxPriceMilli) continue;
    const ex = map.get(item.name);
    if (!ex || item.price < ex.price) map.set(item.name, item);
  }

  let results = Array.from(map.values()).sort((a, b) => a.price - b.price);

  // Filtros garantidos no servidor (não dependem do suporte da Waxpeer)
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(item => item.name.toLowerCase().includes(q));
  }
  if (weaponType && weaponType !== 'Todos') {
    results = results.filter(item => {
      const clean = item.name.startsWith('StatTrak™ ') ? item.name.slice(10) : item.name;
      const base = clean.startsWith('★ ') ? clean.slice(2) : clean;
      return base.startsWith(weaponType + ' |') || base === weaponType;
    });
  }
  if (wears.length > 0) {
    results = results.filter(item => wears.some(w => item.name.includes(WEAR_STRINGS[w] ?? '')));
  }
  if (statTrakOnly) {
    results = results.filter(item => item.name.startsWith('StatTrak™ ') || item.name.includes('★ StatTrak™'));
  }

  return results.slice(0, limit);
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

function extractTradeUrlParams(tradeLink: string): { partner: string; token: string } | null {
  const m = tradeLink.match(/partner=(\d+)&token=([\w-]+)/);
  if (!m) return null;
  return { partner: m[1], token: m[2] };
}

/** Compra o listing mais barato e entrega direto na Steam do trade link.
 *  Se `projectId` for fornecido (recomendado: nosso historyId), a Waxpeer guarda
 *  como referência e pode ser consultado depois via `checkTradesByProjectId`. */
export async function buyItem(listing: WaxpeerListing, tradeLink: string, projectId?: string): Promise<WaxpeerBuyResult> {
  const params = extractTradeUrlParams(tradeLink);
  if (!params) throw new Error('Trade link inválido');
  const queryParams: Record<string, string> = {
    item_id: listing.item_id,
    price: String(listing.price),
    partner: params.partner,
    token: params.token,
  };
  if (projectId) queryParams.project_id = projectId;
  const res = await fetch(url('/buy-one-p2p', queryParams));
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Waxpeer buy HTTP ${res.status} | body: ${body.slice(0, 300)}`);
  }
  const data = await res.json() as WaxpeerBuyResult & { id?: string | number };
  if (!data.success) {
    throw new Error(`Waxpeer buy rejected | msg: ${data.msg ?? 'no msg'}`);
  }
  return { ...data, id: String(data.id ?? '') };
}

/* ── Trade status polling ─────────────────────────────────────────────
 * Após /buy-one-p2p, a Waxpeer leva alguns minutos pra:
 *   1. o vendedor enviar a oferta na Steam (~5min de janela)
 *   2. o comprador aceitar na Steam
 *   3. a Waxpeer detectar a aceitação e marcar como concluída
 * Polling via /check-many-project-id retorna o estado real de cada compra. */

export interface WaxpeerTradeStatus {
  id?: string | number;
  project_id?: string;
  /** Status numérico — interpretado por `classifyTradeStatus` abaixo. */
  status?: number;
  /** ID da trade offer na Steam (presente após a oferta ser enviada). */
  trade_id?: string | number | null;
  /** `true` quando a Waxpeer considera a trade finalizada (aceita pelo comprador). */
  done?: boolean;
  /** Mensagem de cancelamento/erro, se houver. */
  reason?: string;
  cancel_reason?: string;
  for_steamid64?: string;
  /** Preço pago em centavos. */
  price?: number;
}

export type TradeOutcome =
  | { kind: 'pending'; reason?: string }    // ainda em andamento (vendedor enviando ou aguardando aceitar)
  | { kind: 'delivered'; tradeId?: string } // comprador aceitou na Steam, item entregue
  | { kind: 'failed'; reason: string };     // cancelado / recusado / expirado / reembolsado

/**
 * Mapeia o `status` numérico da Waxpeer + flags para um dos 3 estados acima.
 *
 * Códigos observados (Waxpeer P2P):
 *   0 = Sending     — vendedor preparando a oferta
 *   1 = Active      — oferta enviada, aguardando comprador aceitar na Steam
 *   2 = Cancelled   — algo cancelou (timeout, recusa, vendedor sumiu)
 *   3 = Accepted    — comprador aceitou, item entregue
 *   4 = Declined    — comprador recusou
 *   5 = Refunded    — Waxpeer reembolsou (vendedor não enviou)
 *   6 = Sent        — oferta criada, sendo enviada à Steam
 *
 * Como a doc da Waxpeer é instável, a função é defensiva: se `done === true`
 * tratamos como entregue; se `cancel_reason`/`reason` indicar falha, tratamos
 * como falha; resto é "pending" e o cron tenta de novo no próximo tick.
 */
export function classifyTradeStatus(t: WaxpeerTradeStatus): TradeOutcome {
  // Sinais explícitos de sucesso
  if (t.done === true) return { kind: 'delivered', tradeId: t.trade_id ? String(t.trade_id) : undefined };
  if (t.status === 3) return { kind: 'delivered', tradeId: t.trade_id ? String(t.trade_id) : undefined };

  // Sinais explícitos de falha
  const failedStatuses = new Set([2, 4, 5]);
  if (typeof t.status === 'number' && failedStatuses.has(t.status)) {
    return { kind: 'failed', reason: t.cancel_reason ?? t.reason ?? `status=${t.status}` };
  }
  if (t.cancel_reason || (t.reason && /cancel|refund|declin|expir/i.test(t.reason))) {
    return { kind: 'failed', reason: t.cancel_reason ?? t.reason ?? 'cancelled' };
  }

  return { kind: 'pending', reason: t.reason };
}

/** Consulta o estado de múltiplas compras pelos project_ids (= nossos historyIds). */
export async function checkTradesByProjectId(projectIds: string[]): Promise<WaxpeerTradeStatus[]> {
  if (!projectIds.length) return [];
  const q = new URLSearchParams({ api: key() });
  for (const id of projectIds) q.append('project_ids[]', id);
  const res = await fetch(`${BASE}/check-many-project-id?${q.toString()}`);
  if (!res.ok) return [];
  const data = await res.json() as { success?: boolean; trades?: WaxpeerTradeStatus[]; msg?: string };
  if (!data.success) return [];
  return data.trades ?? [];
}

/** Fallback: consulta por trade IDs da Waxpeer (o `id` retornado por /buy-one-p2p). */
export async function checkTradesById(tradeIds: string[]): Promise<WaxpeerTradeStatus[]> {
  if (!tradeIds.length) return [];
  const q = new URLSearchParams({ api: key() });
  for (const id of tradeIds) q.append('id[]', id);
  const res = await fetch(`${BASE}/check-many-steam?${q.toString()}`);
  if (!res.ok) return [];
  const data = await res.json() as { success?: boolean; trades?: WaxpeerTradeStatus[]; msg?: string };
  if (!data.success) return [];
  return data.trades ?? [];
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
