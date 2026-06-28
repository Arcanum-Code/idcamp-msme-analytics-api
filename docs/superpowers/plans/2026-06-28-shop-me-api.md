# Shop Me API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a `GET /api/shops/me` endpoint to retrieve the currently authenticated user's shop, returning a 200 OK with `null` data if they do not have one.

**Architecture:** We will update the schema to define the nullable response type, add a new service method `getMyShop` that looks up a shop by `ownerId`, add a controller method `getMyShop`, and wire it up in the Elysia router BEFORE the `/:id` route to prevent route collision. We'll also add integration tests for this new endpoint.

**Tech Stack:** Bun, Elysia, Prisma, TypeBox

---

### Task 1: Update the Schema

**Files:**
- Modify: `src/modules/shop/schema.ts`

- [ ] **Step 1: Export a new `ShopMeResponseSchema`**

Modify `src/modules/shop/schema.ts` to add the new `ShopMeResponseSchema` at the bottom of the file (or near `ShopResponseSchema`):

```typescript
export const ShopMeResponseSchema = createResponseSchema(
  t.Union([ShopSafeSchema, t.Null()])
);
```

### Task 2: Implement the Service Method

**Files:**
- Modify: `src/modules/shop/service.ts`

- [ ] **Step 1: Write the `getMyShop` service method**

Add the `getMyShop` method to the `ShopService` class in `src/modules/shop/service.ts`:

```typescript
  static async getMyShop(userId: string, log: Logger) {
    log.debug({ userId }, "Fetching shop for authenticated user");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: SAFE_SHOP_SELECT,
    });

    log.info({ shopId: shop?.id, userId }, "User shop retrieved");

    if (!shop) return null;

    return {
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    };
  }
```

### Task 3: Implement the Controller Method

**Files:**
- Modify: `src/modules/shop/controller.ts`

- [ ] **Step 1: Write the `getMyShop` controller method**

Add the `getMyShop` method to the `ShopController` class in `src/modules/shop/controller.ts`:

```typescript
  static async getMyShop({
    user,
    set,
    log,
    locale,
  }: {
    user: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const shop = await ShopService.getMyShop(user.id, log);

    return successResponse(
      set,
      shop,
      { key: "shop.getSuccess" },
      200,
      undefined,
      locale,
    );
  }
```

### Task 4: Register the Route

**Files:**
- Modify: `src/modules/shop/index.ts`

- [ ] **Step 1: Import the new schema**

Update the imports at the top of `src/modules/shop/index.ts` to include `ShopMeResponseSchema`.

```typescript
import {
  CreateShopSchema,
  GetShopsQuerySchema,
  UpdateShopSchema,
  ShopParamSchema,
  ShopResponseSchema,
  ShopMeResponseSchema,
  ShopsResponseSchema,
  ShopCreateResultResponseSchema,
  ShopDeleteResultResponseSchema,
  ShopErrorSchema,
  ShopValidationErrorSchema,
} from "./schema";
```

- [ ] **Step 2: Add the route to `protectedShop`**

In `src/modules/shop/index.ts`, add the `.get("/me", ...)` route definition on `protectedShop`.
**CRITICAL:** It must be placed BEFORE `.get("/:id", ...)` so that "me" is not interpreted as an `id` parameter. This endpoint does not require the `hasPermission` middleware because it is open to any authenticated user.

```typescript
  .get("/me", ShopController.getMyShop, {
    detail: { description: "Retrieve the shop of the authenticated user." },
    response: {
      200: ShopMeResponseSchema,
      500: ShopErrorSchema,
    },
  })
```

### Task 5: Write Integration Tests

**Files:**
- Modify: `src/__tests__/integration/shop.test.ts`

- [ ] **Step 1: Write failing tests for `/api/shops/me`**

Add a new `describe("GET /api/shops/me", () => { ... })` block inside `src/__tests__/integration/shop.test.ts`.

```typescript
  describe("GET /api/shops/me", () => {
    beforeEach(async () => {
      await resetDatabase();
      await createTestRoleWithPermissions("TestUser", []);
    });

    it("should return 401 if user is not logged in", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/shops/me"),
      );
      expect(response.status).toBe(401);
    });

    it("should return 200 with null data if user has no shop", async () => {
      const { accessToken } = await setupTestUser("test-no-shop", "TestUser");
      const response = await app.handle(
        new Request("http://localhost/api/shops/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeNull();
    });

    it("should return 200 with shop data if user has a shop", async () => {
      const { user, accessToken } = await setupTestUser("test-has-shop", "TestUser");
      
      // Create a shop for the user
      await prisma.shop.create({
        data: {
          name: "My Awesome Shop",
          description: "This is my shop",
          ownerId: user.id,
        },
      });

      const response = await app.handle(
        new Request("http://localhost/api/shops/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.name).toBe("My Awesome Shop");
      expect(data.data.ownerId).toBe(user.id);
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test src/__tests__/integration/shop.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files modified are committed together.

```bash
git add .
git commit -m "feat: add GET /api/shops/me endpoint for authenticated users"
```
