# Upload Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `GET /api/uploads/:uploadId/status` to poll the processing status of an upload.

**Architecture:** A new handler in `UploadController` will call `UploadService.getUploadStatus()`, which fetches the `RawUpload` via Prisma. Results are validated against TypeBox schemas in `schema.ts`. To match existing conventions, the payload will be wrapped in the standard `successResponse` format.

**Tech Stack:** Bun, Elysia, TypeBox, Prisma

---

### Task 1: Add Schemas & Locales

**Files:**
- Modify: `src/modules/uploads/schema.ts`
- Modify: `src/modules/uploads/locales/en.ts`

- [ ] **Step 1: Add locales to `en.ts`**

Update `src/modules/uploads/locales/en.ts` to include a success message for status retrieval.

```typescript
export const en = {
  // ... existing fields ...
  saveColumnMapSuccess: "Column map saved.",
  statusRetrieved: "Upload status retrieved.", // <-- ADD THIS LINE
  // ...
```

- [ ] **Step 2: Add params and response schemas**

Add this to `src/modules/uploads/schema.ts`:

```typescript
// Add these exports at the bottom of the file
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
    t.Union([
      t.Object({
        code: t.String(),
        message: t.String(),
      }),
      t.Null(),
    ])
  ),
});

export const UploadStatusResponseSchema = createTbResponseSchema(UploadStatusDataSchema);
```

- [ ] **Step 3: Commit all task changes**

```bash
git add src/modules/uploads/schema.ts src/modules/uploads/locales/en.ts
git commit -m "feat: add schema and locales for upload status"
```

### Task 2: Implement Service Method

**Files:**
- Modify: `src/modules/uploads/service.ts`

- [ ] **Step 1: Write `getUploadStatus` in `UploadService`**

Add this method to `UploadService` in `src/modules/uploads/service.ts`.

```typescript
  static async getUploadStatus(
    uploadId: string,
    userId: string,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug({ uploadId, userId }, "Fetching upload status");

    // Resolve shop
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    const upload = await prisma.rawUpload.findFirst({
      where: {
        id: uploadId,
        shopId: shop?.id ?? "__no_shop__",
      },
      select: {
        id: true,
        filename: true,
        status: true,
        rowCount: true,
        uploadedAt: true,
        processedAt: true,
        error: true,
      },
    });

    if (!upload) {
      log.warn({ uploadId, userId }, "Upload not found or does not belong to user");
      throw new UploadNotFoundError(locale);
    }

    return {
      uploadId: upload.id,
      filename: upload.filename,
      status: upload.status,
      rowCount: upload.rowCount,
      uploadedAt: upload.uploadedAt,
      processedAt: upload.processedAt,
      error: upload.error as { code: string; message: string } | null,
    };
  }
```

- [ ] **Step 2: Commit all task changes**

```bash
git add src/modules/uploads/service.ts
git commit -m "feat: implement getUploadStatus in UploadService"
```

### Task 3: Implement Controller & Route

**Files:**
- Modify: `src/modules/uploads/controller.ts`
- Modify: `src/modules/uploads/index.ts`

- [ ] **Step 1: Add `getUploadStatus` to `UploadController`**

In `src/modules/uploads/controller.ts`, add the following method to `UploadController`:

```typescript
  static async getUploadStatus({
    params,
    user,
    set,
    log,
    locale,
  }: {
    params: { uploadId: string };
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await UploadService.getUploadStatus(
      params.uploadId,
      user.id,
      log,
      locale,
    );

    return successResponse(
      set,
      result,
      { key: "upload.statusRetrieved" },
      200,
      undefined,
      locale,
    );
  }
```

- [ ] **Step 2: Register route in `index.ts`**

In `src/modules/uploads/index.ts`, update `schema.ts` imports and the `protectedUploads` group.

First, update the import from `./schema`:
```typescript
import {
  ColumnMapParamSchema,
  SaveColumnMapBodySchema,
  SaveColumnMapResponseSchema,
  UploadErrorSchema,
  UploadFileBodySchema,
  UploadFileResponseSchema,
  UploadStatusParamSchema,
  UploadStatusResponseSchema,
} from "./schema";
```

Then append the `GET` route to `protectedUploads`:
```typescript
const protectedUploads = createProtectedApp()
  // ... existing routes ...
  .get("/:uploadId/status", UploadController.getUploadStatus, {
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    params: UploadStatusParamSchema,
    response: {
      200: UploadStatusResponseSchema,
      404: UploadErrorSchema,
    },
  });
```

- [ ] **Step 3: Commit all task changes**

```bash
git add src/modules/uploads/controller.ts src/modules/uploads/index.ts
git commit -m "feat: add upload status endpoint controller and route"
```

### Task 4: Integration Tests

**Files:**
- Create: `src/__tests__/uploads/get-status.test.ts`

- [ ] **Step 1: Write integration test**

Create `src/__tests__/uploads/get-status.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createAuthenticatedUser,
  randomIp,
  createTestUpload,
  createTestRoleWithPermissions,
} from "../test_utils";
import { UploadStatus } from "@generated/prisma";

const GET = (uploadId: string, headers: Record<string, string>) =>
  app.handle(
    new Request(`http://localhost/api/uploads/${uploadId}/status`, {
      method: "GET",
      headers: {
        "x-forwarded-for": randomIp(),
        ...headers,
      },
    }),
  );

describe("GET /api/uploads/:uploadId/status", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createTestRoleWithPermissions("TestUser", [
      { featureName: "uploads_management", action: "read" },
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should return 404 if upload does not exist", async () => {
    const { authHeaders } = await createAuthenticatedUser();
    const res = await GET("invalid-id", authHeaders);
    expect(res.status).toBe(404);
  });

  it("should return 404 if upload belongs to a different shop", async () => {
    const user1 = await createAuthenticatedUser();
    const user2 = await createAuthenticatedUser();

    // Create upload for user1
    const { upload } = await createTestUpload(user1.user.id, {
      status: UploadStatus.READY,
    });

    // Request as user2
    const res = await GET(upload.id, user2.authHeaders);
    expect(res.status).toBe(404);
  });

  it("should return 200 and status data if successful", async () => {
    const { user, authHeaders } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, {
      status: UploadStatus.READY,
      filename: "test.csv",
      rowCount: 10,
    });

    const res = await GET(upload.id, authHeaders);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.error).toBe(false);
    expect(body.data.uploadId).toBe(upload.id);
    expect(body.data.status).toBe("READY");
    expect(body.data.filename).toBe("test.csv");
    expect(body.data.rowCount).toBe(10);
    expect(body.data.uploadedAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test src/__tests__/uploads/get-status.test.ts`
Expected: PASS

- [ ] **Step 3: Commit all task changes**

```bash
git add src/__tests__/uploads/get-status.test.ts
git commit -m "test: add integration tests for getUploadStatus"
```
