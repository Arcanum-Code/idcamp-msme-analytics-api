import { t, type Static } from "elysia";
import { createTbResponseSchema, createTbErrorSchema } from "@/libs/response";

// ── Request ──────────────────────────────────────────────────────────
export const ColumnMapParamSchema = t.Object({
  uploadId: t.String(),
});

// The client submits only the fields they are resolving.
// At least one must be provided (minProperties: 1).
export const SaveColumnMapBodySchema = t.Object({
  resolvedMappings: t.Object(
    {
      date: t.Optional(t.String({ minLength: 1 })),
      product: t.Optional(t.String({ minLength: 1 })),
      category: t.Optional(t.String({ minLength: 1 })),
      quantity: t.Optional(t.String({ minLength: 1 })),
      unitPrice: t.Optional(t.String({ minLength: 1 })),
      totalPrice: t.Optional(t.String({ minLength: 1 })),
      paymentMethod: t.Optional(t.String({ minLength: 1 })),
    },
    { minProperties: 1 },
  ),
});

export type SaveColumnMapInput = Static<typeof SaveColumnMapBodySchema>;

// ── Response ─────────────────────────────────────────────────────────
const ColumnMapResultSchema = t.Record(
  t.String(),
  t.Union([t.String(), t.Null()]),
);

export const SaveColumnMapResponseSchema = createTbResponseSchema(
  t.Object({
    columnMap: ColumnMapResultSchema,
  }),
);

export const UploadErrorSchema = createTbErrorSchema(t.Null());
