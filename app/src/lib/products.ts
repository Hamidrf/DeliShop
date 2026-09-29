import type { BgKey, Category } from './theme';

/** A rectangular window onto a source image, optionally clipped. */
export interface Crop {
  src: string;
  iw: number;
  ih: number;
  x: number;
  y: number;
  w: number;
  h: number;
  clip: string;
  /** Cropped from a colour photo rather than the pencil sketch sheet. */
  photo: boolean;
}

export interface Product extends Crop {
  id: string;
  name: string;
  price: number;
  cat: Category;
  bg: BgKey;
  /** Real product photos with a transparent background, if there are any — shown as a slider. */
  photos: string[];
  /** The same photos' raw storage keys, in the same order — only present from `/studio/products`, used by the edit form to say which existing photos to keep. */
  photoKeys: string[];
  /** The first real photo, if there is one — what a single-image spot (thumbnails, the hand/ear/bag stage) shows. */
  real: string | null;
  story: string;
  voice: string | null;
  custom: boolean;
}

/** The shape `GET /api/products` and `GET /api/studio/products` return — see docs/backend-architecture.md §4. */
export interface ApiProduct {
  id: string;
  name: string;
  category: Category;
  color: BgKey;
  price: number;
  story: string;
  drawing: {
    url: string;
    width: number;
    height: number;
    crop: { x: number; y: number; w: number; h: number; clip: string } | null;
  };
  photos: string[];
  /** Only present from `/studio/products` — see `Product.photoKeys`. */
  photoKeys?: string[];
  voiceUrl: string | null;
}

export function productFromApi(p: ApiProduct): Product {
  const crop = p.drawing.crop;
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    cat: p.category,
    bg: p.color,
    photos: p.photos,
    photoKeys: p.photoKeys ?? [],
    real: p.photos[0] ?? null,
    story: p.story,
    voice: p.voiceUrl,
    custom: false,
    src: p.drawing.url,
    iw: p.drawing.width,
    ih: p.drawing.height,
    x: crop?.x ?? 0,
    y: crop?.y ?? 0,
    w: crop?.w ?? p.drawing.width,
    h: crop?.h ?? p.drawing.height,
    clip: crop?.clip ?? 'none',
    photo: false,
  };
}

/** Image filter that cleans up the scanned paper behind a drawing. */
export const artFilter = (p: Pick<Crop, 'src' | 'photo'>) =>
  p.photo ? 'contrast(1.35) brightness(1.12) saturate(1.2)' : 'contrast(1.25) brightness(1.08)';

/** Percent offsets that place the full source image so only the crop shows. */
export const cropStyle = (p: Omit<Crop, 'photo'>) => ({
  width: (p.iw / p.w * 100).toFixed(3) + '%',
  left: (-p.x / p.w * 100).toFixed(3) + '%',
  top: (-p.y / p.h * 100).toFixed(3) + '%',
  clipPath: p.clip || 'none',
});
