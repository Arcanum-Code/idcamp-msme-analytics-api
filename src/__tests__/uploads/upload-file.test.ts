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
const createCsvFile = (headers: string[], filename = "test-data.csv"): File => {
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
    const noPermRole = await createTestRoleWithPermissions("NoPermRole", []);
    const { authHeaders } = await createAuthenticatedUser({
      roleId: noPermRole.id,
    });
    const file = createCsvFile(["transaction_date", "product_detail"]);
    const res = await POST(authHeaders, file);
    expect(res.status).toBe(403);
  });

  it("should return 403 if user has uploads_management:read but not create", async () => {
    const readOnlyRole = await createTestRoleWithPermissions("ReadOnlyRole", [
      { featureName: "uploads_management", action: "read" },
    ]);
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
    const oversizedContent = "x".repeat(env.MAX_FILE_SIZE_MB * 1024 * 1024 + 1);
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
