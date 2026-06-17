# Uploads Feature Permission Guard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RBAC-based permission checks (`hasPermission`) to the uploads module so access can be disabled per-role, matching the pattern used in `user` and `rbac` modules.

**Architecture:** Define a `FEATURE_NAME` constant (`"uploads_management"`) in the uploads route file, import `hasPermission` middleware, and wire it as a `beforeHandle` on the PATCH endpoint. The seed file gets a new feature entry and permission rows. Existing tests are updated to provision the new feature/permission so they continue to pass, plus new tests verify that a role _without_ the permission gets a 403.

**Tech Stack:** Elysia, Bun, Prisma, `hasPermission` middleware, `bun:test`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/modules/uploads/index.ts` | Add `FEATURE_NAME` constant, import `hasPermission`, attach `beforeHandle` to the PATCH route |
| Modify | `src/modules/uploads/schema.ts` | Add `403: UploadErrorSchema` to the PATCH response map |
| Modify | `prisma/seed.ts` | Add `uploads_management` feature and grant it to `SuperAdmin`/`Staff` |
| Modify | `src/__tests__/uploads/column-map.test.ts` | Provision the `uploads_management` permission in test setup, add 403 tests |

---

### Task 1: Add the `uploads_management` feature to the seed file

**Files:**
- Modify: `prisma/seed.ts:7-10` (FEATURES array)
- Modify: `prisma/seed.ts:31-41` (ROLE_PERMISSIONS)

- [ ] **Step 1: Add the feature entry to the FEATURES array**

In `prisma/seed.ts`, add `uploads_management` to the `FEATURES` array:

```typescript
const FEATURES = [
  { name: "user_management", description: "Manage system users" },
  { name: "RBAC_management", description: "Manage roles and permissions" },
  { name: "uploads_management", description: "Manage file uploads and column mappings" },
] as const;
```

- [ ] **Step 2: Grant permissions for the new feature in ROLE_PERMISSIONS**

In `prisma/seed.ts`, update `ROLE_PERMISSIONS` to include the new feature for both roles:

```typescript
const ROLE_PERMISSIONS: Record<
  string,
  Partial<
    Record<
      FeatureName,
      { c?: boolean; r?: boolean; u?: boolean; d?: boolean; p?: boolean }
    >
  >
> = {
  SuperAdmin: {
    user_management: { c: true, r: true, u: true, d: true, p: true },
    RBAC_management: { c: true, r: true, u: true, d: true, p: true },
    uploads_management: { c: true, r: true, u: true, d: true, p: true },
  },
  Staff: {
    user_management: { c: false, r: false, u: false, d: false, p: false },
    RBAC_management: { c: false, r: false, u: false, d: false, p: false },
    uploads_management: { c: true, r: true, u: true, d: false, p: false },
  },
};
```

> **Note:** Staff gets `c: true, r: true, u: true` for uploads (create/read/update) because typical staff users need to upload files and save column mappings. Adjust as needed.

- [ ] **Step 3: Sync the test database with the updated seed**

Since we modified the seed file, the test database must be re-synced before running any tests. This is required per the "Test DB Out of Sync" gotcha.

Run: `bun run test:setup`
Expected: Schema pushed and test DB synced successfully (no errors)

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): add uploads_management feature and permissions"
```

---

### Task 2: Wire `hasPermission` into the uploads route

**Files:**
- Modify: `src/modules/uploads/index.ts:1-24`

- [ ] **Step 1: Import `hasPermission` and define `FEATURE_NAME` in the uploads module**

In `src/modules/uploads/index.ts`, add the import and constant, then attach `beforeHandle` to the PATCH route. The full file should become:

```typescript
import { UploadController } from "./controller";
import {
  ColumnMapParamSchema,
  SaveColumnMapBodySchema,
  SaveColumnMapResponseSchema,
  UploadErrorSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";
import { UploadNotFoundError, UploadNotAwaitingMappingError } from "./error";

const FEATURE_NAME = "uploads_management";

const protectedUploads = createProtectedApp().patch(
  "/:uploadId/column-map",
  UploadController.saveColumnMap,
  {
    params: ColumnMapParamSchema,
    body: SaveColumnMapBodySchema,
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    response: {
      200: SaveColumnMapResponseSchema,
      403: UploadErrorSchema,
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

Key changes from the original:
1. Added `import { hasPermission } from "@/middleware/permission";`
2. Added `const FEATURE_NAME = "uploads_management";`
3. Added `beforeHandle: hasPermission(FEATURE_NAME, "update"),` to the PATCH route config
4. Added `403: UploadErrorSchema` to the response map

- [ ] **Step 2: Run the build to check for type errors**

Run: `bun run build`
Expected: Successful build with no type errors

- [ ] **Step 3: Commit**

```bash
git add src/modules/uploads/index.ts
git commit -m "feat(uploads): add RBAC permission guard to column-map endpoint"
```

---

### Task 3: Update existing tests to provision the `uploads_management` permission

**Files:**
- Modify: `src/__tests__/uploads/column-map.test.ts`

The existing tests use `createAuthenticatedUser()` which creates a `TestUser` role with no permissions. Now that the endpoint requires `uploads_management:update`, all existing tests that expect a non-403 response must provision this permission.

- [ ] **Step 1: Import `createTestRoleWithPermissions` in the test file**

At the top of `src/__tests__/uploads/column-map.test.ts`, update the import from `test_utils`:

```typescript
import {
  resetDatabase,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
  createTestUpload,
} from "../test_utils";
```

- [ ] **Step 2: Create a helper function for authenticated users with upload permission**

Add this helper right after the `PATCH` convenience wrapper (after line 28), before the `describe` block:

```typescript
/**
 * Creates a user whose role has uploads_management:update permission.
 * Use this for any test that expects to pass the permission guard.
 */
async function createUserWithUploadPermission(userOverrides: any = {}) {
  const role = await createTestRoleWithPermissions("TestUser", [
    { featureName: "uploads_management", action: "update" },
  ]);
  return createAuthenticatedUser({ roleId: role.id, ...userOverrides });
}
```

- [ ] **Step 3: Replace `createAuthenticatedUser()` with `createUserWithUploadPermission()` in all tests that need to pass the permission guard**

Every test that currently calls `createAuthenticatedUser()` and expects a status **other than 401 or 403** needs to be changed to `createUserWithUploadPermission()`. This applies to all tests from the "Ownership & Status Guard Tests" section onwards.

The following tests need updating (replace `createAuthenticatedUser()` → `createUserWithUploadPermission()`):

1. **"should return 403 if user account is disabled"** (line 77):
```typescript
  it("should return 403 if user account is disabled", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });
    const res = await PATCH("any-id", authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(403);
  });
```

2. **"should return 404 if uploadId does not exist"** (line 90):
```typescript
  it("should return 404 if uploadId does not exist", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    await prisma.shop.create({ data: { name: "My Shop", ownerId: user.id } });
    const res = await PATCH("non-existent-upload-id", authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(404);
  });
```

3. **"should return 404 if upload belongs to a different shop"** (line 100):
```typescript
  it("should return 404 if upload belongs to a different shop", async () => {
    const { authHeaders } = await createUserWithUploadPermission();

    const roleId = (await prisma.role.findFirst({
      where: { name: "TestUser" },
    }))!.id;
    const userB = await prisma.user.create({
      data: {
        email: "userb@test.com",
        name: "User B",
        password: "hashed",
        roleId,
      },
    });
    const { upload } = await createTestUpload(userB.id);

    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(404);
  });
```

4. **All 409 status tests** ("should return 409 if upload status is READY/UPLOADED/DETECTING_COLUMNS/FAILED" — lines 124, 133, 142, 153):
```typescript
  it("should return 409 if upload status is READY", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id, { status: "READY" });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is UPLOADED", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id, { status: "UPLOADED" });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is DETECTING_COLUMNS", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id, {
      status: "DETECTING_COLUMNS",
    });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is FAILED", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id, { status: "FAILED" });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(409);
  });
```

5. **All 400 validation tests** (lines 164, 171, 178):
```typescript
  it("should return 400 if resolvedMappings is an empty object", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id);
    const res = await PATCH(upload.id, authHeaders, { resolvedMappings: {} });
    expect(res.status).toBe(400);
  });

  it("should return 400 if resolvedMappings is missing from body", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id);
    const res = await PATCH(upload.id, authHeaders, {});
    expect(res.status).toBe(400);
  });

  it("should return 400 if a mapping value is an empty string", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id);
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "" },
    });
    expect(res.status).toBe(400);
  });
```

6. **All happy-path tests** (lines 189, 216, 230, 264):
```typescript
  it("should return 200 and merge resolvedMappings into the existing columnMap", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id, {
      columnMap: {
        date: "transaction_date",
        product: null,
        category: "product_category",
        quantity: "transaction_qty",
        unitPrice: "unit_price",
        totalPrice: null,
        paymentMethod: null,
      },
    });

    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Nama Menu" },
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.columnMap.product).toBe("Nama Menu");
    expect(body.data.columnMap.date).toBe("transaction_date");
    expect(body.data.columnMap.category).toBe("product_category");
  });

  it("should update RawUpload.status to READY in the database", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
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
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id, {
      columnMap: {
        date: "transaction_date",
        product: null,
        category: null,
        quantity: "transaction_qty",
        unitPrice: "unit_price",
        totalPrice: null,
        paymentMethod: null,
      },
    });

    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: {
        product: "Nama Menu",
        category: "Kategori",
        totalPrice: "Total Harga",
        paymentMethod: "Metode Bayar",
      },
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.columnMap.product).toBe("Nama Menu");
    expect(body.data.columnMap.category).toBe("Kategori");
    expect(body.data.columnMap.totalPrice).toBe("Total Harga");
    expect(body.data.columnMap.paymentMethod).toBe("Metode Bayar");
    expect(body.data.columnMap.date).toBe("transaction_date");
    expect(body.data.columnMap.quantity).toBe("transaction_qty");
  });

  it("should not expose internal fields (filePath, shopId) in the response", async () => {
    const { authHeaders, user } = await createUserWithUploadPermission();
    const { upload } = await createTestUpload(user.id);

    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Nama Menu" },
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.filePath).toBeUndefined();
    expect(body.data.shopId).toBeUndefined();
  });
```

- [ ] **Step 4: Run all existing tests to confirm they pass**

Run: `bun test column-map`
Expected: All existing tests PASS (they now provision the required permission)

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/uploads/column-map.test.ts
git commit -m "test(uploads): provision uploads_management permission for existing tests"
```

---

### Task 4: Add new 403 permission-denied tests

**Files:**
- Modify: `src/__tests__/uploads/column-map.test.ts`

- [ ] **Step 1: Write the failing test — 403 when role lacks uploads_management:update permission**

Add the following test right after the existing "should return 403 if user account is disabled" test (inside the "Auth Guard Tests" section):

```typescript
  it("should return 403 if user role lacks uploads_management:update permission", async () => {
    // createAuthenticatedUser() creates a "TestUser" role with NO permissions
    const { authHeaders } = await createAuthenticatedUser();
    const res = await PATCH("any-id", authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(403);
  });
```

- [ ] **Step 2: Run the new test to verify it passes**

Run: `bun test column-map`
Expected: PASS — the `hasPermission` middleware returns 403 because the `TestUser` role has no `uploads_management:update` permission.

- [ ] **Step 3: Write the test — 403 when role has only `read` but not `update` permission**

Add this test right after the previous 403 test:

```typescript
  it("should return 403 if user role has uploads_management:read but not update", async () => {
    const readOnlyRole = await createTestRoleWithPermissions("ReadOnlyUploader", [
      { featureName: "uploads_management", action: "read" },
    ]);
    const { authHeaders } = await createAuthenticatedUser({ roleId: readOnlyRole.id });
    const res = await PATCH("any-id", authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(403);
  });
```

- [ ] **Step 4: Run all tests to verify everything passes**

Run: `bun test column-map`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/uploads/column-map.test.ts
git commit -m "test(uploads): add 403 permission-denied tests for column-map endpoint"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run the full test suite to check for regressions**

Run: `bun test`
Expected: All tests PASS across all modules

- [ ] **Step 2: Final commit (if any adjustments were needed)**

```bash
git add -A
git commit -m "chore: final cleanup for uploads_management feature permission"
```
