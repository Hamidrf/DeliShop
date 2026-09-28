import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from './api';
import { productFromApi, type ApiProduct, type Product } from './products';
import { queryClient } from './queryClient';

export const KEYS = { bag: 'delishop-bag' } as const;
type Key = (typeof KEYS)[keyof typeof KEYS];

/** What the cart keeps in this browser's localStorage — just enough to re-order from the server. */
export interface BagEntry {
  productId: string;
  qty: number;
}

const LOCAL_EVENT = 'delishop-storage';
// useSyncExternalStore requires a stable reference when nothing changed, so
// re-parsing on every call (without this) makes it re-render forever.
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

/** The shop lists active products in `position` order; the studio lists everything (incl. archived), newest first. */
export function useCatalog(order: 'shop' | 'studio'): Product[] {
  const path = order === 'shop' ? '/products' : '/studio/products';
  const { data } = useQuery({
    queryKey: order === 'shop' ? ['products'] : ['studio', 'products'],
    queryFn: () => api.get<{ products: ApiProduct[] }>(path),
  });
  return (data?.products ?? []).map(productFromApi);
}

export function addToBag(p: Product) {
  const bag = read<BagEntry>(KEYS.bag);
  const hit = bag.find(b => b.productId === p.id);
  if (hit) hit.qty += 1;
  else bag.push({ productId: p.id, qty: 1 });
  write(KEYS.bag, bag);
}

export function changeBagQty(productId: string, delta: number) {
  const bag = read<BagEntry>(KEYS.bag)
    .map(b => b.productId === productId ? { ...b, qty: b.qty + delta } : b)
    .filter(b => b.qty > 0);
  write(KEYS.bag, bag);
}

/** Archives the product on the server and takes it out of this browser's bag. */
export async function deleteProduct(p: Product) {
  await api.del(`/studio/products/${p.id}`);
  write(KEYS.bag, read<BagEntry>(KEYS.bag).filter(b => b.productId !== p.id));
  await queryClient.invalidateQueries({ queryKey: ['products'] });
  await queryClient.invalidateQueries({ queryKey: ['studio', 'products'] });
}
