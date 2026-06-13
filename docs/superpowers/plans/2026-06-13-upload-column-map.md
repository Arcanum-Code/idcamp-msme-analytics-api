# Upload Column Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `PATCH /api/uploads/:uploadId/column-map` — an authenticated endpoint that merges the client's resolved column mappings into a `RawUpload` record and transitions it from `NEEDS_MAPPING` to `READY`.

**Architecture:** New `uploads` module under `src/modules/uploads/` following the exact same file structure as `src/modules/user/` (error.ts → locales/ → schema.ts → service.ts → controller.ts → index.ts). Ownership validation is done by looking up the user's `Shop` via `ownerId` (one user = one shop for MVP), then verifying `RawUpload.shopId === shop.id`. No RBAC `hasPermission` guard — the endpoint is purely authentication + ownership-gated.

**Tech Stack:** Bun, Elysia, Prisma ORM (`@generated/prisma`), TypeBox (`t` from `elysia`), pino Logger, bun:test for integration tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/modules/uploads/error.ts` | Custom error classes thrown by the service |
| Create | `src/modules/uploads/locales/en.ts` | English i18n strings |
| Create | `src/modules/uploads/locales/id.ts` | Indonesian i18n strings |
| Create | `src/modules/uploads/locales/es.ts` | Spanish i18n strings |
| Create | `src/modules/uploads/locales/index.ts` | Re-export all locale objects |
| Create | `src/modules/uploads/schema.ts` | TypeBox request body + response schemas |
| Create | `src/modules/uploads/service.ts` | `UploadService.saveColumnMap()` — DB logic |
| Create | `src/modules/uploads/controller.ts` | `UploadController.saveColumnMap()` — HTTP adapter |
| Create | `src/modules/uploads/index.ts` | Elysia route registration (`/api/uploads`) |
| Create | `src/__tests__/uploads/column-map.test.ts` | Integration tests |
| Modify | `src/modules/index.ts` | Export `uploads` module |
| Modify | `src/server.ts` | Register `uploads` with `app.use(uploads)` |
| Modify | `src/libs/i18n/index.ts` | Register `upload` locale namespace |

---

## Task 1: Error Classes

**Files:**
- Create: `src/modules/uploads/error.ts`

- [ ] **Step 1: Create the error file**

```typescript
// src/modules/uploads/error.ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
bun run build 2>&1 | head -30
```

Expected: No errors referencing `uploads/error.ts`.

---

## Task 2: Locale Strings

**Files:**
- Create: `src/modules/uploads/locales/en.ts`
- Create: `src/modules/uploads/locales/id.ts`
- Create: `src/modules/uploads/locales/es.ts`
- Create: `src/modules/uploads/locales/index.ts`

- [ ] **Step 1: Create English locale**

```typescript
// src/modules/uploads/locales/en.ts
export const en = {
  saveColumnMapSuccess: "Column map saved.",
  notFound: "Upload not found.",
  notAwaitingMapping:
    "This upload no longer requires manual column mapping.",
} as const;

export type UploadLocale = typeof en;
```

- [ ] **Step 2: Create Indonesian locale**

```typescript
// src/modules/uploads/locales/id.ts
export const id = {
  saveColumnMapSuccess: "Peta kolom berhasil disimpan.",
  notFound: "Upload tidak ditemukan.",
  notAwaitingMapping:
    "Upload ini tidak lagi memerlukan pemetaan kolom manual.",
} as const;
```

- [ ] **Step 3: Create Spanish locale**

```typescript
// src/modules/uploads/locales/es.ts
export const es = {
  saveColumnMapSuccess: "Mapa de columnas guardado.",
  notFound: "Subida no encontrada.",
  notAwaitingMapping:
    "Esta subida ya no requiere mapeo de columnas manual.",
} as const;
```

- [ ] **Step 4: Create locale index**

```typescript
// src/modules/uploads/locales/index.ts
export { en } from "./en";
export { es } from "./es";
export { id } from "./id";
```

---

## Task 3: TypeBox Schemas

**Files:**
- Create: `src/modules/uploads/schema.ts`

- [ ] **Step 1: Create the schema file**

```typescript
// src/modules/uploads/schema.ts
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
      date:          t.Optional(t.String({ minLength: 1 })),
      product:       t.Optional(t.String({ minLength: 1 })),
      category:      t.Optional(t.String({ minLength: 1 })),
      quantity:      t.Optional(t.String({ minLength: 1 })),
      unitPrice:     t.Optional(t.String({ minLength: 1 })),
      totalPrice:    t.Optional(t.String({ minLength: 1 })),
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
```

---

## Task 4: Write Failing Integration Tests

Write the tests before implementing the service/controller/route. The app will return `404` (route not found) for all cases until the route is wired up in Task 8. Running them now confirms they fail for the right reason.

**Files:**
- Create: `src/__tests__/uploads/column-map.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/__tests__/uploads/column-map.test.ts
import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  randomIp,
} from "../test_utils";
import jwt from "jsonwebtoken";

// ── Test helper: create a shop owned by userId, plus a RawUpload ───────
async function createTestUpload(
  ownerId: string,
  overrides: {
    status?: "UPLOADED" | "DETECTING_COLUMNS" | "NEEDS_MAPPING" | "READY" | "FAILED";
    columnMap?: Record<string, string | null>;
  } = {},
) {
  const shop = await prisma.shop.create({
    data: { name: "Test Shop", ownerId },
  });

  const upload = await prisma.rawUpload.create({
    data: {
      shopId: shop.id,
      filename: "sales.csv",
      filePath: "/uploads/sales.csv",
      status: overrides.status ?? "NEEDS_MAPPING",
      columnMap: overrides.columnMap ?? {
        date:          "transaction_date",
        product:       null,
        category:      "product_category",
        quantity:      "transaction_qty",
        unitPrice:     "unit_price",
        totalPrice:    null,
        paymentMethod: null,
      },
      unmappedRequired: ["product"],
    },
  });

  return { shop, upload };
}

// ── Convenience wrapper for the endpoint ───────────────────────────────
const PATCH = (
  uploadId: string,
  headers: Record<string, string>,
  body: unknown,
) =>
  app.handle(
    new Request(`http://localhost/api/uploads/${uploadId}/column-map`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": randomIp(),
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

// ──────────────────────────────────────────────────────────────────────

describe("PATCH /api/uploads/:uploadId/column-map", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── Auth Guard Tests ───────────────────────────────────────────────

  it("should return 401 if not authenticated", async () => {
    const res = await PATCH("any-id", {}, { resolvedMappings: { product: "Menu" } });
    expect(res.status).toBe(401);
  });

  it("should return 401 if access token is expired", async () => {
    const { user } = await createAuthenticatedUser();
    const expiredToken = jwt.sign(
      { userId: user.id, tokenVersion: user.tokenVersion },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "-1h" },
    );
    const res = await PATCH(
      "any-id",
      { Authorization: `Bearer ${expiredToken}` },
      { resolvedMappings: { product: "Menu" } },
    );
    expect(res.status).toBe(401);
  });

  it("should return 401 if access token is invalid", async () => {
    const res = await PATCH(
      "any-id",
      { Authorization: "Bearer invalid-token" },
      { resolvedMappings: { product: "Menu" } },
    );
    expect(res.status).toBe(401);
  });

  it("should return 403 if user account is disabled", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });
    const res = await PATCH("any-id", authHeaders, { resolvedMappings: { product: "Menu" } });
    expect(res.status).toBe(403);
  });

  // ── Ownership & Status Guard Tests ─────────────────────────────────

  it("should return 404 if uploadId does not exist", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    // Give the user a shop so ownership lookup doesn't also fail
    await prisma.shop.create({ data: { name: "My Shop", ownerId: user.id } });
    const res = await PATCH(
      "non-existent-upload-id",
      authHeaders,
      { resolvedMappings: { product: "Menu" } },
    );
    expect(res.status).toBe(404);
  });

  it("should return 404 if upload belongs to a different shop", async () => {
    // User A is authenticated
    const { authHeaders } = await createAuthenticatedUser();

    // User B owns a different shop with the upload
    const roleId = (await prisma.role.findFirst({ where: { name: "TestUser" } }))!.id;
    const userB = await prisma.user.create({
      data: {
        email: "userb@test.com",
        name: "User B",
        password: "hashed",
        roleId,
      },
    });
    const { upload } = await createTestUpload(userB.id);

    const res = await PATCH(upload.id, authHeaders, { resolvedMappings: { product: "Menu" } });
    expect(res.status).toBe(404);
  });

  it("should return 409 if upload status is READY", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, { status: "READY" });
    const res = await PATCH(upload.id, authHeaders, { resolvedMappings: { product: "Menu" } });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is UPLOADED", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, { status: "UPLOADED" });
    const res = await PATCH(upload.id, authHeaders, { resolvedMappings: { product: "Menu" } });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is DETECTING_COLUMNS", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, { status: "DETECTING_COLUMNS" });
    const res = await PATCH(upload.id, authHeaders, { resolvedMappings: { product: "Menu" } });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is FAILED", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, { status: "FAILED" });
    const res = await PATCH(upload.id, authHeaders, { resolvedMappings: { product: "Menu" } });
    expect(res.status).toBe(409);
  });

  // ── Validation Tests ───────────────────────────────────────────────

  it("should return 400 if resolvedMappings is an empty object", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id);
    const res = await PATCH(upload.id, authHeaders, { resolvedMappings: {} });
    expect(res.status).toBe(400);
  });

  it("should return 400 if resolvedMappings is missing from body", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id);
    const res = await PATCH(upload.id, authHeaders, {});
    expect(res.status).toBe(400);
  });

  it("should return 400 if a mapping value is an empty string", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id);
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "" },
    });
    expect(res.status).toBe(400);
  });

  // ── Happy Path Tests ───────────────────────────────────────────────

  it("should return 200 and merge resolvedMappings into the existing columnMap", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, {
      columnMap: {
        date:          "transaction_date",
        product:       null,
        category:      "product_category",
        quantity:      "transaction_qty",
        unitPrice:     "unit_price",
        totalPrice:    null,
        paymentMethod: null,
      },
    });

    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Nama Menu" },
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    // Resolved field is now set
    expect(body.data.columnMap.product).toBe("Nama Menu");
    // Previously detected fields are preserved
    expect(body.data.columnMap.date).toBe("transaction_date");
    expect(body.data.columnMap.category).toBe("product_category");
  });

  it("should update RawUpload.status to READY in the database", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id);

    await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Nama Menu" },
    });

    const updated = await prisma.rawUpload.findUnique({
      where: { id: upload.id },
    });
    expect(updated?.status).toBe("READY");
  });

  it("should correctly merge multiple resolved fields at once", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, {
      columnMap: {
        date:          "transaction_date",
        product:       null,
        category:      null,
        quantity:      "transaction_qty",
        unitPrice:     "unit_price",
        totalPrice:    null,
        paymentMethod: null,
      },
    });

    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: {
        product:       "Nama Menu",
        category:      "Kategori",
        totalPrice:    "Total Harga",
        paymentMethod: "Metode Bayar",
      },
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.columnMap.product).toBe("Nama Menu");
    expect(body.data.columnMap.category).toBe("Kategori");
    expect(body.data.columnMap.totalPrice).toBe("Total Harga");
    expect(body.data.columnMap.paymentMethod).toBe("Metode Bayar");
    // Fields not in resolvedMappings must be untouched
    expect(body.data.columnMap.date).toBe("transaction_date");
    expect(body.data.columnMap.quantity).toBe("transaction_qty");
  });

  it("should not expose internal fields (filePath, shopId) in the response", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id);

    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Nama Menu" },
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.filePath).toBeUndefined();
    expect(body.data.shopId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run `bun run test:setup` first**

```bash
bun run test:setup
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Run tests — verify they fail**

```bash
bun test uploads/column-map
```

Expected: All 17 tests FAIL. They return `404` because the route does not exist yet. This confirms the tests are pointed at the correct URL and will exercise the real implementation once it is wired up.

---

## Task 5: Service

**Files:**
- Create: `src/modules/uploads/service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// src/modules/uploads/service.ts
import { prisma } from "@/libs/prisma";
import { UploadStatus } from "@generated/prisma";
import type { SaveColumnMapInput } from "./schema";
import { UploadNotFoundError, UploadNotAwaitingMappingError } from "./error";
import type { Logger } from "pino";

export abstract class UploadService {
  static async saveColumnMap(
    uploadId: string,
    userId: string,
    data: SaveColumnMapInput,
    log: Logger,
    locale: string = "en",
  ): Promise<Record<string, string | null>> {
    log.debug({ uploadId, userId }, "Saving column map for upload");

    // 1. Resolve the authenticated user's shop (MVP: one user → one shop).
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    // 2. Find upload and verify ownership in a single query.
    //    If the user has no shop, shop?.id is undefined and the sentinel
    //    "__no_shop__" will never match any real shopId → null → 404.
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

    // 3. Guard: only NEEDS_MAPPING uploads may be updated.
    if (upload.status !== UploadStatus.NEEDS_MAPPING) {
      log.warn(
        { uploadId, status: upload.status },
        "Column map update rejected: upload is not in NEEDS_MAPPING state",
      );
      throw new UploadNotAwaitingMappingError(locale);
    }

    // 4. Merge submitted fields into the existing partial columnMap.
    //    Already-detected (non-null) values are preserved; only submitted
    //    keys are added or overwritten.
    const existingColumnMap =
      (upload.columnMap as Record<string, string | null>) ?? {};

    const mergedColumnMap: Record<string, string | null> = {
      ...existingColumnMap,
      ...data.resolvedMappings,
    };

    // 5. Persist merged map and transition status → READY.
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

---

## Task 6: Controller

**Files:**
- Create: `src/modules/uploads/controller.ts`

- [ ] **Step 1: Create the controller file**

```typescript
// src/modules/uploads/controller.ts
import { UploadService } from "./service";
import { successResponse } from "@/libs/response";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type { SaveColumnMapInput } from "./schema";

export class UploadController {
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

---

## Task 7: Route Registration

**Files:**
- Create: `src/modules/uploads/index.ts`

- [ ] **Step 1: Create the module index**

```typescript
// src/modules/uploads/index.ts
import { UploadController } from "./controller";
import {
  ColumnMapParamSchema,
  SaveColumnMapBodySchema,
  SaveColumnMapResponseSchema,
  UploadErrorSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { UploadNotFoundError, UploadNotAwaitingMappingError } from "./error";

const protectedUploads = createProtectedApp().patch(
  "/:uploadId/column-map",
  UploadController.saveColumnMap,
  {
    params: ColumnMapParamSchema,
    body: SaveColumnMapBodySchema,
    response: {
      200: SaveColumnMapResponseSchema,
      404: UploadErrorSchema,
      409: UploadErrorSchema,
    },
  },
);

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
      })
      .use(protectedUploads),
);
```

---

## Task 8: Wire Into the App

**Files:**
- Modify: `src/modules/index.ts`
- Modify: `src/server.ts`
- Modify: `src/libs/i18n/index.ts`

- [ ] **Step 1: Export from modules index**

Replace the contents of `src/modules/index.ts`:

```typescript
// src/modules/index.ts
export { health } from "./health";
export { auth } from "./auth";
export { user } from "./user";
export { rbac } from "./rbac";
export { dashboard } from "./dashboard";
export { uploads } from "./uploads";
```

- [ ] **Step 2: Register in server.ts**

In `src/server.ts`, change the import line and add `.use(uploads)`:

```typescript
// change the import at the top:
import { user, health, auth, rbac, dashboard, uploads } from "./modules";

// in the app chain, add after .use(dashboard):
  .use(dashboard)
  .use(uploads)     // ← new
  .use(globalErrorHandler)
```

- [ ] **Step 3: Register locale namespace in `src/libs/i18n/index.ts`**

Add the following import after the existing module locale imports:

```typescript
import {
  en as uploadEn,
  es as uploadEs,
  id as uploadId,      // named uploadId to avoid shadowing the `id` locale variable
} from "@/modules/uploads/locales";
```

Then add `upload:` to all three locale objects:

```typescript
const en = {
  common: commonEn,
  validation: validationEn,
  auth: authEn,
  user: userEn,
  rbac: rbacEn,
  health: healthEn,
  dashboard: dashboardEn,
  upload: uploadEn,    // ← new
};

const es = {
  common: commonEs,
  validation: validationEs,
  auth: authEs,
  user: userEs,
  rbac: rbacEs,
  health: healthEs,
  dashboard: dashboardEs,
  upload: uploadEs,    // ← new
};

const id = {
  common: commonId,
  validation: validationId,
  auth: authId,
  user: userId,
  rbac: rbacId,
  health: healthId,
  dashboard: dashboardId,
  upload: uploadId,    // ← new
};
```

- [ ] **Step 4: Verify full build compiles**

```bash
bun run build 2>&1 | head -40
```

Expected: Ends with bundle file size. Zero TypeScript errors.

- [ ] **Step 5: Commit scaffold**

```bash
git add src/modules/uploads/ src/modules/index.ts src/server.ts src/libs/i18n/index.ts
git commit -m "feat: add uploads module with PATCH /api/uploads/:uploadId/column-map"
```

---

## Task 9: Run Tests — Verify All Pass

- [ ] **Step 1: Sync test database schema**

```bash
bun run test:setup
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 2: Run the upload column-map tests**

```bash
bun test uploads/column-map
```

Expected: All 17 tests pass:

```
✓ should return 401 if not authenticated
✓ should return 401 if access token is expired
✓ should return 401 if access token is invalid
✓ should return 403 if user account is disabled
✓ should return 404 if uploadId does not exist
✓ should return 404 if upload belongs to a different shop
✓ should return 409 if upload status is READY
✓ should return 409 if upload status is UPLOADED
✓ should return 409 if upload status is DETECTING_COLUMNS
✓ should return 409 if upload status is FAILED
✓ should return 400 if resolvedMappings is an empty object
✓ should return 400 if resolvedMappings is missing from body
✓ should return 400 if a mapping value is an empty string
✓ should return 200 and merge resolvedMappings into the existing columnMap
✓ should update RawUpload.status to READY in the database
✓ should correctly merge multiple resolved fields at once
✓ should not expose internal fields (filePath, shopId) in the response

17 pass
0 fail
```

- [ ] **Step 3: Run the full test suite — confirm no regressions**

```bash
bun test
```

Expected: All previously passing tests continue to pass.

- [ ] **Step 4: Commit tests**

```bash
git add src/__tests__/uploads/column-map.test.ts
git commit -m "test: integration tests for PATCH /api/uploads/:uploadId/column-map"
```
