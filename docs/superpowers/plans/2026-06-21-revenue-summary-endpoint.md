# Revenue Summary Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `POST /api/reports/revenue` endpoint to trigger revenue computation and serve cached results, and update the existing FastAPI mock function to match the API specification.

**Architecture:** We will create a new controller and route definition for the `reports` module. We will also update the existing mock function in `src/modules/reports/compute-revenue.ts` to return precise data matching the API specification for `POST /internal/revenue-summary`. The module will then be registered into the Elysia application.

**Tech Stack:** Bun, Elysia, Prisma, TypeScript

---

### Task 1: Update Mock Static Function for FastAPI

**Files:**
- Modify: `src/modules/reports/compute-revenue.ts`

- [ ] **Step 1: Update the mock function implementation**

Modify `getMockResult` to exactly match the response object in lines 502-607 of `docs/api/revenue-summary.md`. Replace the current `getMockResult` with the following implementation:

```typescript
function getMockResult(payload: ComputeRevenuePayload): ComputeRevenueResult {
  return {
    status: "success",
    periodType: payload.periodType,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    rowsProcessed: 1842,
    rowsInPeriod: 312,
    result: {
      totalRevenue: 4750000,
      totalTransactions: 312,
      avgTransactionValue: 15224,
      revenueByDay: [
        { date: "2025-05-26", revenue: 620000, transactions: 41 },
        { date: "2025-05-27", revenue: 580000, transactions: 38 },
        { date: "2025-05-28", revenue: 710000, transactions: 47 },
        { date: "2025-05-29", revenue: 690000, transactions: 45 },
        { date: "2025-05-30", revenue: 750000, transactions: 50 },
        { date: "2025-05-31", revenue: 820000, transactions: 54 },
        { date: "2025-06-01", revenue: 580000, transactions: 37 }
      ],
      peakDay: {
        date: "2025-05-31",
        revenue: 820000,
        transactions: 54
      },
      previousPeriod: {
        totalRevenue: 4381500,
        totalTransactions: 289
      },
      growthVsPreviousPeriod: 8.4
    }
  };
}
```

### Task 2: Create Reports Controller

**Files:**
- Create: `src/modules/reports/controller.ts`

- [ ] **Step 1: Write the minimal implementation**

Create the controller that calls the existing `ReportsService`. Notice the `successResponse` usage matches the Elysia structure found in `src/modules/auth/controller.ts`.

```typescript
import { ReportsService } from "./service";
import type { GenerateRevenueReportInput } from "./schema";
import { successResponse } from "@/libs/response";
import type { Context } from "elysia";
import type { Logger } from "pino";

export class ReportsController {
  static async generateRevenueReport({
    body,
    user,
    set,
    log,
    locale,
  }: {
    body: GenerateRevenueReportInput;
    user: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await ReportsService.generateRevenueReport(
      user.id,
      body,
      log,
      locale
    );

    return successResponse(
      set,
      result,
      {
        message: result.cached
          ? "Revenue report retrieved from cache."
          : "Revenue summary is being computed.",
      },
      result.cached ? 200 : 202,
      undefined,
      locale
    );
  }
}
```

### Task 3: Setup Elysia Route for Reports

**Files:**
- Create: `src/modules/reports/index.ts`

- [ ] **Step 1: Write the plugin implementation**

We create the plugin and route, utilizing the schema for validation and injecting authentication.

```typescript
import { Elysia } from "elysia";
import { ReportsController } from "./controller";
import { GenerateRevenueReportBodySchema } from "./schema";
import { isAuthenticated } from "@/middleware/auth";
import { extractLocale } from "@/middleware/locale";
import { setupLogger } from "@/middleware/logger";

export const reports = new Elysia({ prefix: "/api/reports" })
  .use(setupLogger)
  .use(extractLocale)
  .use(isAuthenticated)
  .post(
    "/revenue",
    ({ body, user, set, log, locale }) =>
      ReportsController.generateRevenueReport({
        body,
        user: user as { id: string },
        set,
        log,
        locale,
      }),
    {
      body: GenerateRevenueReportBodySchema,
      detail: {
        tags: ["Reports"],
        description: "Trigger revenue summary computation or fetch cached result.",
      },
    }
  );
```

### Task 4: Export and Mount Reports Module

**Files:**
- Modify: `src/modules/index.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Export from modules index**

Update `src/modules/index.ts` to export the new reports module. Append the following:

```typescript
export { reports } from "./reports";
```

- [ ] **Step 2: Mount in server**

Modify `src/server.ts` to import `reports` from `./modules` and attach it to the application. Update the import from `./modules` to include `reports`:

```typescript
import { user, health, auth, rbac, dashboard, uploads, reports } from "./modules";
```

And add `.use(reports)` after `.use(uploads)` in the `Elysia()` chain:

```typescript
export const app = new Elysia()
  // ... other usages
  .use(dashboard)
  .use(uploads)
  .use(reports)
  .use(globalErrorHandler)
  .listen(port);
```

### Task 5: Write Integration Tests

**Files:**
- Create: `src/__tests__/integration/reports.test.ts`

- [ ] **Step 1: Write the integration test for the endpoint**

```typescript
import { describe, expect, it, beforeAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import { createTestUser, getTestAuthHeaders } from "../utils/auth";
import { ReportStatus, UploadStatus, PeriodType } from "@generated/prisma";

describe("POST /api/reports/revenue", () => {
  let authHeaders: Record<string, string>;
  let user: any;
  let shop: any;
  let upload: any;

  beforeAll(async () => {
    user = await createTestUser({ email: "reports-test@example.com" });
    authHeaders = await getTestAuthHeaders(app, "reports-test@example.com");

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
        },
        body: JSON.stringify({
          uploadId: upload.id,
          periodType: "WEEKLY",
          periodStart: "2025-05-26",
          periodEnd: "2025-06-01",
        }),
      })
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
        },
        body: JSON.stringify({
          uploadId: upload.id,
          periodType: "WEEKLY",
          periodStart: "2025-05-26",
          periodEnd: "2025-06-01",
        }),
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.cached).toBe(true);
  });
});
```

### Task 6: Commit All Plan Changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add src/modules/reports/compute-revenue.ts src/modules/reports/controller.ts src/modules/reports/index.ts src/modules/index.ts src/server.ts src/__tests__/integration/reports.test.ts
git commit -m "feat(reports): implement POST /api/reports/revenue and update FastAPI mock data"
```
