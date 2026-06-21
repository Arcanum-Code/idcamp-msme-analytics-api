# Revenue Report API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `POST /api/reports/revenue` endpoint that asynchronously computes a revenue report based on an uploaded transaction file via the FastAPI mini-model.

**Architecture:** We will create a new `reports` module. The endpoint will handle request validation, cache checking, and database initialization for the `ReportSnapshot`. If a snapshot for the requested period doesn't exist, it will immediately return a `202 Accepted` response and spawn an asynchronous background task to call the FastAPI mini-model. We will also add the `reports_management` feature to our RBAC seeding so the routes can be protected.

**Tech Stack:** Bun, Elysia, TypeBox, Prisma

---

### Task 1: Update Schema Seed Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add `reports_management` to FEATURES array**

Update the `FEATURES` array in `prisma/seed.ts` to include the `reports_management` feature.

```typescript
const FEATURES = [
  { name: "user_management", description: "Manage system users" },
  { name: "RBAC_management", description: "Manage roles and permissions" },
  { name: "uploads_management", description: "Manage file uploads" },
  { name: "reports_management", description: "Manage reports and analytics" },
] as const;
```

- [ ] **Step 2: Add `reports_management` to ROLE_PERMISSIONS**

Update the `ROLE_PERMISSIONS` configuration to grant both `SuperAdmin` and `Staff` access to reports.

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
    reports_management: { c: true, r: true, u: true, d: true, p: true },
  },
  Staff: {
    user_management: { c: false, r: false, u: false, d: false, p: false },
    RBAC_management: { c: false, r: false, u: false, d: false, p: false },
    uploads_management: { c: true, r: true, u: true, d: false, p: false },
    reports_management: { c: true, r: true, u: false, d: false, p: true },
  },
};
```

- [ ] **Step 3: Commit all task changes**

```bash
git add prisma/seed.ts
git commit -m "chore: add reports_management feature to rbac seed"
```

---

### Task 2: Create Reports Module Base (Schema & Error)

**Files:**
- Create: `src/modules/reports/schema.ts`
- Create: `src/modules/reports/error.ts`

- [ ] **Step 1: Create custom error definitions**

Create `src/modules/reports/error.ts`:

```typescript
import { BaseError } from "@/libs/error";

export class UploadNotReadyError extends BaseError {
  constructor(locale: string = "en") {
    super(400, "UPLOAD_NOT_READY", "Upload is not ready for report generation.", locale);
  }
}

export class InvalidPeriodError extends BaseError {
  constructor(locale: string = "en") {
    super(400, "INVALID_PERIOD", "periodStart must be before or equal to periodEnd.", locale);
  }
}

export class ComputationFailedError extends BaseError {
  constructor(locale: string = "en") {
    super(422, "COMPUTATION_FAILED", "Revenue computation failed.", locale);
  }
}
```

- [ ] **Step 2: Create schemas**

Create `src/modules/reports/schema.ts` using TypeBox.

```typescript
import { t } from "elysia";
import { PeriodType } from "@generated/prisma";

export const GenerateRevenueReportBodySchema = t.Object({
  uploadId: t.String(),
  periodType: t.Enum(PeriodType),
  periodStart: t.String({ format: "date", examples: ["2025-05-26"] }),
  periodEnd: t.String({ format: "date", examples: ["2025-06-01"] }),
});

export type GenerateRevenueReportInput = typeof GenerateRevenueReportBodySchema.static;

export const GenerateRevenueReportAcceptedResponseSchema = t.Object({
  reportId: t.String(),
  status: t.String(),
  message: t.String(),
});

export const GenerateRevenueReportCachedResponseSchema = t.Object({
  reportId: t.String(),
  status: t.String(),
  cached: t.Boolean(),
  computedAt: t.Optional(t.String()),
});

export const ReportsErrorSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});
```

- [ ] **Step 3: Commit all task changes**

```bash
git add src/modules/reports/schema.ts src/modules/reports/error.ts
git commit -m "feat(reports): add base schemas and errors for revenue endpoint"
```

---

### Task 3: Create FastAPI Compute Function

**Files:**
- Create: `src/modules/reports/compute-revenue.ts`

- [ ] **Step 1: Create function to call FastAPI internal endpoint**

Create `src/modules/reports/compute-revenue.ts`:

```typescript
import { env } from "@/config/env";
import type { Logger } from "pino";

export interface ComputeRevenuePayload {
  filePath: string;
  columnMap: Record<string, string | null>;
  periodType: "DAILY" | "WEEKLY" | "MONTHLY";
  periodStart: string;
  periodEnd: string;
  timezone?: string;
}

export interface ComputeRevenueResult {
  status: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  rowsProcessed: number;
  rowsInPeriod: number;
  result: Record<string, any>;
}

export async function computeRevenueSummary(
  payload: ComputeRevenuePayload,
  log: Logger,
): Promise<ComputeRevenueResult> {
  log.debug({ payload }, "Sending request to FastAPI for revenue summary");

  // Wait, what's the internal service URL? Usually something like:
  const miniModelUrl = env.MINI_MODEL_URL || "http://localhost:5000";

  const response = await fetch(`${miniModelUrl}/internal/revenue-summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      timezone: payload.timezone ?? "Asia/Jakarta",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ status: response.status, errorData }, "FastAPI computation failed");
    throw new Error(errorData.message || "Computation failed");
  }

  const data = await response.json() as ComputeRevenueResult;
  return data;
}
```

- [ ] **Step 2: Commit all task changes**

```bash
git add src/modules/reports/compute-revenue.ts
git commit -m "feat(reports): add function to call internal FastAPI revenue summary"
```

---

### Task 4: Create Reports Service

**Files:**
- Create: `src/modules/reports/service.ts`

- [ ] **Step 1: Write the service logic**

Create `src/modules/reports/service.ts`. This contains the core logic for checking the cache and spawning the background computation.

```typescript
import { prisma } from "@/libs/prisma";
import { ReportStatus, UploadStatus, PeriodType } from "@generated/prisma";
import type { GenerateRevenueReportInput } from "./schema";
import {
  InvalidPeriodError,
  UploadNotReadyError,
} from "./error";
import { UploadNotFoundError } from "../uploads/error";
import { computeRevenueSummary } from "./compute-revenue";
import type { Logger } from "pino";

export abstract class ReportsService {
  static async generateRevenueReport(
    userId: string,
    data: GenerateRevenueReportInput,
    log: Logger,
    locale: string = "en",
  ) {
    // 1. Validate period
    if (new Date(data.periodStart) > new Date(data.periodEnd)) {
      throw new InvalidPeriodError(locale);
    }

    // 2. Resolve shop
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    const upload = await prisma.rawUpload.findFirst({
      where: {
        id: data.uploadId,
        shopId: shop?.id ?? "__no_shop__",
      },
    });

    if (!upload) {
      throw new UploadNotFoundError(locale);
    }

    if (upload.status !== UploadStatus.READY) {
      throw new UploadNotReadyError(locale);
    }

    // 3. Check for existing snapshot
    const existingSnapshot = await prisma.reportSnapshot.findUnique({
      where: {
        uploadId_periodType_periodStart_periodEnd: {
          uploadId: data.uploadId,
          periodType: data.periodType as PeriodType,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
        },
      },
    });

    if (existingSnapshot) {
      return {
        cached: true,
        reportId: existingSnapshot.id,
        status: existingSnapshot.status,
        computedAt: existingSnapshot.computedAt?.toISOString(),
      };
    }

    // 4. Create new snapshot in PROCESSING state
    const snapshot = await prisma.reportSnapshot.create({
      data: {
        shopId: upload.shopId,
        uploadId: upload.id,
        periodType: data.periodType as PeriodType,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        status: ReportStatus.PROCESSING,
      },
    });

    // 5. Fire background computation
    this.runBackgroundComputation(snapshot.id, upload, data, log).catch((err) => {
      log.error({ err, snapshotId: snapshot.id }, "Background computation error");
    });

    return {
      cached: false,
      reportId: snapshot.id,
      status: "PROCESSING",
      message: "Revenue summary is being computed.",
    };
  }

  private static async runBackgroundComputation(
    snapshotId: string,
    upload: any,
    data: GenerateRevenueReportInput,
    log: Logger,
  ) {
    try {
      const result = await computeRevenueSummary(
        {
          filePath: upload.filePath,
          columnMap: upload.columnMap as Record<string, string | null>,
          periodType: data.periodType,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
        },
        log,
      );

      // Save success
      await prisma.reportSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: ReportStatus.COMPLETED,
          revenueData: result.result,
          computedAt: new Date(),
          narrative: "Laporan berhasil di-generate.", // Mock narrative for now
        },
      });
    } catch (error) {
      // Save failure
      await prisma.reportSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: ReportStatus.FAILED,
          error: { message: error instanceof Error ? error.message : "Unknown error" },
        },
      });
    }
  }
}
```

- [ ] **Step 2: Commit all task changes**

```bash
git add src/modules/reports/service.ts
git commit -m "feat(reports): implement revenue report service logic"
```

---

### Task 5: Create Controller and Setup Router

**Files:**
- Create: `src/modules/reports/controller.ts`
- Create: `src/modules/reports/index.ts`
- Modify: `src/modules/index.ts:7-9`
- Modify: `src/server.ts:60-64`

- [ ] **Step 1: Write Controller**

Create `src/modules/reports/controller.ts`:

```typescript
import { ReportsService } from "./service";
import type { GenerateRevenueReportInput } from "./schema";

export abstract class ReportsController {
  static async generateRevenueReport({
    body,
    user,
    log,
    locale,
    set,
  }: {
    body: GenerateRevenueReportInput;
    user: { id: string };
    log: any;
    locale: string;
    set: any;
  }) {
    const result = await ReportsService.generateRevenueReport(
      user.id,
      body,
      log,
      locale,
    );

    if (result.cached) {
      set.status = 200;
      return {
        reportId: result.reportId,
        status: result.status,
        cached: true,
        computedAt: result.computedAt,
      };
    }

    set.status = 202;
    return {
      reportId: result.reportId,
      status: result.status,
      message: result.message,
    };
  }
}
```

- [ ] **Step 2: Create Module Index**

Create `src/modules/reports/index.ts` to hook up the routes and error handlers:

```typescript
import { ReportsController } from "./controller";
import {
  GenerateRevenueReportBodySchema,
  GenerateRevenueReportAcceptedResponseSchema,
  GenerateRevenueReportCachedResponseSchema,
  ReportsErrorSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";
import {
  UploadNotReadyError,
  InvalidPeriodError,
  ComputationFailedError,
} from "./error";
import { UploadNotFoundError } from "../uploads/error";

const FEATURE_NAME = "reports_management";

const protectedReports = createProtectedApp().post(
  "/revenue",
  ReportsController.generateRevenueReport,
  {
    beforeHandle: hasPermission(FEATURE_NAME, "create"),
    body: GenerateRevenueReportBodySchema,
    response: {
      200: GenerateRevenueReportCachedResponseSchema,
      202: GenerateRevenueReportAcceptedResponseSchema,
      400: ReportsErrorSchema,
      404: ReportsErrorSchema,
    },
  },
);

export const reports = createBaseApp({ tags: ["Reports"] }).group(
  "/api/reports",
  (app) =>
    app
      .onError(({ error, set, locale }) => {
        if (error instanceof UploadNotFoundError) {
          return errorResponse(set, 404, { key: "upload.notFound" }, null, locale);
        }
        if (error instanceof UploadNotReadyError) {
          return errorResponse(set, 400, { key: "reports.uploadNotReady" }, null, locale);
        }
        if (error instanceof InvalidPeriodError) {
          return errorResponse(set, 400, { key: "reports.invalidPeriod" }, null, locale);
        }
        if (error instanceof ComputationFailedError) {
          return errorResponse(set, 422, { key: "reports.computationFailed" }, null, locale);
        }
      })
      .use(protectedReports),
);
```

- [ ] **Step 3: Export in Global Index**

Modify `src/modules/index.ts` to export the `reports` module. Add this at the bottom:

```typescript
export { reports } from "./reports";
```

- [ ] **Step 4: Register module in Server**

Modify `src/server.ts` to include the `reports` module alongside others. Find where `uploads` is imported and used, and add `reports`.

```typescript
// Add to imports
import { user, health, auth, rbac, dashboard, uploads, reports } from "./modules";

// Further down, in the chain:
  .use(uploads)
  .use(reports)
  .use(globalErrorHandler)
```

- [ ] **Step 5: Commit all task changes**

```bash
git add src/modules/reports/controller.ts src/modules/reports/index.ts src/modules/index.ts src/server.ts
git commit -m "feat(reports): add API routes and register reports module"
```
