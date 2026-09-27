export const INK = '#1d1b19';
export const PAPER = '#FBF8F2';

export const COLORS = {
  mint: '#97DDD6',
  pink: '#FF97AB',
  orange: '#FF844B',
  purple: '#D383FF',
  yellow: '#FFE24D',
  green: '#B6FF80',
} as const;

export type BgKey = keyof typeof COLORS;

export const CATEGORIES = ['Keychains', 'Earrings', 'Pins'] as const;
export type Category = (typeof CATEGORIES)[number];
export type CategoryFilter = 'All' | Category;
export const FILTERS: CategoryFilter[] = ['All', ...CATEGORIES];

export const CAT_COLOR: Record<CategoryFilter, string> = {
  All: INK,
  Keychains: COLORS.yellow,
  Earrings: COLORS.pink,
  Pins: COLORS.mint,
};

export const bgImage = (bg: BgKey) => `/assets/bg/${bg}.png`;
export const colorOf = (bg: string) => COLORS[bg as BgKey] ?? '#fff';

/** Payment card shown on the checkout page. */
export const CARD_NUMBER = '6037 9975 1234 5678';
export const CARD_HOLDER = 'DeliShop';
