import type { InferSelectModel } from 'drizzle-orm';
import { storage } from './storage';
import type { products } from '../db/schema';

type ProductRow = InferSelectModel<typeof products>;

/** Shape the frontend's `Product` type expects — see docs/backend-architecture.md §4. */
export function serializeProduct(p: ProductRow) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    color: p.color,
    price: p.price,
    story: p.story,
    drawing: {
      url: storage.publicUrl(p.drawingKey),
      width: p.drawingWidth,
      height: p.drawingHeight,
      crop: p.drawingCrop,
    },
    photoUrl: p.photoKey ? storage.publicUrl(p.photoKey) : null,
    voiceUrl: p.voiceKey ? storage.publicUrl(p.voiceKey) : null,
  };
}

export function serializeStudioProduct(p: ProductRow) {
  return {
    ...serializeProduct(p),
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}
