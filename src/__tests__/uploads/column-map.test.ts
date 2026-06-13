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
    status?:
      | "UPLOADED"
      | "DETECTING_COLUMNS"
      | "NEEDS_MAPPING"
      | "READY"
      | "FAILED";
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
        date: "transaction_date",
        product: null,
        category: "product_category",
        quantity: "transaction_qty",
        unitPrice: "unit_price",
        totalPrice: null,
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
    const res = await PATCH(
      "any-id",
      {},
      { resolvedMappings: { product: "Menu" } },
    );
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
    const res = await PATCH("any-id", authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(403);
  });

  // ── Ownership & Status Guard Tests ─────────────────────────────────

  it("should return 404 if uploadId does not exist", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    // Give the user a shop so ownership lookup doesn't also fail
    await prisma.shop.create({ data: { name: "My Shop", ownerId: user.id } });
    const res = await PATCH("non-existent-upload-id", authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(404);
  });

  it("should return 404 if upload belongs to a different shop", async () => {
    // User A is authenticated
    const { authHeaders } = await createAuthenticatedUser();

    // User B owns a different shop with the upload
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

  it("should return 409 if upload status is READY", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, { status: "READY" });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is UPLOADED", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, { status: "UPLOADED" });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is DETECTING_COLUMNS", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, {
      status: "DETECTING_COLUMNS",
    });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
    expect(res.status).toBe(409);
  });

  it("should return 409 if upload status is FAILED", async () => {
    const { authHeaders, user } = await createAuthenticatedUser();
    const { upload } = await createTestUpload(user.id, { status: "FAILED" });
    const res = await PATCH(upload.id, authHeaders, {
      resolvedMappings: { product: "Menu" },
    });
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
