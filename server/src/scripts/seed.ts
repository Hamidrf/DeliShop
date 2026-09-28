import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db, pool } from '../db/client';
import type { DrawingCrop } from '../db/schema';
import { products } from '../db/schema';
import { storage, randomSuffix } from '../lib/storage';
import { processProductPhoto } from '../lib/uploads';
import type { CardColor, ProductCategory } from '../lib/validators';

const ART_DIR = path.resolve(__dirname, '../../../app/public/art');
const REAL_DIR = path.resolve(__dirname, '../../../app/public/assets/real');

interface Seed {
  name: string;
  price: number;
  category: ProductCategory;
  color: CardColor;
  story: string;
  source: string; // filename in ART_DIR — several seeds share the same sheet.jpg
  crop: DrawingCrop;
  realPhoto?: string; // filename in REAL_DIR
}

// Ported 1:1 from the `BUILTIN` array the frontend computes in
// `app/src/lib/products.ts` (dumped once with `tsx` and pasted here) so the
// shop looks pixel-identical after the move to the server. See
// docs/backend-architecture.md §10 "کارهایی که کوچک به نظر می‌رسند ولی نیستند".
const SEEDS: Seed[] = [
  { name: 'Super Fox', price: 200, category: 'Keychains', color: 'orange', source: 'fox.jpeg', realPhoto: 'super-fox.png',
    crop: { x: 150, y: 370, w: 900, h: 1000, clip: 'none' },
    story: 'This is Super Fox. He wears a black mask so nobody knows he is secretly very soft. He saves lost socks at night.' },
  { name: 'Balloon', price: 75, category: 'Keychains', color: 'yellow', source: 'sheet.jpg',
    crop: { x: 66.17, y: 0, w: 330.85, h: 610.2, clip: 'none' },
    story: 'My balloon wanted to fly away, so I put it on a keychain. Now it stays with you and still feels like floating.' },
  { name: 'Mystery Ball', price: 500, category: 'Keychains', color: 'purple', source: 'sheet.jpg',
    crop: { x: 1059.18, y: 689, w: 457.7299999999998, h: 390.3399999999999, clip: 'polygon(53.683% 33.643%,74.068% 33.643%,74.068% 33.643%,74.068% 33.643%,74.068% 52.702%,51.718% 52.702%,51.718% 37.586%,53.683% 37.586%)' },
    story: 'Nobody knows what is inside the Mystery Ball. Not even me. Shake it and make a wish.' },
  { name: 'Heart Cards', price: 100, category: 'Keychains', color: 'pink', source: 'cards.jpeg',
    crop: { x: 140, y: 350, w: 700, h: 700, clip: 'none' },
    story: 'I drew hearts for everyone I love. There were too many, so I made cards you can keep.' },
  { name: 'Flower', price: 150, category: 'Earrings', color: 'green', source: 'sheet.jpg',
    crop: { x: 583.87, y: 0, w: 324.35, h: 576.3, clip: 'none' },
    story: 'This flower never needs water. It only needs you to smile at it once a day.' },
  { name: 'Cat', price: 150, category: 'Pins', color: 'mint', source: 'sheet.jpg',
    crop: { x: 1608.65, y: 689, w: 348.4499999999998, h: 524.94, clip: 'none' },
    story: "This cat sleeps all day and dreams about fish in the sky. Please don't wake her up." },
  { name: 'Book', price: 250, category: 'Pins', color: 'mint', source: 'book.jpeg',
    crop: { x: 275, y: 410, w: 700, h: 700, clip: 'none' },
    story: 'I wrote this book about a girl who could talk to clouds. The clouds told her all their secrets.' },
  { name: 'Lip', price: 100, category: 'Earrings', color: 'pink', source: 'sheet.jpg',
    crop: { x: 1029, y: 1508, w: 432.5799999999999, h: 540, clip: 'polygon(50.244% 73.633%,68.419% 73.633%,68.419% 79.236%,71.366% 79.236%,71.366% 100.000%,50.244% 100.000%,50.244% 73.633%,50.244% 73.633%)' },
    story: 'This lip is always happy. When you are sad, it smiles for you.' },
  { name: 'Charms', price: 100, category: 'Earrings', color: 'purple', source: 'sheet.jpg',
    crop: { x: 1094.39, y: 0, w: 326.95000000000005, h: 576.3, clip: 'none' },
    story: 'Little charms for little luck. Put one on your bag and good things will follow you.' },
  { name: 'Panda', price: 150, category: 'Pins', color: 'yellow', source: 'panda.jpeg',
    crop: { x: 180, y: 300, w: 860, h: 1020, clip: 'none' },
    story: 'Panda eats bamboo for breakfast, lunch and dinner. On Fridays he eats cake.' },
  { name: 'Guitar', price: 200, category: 'Pins', color: 'orange', source: 'sheet.jpg',
    crop: { x: 1608.65, y: 1373, w: 338.3499999999999, h: 675, clip: 'none' },
    story: 'My guitar plays only happy songs. If you listen very close you can hear it.' },
  { name: 'Card', price: 100, category: 'Pins', color: 'green', source: 'sheet.jpg',
    crop: { x: 1608.65, y: 0, w: 338.3499999999999, h: 440.7, clip: 'none' },
    story: 'A tiny card for a tiny message. Write something nice and give it to a friend.' },
  { name: 'Snail', price: 150, category: 'Keychains', color: 'pink', source: 'sheet.jpg',
    crop: { x: 519, y: 1373, w: 409.17999999999995, h: 675, clip: 'polygon(28.997% 67.041%,45.321% 67.041%,45.321% 67.041%,45.321% 67.041%,45.321% 100.000%,25.342% 100.000%,25.342% 71.326%,28.997% 71.326%)' },
    story: 'Snail is slow, but she always gets there. She carries her house so she is never lost.' },
  { name: 'Butterfly & Flower', price: 150, category: 'Earrings', color: 'mint', source: 'bf.jpeg',
    crop: { x: 180, y: 400, w: 600, h: 710, clip: 'none' },
    story: 'The butterfly found the flower and they became best friends. Now they go everywhere together.' },
  { name: 'Banana', price: 75, category: 'Keychains', color: 'yellow', source: 'sheet.jpg',
    crop: { x: 66.17, y: 689, w: 330.85, h: 538.4000000000001, clip: 'none' },
    story: 'This banana is too cute to eat. It likes to hang out and make people laugh.' },
  { name: 'Beachwear', price: 250, category: 'Pins', color: 'purple', source: 'sheet.jpg',
    crop: { x: 0, y: 1373, w: 509, h: 675, clip: 'polygon(3.231% 67.041%,18.889% 67.041%,18.889% 91.101%,24.854% 91.101%,24.854% 100.000%,0.000% 100.000%,0.000% 71.326%,3.231% 71.326%)' },
    story: 'Summer clothes for summer days. I drew them when I was dreaming about the sea.' },
];

interface UploadedSource {
  key: string;
  width: number;
  height: number;
}

// Several seeds point at the same `sheet.jpg`; upload each source file once.
const sourceCache = new Map<string, Promise<UploadedSource>>();

function uploadSource(filename: string): Promise<UploadedSource> {
  let promise = sourceCache.get(filename);
  if (!promise) {
    promise = (async () => {
      const raw = await readFile(path.join(ART_DIR, filename));
      // Re-encoded to WebP (and metadata stripped) like every other drawing,
      // without resizing — these coordinates were computed against the
      // source files' real pixel dimensions.
      const webp = await sharp(raw).webp({ quality: 90 }).toBuffer();
      const meta = await sharp(webp).metadata();
      const key = `products/drawing-${randomSuffix()}.webp`;
      await storage.put('media', key, webp, 'image/webp');
      return { key, width: meta.width ?? 0, height: meta.height ?? 0 };
    })();
    sourceCache.set(filename, promise);
  }
  return promise;
}

async function main() {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length) {
    console.log('Products table is not empty — skipping seed. Delete the rows first if you want to reseed.');
    return;
  }

  for (const [index, seed] of SEEDS.entries()) {
    const drawing = await uploadSource(seed.source);

    let photoKey: string | null = null;
    if (seed.realPhoto) {
      const raw = await readFile(path.join(REAL_DIR, seed.realPhoto));
      const photo = await processProductPhoto(raw);
      photoKey = `products/photo-${randomSuffix()}.webp`;
      await storage.put('media', photoKey, photo.buffer, 'image/webp');
    }

    await db.insert(products).values({
      name: seed.name,
      category: seed.category,
      color: seed.color,
      price: seed.price,
      story: seed.story,
      drawingKey: drawing.key,
      drawingWidth: drawing.width,
      drawingHeight: drawing.height,
      drawingCrop: seed.crop,
      photoKey,
      position: index + 1,
    });
    console.log(`Seeded "${seed.name}".`);
  }

  console.log(`Done — ${SEEDS.length} products seeded.`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
