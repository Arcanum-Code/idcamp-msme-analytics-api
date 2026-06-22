import { t, type Static } from "elysia";
import { createResponseSchema, createErrorSchema } from "@/libs/response";

// ── Existing: Column Map (PATCH) ─────────────────────────────────────
export const ColumnMapParamSchema = t.Object({
  uploadId: t.String(),
});

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

const ColumnMapResultSchema = t.Record(
  t.String(),
  t.Union([t.String(), t.Null()]),
);

export const SaveColumnMapResponseSchema = createResponseSchema(
  t.Object({
    columnMap: ColumnMapResultSchema,
  }),
);

export const UploadErrorSchema = createErrorSchema(t.Null());

// ── New: File Upload (POST) ──────────────────────────────────────────
export const UploadFileBodySchema = t.Object({
  file: t.File(),
});

export type UploadFileInput = Static<typeof UploadFileBodySchema>;

const UploadFileDataSchema = t.Object({
  uploadId: t.String(),
  filename: t.String(),
  status: t.String(),
  unmappedRequired: t.Optional(t.Array(t.String())),
  detectedColumns: t.Optional(t.Array(t.String())),
});

export const UploadFileResponseSchema =
  createResponseSchema(UploadFileDataSchema);

export const UploadStatusParamSchema = t.Object({
  uploadId: t.String(),
});

export const UploadStatusDataSchema = t.Object({
  uploadId: t.String(),
  filename: t.String(),
  status: t.String(),
  rowCount: t.Optional(t.Union([t.Number(), t.Null()])),
  uploadedAt: t.Union([t.Date(), t.String()]),
  processedAt: t.Optional(t.Union([t.Date(), t.String(), t.Null()])),
  error: t.Optional(
    t.Object({
      code: t.String(),
      message: t.String(),
    }),
  ),
});

export const UploadStatusResponseSchema = createResponseSchema(
  UploadStatusDataSchema,
);
