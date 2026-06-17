# POST /api/uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /api/uploads` — accepts a CSV/Excel file upload, saves it to disk, runs column auto-detection via a mock function (replacing FastAPI's `POST /internal/detect-columns`), and returns the upload status (`READY` or `NEEDS_MAPPING`).

**Architecture:** Elysia receives the multipart file, validates type/size, persists it under `{UPLOAD_DIR}/{shopId}/{timestamp}-{suffix}-{filename}`, creates a `RawUpload` record, and synchronously calls a mock `detectColumns()` function that reads headers and matches against an alias dictionary. Based on detection confidence the upload transitions to `READY` (all required columns resolved) or `NEEDS_MAPPING` (client must resolve via `PATCH /api/uploads/:uploadId/column-map`). The mock will be swapped for an HTTP call to FastAPI when the Python service is ready.

**Tech Stack:** Bun · Elysia · Prisma (PostgreSQL) · Typebox · Pino

---

## File Structure

```
Files to create:
  src/modules/uploads/detect-columns.ts          — Mock column-detection function (replaces FastAPI call)
  src/__tests__/uploads/detect-columns.test.ts    — Unit tests for the mock detection function
  src/__tests__/uploads/upload-file.test.ts       — Integration tests for POST /api/uploads

Files to modify:
  src/config/env.ts                               — Add UPLOAD_DIR, MAX_FILE_SIZE_MB
  .env.example                                    — Document new env vars
  src/modules/uploads/locales/en.ts               — Add upload success/error locale keys
  src/modules/uploads/locales/es.ts               — Spanish translations
  src/modules/uploads/locales/id.ts               — Indonesian translations
  src/modules/uploads/error.ts                    — Add InvalidFileType, FileTooLarge, FileParseFailed, NoShop errors
  src/modules/uploads/schema.ts                   — Add file upload body/response Typebox schemas
  src/modules/uploads/service.ts                  — Add uploadFile() method
  src/modules/uploads/controller.ts               — Add uploadFile() handler
  src/modules/uploads/index.ts                    — Wire POST / route + new error handlers
```

---

### Task 1: Environment Configuration

**Files:**
- Modify: `src/config/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add `UPLOAD_DIR` and `MAX_FILE_SIZE_MB` to `src/config/env.ts`**

Add two new fields to the `envSchema` object — one for the upload directory and one for the max file size in megabytes.

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.url().default("http://localhost:5173"),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string(),

  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string(),

  DATABASE_URL: z.url(),

  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
});
```

- [ ] **Step 2: Update `.env.example`**

Append the new variables to the end of `.env.example`:

```env
# File uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
```

- [ ] **Step 3: Commit all task changes**

> This is the **only** commit step per task. All files created/modified in this task are committed together.

```bash
git add src/config/env.ts .env.example
git commit -m "feat(uploads): add UPLOAD_DIR and MAX_FILE_SIZE_MB env config"
```

---

### Task 2: Locale Strings and Error Classes

**Files:**
- Modify: `src/modules/uploads/locales/en.ts`
- Modify: `src/modules/uploads/locales/es.ts`
- Modify: `src/modules/uploads/locales/id.ts`
- Modify: `src/modules/uploads/error.ts`

- [ ] **Step 1: Add English locale keys in `src/modules/uploads/locales/en.ts`**

```typescript
export const en = {
  saveColumnMapSuccess: "Column map saved.",
  notFound: "Upload not found.",
  notAwaitingMapping: "This upload no longer requires manual column mapping.",
  uploadSuccess: "File uploaded successfully. All columns detected.",
  uploadNeedsMapping:
    "Some required columns could not be detected. Please resolve the fields in unmappedRequired.",
  invalidFileType: "File must be CSV (.csv) or Excel (.xlsx, .xls).",
  fileTooLarge:
    "File exceeds the maximum allowed size of {{maxSize}} MB.",
  fileParseFailed:
    "File could not be read. It may be corrupted or in the wrong format.",
  noShop: "You must create a shop before uploading files.",
} as const;

export type UploadLocale = typeof en;
```

- [ ] **Step 2: Add Spanish locale keys in `src/modules/uploads/locales/es.ts`**

```typescript
export const es = {
  saveColumnMapSuccess: "Mapa de columnas guardado.",
  notFound: "Subida no encontrada.",
  notAwaitingMapping: "Esta subida ya no requiere mapeo de columnas manual.",
  uploadSuccess:
    "Archivo subido exitosamente. Todas las columnas fueron detectadas.",
  uploadNeedsMapping:
    "Algunas columnas requeridas no pudieron ser detectadas. Resuelva los campos en unmappedRequired.",
  invalidFileType: "El archivo debe ser CSV (.csv) o Excel (.xlsx, .xls).",
  fileTooLarge:
    "El archivo excede el tamaño máximo permitido de {{maxSize}} MB.",
  fileParseFailed:
    "No se pudo leer el archivo. Puede estar corrupto o en un formato incorrecto.",
  noShop: "Debe crear una tienda antes de subir archivos.",
} as const;
```

- [ ] **Step 3: Add Indonesian locale keys in `src/modules/uploads/locales/id.ts`**

```typescript
export const id = {
  saveColumnMapSuccess: "Peta kolom berhasil disimpan.",
  notFound: "Upload tidak ditemukan.",
  notAwaitingMapping: "Upload ini tidak lagi memerlukan pemetaan kolom manual.",
  uploadSuccess:
    "File berhasil diunggah. Semua kolom berhasil terdeteksi.",
  uploadNeedsMapping:
    "Beberapa kolom wajib tidak dapat terdeteksi. Silakan selesaikan kolom pada unmappedRequired.",
  invalidFileType: "File harus berupa CSV (.csv) atau Excel (.xlsx, .xls).",
  fileTooLarge:
    "File melebihi ukuran maksimum yang diizinkan sebesar {{maxSize}} MB.",
  fileParseFailed:
    "File tidak dapat dibaca. File mungkin rusak atau dalam format yang salah.",
  noShop: "Anda harus membuat toko terlebih dahulu sebelum mengunggah file.",
} as const;
```

- [ ] **Step 4: Add error classes in `src/modules/uploads/error.ts`**

Append four new error classes below the existing ones. **Do not remove** the existing `UploadNotFoundError` and `UploadNotAwaitingMappingError`.

```typescript
import { t } from "@/libs/i18n";

export class UploadNotFoundError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.notFound"));
    this.key = "upload.notFound";
  }
}

export class UploadNotAwaitingMappingError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.notAwaitingMapping"));
    this.key = "upload.notAwaitingMapping";
  }
}

export class InvalidFileTypeError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.invalidFileType"));
    this.key = "upload.invalidFileType";
  }
}

export class FileTooLargeError extends Error {
  readonly key: string;
  readonly maxSize: number;

  constructor(maxSize: number, locale: string = "en") {
    super(t(locale, "upload.fileTooLarge", { maxSize }));
    this.key = "upload.fileTooLarge";
    this.maxSize = maxSize;
  }
}

export class FileParseFailedError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.fileParseFailed"));
    this.key = "upload.fileParseFailed";
  }
}

export class NoShopError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.noShop"));
    this.key = "upload.noShop";
  }
}
```

- [ ] **Step 5: Commit all task changes**

> This is the **only** commit step per task. All files created/modified in this task are committed together.

```bash
git add src/modules/uploads/locales/ src/modules/uploads/error.ts
git commit -m "feat(uploads): add locale strings and error classes for file upload"
```

---

### Task 3: Request/Response Schemas

**Files:**
- Modify: `src/modules/uploads/schema.ts`

- [ ] **Step 1: Add file upload schemas to `src/modules/uploads/schema.ts`**

Append the new schemas below the existing ones. **Do not remove** existing schemas (`ColumnMapParamSchema`, `SaveColumnMapBodySchema`, etc.).

```typescript
import { t, type Static } from "elysia";
import { createTbResponseSchema, createTbErrorSchema } from "@/libs/response";

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

export const SaveColumnMapResponseSchema = createTbResponseSchema(
  t.Object({
    columnMap: ColumnMapResultSchema,
  }),
);

export const UploadErrorSchema = createTbErrorSchema(t.Null());

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
  createTbResponseSchema(UploadFileDataSchema);
```

- [ ] **Step 2: Commit all task changes**

> This is the **only** commit step per task. All files created/modified in this task are committed together.

```bash
git add src/modules/uploads/schema.ts
git commit -m "feat(uploads): add Typebox schemas for file upload endpoint"
```

---

### Task 4: Mock Column Detection Function (TDD)

**Files:**
- Create: `src/__tests__/uploads/detect-columns.test.ts`
- Create: `src/modules/uploads/detect-columns.ts`

- [ ] **Step 1: Write the failing test in `src/__tests__/uploads/detect-columns.test.ts`**

```typescript
import { describe, it, expect, afterAll } from "bun:test";
import { detectColumns } from "@/modules/uploads/detect-columns";
import { resolve, join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import pino from "pino";

const log = pino({ level: "silent" });
const FIXTURE_DIR = resolve(import.meta.dir, "fixtures");

/** Write a temporary CSV file for testing. */
async function writeCsv(
  filename: string,
  headers: string[],
  rows: string[][] = [],
): Promise<string> {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const filePath = join(FIXTURE_DIR, filename);
  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  await Bun.write(filePath, lines.join("\n"));
  return filePath;
}

afterAll(async () => {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
});

describe("detectColumns (mock)", () => {
  it("should return full confidence when all required columns match aliases", async () => {
    const filePath = await writeCsv("full.csv", [
      "transaction_date",
      "product_detail",
      "product_category",
      "transaction_qty",
      "unit_price",
    ]);

    const result = await detectColumns(filePath, log);

    expect(result.status).toBe("success");
    expect(result.confidence).toBe("full");
    expect(result.columnMap.date).toBe("transaction_date");
    expect(result.columnMap.product).toBe("product_detail");
    expect(result.columnMap.quantity).toBe("transaction_qty");
    expect(result.columnMap.unitPrice).toBe("unit_price");
    expect(result.unmappedRequired).toEqual([]);
  });

  it("should return partial confidence when a required column is missing", async () => {
    const filePath = await writeCsv("partial.csv", [
      "transaction_date",
      "transaction_qty",
      "unit_price",
      "product_category",
    ]);

    const result = await detectColumns(filePath, log);

    expect(result.status).toBe("success");
    expect(result.confidence).toBe("partial");
    expect(result.columnMap.product).toBeNull();
    expect(result.unmappedRequired).toContain("product");
  });

  it("should list all file headers in detectedColumns", async () => {
    const headers = [
      "transaction_date",
      "custom_col",
      "transaction_qty",
      "unit_price",
      "product_detail",
    ];
    const filePath = await writeCsv("headers.csv", headers);

    const result = await detectColumns(filePath, log);

    expect(result.detectedColumns).toEqual(headers);
  });

  it("should match column names case-insensitively", async () => {
    const filePath = await writeCsv("case.csv", [
      "Transaction_Date",
      "Product_Detail",
      "Transaction_Qty",
      "Unit_Price",
    ]);

    const result = await detectColumns(filePath, log);

    expect(result.confidence).toBe("full");
    expect(result.columnMap.date).toBe("Transaction_Date");
    expect(result.columnMap.product).toBe("Product_Detail");
  });

  it("should handle quoted CSV headers", async () => {
    const filePath = join(FIXTURE_DIR, "quoted.csv");
    await mkdir(FIXTURE_DIR, { recursive: true });
    await Bun.write(
      filePath,
      '"transaction_date","product_detail","transaction_qty","unit_price"\n',
    );

    const result = await detectColumns(filePath, log);

    expect(result.confidence).toBe("full");
    expect(result.columnMap.date).toBe("transaction_date");
  });

  it("should throw FILE_NOT_FOUND for missing files", async () => {
    await expect(
      detectColumns("/nonexistent/file.csv", log),
    ).rejects.toThrow("FILE_NOT_FOUND");
  });

  it("should throw UNSUPPORTED_FILE_TYPE for invalid extensions", async () => {
    const filePath = join(FIXTURE_DIR, "data.json");
    await mkdir(FIXTURE_DIR, { recursive: true });
    await Bun.write(filePath, '{"a": 1}');

    await expect(detectColumns(filePath, log)).rejects.toThrow(
      "UNSUPPORTED_FILE_TYPE",
    );
  });

  it("should return partial for Excel files (mock limitation)", async () => {
    const filePath = join(FIXTURE_DIR, "data.xlsx");
    await mkdir(FIXTURE_DIR, { recursive: true });
    // Write a minimal placeholder — mock can't parse real Excel
    await Bun.write(filePath, "fake-excel-content");

    const result = await detectColumns(filePath, log);

    expect(result.status).toBe("success");
    expect(result.confidence).toBe("partial");
    expect(result.unmappedRequired.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test src/__tests__/uploads/detect-columns.test.ts
```

Expected: FAIL — `Cannot find module "@/modules/uploads/detect-columns"`

- [ ] **Step 3: Implement the mock in `src/modules/uploads/detect-columns.ts`**

```typescript
import type { Logger } from "pino";

/**
 * Standard field keys → list of known column-name aliases.
 * Matching is case-insensitive. Spaces in headers are normalized to underscores.
 */
const ALIAS_MAP: Record<string, string[]> = {
  date: [
    "transaction_date",
    "tanggal",
    "date",
    "tgl",
    "order_date",
    "tanggal_transaksi",
    "tgl_transaksi",
  ],
  product: [
    "product_detail",
    "product_name",
    "nama_menu",
    "product",
    "menu",
    "item",
    "nama_produk",
    "produk",
  ],
  category: [
    "product_category",
    "category",
    "kategori",
    "category_name",
    "kategori_produk",
    "product_type",
  ],
  quantity: [
    "transaction_qty",
    "quantity",
    "jumlah",
    "qty",
    "kuantitas",
  ],
  unitPrice: [
    "unit_price",
    "harga_satuan",
    "price",
    "harga",
    "harga_unit",
  ],
  totalPrice: [
    "total_price",
    "total_harga",
    "total",
    "amount",
    "jumlah_harga",
  ],
  paymentMethod: [
    "payment_method",
    "metode_bayar",
    "payment",
    "metode_pembayaran",
  ],
};

/** Required standard keys — if any are unresolved, confidence is "partial". */
const REQUIRED_KEYS = ["date", "product", "quantity", "unitPrice"];

export interface DetectColumnsResult {
  status: "success";
  confidence: "full" | "partial";
  columnMap: Record<string, string | null>;
  detectedColumns: string[];
  unmappedRequired: string[];
}

/**
 * Mock implementation of FastAPI `POST /internal/detect-columns`.
 *
 * Reads the header row of a CSV file and matches each column to a
 * standard field key using case-insensitive alias matching.
 *
 * **Excel limitation:** The mock cannot parse binary Excel files without
 * a third-party library. Excel uploads return `confidence: "partial"` with
 * all required keys unmapped so the user can resolve them manually via
 * `PATCH /api/uploads/:uploadId/column-map`. The real FastAPI service
 * (pandas) handles Excel natively.
 *
 * **Swap instructions:** When FastAPI is ready, replace the body of this
 * function with an HTTP call:
 * ```
 * const res = await fetch("http://localhost:5000/internal/detect-columns", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ filePath }),
 * });
 * return res.json();
 * ```
 */
export async function detectColumns(
  filePath: string,
  log: Logger,
): Promise<DetectColumnsResult> {
  log.debug({ filePath }, "Mock detect-columns: reading file headers");

  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    throw new Error("FILE_NOT_FOUND");
  }

  const ext = filePath.split(".").pop()?.toLowerCase();

  // ── Excel: mock cannot parse binary files ──────────────────────────
  if (ext === "xlsx" || ext === "xls") {
    log.warn(
      { filePath },
      "Mock detect-columns: Excel header detection not supported — returning partial result requiring manual mapping",
    );

    const columnMap: Record<string, string | null> = {};
    for (const key of Object.keys(ALIAS_MAP)) {
      columnMap[key] = null;
    }

    return {
      status: "success",
      confidence: "partial",
      columnMap,
      detectedColumns: [],
      unmappedRequired: [...REQUIRED_KEYS],
    };
  }

  // ── CSV: parse first line ──────────────────────────────────────────
  if (ext !== "csv") {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  const text = await file.text();
  const firstLine = text.split(/\r?\n/)[0];

  if (!firstLine || firstLine.trim().length === 0) {
    throw new Error("FILE_PARSE_FAILED");
  }

  const headers = firstLine
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  if (headers.length === 0) {
    throw new Error("FILE_PARSE_FAILED");
  }

  // ── Alias matching ─────────────────────────────────────────────────
  const headersNormalized = headers.map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );

  const columnMap: Record<string, string | null> = {};

  for (const [key, aliases] of Object.entries(ALIAS_MAP)) {
    const matchIndex = headersNormalized.findIndex((h) =>
      aliases.some((alias) => alias.toLowerCase() === h),
    );
    columnMap[key] = matchIndex !== -1 ? headers[matchIndex] : null;
  }

  const unmappedRequired = REQUIRED_KEYS.filter((k) => columnMap[k] === null);
  const confidence = unmappedRequired.length === 0 ? "full" : "partial";

  log.info(
    { confidence, unmappedRequired, detectedColumns: headers },
    "Mock detect-columns: detection complete",
  );

  return {
    status: "success",
    confidence,
    columnMap,
    detectedColumns: headers,
    unmappedRequired,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun test src/__tests__/uploads/detect-columns.test.ts
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit all task changes**

> This is the **only** commit step per task. All files created/modified in this task are committed together.

```bash
git add src/modules/uploads/detect-columns.ts src/__tests__/uploads/detect-columns.test.ts
git commit -m "feat(uploads): add mock detect-columns function with unit tests"
```

---

### Task 5: Upload Service — `uploadFile` Method

**Files:**
- Modify: `src/modules/uploads/service.ts`

- [ ] **Step 1: Add `uploadFile` static method to `UploadService`**

Add the required imports at the top of the file, then add the new method **above** the existing `saveColumnMap` method. **Do not remove** the existing `saveColumnMap` method.

The full file after edits:

```typescript
import { prisma } from "@/libs/prisma";
import { UploadStatus } from "@generated/prisma";
import type { SaveColumnMapInput } from "./schema";
import {
  UploadNotFoundError,
  UploadNotAwaitingMappingError,
  InvalidFileTypeError,
  FileTooLargeError,
  FileParseFailedError,
  NoShopError,
} from "./error";
import { detectColumns } from "./detect-columns";
import { env } from "@/config/env";
import { resolve, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { Logger } from "pino";

const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls"];

export abstract class UploadService {
  /**
   * Handle a file upload: validate → save to disk → create DB record →
   * run column detection → return final status.
   */
  static async uploadFile(
    userId: string,
    file: File,
    log: Logger,
    locale: string = "en",
  ): Promise<{
    uploadId: string;
    filename: string;
    status: UploadStatus;
    unmappedRequired?: string[];
    detectedColumns?: string[];
  }> {
    log.debug(
      { userId, filename: file.name, size: file.size },
      "Processing file upload",
    );

    // 1. Validate file extension.
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      log.warn({ filename: file.name, ext }, "Rejected: invalid file type");
      throw new InvalidFileTypeError(locale);
    }

    // 2. Validate file size.
    const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      log.warn(
        { filename: file.name, size: file.size, maxBytes },
        "Rejected: file too large",
      );
      throw new FileTooLargeError(env.MAX_FILE_SIZE_MB, locale);
    }

    // 3. Resolve user's shop (MVP: one user → one shop).
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!shop) {
      log.warn({ userId }, "Rejected: user has no shop");
      throw new NoShopError(locale);
    }

    // 4. Save file to disk with a unique name.
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeFilename = `${timestamp}-${suffix}-${sanitizedName}`;
    const uploadDir = resolve(env.UPLOAD_DIR);
    const shopDir = join(uploadDir, shop.id);
    const filePath = join(shopDir, safeFilename);

    await mkdir(shopDir, { recursive: true });
    await Bun.write(filePath, file);

    log.info(
      { filePath, shopId: shop.id, originalName: file.name },
      "File saved to disk",
    );

    // 5. Create RawUpload record (status: UPLOADED).
    const upload = await prisma.rawUpload.create({
      data: {
        shopId: shop.id,
        filename: file.name,
        filePath,
        status: UploadStatus.UPLOADED,
      },
    });

    // 6. Run column detection.
    try {
      const detection = await detectColumns(filePath, log);

      if (detection.confidence === "full") {
        const updated = await prisma.rawUpload.update({
          where: { id: upload.id },
          data: {
            status: UploadStatus.READY,
            columnMap: detection.columnMap,
            processedAt: new Date(),
          },
        });

        log.info(
          { uploadId: updated.id, status: updated.status },
          "Upload complete — all columns detected",
        );

        return {
          uploadId: updated.id,
          filename: updated.filename,
          status: updated.status,
        };
      }

      // Partial detection → NEEDS_MAPPING
      const updated = await prisma.rawUpload.update({
        where: { id: upload.id },
        data: {
          status: UploadStatus.NEEDS_MAPPING,
          columnMap: detection.columnMap,
          unmappedRequired: detection.unmappedRequired,
        },
      });

      log.info(
        {
          uploadId: updated.id,
          status: updated.status,
          unmappedRequired: detection.unmappedRequired,
        },
        "Upload complete — manual column mapping required",
      );

      return {
        uploadId: updated.id,
        filename: updated.filename,
        status: updated.status,
        unmappedRequired: detection.unmappedRequired,
        detectedColumns: detection.detectedColumns,
      };
    } catch (err) {
      // Column detection failed — mark upload as FAILED.
      await prisma.rawUpload.update({
        where: { id: upload.id },
        data: {
          status: UploadStatus.FAILED,
          error: {
            code: "COLUMN_DETECTION_FAILED",
            message: err instanceof Error ? err.message : "Unknown error",
          },
        },
      });

      log.error(
        { uploadId: upload.id, err },
        "Column detection failed — upload marked FAILED",
      );

      throw new FileParseFailedError(locale);
    }
  }

  static async saveColumnMap(
    uploadId: string,
    userId: string,
    data: SaveColumnMapInput,
    log: Logger,
    locale: string = "en",
  ): Promise<Record<string, string | null>> {
    log.debug({ uploadId, userId }, "Saving column map for upload");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    const upload = await prisma.rawUpload.findFirst({
      where: {
        id: uploadId,
        shopId: shop?.id ?? "__no_shop__",
      },
    });

    if (!upload) {
      log.warn(
        { uploadId, userId },
        "Upload not found or does not belong to user's shop",
      );
      throw new UploadNotFoundError(locale);
    }

    if (upload.status !== UploadStatus.NEEDS_MAPPING) {
      log.warn(
        { uploadId, status: upload.status },
        "Column map update rejected: upload is not in NEEDS_MAPPING state",
      );
      throw new UploadNotAwaitingMappingError(locale);
    }

    const existingColumnMap =
      (upload.columnMap as Record<string, string | null>) ?? {};

    const mergedColumnMap: Record<string, string | null> = {
      ...existingColumnMap,
      ...data.resolvedMappings,
    };

    const updated = await prisma.rawUpload.update({
      where: { id: uploadId },
      data: {
        columnMap: mergedColumnMap,
        status: UploadStatus.READY,
      },
    });

    log.info(
      { uploadId, resolvedKeys: Object.keys(data.resolvedMappings) },
      "Column map saved — upload marked READY",
    );

    return updated.columnMap as Record<string, string | null>;
  }
}
```

- [ ] **Step 2: Commit all task changes**

> This is the **only** commit step per task. All files created/modified in this task are committed together.

```bash
git add src/modules/uploads/service.ts
git commit -m "feat(uploads): add uploadFile service method with mock column detection"
```

---

### Task 6: Controller and Route Wiring

**Files:**
- Modify: `src/modules/uploads/controller.ts`
- Modify: `src/modules/uploads/index.ts`

- [ ] **Step 1: Add `uploadFile` handler in `src/modules/uploads/controller.ts`**

Add the new import and method. **Do not remove** the existing `saveColumnMap` handler.

```typescript
import { UploadService } from "./service";
import { successResponse } from "@/libs/response";
import { UploadStatus } from "@generated/prisma";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type { SaveColumnMapInput, UploadFileInput } from "./schema";

export class UploadController {
  static async uploadFile({
    body,
    user,
    set,
    log,
    locale,
  }: {
    body: UploadFileInput;
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await UploadService.uploadFile(
      user.id,
      body.file,
      log,
      locale,
    );

    const messageKey =
      result.status === UploadStatus.READY
        ? "upload.uploadSuccess"
        : "upload.uploadNeedsMapping";

    return successResponse(
      set,
      result,
      { key: messageKey },
      202,
      undefined,
      locale,
    );
  }

  static async saveColumnMap({
    params,
    body,
    user,
    set,
    log,
    locale,
  }: {
    params: { uploadId: string };
    body: SaveColumnMapInput;
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const columnMap = await UploadService.saveColumnMap(
      params.uploadId,
      user.id,
      body,
      log,
      locale,
    );

    return successResponse(
      set,
      { columnMap },
      { key: "upload.saveColumnMapSuccess" },
      200,
      undefined,
      locale,
    );
  }
}
```

- [ ] **Step 2: Wire the `POST /` route and error handlers in `src/modules/uploads/index.ts`**

```typescript
import { UploadController } from "./controller";
import {
  ColumnMapParamSchema,
  SaveColumnMapBodySchema,
  SaveColumnMapResponseSchema,
  UploadErrorSchema,
  UploadFileBodySchema,
  UploadFileResponseSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import {
  UploadNotFoundError,
  UploadNotAwaitingMappingError,
  InvalidFileTypeError,
  FileTooLargeError,
  FileParseFailedError,
  NoShopError,
} from "./error";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "uploads_management";

const protectedUploads = createProtectedApp()
  .post("/", UploadController.uploadFile, {
    beforeHandle: hasPermission(FEATURE_NAME, "create"),
    body: UploadFileBodySchema,
    response: {
      202: UploadFileResponseSchema,
      400: UploadErrorSchema,
      422: UploadErrorSchema,
    },
  })
  .patch("/:uploadId/column-map", UploadController.saveColumnMap, {
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    params: ColumnMapParamSchema,
    body: SaveColumnMapBodySchema,
    response: {
      200: SaveColumnMapResponseSchema,
      403: UploadErrorSchema,
      404: UploadErrorSchema,
      409: UploadErrorSchema,
    },
  });

export const uploads = createBaseApp({ tags: ["Uploads"] }).group(
  "/api/uploads",
  (app) =>
    app
      .onError(({ error, set, locale }) => {
        if (error instanceof UploadNotFoundError) {
          return errorResponse(
            set,
            404,
            { key: "upload.notFound" },
            null,
            locale,
          );
        }

        if (error instanceof UploadNotAwaitingMappingError) {
          return errorResponse(
            set,
            409,
            { key: "upload.notAwaitingMapping" },
            null,
            locale,
          );
        }

        if (error instanceof InvalidFileTypeError) {
          return errorResponse(
            set,
            400,
            { key: "upload.invalidFileType" },
            null,
            locale,
          );
        }

        if (error instanceof FileTooLargeError) {
          return errorResponse(
            set,
            400,
            {
              key: "upload.fileTooLarge",
              params: { maxSize: error.maxSize },
            },
            null,
            locale,
          );
        }

        if (error instanceof FileParseFailedError) {
          return errorResponse(
            set,
            422,
            { key: "upload.fileParseFailed" },
            null,
            locale,
          );
        }

        if (error instanceof NoShopError) {
          return errorResponse(
            set,
            400,
            { key: "upload.noShop" },
            null,
            locale,
          );
        }
      })
      .use(protectedUploads),
);
```

- [ ] **Step 3: Commit all task changes**

> This is the **only** commit step per task. All files created/modified in this task are committed together.

```bash
git add src/modules/uploads/controller.ts src/modules/uploads/index.ts
git commit -m "feat(uploads): wire POST /api/uploads controller and route"
```

---

### Task 7: Integration Tests

**Files:**
- Create: `src/__tests__/uploads/upload-file.test.ts`

- [ ] **Step 1: Write the integration test file `src/__tests__/uploads/upload-file.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import { env } from "@/config/env";
import { resolve } from "node:path";
import { rm, readdir } from "node:fs/promises";
import {
  resetDatabase,
  createAuthenticatedUser,
  randomIp,
  createTestRoleWithPermissions,
} from "../test_utils";

// ── Helper: build a POST /api/uploads request with FormData ──────────
const POST = (headers: Record<string, string>, file?: File) => {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }

  // Remove content-type — FormData sets it automatically with boundary
  const { "content-type": _, ...cleanHeaders } = headers;

  return app.handle(
    new Request("http://localhost/api/uploads", {
      method: "POST",
      headers: {
        "x-forwarded-for": randomIp(),
        ...cleanHeaders,
      },
      body: formData,
    }),
  );
};

/** Create a File with CSV content from a list of column headers. */
const createCsvFile = (
  headers: string[],
  filename = "test-data.csv",
): File => {
  const rows = [
    headers.join(","),
    headers.map((_, i) => `sample_${i}`).join(","),
  ];
  return new File([rows.join("\n")], filename, { type: "text/csv" });
};

// ── Cleanup helper ───────────────────────────────────────────────────
const cleanUploads = async () => {
  const dir = resolve(env.UPLOAD_DIR);
  await rm(dir, { recursive: true, force: true });
};

// ──────────────────────────────────────────────────────────────────────

describe("POST /api/uploads", () => {
  beforeEach(async () => {
    await resetDatabase();
    await cleanUploads();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "uploads_management", action: "create" },
    ]);
  });

  afterAll(async () => {
    await cleanUploads();
    await prisma.$disconnect();
  });

  // ── Auth Guard Tests ─────────────────────────────────────────────

  it("should return 401 if not authenticated", async () => {
    const file = createCsvFile(["transaction_date", "product_detail"]);
    const res = await POST({}, file);
    expect(res.status).toBe(401);
  });

  it("should return 403 if user lacks uploads_management create permission", async () => {
    const noPermRole = await createTestRoleWithPermissions(
      "NoPermRole",
      [],
    );
    const { authHeaders } = await createAuthenticatedUser({
      roleId: noPermRole.id,
    });
    const file = createCsvFile(["transaction_date", "product_detail"]);
    const res = await POST(authHeaders, file);
    expect(res.status).toBe(403);
  });

  it("should return 403 if user has uploads_management:read but not create", async () => {
    const readOnlyRole = await createTestRoleWithPermissions(
      "ReadOnlyRole",
      [{ featureName: "uploads_management", action: "read" }],
    );
    const { authHeaders } = await createAuthenticatedUser({
      roleId: readOnlyRole.id,
    });
    const file = createCsvFile(["transaction_date", "product_detail"]);
    const res = await POST(authHeaders, file);
    expect(res.status).toBe(403);
  });

  // ── Validation Tests ─────────────────────────────────────────────

  it("should return 400 if no file is provided", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    const res = await POST(authHeaders); // no file
    expect(res.status).toBe(400);
  });

  it("should return 400 if file has invalid extension (.txt)", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = new File(["some data"], "notes.txt", {
      type: "text/plain",
    });
    const res = await POST(authHeaders, file);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain("CSV");
  });

  it("should return 400 if file has invalid extension (.pdf)", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = new File(["fake-pdf"], "report.pdf", {
      type: "application/pdf",
    });
    const res = await POST(authHeaders, file);
    expect(res.status).toBe(400);
  });

  it("should return 400 if file exceeds max size", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    // Create a file larger than MAX_FILE_SIZE_MB
    const oversizedContent = "x".repeat(
      env.MAX_FILE_SIZE_MB * 1024 * 1024 + 1,
    );
    const file = new File([oversizedContent], "huge.csv", {
      type: "text/csv",
    });
    const res = await POST(authHeaders, file);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain(String(env.MAX_FILE_SIZE_MB));
  });

  // ── Business Rule Tests ──────────────────────────────────────────

  it("should return 400 if user has no shop", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    // No shop created for this user
    const file = createCsvFile(["transaction_date", "product_detail"]);
    const res = await POST(authHeaders, file);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain("shop");
  });

  // ── Happy Path: Full Detection (READY) ───────────────────────────

  it("should return 202 with status READY when all required columns are detected", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = createCsvFile([
      "transaction_date",
      "product_detail",
      "product_category",
      "transaction_qty",
      "unit_price",
    ]);

    const res = await POST(authHeaders, file);
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.error).toBe(false);
    expect(body.data.status).toBe("READY");
    expect(body.data.uploadId).toBeDefined();
    expect(body.data.filename).toBe("test-data.csv");
    // READY response should NOT include unmappedRequired
    expect(body.data.unmappedRequired).toBeUndefined();
  });

  it("should create a RawUpload record with status READY in the database", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = createCsvFile([
      "transaction_date",
      "product_detail",
      "transaction_qty",
      "unit_price",
    ]);

    const res = await POST(authHeaders, file);
    const body = await res.json();

    const upload = await prisma.rawUpload.findUnique({
      where: { id: body.data.uploadId },
    });

    expect(upload).not.toBeNull();
    expect(upload!.status).toBe("READY");
    expect(upload!.columnMap).toBeDefined();
    expect(upload!.processedAt).not.toBeNull();
  });

  it("should save the file to disk under the shop's upload directory", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const shop = await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = createCsvFile([
      "transaction_date",
      "product_detail",
      "transaction_qty",
      "unit_price",
    ]);
    await POST(authHeaders, file);

    const uploadDir = resolve(env.UPLOAD_DIR);
    const shopDir = `${uploadDir}/${shop.id}`;
    const files = await readdir(shopDir);

    expect(files.length).toBe(1);
    expect(files[0]).toContain("test-data.csv");
  });

  // ── Happy Path: Partial Detection (NEEDS_MAPPING) ────────────────

  it("should return 202 with status NEEDS_MAPPING when some required columns are missing", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    // Missing "product" — only date, qty, unitPrice present
    const file = createCsvFile([
      "transaction_date",
      "transaction_qty",
      "unit_price",
      "product_category",
    ]);

    const res = await POST(authHeaders, file);
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.data.status).toBe("NEEDS_MAPPING");
    expect(body.data.unmappedRequired).toContain("product");
    expect(body.data.detectedColumns).toBeDefined();
    expect(body.data.detectedColumns).toContain("transaction_date");
  });

  it("should create a NEEDS_MAPPING record with unmappedRequired in the database", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = createCsvFile([
      "transaction_date",
      "transaction_qty",
      "unit_price",
    ]);

    const res = await POST(authHeaders, file);
    const body = await res.json();

    const upload = await prisma.rawUpload.findUnique({
      where: { id: body.data.uploadId },
    });

    expect(upload!.status).toBe("NEEDS_MAPPING");
    expect(upload!.unmappedRequired).toContain("product");
  });

  // ── Excel Upload (Mock Limitation) ───────────────────────────────

  it("should accept .xlsx files and return NEEDS_MAPPING (mock limitation)", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = new File(["fake-xlsx-content"], "data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST(authHeaders, file);
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.data.status).toBe("NEEDS_MAPPING");
    // Mock can't parse Excel, so all required keys are unmapped
    expect(body.data.unmappedRequired.length).toBeGreaterThan(0);
  });

  it("should accept .xls files and return NEEDS_MAPPING (mock limitation)", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = new File(["fake-xls-content"], "legacy.xls", {
      type: "application/vnd.ms-excel",
    });

    const res = await POST(authHeaders, file);
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.data.status).toBe("NEEDS_MAPPING");
  });

  // ── Isolation Tests ──────────────────────────────────────────────

  it("should not expose internal fields (filePath, shopId) in the response", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.shop.create({
      data: { name: "Test Shop", ownerId: user.id },
    });

    const file = createCsvFile([
      "transaction_date",
      "product_detail",
      "transaction_qty",
      "unit_price",
    ]);

    const res = await POST(authHeaders, file);
    const body = await res.json();

    expect(body.data.filePath).toBeUndefined();
    expect(body.data.shopId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the full integration test suite**

```bash
bun test src/__tests__/uploads/upload-file.test.ts
```

Expected: all tests PASS

- [ ] **Step 3: Run the complete test suite to check for regressions**

```bash
bun test
```

Expected: all existing tests still PASS, plus the new upload tests

- [ ] **Step 4: Commit all task changes**

> This is the **only** commit step per task. All files created/modified in this task are committed together.

```bash
git add src/__tests__/uploads/upload-file.test.ts
git commit -m "test(uploads): add integration tests for POST /api/uploads"
```
