import { useMemo, useSyncExternalStore } from 'react';
import { BUILTIN, fromStored, type Crop, type Product, type StoredProduct } from './products';
import type { BgKey } from './theme';

// Everything lives in this browser's localStorage until the shop has a backend.
// Keys match the Claude Design prototypes so data carries over.
export const KEYS = {
  products: 'delishop-products',
  hidden: 'delishop-hidden',
  bag: 'delishop-bag',
  orders: 'delishop-orders',
} as const;
type Key = (typeof KEYS)[keyof typeof KEYS];

export interface BagItem extends Omit<Crop, 'photo'> {
  name: string;
  price: number;
  bg: BgKey;
  real: string | null;
  qty: number;
}

export interface Order {
  no: string;
  date: number;
  name: string;
  phone: string;
  items: { name: string; price: number; qty: number }[];
}

const LOCAL_EVENT = 'delishop-storage';
const cache = new Map<Key, { raw: string | null; value: unknown }>();

function readRaw(key: Key): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function read<T>(key: Key): T[] {
  const raw = readRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T[];
  let value: T[] = [];
  try { value = JSON.parse(raw || '[]'); } catch { /* corrupt entry: treat as empty */ }
  cache.set(key, { raw, value });
  return value;
}

/** Returns false when the browser refuses the write (usually storage quota). */
export function write(key: Key, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: key }));
  return true;
}

export function remove(key: Key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: key }));
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

/** Live view of a stored list; re-renders on changes from this tab and others. */
export function useStored<T>(key: Key): T[] {
  return useSyncExternalStore(subscribe, () => read<T>(key));
}

/**
 * Every product still for sale. The shop lists originals first and then
 * studio additions oldest-first; the studio lists its newest additions first.
 */
export function useCatalog(order: 'shop' | 'studio'): Product[] {
  const stored = useStored<StoredProduct>(KEYS.products);
  const hidden = useStored<string>(KEYS.hidden);
  return useMemo(() => {
    const custom = stored.map(fromStored);
    const all = order === 'shop' ? BUILTIN.concat(custom.slice().reverse()) : custom.concat(BUILTIN);
    return all.filter(p => !hidden.includes(p.name));
  }, [stored, hidden, order]);
}

export function addToBag(p: Product) {
  const bag = read<BagItem>(KEYS.bag).map(b => ({ ...b }));
  const hit = bag.find(b => b.name === p.name);
  if (hit) hit.qty += 1;
  else bag.push({ name: p.name, price: p.price, bg: p.bg, src: p.src, iw: p.iw, ih: p.ih, x: p.x, y: p.y, w: p.w, h: p.h, clip: p.clip, real: p.real, qty: 1 });
  write(KEYS.bag, bag);
}

/**
 * Takes a product off the shop and out of every bag. Studio additions are
 * erased; the built-in originals are only hidden.
 */
export function deleteProduct(p: Product) {
  if (p.custom) write(KEYS.products, read<StoredProduct>(KEYS.products).filter(c => c.id !== p.id));
  else write(KEYS.hidden, Array.from(new Set(read<string>(KEYS.hidden).concat(p.name))));
  write(KEYS.bag, read<BagItem>(KEYS.bag).filter(b => b.name !== p.name));
}
