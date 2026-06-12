# Feature Implementation Walkthrough & Template

This document provides a step-by-step example workflow for implementing a new feature or module (e.g., adding a `products` feature) from database schema changes down to route registration and tests.

---

## Step 1: Database Schema Changes

Edit `prisma/schema.prisma` to add your model definitions. Then run migrations and generate type definitions:

```bash
# Edit prisma/schema.prisma to add new models
# Then generate and apply the dev migration
prisma migrate dev --name add_products
prisma generate
```

---

## Step 2: Create the Module Directory Structure

Create your new feature folder under `src/modules/[feature-name]/`. For example, for a `products` module, create `src/modules/products/` containing:

- `schema.ts` - TypeBox (`t`) validation and API documentation response schemas merged
- `controller.ts` - Request-response lifecycle handler, manages cookies/JWTs and maps payloads to services
- `service.ts` - Core business and database logic with injected pino logging
- `index.ts` - Elysia route declarations binding controllers, paths, and schemas
- `locales/` - Localized key-value translation files

Example folder tree:
```
src/modules/products/
  index.ts
  controller.ts
  service.ts
  schema.ts
  locales/
    en.ts
    es.ts
    id.ts
```

---

## Step 3: Implement Schemas (`schema.ts`)

Define all TypeBox input, output, and response schemas here:

```typescript
import { t, type Static } from "elysia";
import { createTbResponseSchema, createTbErrorSchema } from "@/libs/response";

/**
 * Input validation schemas
 */
export const CreateProductSchema = t.Object({
  name: t.String({ minLength: 1 }),
  price: t.Number({ minimum: 0 }),
});

export const UpdateProductSchema = t.Partial(CreateProductSchema);

export const ProductQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ default: 1 })),
  limit: t.Optional(t.Numeric({ default: 10 })),
});

/**
 * Inferred input types
 */
export type CreateProductInput = Static<typeof CreateProductSchema>;
export type UpdateProductInput = Static<typeof UpdateProductSchema>;

/**
 * Response schemas
 */
export const ProductResponseSchema = t.Object({
  id: t.String(),
  name: t.String(),
  price: t.Number(),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

export const ProductListResponseSchema = createTbResponseSchema(
  t.Array(ProductResponseSchema),
);

export const ProductSingleResponseSchema = createTbResponseSchema(
  ProductResponseSchema,
);

export const ProductErrorSchema = createTbErrorSchema(t.Null());
```

---

## Step 4: Implement the Service Layer (`service.ts`)

Your service layer implements database queries, transactions, and business logic. Inject the logger as a parameter `log: Logger` and log all operations clearly. Services are pure logic and never touch Elysia HTTP details (cookies, headers, direct router set contexts):

```typescript
import type { Logger } from "pino";
import { prisma } from "@/libs/prisma";
import type { CreateProductInput, UpdateProductInput } from "./schema";

export abstract class ProductService {
  static async getProducts(params: { page: number; limit: number }, log: Logger) {
    const { page, limit } = params;
    log.debug({ page, limit }, "Fetching products list");

    const skip = (page - 1) * limit;
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count(),
    ]);

    log.info({ count: products.length, total }, "Products retrieved successfully");
    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async createProduct(data: CreateProductInput, log: Logger) {
    log.debug({ name: data.name }, "Creating new product");

    const product = await prisma.product.create({ data });

    log.info({ productId: product.id }, "Product created successfully");
    return product;
  }

  static async updateProduct(id: string, data: UpdateProductInput, log: Logger) {
    log.debug({ productId: id }, "Updating product");

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    log.info({ productId: id }, "Product updated successfully");
    return product;
  }

  static async deleteProduct(id: string, log: Logger) {
    log.debug({ productId: id }, "Deleting product");

    await prisma.product.delete({ where: { id } });

    log.info({ productId: id }, "Product deleted successfully");
  }
}
```

---

## Step 5: Implement the Controller Layer (`controller.ts`)

The controller acts as the bridge between HTTP routing and pure business logic. It handles cookies, JWT token decoding/signing, maps incoming request contexts, invokes services, and formats JSON outputs via success/error helpers:

```typescript
import type { Context } from "elysia";
import type { Logger } from "pino";
import { ProductService } from "./service";
import { successResponse, errorResponse } from "@/libs/response";
import type { CreateProductInput, UpdateProductInput } from "./schema";

export class ProductController {
  static async getProducts({
    query,
    set,
    log,
    locale,
  }: {
    query: { page?: number; limit?: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);

    const { products, pagination } = await ProductService.getProducts(
      { page, limit },
      log,
    );

    return successResponse(
      set,
      products,
      { key: "products.listSuccess" },
      200,
      { pagination },
      locale,
    );
  }

  static async createProduct({
    body,
    set,
    log,
    locale,
  }: {
    body: CreateProductInput;
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const product = await ProductService.createProduct(body, log);

    return successResponse(
      set,
      product,
      { key: "products.createSuccess" },
      201,
      undefined,
      locale,
    );
  }
}
```

---

## Step 6: Implement Route Declarations (`index.ts`)

Group endpoints and associate pathing, HTTP methods, route schemas, authentication permissions, and controller handler bindings:

```typescript
import { createProtectedApp } from "@/libs/base";
import { ProductController } from "./controller";
import {
  CreateProductSchema,
  ProductQuerySchema,
  ProductListResponseSchema,
  ProductSingleResponseSchema,
  ProductErrorSchema,
} from "./schema";

const protectedProducts = createProtectedApp()
  .get("/", ProductController.getProducts, {
    query: ProductQuerySchema,
    response: {
      200: ProductListResponseSchema,
      500: ProductErrorSchema,
    },
  })
  .post("/", ProductController.createProduct, {
    body: CreateProductSchema,
    response: {
      201: ProductSingleResponseSchema,
      500: ProductErrorSchema,
    },
  });

export const products = createProtectedApp({ tags: ["Products"] }).group(
  "/products",
  (app) => app.use(protectedProducts),
);
```

---

## Step 7: Implement Feature Tests

Create tests in `src/__tests__/products/` (e.g. `list.test.ts`, `create.test.ts`):

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "@/app";
import { getAuthToken, resetDatabase } from "@tests/test_utils";

describe("POST /products", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should create a new product", async () => {
    const token = await getAuthToken();

    const res = await app.handle(
      new Request("http://localhost/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: "Test Product",
          price: 99.99,
        }),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.name).toBe("Test Product");
  });
});
```

---

## Step 8: Register the Module

Open `src/modules/index.ts` and add your module:

```typescript
import { auth } from "./auth";
import { user } from "./user";
import { rbac } from "./rbac";
import { products } from "./products";

export const modules = [auth, user, rbac, products];
```

---

## Step 9: Verify Everything

Run ESLint, unit tests, and check features locally:

```bash
bun run lint           # Check for linting errors
bun test products      # Run your feature tests
bun run dev            # Run the dev server to test manually
```
