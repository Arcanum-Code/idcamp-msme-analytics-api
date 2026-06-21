import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  createAuthenticatedUser,
  randomIp,
  resetDatabase,
} from "../test_utils";
import { UploadStatus, PeriodType, ReportStatus } from "@generated/prisma";

describe("POST /api/reports/revenue", () => {
  let authHeaders: Record<string, string>;
  let user: any;
  let shop: any;
  let upload: any;

  beforeAll(async () => {
    await resetDatabase();
    const authData = await createAuthenticatedUser({
      email: "reports-test@example.com",
    });
    user = authData.user;
    authHeaders = authData.authHeaders;

    shop = await prisma.shop.create({
      data: {
        name: "Reports Shop",
        ownerId: user.id,
      },
    });

    upload = await prisma.rawUpload.create({
      data: {
        shopId: shop.id,
        filename: "test.csv",
        filePath: "/fake/path/test.csv",
        status: UploadStatus.READY,
      },
    });
  });

  it("should return 202 Accepted and trigger computation if no cache exists", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/reports/revenue", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          uploadId: upload.id,
          periodType: "WEEKLY",
          periodStart: "2025-05-26",
          periodEnd: "2025-06-01",
        }),
      }),
    );

    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.data.status).toBe("PROCESSING");
    expect(data.data.cached).toBe(false);
  });

  it("should return 200 OK and cached true if computation already running/completed", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/reports/revenue", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          uploadId: upload.id,
          periodType: "WEEKLY",
          periodStart: "2025-05-26",
          periodEnd: "2025-06-01",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.cached).toBe(true);
  });
});

describe("GET /api/reports/:reportId", () => {
  let authHeaders: Record<string, string>;
  let user: any;
  let shop: any;
  let upload: any;

  beforeAll(async () => {
    const authData = await createAuthenticatedUser({
      id: "get-reports-user-id",
      email: "get-reports-test@example.com",
    });
    user = authData.user;
    authHeaders = authData.authHeaders;

    shop = await prisma.shop.create({
      data: {
        name: "Get Reports Shop",
        ownerId: user.id,
      },
    });

    upload = await prisma.rawUpload.create({
      data: {
        shopId: shop.id,
        filename: "test.csv",
        filePath: "/fake/path/test.csv",
        status: UploadStatus.READY,
      },
    });
  });

  it("should return 404 if report does not exist", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/reports/nonexistent", {
        method: "GET",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(404);
  });

  it("should return PROCESSING status if report is still processing", async () => {
    const report = await prisma.reportSnapshot.create({
      data: {
        shopId: shop.id,
        uploadId: upload.id,
        periodType: PeriodType.WEEKLY,
        periodStart: new Date("2025-05-26"),
        periodEnd: new Date("2025-06-01"),
        status: ReportStatus.PROCESSING,
      },
    });

    const response = await app.handle(
      new Request(`http://localhost/api/reports/${report.id}`, {
        method: "GET",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.status).toBe("PROCESSING");
    expect(data.data.reportId).toBe(report.id);
  });

  it("should return COMPLETED report with revenue data and narrative", async () => {
    const report = await prisma.reportSnapshot.create({
      data: {
        shopId: shop.id,
        uploadId: upload.id,
        periodType: PeriodType.DAILY,
        periodStart: new Date("2025-06-01"),
        periodEnd: new Date("2025-06-01"),
        status: ReportStatus.COMPLETED,
        revenueData: { totalRevenue: 1000 },
        narrative: "Test narrative",
        computedAt: new Date("2025-06-01T10:00:00Z"),
      },
    });

    const response = await app.handle(
      new Request(`http://localhost/api/reports/${report.id}`, {
        method: "GET",
        headers: authHeaders,
      }),
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.status).toBe("COMPLETED");
    expect(data.data.revenue.totalRevenue).toBe(1000);
    expect(data.data.narrative).toBe("Test narrative");
  });
});
