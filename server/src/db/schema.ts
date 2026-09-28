import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const productCategory = pgEnum('product_category', ['Keychains', 'Earrings', 'Pins']);
export const cardColor = pgEnum('card_color', ['mint', 'pink', 'orange', 'purple', 'yellow', 'green']);
export const orderStatus = pgEnum('order_status', [
  'awaiting_review',
  'confirmed',
  'shipped',
  'rejected',
  'cancelled',
]);

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  adminId: uuid('admin_id').notNull().references(() => admins.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('sessions_expires_at_idx').on(table.expiresAt),
]);

export interface DrawingCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  clip: string;
}

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: productCategory('category').notNull(),
  color: cardColor('color').notNull(),
  price: integer('price').notNull(),
  story: text('story').notNull().default(''),
  drawingKey: text('drawing_key').notNull(),
  drawingWidth: integer('drawing_width').notNull(),
  drawingHeight: integer('drawing_height').notNull(),
  drawingCrop: jsonb('drawing_crop').$type<DrawingCrop | null>(),
  photoKey: text('photo_key'),
  voiceKey: text('voice_key'),
  voiceMime: text('voice_mime'),
  position: integer('position').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check('products_price_check', sql`${table.price} > 0`),
  // Partial indexes: the shop only ever lists active products, and two
  // active products can't share a name (the cart and existing localStorage
  // data both key products by name).
  index('products_position_active_idx').on(table.position).where(sql`${table.archivedAt} is null`),
  uniqueIndex('products_lower_name_active_idx').on(sql`lower(${table.name})`).where(sql`${table.archivedAt} is null`),
]);

// Order numbers customers are told over the phone; starts past the range of
// the random 4-digit numbers the old localStorage prototype used, so a
// customer reading out an old number is obviously not a real server order.
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1001, minValue: 1001 });

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: integer('number').notNull().unique().default(sql`nextval('order_number_seq')`),
  status: orderStatus('status').notNull().default('awaiting_review'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  total: integer('total').notNull(),
  receiptKey: text('receipt_key').notNull(),
  receiptMime: text('receipt_mime').notNull(),
  adminNote: text('admin_note'),
  statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('orders_status_created_at_idx').on(table.status, table.createdAt),
  index('orders_customer_phone_idx').on(table.customerPhone),
]);

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
}, table => [
  check('order_items_quantity_check', sql`${table.quantity} between 1 and 20`),
  index('order_items_order_id_idx').on(table.orderId),
]);

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  admin: one(admins, { fields: [sessions.adminId], references: [admins.id] }),
}));
