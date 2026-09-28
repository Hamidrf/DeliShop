import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client';
import { products } from '../../db/schema';
import { ApiError, notFound, validationFailed } from '../../lib/errors';
import { serializeStudioProduct } from '../../lib/serialize';
import { storage, randomSuffix } from '../../lib/storage';
import { assertDrawing, assertProductPhoto, assertVoice, processDrawing, processProductPhoto } from '../../lib/uploads';
import { categorySchema, colorSchema } from '../../lib/validators';

export const studioProductsRoute = new Hono();

studioProductsRoute.get('/', async c => {
  const archived = c.req.query('archived') === 'true';
  const rows = await db.select().from(products)
    .where(archived ? isNotNull(products.archivedAt) : isNull(products.archivedAt))
    .orderBy(desc(products.createdAt));
  return c.json({ products: rows.map(serializeStudioProduct) });
});

const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  category: categorySchema,
  color: colorSchema,
  price: z.coerce.number().int().positive(),
  story: z.string().max(600).optional().default(''),
});

async function nameTaken(name: string, excludeId?: string) {
  const conditions = [isNull(products.archivedAt), sql`lower(${products.name}) = lower(${name})`];
  if (excludeId) conditions.push(sql`${products.id} != ${excludeId}`);
  const rows = await db.select({ id: products.id }).from(products).where(and(...conditions)).limit(1);
  return rows.length > 0;
}

studioProductsRoute.post('/', async c => {
  const body = await c.req.parseBody();
  const parsed = fieldsSchema.safeParse({
    name: body.name,
    category: body.category,
    color: body.color,
    price: body.price,
    story: body.story,
  });
  if (!parsed.success) throw validationFailed('Please check the product fields.', flatten(parsed.error));
  const fields = parsed.data;

  if (await nameTaken(fields.name)) throw new ApiError(409, 'name_taken', 'A product with this name already exists.');

  const drawingFile = body.drawing;
  if (!(drawingFile instanceof File)) throw validationFailed('The drawing is required.', { drawing: 'required' });
  const drawingBytes = Buffer.from(await drawingFile.arrayBuffer());
  assertDrawing(drawingBytes);
  const drawing = await processDrawing(drawingBytes);
  const drawingKey = `products/drawing-${randomSuffix()}.webp`;
  await storage.put('media', drawingKey, drawing.buffer, 'image/webp');

  let photoKey: string | null = null;
  if (body.photo instanceof File && body.photo.size > 0) {
    const photoBytes = Buffer.from(await body.photo.arrayBuffer());
    assertProductPhoto(photoBytes);
    const photo = await processProductPhoto(photoBytes);
    photoKey = `products/photo-${randomSuffix()}.webp`;
    await storage.put('media', photoKey, photo.buffer, 'image/webp');
  }

  let voiceKey: string | null = null;
  let voiceMime: string | null = null;
  if (body.voice instanceof File && body.voice.size > 0) {
    const voiceBytes = Buffer.from(await body.voice.arrayBuffer());
    const sig = assertVoice(voiceBytes);
    voiceKey = `products/voice-${randomSuffix()}.${sig.ext}`;
    voiceMime = sig.mime;
    await storage.put('media', voiceKey, voiceBytes, sig.mime);
  }

  const positionRows = await db.select({ next: sql<number>`coalesce(max(${products.position}), 0) + 1` }).from(products);
  const next = positionRows[0]?.next ?? 1;

  const [created] = await db.insert(products).values({
    name: fields.name,
    category: fields.category,
    color: fields.color,
    price: fields.price,
    story: fields.story,
    drawingKey,
    drawingWidth: drawing.width,
    drawingHeight: drawing.height,
    drawingCrop: null,
    photoKey,
    voiceKey,
    voiceMime,
    position: next,
  }).returning();

  return c.json({ product: serializeStudioProduct(created!) }, 201);
});

studioProductsRoute.delete('/:id', async c => {
  const id = c.req.param('id');
  const [updated] = await db.update(products)
    .set({ archivedAt: new Date() })
    .where(and(eq(products.id, id), isNull(products.archivedAt)))
    .returning();
  if (!updated) throw notFound('Product not found.');
  return c.body(null, 204);
});

studioProductsRoute.post('/:id/restore', async c => {
  const id = c.req.param('id');
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) throw notFound('Product not found.');

  if (await nameTaken(existing.name, existing.id)) {
    throw new ApiError(409, 'name_taken', 'Another active product already has this name.');
  }

  const [restored] = await db.update(products).set({ archivedAt: null }).where(eq(products.id, id)).returning();
  return c.json({ product: serializeStudioProduct(restored!) });
});

function flatten(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'field')] = issue.message;
  return fields;
}
