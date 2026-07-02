# Integrate FastAPI Detect Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the mock detect-columns implementation with the real FastAPI service call so that Excel column detection works correctly.

**Architecture:** We will replace the manual CSV/Excel parsing in `src/modules/uploads/detect-columns.ts` with an HTTP POST request to the external FastAPI service. The URL will be constructed using the `MINI_MODEL_URL` environment variable.

**Tech Stack:** Bun, TypeScript, Fetch API

---

### Task 1: Update detectColumns to use FastAPI service

**Files:**
- Modify: `src/modules/uploads/detect-columns.ts`

- [ ] **Step 1: Replace mock implementation with fetch call**

```typescript
import type { Logger } from "pino";

export interface DetectColumnsResult {
  status: "success";
  confidence: "full" | "partial";
  columnMap: Record<string, string | null>;
  detectedColumns: string[];
  unmappedRequired: string[];
}

export async function detectColumns(
  filePath: string,
  log: Logger,
): Promise<DetectColumnsResult> {
  const modelUrl = process.env.MINI_MODEL_URL || "http://localhost:5000";
  const endpoint = `${modelUrl}/internal/detect-columns`;
  
  log.debug({ filePath, endpoint }, "Calling FastAPI service for column detection");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });

    if (!res.ok) {
      log.error({ status: res.status, statusText: res.statusText }, "FastAPI service failed");
      throw new Error(`FASTAPI_ERROR: ${res.statusText}`);
    }

    const data = await res.json() as DetectColumnsResult;
    
    log.info(
      { confidence: data.confidence, unmappedRequired: data.unmappedRequired, detectedColumns: data.detectedColumns },
      "FastAPI detect-columns: detection complete"
    );

    return data;
  } catch (error) {
    log.error({ err: error, filePath }, "Failed to detect columns via FastAPI");
    throw error;
  }
}
```

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add src/modules/uploads/detect-columns.ts
git commit -m "fix(uploads): integrate real FastAPI detect-columns service to fix Excel parsing"
```
