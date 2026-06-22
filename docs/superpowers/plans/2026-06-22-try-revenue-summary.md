# Try Revenue Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a public API endpoint to allow users to upload a file and try the revenue summary feature without logging in or creating a shop.

**Architecture:** We will add a new public route in the `reports` module (`POST /reports/try-revenue-summary`). The endpoint will save the uploaded file to a temporary location, run column detection (`detectColumns`), and if detection is full (or if a manual `columnMap` payload is provided that completes the mapping), compute the revenue using `computeRevenueSummary`. Unmapped columns will result in a 400 Bad Request with the required fields for manual mapping returned to the client. The temporary file will be cleaned up afterwards.

**Tech Stack:** Bun, Elysia, TypeBox

---

### Task 1: Add Schemas

**Files:**
- Modify: `src/modules/reports/schema.ts`
- Create: `src/__tests__/reports/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/reports/schema.test.ts
import { describe, expect, it } from 'bun:test';
import { TryRevenueSummarySchema } from '../../modules/reports/schema';
import { Value } from '@sinclair/typebox/value';

describe('TryRevenueSummarySchema', () => {
  it('should validate valid payload', () => {
    const valid = {
      file: new File(["data"], "test.csv"),
      periodType: "DAILY",
      periodStart: "2025-01-01",
      periodEnd: "2025-01-31"
    };
    expect(Value.Check(TryRevenueSummarySchema, valid)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/reports/schema.test.ts`
Expected: FAIL (Cannot find TryRevenueSummarySchema)

- [ ] **Step 3: Write minimal implementation**

```typescript
// Modify src/modules/reports/schema.ts - append to bottom
import { Static } from "elysia";

export const TryRevenueSummarySchema = t.Object({
  file: t.File(),
  periodType: t.Union([t.Literal("DAILY"), t.Literal("WEEKLY"), t.Literal("MONTHLY")]),
  periodStart: t.String({ format: "date" }),
  periodEnd: t.String({ format: "date" }),
  timezone: t.Optional(t.String()),
  columnMap: t.Optional(t.String()) 
});
export type TryRevenueSummaryInput = Static<typeof TryRevenueSummarySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/reports/schema.test.ts`
Expected: PASS

### Task 2: Add Service Logic

**Files:**
- Modify: `src/modules/reports/service.ts`
- Create: `src/__tests__/reports/try-revenue-service.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/reports/try-revenue-service.test.ts
import { describe, expect, it } from 'bun:test';
import { ReportService } from '../../modules/reports/service';

describe('ReportService.tryComputeRevenue', () => {
  it('should exist as a method', () => {
    expect(typeof ReportService.tryComputeRevenue).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/reports/try-revenue-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// Modify src/modules/reports/service.ts
// Add imports at the top
import { detectColumns } from "../uploads/detect-columns";
import { computeRevenueSummary } from "./compute-revenue";
import { join, resolve } from "node:path";
import { mkdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { TryRevenueSummaryInput } from "./schema";
import { env } from "@/config/env";

// Inside ReportService abstract class:
  static async tryComputeRevenue(
    data: TryRevenueSummaryInput,
    log: Logger,
  ) {
    log.debug({ filename: data.file.name }, "Try revenue summary process started");

    const tempDir = resolve(env.UPLOAD_DIR, "demo");
    await mkdir(tempDir, { recursive: true });
    
    const tempFile = join(tempDir, `${randomUUID()}-${data.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    await Bun.write(tempFile, data.file);

    try {
      const detection = await detectColumns(tempFile, log);
      let finalColumnMap = detection.columnMap;

      if (data.columnMap) {
        try {
          const parsedOverrides = JSON.parse(data.columnMap);
          finalColumnMap = { ...finalColumnMap, ...parsedOverrides };
        } catch (e) {
          log.warn("Invalid columnMap JSON provided");
        }
      }

      const unmapped = Object.keys(finalColumnMap).filter(k => finalColumnMap[k] === null);
      if (unmapped.length > 0) {
        return {
          status: "needs_mapping",
          detectedColumns: detection.detectedColumns,
          unmappedRequired: unmapped
        };
      }

      const result = await computeRevenueSummary({
        filePath: tempFile,
        columnMap: finalColumnMap,
        periodType: data.periodType,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        timezone: data.timezone
      }, log);

      return { status: "success", data: result };
    } finally {
      await unlink(tempFile).catch(() => {});
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/reports/try-revenue-service.test.ts`
Expected: PASS

### Task 3: Add Controller and Route

**Files:**
- Modify: `src/modules/reports/controller.ts`
- Modify: `src/modules/reports/index.ts`
- Create: `src/__tests__/reports/try-revenue-route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/reports/try-revenue-route.test.ts
import { describe, expect, it } from 'bun:test';
import { app } from '../../app';

describe('POST /reports/try-revenue-summary', () => {
  it('should return 400 when body is empty', async () => {
    const res = await app.handle(
      new Request('http://localhost/reports/try-revenue-summary', {
        method: 'POST'
      })
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/reports/try-revenue-route.test.ts`
Expected: FAIL (returns 404 because route doesn't exist)

- [ ] **Step 3: Write minimal implementation**

```typescript
// Modify src/modules/reports/controller.ts
import type { TryRevenueSummaryInput } from "./schema";

// Inside ReportController:
  static async tryRevenueSummary({
    body,
    set,
    log,
    locale,
  }: {
    body: TryRevenueSummaryInput;
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await ReportService.tryComputeRevenue(body, log);

    if (result.status === "needs_mapping") {
      return errorResponse(
        set,
        400,
        { key: "uploads.needsMapping", params: { fields: result.unmappedRequired!.join(", ") } },
        { 
          detectedColumns: result.detectedColumns, 
          unmappedRequired: result.unmappedRequired 
        },
        locale
      );
    }

    return successResponse(
      set,
      result.data,
      { key: "reports.computeSuccess" },
      200,
      undefined,
      locale
    );
  }
```

```typescript
// Modify src/modules/reports/index.ts
import { TryRevenueSummarySchema } from "./schema";

// Find `export const reports = createProtectedApp...` and wrap it to include a public route
export const reports = createBaseApp({ tags: ["Reports"] }).group(
  "/reports",
  (app) => app
    .post("/try-revenue-summary", ReportController.tryRevenueSummary, {
      body: TryRevenueSummarySchema,
      detail: { summary: "Try revenue summary without login" }
    })
    .use(protectedReports) // Ensure `protectedReports` refers to the original `createProtectedApp()` chain
);
// Note: You will need to rename the original `export const reports = createProtectedApp()...` to `const protectedReports = createProtectedApp()...`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/reports/try-revenue-route.test.ts`
Expected: PASS

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add src/modules/reports/schema.ts src/__tests__/reports/schema.test.ts src/modules/reports/service.ts src/__tests__/reports/try-revenue-service.test.ts src/modules/reports/controller.ts src/modules/reports/index.ts src/__tests__/reports/try-revenue-route.test.ts
git commit -m "feat: add try revenue summary public endpoint"
```
