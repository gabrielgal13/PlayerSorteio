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

/** Busca items no marketplace com o mais barato por nome (para browse/autocomplete). */
export async function browseItems(search: string): Promise<WaxpeerPriceItem[]> {
  const res = await fetch(
    url('/prices', { game: 'csgo', search, sort: 'price', order: 'asc' }),
  );
  if (!res.ok) return [];
  const data = await res.json() as {
    success: boolean;
    items?: Array<{ name: string; price: number; img: string }> | Record<string, { price: number; img: string }>;
  };
  if (!data.success || !data.items) return [];

  const raw: WaxpeerPriceItem[] = Array.isArray(data.items)
    ? data.items.map(i => ({ name: i.name, price: i.price, image: i.img }))
    : Object.entries(data.items as Record<string, { price: number; img: string }>)
        .map(([name, i]) => ({ name, price: i.price, image: i.img }));

  // Deduplica por nome mantendo o mais barato
  const map = new Map<string, WaxpeerPriceItem>();
  for (const item of raw) {
    const ex = map.get(item.name);
    if (!ex || item.price < ex.price) map.set(item.name, item);
  }
  return Array.from(map.values()).sort((a, b) => a.price - b.price).slice(0, 200);
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
