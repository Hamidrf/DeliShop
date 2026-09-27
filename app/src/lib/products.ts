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
  id?: number;
  name: string;
  price: number;
  cat: Category;
  bg: BgKey;
  /** Real product photo with a transparent background, if we have one. */
  real: string | null;
  story: string;
  voice: string | null;
  custom: boolean;
}

/** Shape saved in localStorage by the studio "New product" form. */
export interface StoredProduct {
  id: number;
  name: string;
  cat: Category;
  bg: BgKey;
  price: number;
  story: string;
  drawing: string;
  dw: number;
  dh: number;
  photo: string | null;
  voice: string | null;
}

const SHEET = '/art/sheet.jpg';
const SW = 2048, SH = 2048, PW = 1125, PH = 1500;
const COLS = [[0, 509], [519, 1018], [1029, 1532], [1543, 2048]];
const ROWS = [[0, 678], [689, 1362], [1373, 2048]];

type Win = [number, number, number, number];
type Pt = [number, number];

/** Sketch-sheet cell n (1-12): window and optional notches, in cell fractions. */
function cell(n: number, win: Win, numNotch?: Pt | null, rightNotch?: Pt | null): Crop {
  const c = COLS[(n - 1) % 4], r = ROWS[Math.floor((n - 1) / 4)];
  const cw = c[1] - c[0], ch = r[1] - r[0];
  const X0 = c[0] + win[0] * cw, X1 = c[0] + win[1] * cw, Y0 = r[0] + win[2] * ch, Y1 = r[0] + win[3] * ch;
  let clip = 'none';
  if (numNotch || rightNotch) {
    const nx = numNotch ? c[0] + numNotch[0] * cw : X0, ny = numNotch ? r[0] + numNotch[1] * ch : Y0;
    const rx = rightNotch ? c[0] + rightNotch[0] * cw : X1, ry = rightNotch ? r[0] + rightNotch[1] * ch : Y0;
    const p = (x: number, y: number) => `${(x / SW * 100).toFixed(3)}% ${(y / SH * 100).toFixed(3)}%`;
    clip = `polygon(${[p(nx, Y0), p(rx, Y0), p(rx, ry), p(X1, ry), p(X1, Y1), p(X0, Y1), p(X0, ny), p(nx, ny)].join(',')})`;
  }
  return { src: SHEET, iw: SW, ih: SH, x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0, clip, photo: false };
}

const photo = (file: string, x: number, y: number, w: number, h: number): Crop =>
  ({ src: '/art/' + file, iw: PW, ih: PH, x, y, w, h, clip: 'none', photo: true });

type Seed = Omit<Product, 'custom' | 'voice' | 'real' | 'story'> & { real?: string };

const SEEDS: Seed[] = [
  { name: 'Super Fox', price: 200, cat: 'Keychains', bg: 'orange', real: '/assets/real/super-fox.png', ...photo('fox.jpeg', 150, 370, 900, 1000) },
  { name: 'Balloon', price: 75, cat: 'Keychains', bg: 'yellow', ...cell(1, [.13, .78, 0, .9]) },
  { name: 'Mystery Ball', price: 500, cat: 'Keychains', bg: 'purple', ...cell(7, [.06, .97, 0, .58], [.14, .12]) },
  { name: 'Heart Cards', price: 100, cat: 'Keychains', bg: 'pink', ...photo('cards.jpeg', 140, 350, 700, 700) },
  { name: 'Flower', price: 150, cat: 'Earrings', bg: 'green', ...cell(2, [.13, .78, 0, .85]) },
  { name: 'Cat', price: 150, cat: 'Pins', bg: 'mint', ...cell(8, [.13, .82, 0, .78]) },
  { name: 'Book', price: 250, cat: 'Pins', bg: 'mint', ...photo('book.jpeg', 275, 410, 700, 700) },
  { name: 'Lip', price: 100, cat: 'Earrings', bg: 'pink', ...cell(11, [0, .86, .2, 1], null, [.74, .37]) },
  { name: 'Charms', price: 100, cat: 'Earrings', bg: 'purple', ...cell(3, [.13, .78, 0, .85]) },
  { name: 'Panda', price: 150, cat: 'Pins', bg: 'yellow', ...photo('panda.jpeg', 180, 300, 860, 1020) },
  { name: 'Guitar', price: 200, cat: 'Pins', bg: 'orange', ...cell(12, [.13, .8, 0, 1]) },
  { name: 'Card', price: 100, cat: 'Pins', bg: 'green', ...cell(4, [.13, .8, 0, .65]) },
  { name: 'Snail', price: 150, cat: 'Keychains', bg: 'pink', ...cell(10, [0, .82, 0, 1], [.15, .13]) },
  { name: 'Butterfly & Flower', price: 150, cat: 'Earrings', bg: 'mint', ...photo('bf.jpeg', 180, 400, 600, 710) },
  { name: 'Banana', price: 75, cat: 'Keychains', bg: 'yellow', ...cell(5, [.13, .78, 0, .8]) },
  { name: 'Beachwear', price: 250, cat: 'Pins', bg: 'purple', ...cell(9, [0, 1, 0, 1], [.13, .13], [.76, .73]) },
];

const STORIES: Record<string, string> = {
  'Super Fox': 'This is Super Fox. He wears a black mask so nobody knows he is secretly very soft. He saves lost socks at night.',
  'Balloon': 'My balloon wanted to fly away, so I put it on a keychain. Now it stays with you and still feels like floating.',
  'Mystery Ball': 'Nobody knows what is inside the Mystery Ball. Not even me. Shake it and make a wish.',
  'Heart Cards': 'I drew hearts for everyone I love. There were too many, so I made cards you can keep.',
  'Flower': 'This flower never needs water. It only needs you to smile at it once a day.',
  'Cat': "This cat sleeps all day and dreams about fish in the sky. Please don't wake her up.",
  'Book': 'I wrote this book about a girl who could talk to clouds. The clouds told her all their secrets.',
  'Lip': 'This lip is always happy. When you are sad, it smiles for you.',
  'Charms': 'Little charms for little luck. Put one on your bag and good things will follow you.',
  'Panda': 'Panda eats bamboo for breakfast, lunch and dinner. On Fridays he eats cake.',
  'Guitar': 'My guitar plays only happy songs. If you listen very close you can hear it.',
  'Card': 'A tiny card for a tiny message. Write something nice and give it to a friend.',
  'Snail': 'Snail is slow, but she always gets there. She carries her house so she is never lost.',
  'Butterfly & Flower': 'The butterfly found the flower and they became best friends. Now they go everywhere together.',
  'Banana': 'This banana is too cute to eat. It likes to hang out and make people laugh.',
  'Beachwear': 'Summer clothes for summer days. I drew them when I was dreaming about the sea.',
};

export const BUILTIN: Product[] = SEEDS.map(s => ({
  ...s, real: s.real ?? null, story: STORIES[s.name] ?? '', voice: null, custom: false,
}));

export function fromStored(c: StoredProduct): Product {
  return {
    id: c.id, name: c.name, price: c.price, cat: c.cat, bg: c.bg,
    src: c.drawing, iw: c.dw, ih: c.dh, x: 0, y: 0, w: c.dw, h: c.dh, clip: 'none', photo: false,
    real: c.photo || null, story: c.story || '', voice: c.voice || null, custom: true,
  };
}

/** Image filter that cleans up the scanned paper behind a drawing. */
export const artFilter = (p: Pick<Crop, 'src' | 'photo'>) =>
  p.photo || p.src !== SHEET ? 'contrast(1.35) brightness(1.12) saturate(1.2)' : 'contrast(1.25) brightness(1.08)';

/** Percent offsets that place the full source image so only the crop shows. */
export const cropStyle = (p: Omit<Crop, 'photo'>) => ({
  width: (p.iw / p.w * 100).toFixed(3) + '%',
  left: (-p.x / p.w * 100).toFixed(3) + '%',
  top: (-p.y / p.h * 100).toFixed(3) + '%',
  clipPath: p.clip || 'none',
});
