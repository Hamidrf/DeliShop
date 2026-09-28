import { z } from 'zod';

export const categorySchema = z.enum(['Keychains', 'Earrings', 'Pins']);
export const colorSchema = z.enum(['mint', 'pink', 'orange', 'purple', 'yellow', 'green']);
export const orderStatusSchema = z.enum(['awaiting_review', 'confirmed', 'shipped', 'rejected', 'cancelled']);

export type ProductCategory = z.infer<typeof categorySchema>;
export type CardColor = z.infer<typeof colorSchema>;

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

export const orderItemsSchema = z.array(orderItemInputSchema).min(1).max(30);

/** Which status transitions the studio is allowed to make from a given status. Anything else is final. */
export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  awaiting_review: ['confirmed', 'rejected'],
  confirmed: ['shipped', 'cancelled'],
  shipped: [],
  rejected: [],
  cancelled: [],
};
