# Get Revenue Report Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `GET /api/reports/:reportId` endpoint to fetch a completed revenue report or its processing status.

**Architecture:** We will create a new route in the `reports` module, along with parameter schema validation, error definition, and service method to query the database and format the output according to the `ReportSnapshot`'s current status.

**Tech Stack:** Bun, Elysia, Prisma, TypeScript

---

### Task 1: Define Schema and Error

**Files:**
- Modify: `src/modules/reports/schema.ts`
- Modify: `src/modules/reports/error.ts`

- [ ] **Step 1: Add parameter schema**
Append the following to `src/modules/reports/schema.ts`:
```typescript
export const GetReportParamsSchema = t.Object({
  reportId: t.String(),
});
```

- [ ] **Step 2: Add error class**
Append the following to `src/modules/reports/error.ts`:
```typescript
export class ReportNotFoundError extends Error {
  readonly key = "reports.reportNotFound";
  constructor(locale: string = "en") {
    super(t(locale, "reports.reportNotFound"));
  }
}
```

### Task 2: Implement Service Logic

**Files:**
- Modify: `src/modules/reports/service.ts`

- [ ] **Step 1: Write the service method**
Update `src/modules/reports/service.ts` to import `ReportNotFoundError` (from `./error`). Then, add the `getReport` static method to `ReportsService`:

```typescript
  static async getReport(
    userId: string,
    reportId: string,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug({ userId, reportId }, "Fetching report");

    const report = await prisma.reportSnapshot.findFirst({
      where: {
        id: reportId,
        shop: { ownerId: userId },
      },
    });

    if (!report) {
      log.warn({ userId, reportId }, "Report not found or not owned by user");
      throw new ReportNotFoundError(locale);
    }

    if (report.status === ReportStatus.PROCESSING) {
      return {
        reportId: report.id,
        status: report.status,
      };
    }

    return {
      reportId: report.id,
      shopId: report.shopId,
      periodType: report.periodType,
      periodStart: report.periodStart.toISOString().split("T")[0],
      periodEnd: report.periodEnd.toISOString().split("T")[0],
      status: report.status,
      computedAt: report.computedAt?.toISOString(),
      revenue: report.revenueData,
      narrative: report.narrative,
      ...(report.status === ReportStatus.FAILED ? { error: report.error } : {}),
    };
  }
```

### Task 3: Implement Controller Method

**Files:**
- Modify: `src/modules/reports/controller.ts`

- [ ] **Step 1: Write the controller method**
Add the `getReport` static method to `ReportsController` in `src/modules/reports/controller.ts`:

```typescript
  static async getReport({
    params,
    user,
    set,
    log,
    locale,
  }: {
    params: { reportId: string };
    user: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await ReportsService.getReport(
      user.id,
      params.reportId,
      log,
      locale,
    );

    return successResponse(
      set,
      result,
      "Report retrieved successfully.",
      200,
      undefined,
      locale,
    );
  }
```

### Task 4: Setup Route and Error Handler

**Files:**
- Modify: `src/modules/reports/index.ts`

- [ ] **Step 1: Add the route to protectedApp**
Import `GetReportParamsSchema` from schema. Chain a `.get` to `protectedReports`:

```typescript
  .get(
    "/:reportId",
    ({ params, user, set, log, locale }) =>
      ReportsController.getReport({
        params: params as { reportId: string },
        user: user as { id: string },
        set,
        log,
        locale,
      }),
    {
      params: GetReportParamsSchema,
      detail: {
        tags: ["Reports"],
        description: "Fetch a completed revenue report or its processing status.",
      },
    }
  )
```

- [ ] **Step 2: Add error handler**
Import `ReportNotFoundError` and add an `if` block inside `.onError`:
```typescript
        if (error instanceof ReportNotFoundError) {
          return errorResponse(
            set,
            404,
            { key: "reports.reportNotFound" },
            null,
            locale,
          );
        }
```

### Task 5: Write Integration Tests

**Files:**
- Modify: `src/__tests__/integration/reports.test.ts`

- [ ] **Step 1: Add test cases**
Add a new `describe` block inside `reports.test.ts` for `GET /api/reports/:reportId`.

```typescript
describe("GET /api/reports/:reportId", () => {
  let authHeaders: Record<string, string>;
  let user: any;
  let shop: any;
  let upload: any;

  beforeAll(async () => {
    user = await createAuthenticatedUser({ email: "get-reports-test@example.com" });
    authHeaders = user.headers;

    shop = await prisma.shop.create({
      data: {
        name: "Get Reports Shop",
        ownerId: user.user.id,
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
      })
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
      })
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
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.status).toBe("COMPLETED");
    expect(data.data.revenue.totalRevenue).toBe(1000);
    expect(data.data.narrative).toBe("Test narrative");
  });
});
```

### Task 6: Commit All Plan Changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add .
git commit -m "feat(reports): implement GET /api/reports/:reportId endpoint"
```
