# API Documentation — Revenue Summary Analytics Flow

## Overview

This document covers the API contract for the **Revenue Summary** feature across two services:

- **Elysia Backend** — the main API server. Handles authentication, file uploads, job orchestration, and serving results to clients.
- **FastAPI Mini Model** — the internal analytics service. Receives a file path and column map, computes revenue metrics, and returns a structured JSON payload.

The two services communicate internally (server-to-server). The FastAPI service is **never exposed to the public internet**.

---

## System Topology

```
Client (Web / WhatsApp)
        │
        ▼
┌─────────────────────┐
│   Elysia Backend    │  ← Public API (authenticated)
│   (Bun + Elysia)    │
└────────┬────────────┘
         │  Internal HTTP (server-to-server)
         ▼
┌──────────────────────────┐
│   FastAPI Mini Model    │  ← Internal only (no auth)
│  (Python + FastAPI +     │
│       pandas)            │
└──────────────────────────┘
         │
         ▼
    PostgreSQL
  (ReportSnapshot)
```

---

## End-to-End Flow — Revenue Summary

```
1.  POST /api/uploads              → Client uploads CSV/Excel file
         │
         └── Elysia calls FastAPI internally:
             POST /internal/detect-columns
             → confidence "full"    → column map saved, status = READY
             → confidence "partial" → status = NEEDS_MAPPING, unmapped fields returned to client

2.  PATCH /api/uploads/:uploadId/column-map   → Client resolves unmapped fields (only if NEEDS_MAPPING)
3.  GET  /api/uploads/:id/status   → Client polls upload processing status
4.  POST /api/reports/revenue      → Client requests revenue report for a period
5.  GET  /api/reports/:id          → Client fetches completed report
         │
         └── Elysia calls FastAPI internally:
             POST /internal/revenue-summary
6.  WhatsApp or dashboard receives narrative + chart data
```

---

## Elysia Backend

**Base URL:** `https://api.your-domain.com`

All endpoints require a JWT Bearer token:

```
Authorization: Bearer <access_token>
```

> **Ownership validation.** For any endpoint that accepts an `:uploadId` (or a `uploadId` in the request body), Elysia must verify that `RawUpload.shopId` matches the `shopId` of the authenticated user before processing the request. If the upload belongs to a different shop, Elysia returns `404 UPLOAD_NOT_FOUND` — the same response as if the upload did not exist, to avoid leaking whether the ID is valid. This check applies to:
>
> - `PATCH /api/uploads/:uploadId/column-map`
> - `GET /api/uploads/:uploadId/status`
> - `POST /api/reports/revenue` (validates `uploadId` in the request body)

---

### Shop Setup

#### `PATCH /api/uploads/:uploadId/column-map`

Saves the column mapping for a specific uploaded CSV/Excel file. Only called when the upload status is `NEEDS_MAPPING` and one or more required fields could not be resolved during automatic column detection. The client submits only the unresolved fields; already-detected fields are preserved.

Calling this endpoint when `RawUpload.status` is not `NEEDS_MAPPING` (e.g. the upload is already `READY`, still `DETECTING_COLUMNS`, or `FAILED`) returns `409 UPLOAD_NOT_AWAITING_MAPPING` and does not modify `RawUpload.columnMap`.

> **Where is this processed?**
>
> Elysia merges the submitted fields into the existing `RawUpload.columnMap` record in PostgreSQL.
>
> The mapping is stored per uploaded file rather than per shop because different uploads may originate from different POS systems and therefore have different column names.
>
> FastAPI is the service that consumes the mapping. Whenever Elysia calls `POST /internal/revenue-summary`, it forwards the file's `columnMap` together with the `filePath` so FastAPI can correctly interpret the dataset.
>
> Elysia never parses the uploaded file itself.

**Request body**

```json
{
  "resolvedMappings": {
    "date": "Tanggal",
    "product": "Nama Menu",
    "category": "Kategori",
    "quantity": "Jumlah",
    "unitPrice": "Harga Satuan",
    "totalPrice": "Total Harga",
    "paymentMethod": "Metode Bayar"
  }
}
```

**Standard field keys**

| Key             | Required | Description                                             |
| --------------- | -------- | ------------------------------------------------------- |
| `date`          | Yes      | Transaction date column name in the file                |
| `product`       | Yes      | Product/menu item name                                  |
| `quantity`      | Yes      | Units sold                                              |
| `unitPrice`     | Yes      | Price per unit (IDR)                                    |
| `totalPrice`    | No       | Row total — derived from quantity × unitPrice if absent |
| `category`      | No       | Product category — auto-grouped if absent               |
| `paymentMethod` | No       | Cash, QRIS, transfer, etc.                              |

**Response `200 OK`**

```json
{
  "message": "Column map saved.",
  "columnMap": { "date": "Tanggal", "product": "Nama Menu", "...": "..." }
}
```

**Error responses**

| Status | Code                          | Description                                                                                                                                                           |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404`  | `UPLOAD_NOT_FOUND`            | `uploadId` does not exist or belongs to another shop                                                                                                                  |
| `409`  | `UPLOAD_NOT_AWAITING_MAPPING` | `RawUpload.status` is not `NEEDS_MAPPING` — column mapping has already been resolved (or the upload hasn't finished detection yet), so this endpoint cannot be called |

**Response `409 Conflict`**

```json
{
  "code": "UPLOAD_NOT_AWAITING_MAPPING",
  "message": "This upload no longer requires manual column mapping."
}
```

---

### File Upload

#### `POST /api/uploads`

Uploads a transaction data file (CSV or Excel). Elysia stores the file on disk, then immediately calls FastAPI's `POST /internal/detect-columns` to auto-detect the column mapping. If all required columns are resolved, the upload moves to `READY` and is ready for report generation. If some required columns cannot be detected, the upload moves to `NEEDS_MAPPING` and the client must resolve the missing fields via `PATCH /api/uploads/:uploadId/column-map` before proceeding.

**Request**

`Content-Type: multipart/form-data`

| Field  | Type   | Required | Description                            |
| ------ | ------ | -------- | -------------------------------------- |
| `file` | `File` | Yes      | `.csv`, `.xlsx`, or `.xls` — max 10 MB |

**Response `202 Accepted`**

```json
{
  "uploadId": "clxupload789",
  "filename": "transaksi-juni-2025.csv",
  "status": "UPLOADED",
  "message": "File received. Column detection in progress."
}
```

**Response `202 Accepted` — column detection needs manual resolution**

```json
{
  "uploadId": "clxupload789",
  "filename": "transaksi-juni-2025.csv",
  "status": "NEEDS_MAPPING",
  "unmappedRequired": ["product"],
  "detectedColumns": [
    "transaction_date",
    "transaction_qty",
    "unit_price",
    "product_category"
  ],
  "message": "Some required columns could not be detected. Please resolve the fields in unmappedRequired."
}
```

**Error responses**

| Status | Code                | Description                                        |
| ------ | ------------------- | -------------------------------------------------- |
| `400`  | `INVALID_FILE_TYPE` | File is not CSV or Excel                           |
| `400`  | `FILE_TOO_LARGE`    | File exceeds 10 MB                                 |
| `422`  | `FILE_PARSE_FAILED` | File could not be read (corrupted or wrong format) |

---

#### `GET /api/uploads/:uploadId/status`

Polls the processing status of an upload. The client should poll this every 3–5 seconds until `status` is `READY`, `NEEDS_MAPPING`, or `FAILED`.

**Response `200 OK`**

```json
{
  "uploadId": "clxupload789",
  "filename": "transaksi-juni-2025.csv",
  "status": "READY",
  "rowCount": 1842,
  "uploadedAt": "2025-06-01T08:23:00Z",
  "processedAt": "2025-06-01T08:23:14Z"
}
```

**`status` values (`Upload.status`)**

| Value               | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `UPLOADED`          | File received, column detection in progress                             |
| `DETECTING_COLUMNS` | Column auto-detection is running against the file                       |
| `NEEDS_MAPPING`     | Column detection partial — owner must resolve `unmappedRequired` fields |
| `READY`             | All columns resolved, file is ready for report generation               |
| `FAILED`            | Processing failed — see `error` field                                   |

> **Note:** `Upload.status` and `Report.status` are separate state machines. An upload reaching `READY` only means the file is ready to be used for report generation — it does not imply any report has been computed. Report computation status is tracked independently via `Report.status` (see [Report Generation](#report-generation)).

**Response `200 OK` — failed state**

```json
{
  "uploadId": "clxupload789",
  "status": "FAILED",
  "error": {
    "code": "MISSING_REQUIRED_COLUMN",
    "message": "Column 'Tanggal' not found in file. Check your column map."
  }
}
```

**Error responses**

| Status | Code               | Description                                          |
| ------ | ------------------ | ---------------------------------------------------- |
| `404`  | `UPLOAD_NOT_FOUND` | `uploadId` does not exist or belongs to another shop |

---

### Report Generation

#### `POST /api/reports/revenue`

Triggers revenue summary computation for a specific upload and period. Elysia retrieves the `columnMap` associated with the specified upload and forwards it to FastAPI together with the `filePath`. FastAPI uses the upload-specific `columnMap` to interpret the file during revenue computation. Elysia stores the result as a `ReportSnapshot`. If a snapshot already exists for the same `(uploadId, periodType, periodStart, periodEnd)`, it is returned from cache instead of being recomputed.

**Request body**

```json
{
  "uploadId": "clxupload789",
  "periodType": "WEEKLY",
  "periodStart": "2025-05-26",
  "periodEnd": "2025-06-01"
}
```

**`periodType` values:** `DAILY` · `WEEKLY` · `MONTHLY`

**Response `202 Accepted`** — computation triggered

```json
{
  "reportId": "clxreport321",
  "status": "PROCESSING",
  "message": "Revenue summary is being computed."
}
```

**Response `200 OK`** — served from cache

```json
{
  "reportId": "clxreport321",
  "status": "COMPLETED",
  "cached": true,
  "computedAt": "2025-06-01T09:00:00Z"
}
```

**Error responses**

| Status | Code                 | Description                                                                                     |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------- |
| `404`  | `UPLOAD_NOT_FOUND`   | `uploadId` does not exist or belongs to another shop                                            |
| `400`  | `UPLOAD_NOT_READY`   | Upload status is not `READY` — may still be `NEEDS_MAPPING`, `UPLOADED`, or `DETECTING_COLUMNS` |
| `400`  | `INVALID_PERIOD`     | `periodStart` is after `periodEnd`                                                              |
| `422`  | `COMPUTATION_FAILED` | FastAPI mini model returned an error                                                            |

---

#### `GET /api/reports/:reportId`

Fetches a completed revenue report. Returns the structured JSON from the mini model plus the LLM-generated Bahasa Indonesia narrative.

**Response `200 OK`**

```json
{
  "reportId": "clxreport321",
  "shopId": "clx2shop456",
  "periodType": "WEEKLY",
  "periodStart": "2025-05-26",
  "periodEnd": "2025-06-01",
  "status": "COMPLETED",
  "computedAt": "2025-06-01T09:00:00Z",
  "revenue": {
    "totalRevenue": 4750000,
    "totalTransactions": 312,
    "avgTransactionValue": 15224,
    "revenueByDay": [
      { "date": "2025-05-26", "revenue": 620000, "transactions": 41 },
      { "date": "2025-05-27", "revenue": 580000, "transactions": 38 },
      { "date": "2025-05-28", "revenue": 710000, "transactions": 47 },
      { "date": "2025-05-29", "revenue": 690000, "transactions": 45 },
      { "date": "2025-05-30", "revenue": 750000, "transactions": 50 },
      { "date": "2025-05-31", "revenue": 820000, "transactions": 54 },
      { "date": "2025-06-01", "revenue": 580000, "transactions": 37 }
    ],
    "peakDay": {
      "date": "2025-05-31",
      "revenue": 820000,
      "transactions": 54
    },
    "growthVsPreviousPeriod": 8.4
  },
  "narrative": "Minggu ini kedai Anda mencatat pendapatan sebesar Rp 4.750.000 dari 312 transaksi. Hari Sabtu (31 Mei) menjadi hari tersibuk dengan pendapatan Rp 820.000. Dibandingkan minggu lalu, pendapatan naik 8,4% — pertumbuhan yang solid. Rata-rata nilai transaksi Anda berada di Rp 15.224."
}
```

**Response `200 OK` — still processing**

```json
{
  "reportId": "clxreport321",
  "status": "PROCESSING"
}
```

**`status` values (`Report.status`)**

| Value        | Description                                       |
| ------------ | ------------------------------------------------- |
| `PROCESSING` | Revenue computation is in progress                |
| `COMPLETED`  | Report computed successfully and is ready to view |
| `FAILED`     | Computation failed — see `error` field            |

**Error responses**

| Status | Code               | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| `404`  | `REPORT_NOT_FOUND` | Report does not exist or belongs to another shop |

---

#### `GET /api/reports`

Lists all report snapshots for the authenticated shop owner's shop.

**Query parameters**

| Param        | Type     | Default | Description                               |
| ------------ | -------- | ------- | ----------------------------------------- |
| `periodType` | `string` | —       | Filter by `DAILY`, `WEEKLY`, or `MONTHLY` |
| `limit`      | `number` | `10`    | Max results                               |
| `offset`     | `number` | `0`     | Pagination offset                         |

**Response `200 OK`**

```json
{
  "reports": [
    {
      "reportId": "clxreport321",
      "periodType": "WEEKLY",
      "periodStart": "2025-05-26",
      "periodEnd": "2025-06-01",
      "status": "COMPLETED",
      "computedAt": "2025-06-01T09:00:00Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

## FastAPI Mini Model

**Base URL:** `http://localhost:5000` (internal only)

No authentication. This service is bound to `localhost` or a private Docker network and is never reachable from outside the server. Elysia is the only caller.

---

### `POST /internal/detect-columns`

Reads only the header row of the uploaded file and attempts to map each column to a standard field key using exact alias matching followed by fuzzy similarity scoring. Called automatically by Elysia immediately after every file upload. Elysia never reads the file itself.

**Request body**

```json
{
  "filePath": "/uploads/clx2shop456/transaksi-juni-2025.csv"
}
```

**Response `200 OK` — all required columns detected**

```json
{
  "status": "success",
  "confidence": "full",
  "columnMap": {
    "date": "transaction_date",
    "product": "product_detail",
    "category": "product_category",
    "quantity": "transaction_qty",
    "unitPrice": "unit_price",
    "totalPrice": null
  },
  "detectedColumns": [
    "transaction_id",
    "transaction_date",
    "transaction_time",
    "transaction_qty",
    "store_id",
    "store_location",
    "product_id",
    "unit_price",
    "product_category",
    "product_type",
    "product_detail"
  ],
  "unmappedRequired": []
}
```

**Response `200 OK` — partial detection**

```json
{
  "status": "success",
  "confidence": "partial",
  "columnMap": {
    "date": "transaction_date",
    "product": null,
    "category": "product_category",
    "quantity": "transaction_qty",
    "unitPrice": "unit_price",
    "totalPrice": null
  },
  "detectedColumns": [
    "transaction_date",
    "transaction_qty",
    "unit_price",
    "product_category"
  ],
  "unmappedRequired": ["product"]
}
```

**Response fields**

| Field              | Type     | Description                                                                                 |
| ------------------ | -------- | ------------------------------------------------------------------------------------------- |
| `confidence`       | `string` | `"full"` if all required fields mapped, `"partial"` if any required field is unresolved     |
| `columnMap`        | `object` | Best-effort mapping of standard keys to actual column names. `null` value means unresolved. |
| `detectedColumns`  | `array`  | All column headers found in the file                                                        |
| `unmappedRequired` | `array`  | Required standard keys that could not be mapped — empty when `confidence` is `"full"`       |

**`totalPrice` is always nullable.** If absent from the file, FastAPI derives it as `quantity × unitPrice` during report computation.

**Error responses**

| Status | Code                    | Description                                      |
| ------ | ----------------------- | ------------------------------------------------ |
| `422`  | `FILE_NOT_FOUND`        | `filePath` does not exist on disk                |
| `422`  | `UNSUPPORTED_FILE_TYPE` | File extension is not `.csv`, `.xlsx`, or `.xls` |
| `422`  | `FILE_PARSE_FAILED`     | Header row could not be read (corrupted file)    |

---

### `POST /internal/revenue-summary`

The core endpoint. Receives a file path and column map, runs the full revenue computation via pandas, and returns a structured JSON payload ready to be stored as `ReportSnapshot.revenueData`.

**Request body**

```json
{
  "filePath": "/uploads/clx2shop456/transaksi-juni-2025.csv",
  "columnMap": {
    "date": "Tanggal",
    "product": "Nama Menu",
    "category": "Kategori",
    "quantity": "Jumlah",
    "unitPrice": "Harga Satuan",
    "totalPrice": "Total Harga"
  },
  "periodType": "WEEKLY",
  "periodStart": "2025-05-26",
  "periodEnd": "2025-06-01",
  "timezone": "Asia/Jakarta"
}
```

**Request fields**

| Field         | Type     | Required | Description                                                 |
| ------------- | -------- | -------- | ----------------------------------------------------------- |
| `filePath`    | `string` | Yes      | Absolute path to the uploaded file on shared disk           |
| `columnMap`   | `object` | Yes      | Column name mapping from the upload's `RawUpload.columnMap` |
| `periodType`  | `string` | Yes      | `DAILY`, `WEEKLY`, or `MONTHLY`                             |
| `periodStart` | `string` | Yes      | ISO 8601 date — start of period (inclusive)                 |
| `periodEnd`   | `string` | Yes      | ISO 8601 date — end of period (inclusive)                   |
| `timezone`    | `string` | No       | Defaults to `Asia/Jakarta`                                  |

**Response `200 OK`**

```json
{
  "status": "success",
  "periodType": "WEEKLY",
  "periodStart": "2025-05-26",
  "periodEnd": "2025-06-01",
  "rowsProcessed": 1842,
  "rowsInPeriod": 312,
  "result": {
    "totalRevenue": 4750000,
    "totalTransactions": 312,
    "avgTransactionValue": 15224,
    "revenueByDay": [
      { "date": "2025-05-26", "revenue": 620000, "transactions": 41 },
      { "date": "2025-05-27", "revenue": 580000, "transactions": 38 },
      { "date": "2025-05-28", "revenue": 710000, "transactions": 47 },
      { "date": "2025-05-29", "revenue": 690000, "transactions": 45 },
      { "date": "2025-05-30", "revenue": 750000, "transactions": 50 },
      { "date": "2025-05-31", "revenue": 820000, "transactions": 54 },
      { "date": "2025-06-01", "revenue": 580000, "transactions": 37 }
    ],
    "peakDay": {
      "date": "2025-05-31",
      "revenue": 820000,
      "transactions": 54
    },
    "previousPeriod": {
      "totalRevenue": 4381500,
      "totalTransactions": 289
    },
    "growthVsPreviousPeriod": 8.4
  }
}
```

**Response fields — `result` object**

| Field                    | Type     | Description                                                                                                                                                    |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `totalRevenue`           | `number` | Sum of all `totalPrice` values in period (IDR)                                                                                                                 |
| `totalTransactions`      | `number` | Count of unique transaction rows in period                                                                                                                     |
| `avgTransactionValue`    | `number` | `totalRevenue / totalTransactions` rounded to nearest integer                                                                                                  |
| `revenueByDay`           | `array`  | Daily breakdown — one entry per day in the period                                                                                                              |
| `peakDay`                | `object` | Day with highest revenue in the period                                                                                                                         |
| `previousPeriod`         | `object` | Same metrics for the preceding equivalent period — used for growth calculation                                                                                 |
| `growthVsPreviousPeriod` | `number` | Percentage change vs previous period, rounded to 1 decimal place. Positive = growth, negative = decline. `null` if no previous period data exists in the file. |

**Response `422 Unprocessable Entity` — computation error**

```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_COLUMN",
  "message": "Column 'Tanggal' not found in file. Available columns: ['Date', 'Item', 'Qty', 'Price']"
}
```

**Error codes from FastAPI**

| Code                      | Description                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `FILE_NOT_FOUND`          | `filePath` does not exist on disk                                                    |
| `UNSUPPORTED_FILE_TYPE`   | File extension is not `.csv`, `.xlsx`, or `.xls`                                     |
| `MISSING_REQUIRED_COLUMN` | A required mapped column is absent from the file                                     |
| `INVALID_DATE_FORMAT`     | Date column values cannot be parsed — includes sample of unparseable values          |
| `EMPTY_PERIOD`            | No rows found within the requested `periodStart`–`periodEnd` range                   |
| `COMPUTATION_ERROR`       | Unexpected pandas/numpy error — includes traceback in `detail` field (internal only) |

---

### `GET /internal/health`

Health check. Elysia calls this on startup to confirm the FastAPI service is reachable.

**Response `200 OK`**

```json
{
  "status": "ok",
  "service": "mini-model",
  "version": "1.0.0"
}
```

---

## Data Models

```ts
type UploadStatus =
  | "UPLOADED"
  | "DETECTING_COLUMNS"
  | "NEEDS_MAPPING"
  | "READY"
  | "FAILED";

type RawUpload = {
  id: string;
  shopId: string;
  filePath: string;
  status: UploadStatus;
  columnMap: Record<string, string | null>;
  createdAt: Date;
};

type ReportStatus = "PROCESSING" | "COMPLETED" | "FAILED";

type ReportSnapshot = {
  id: string;
  shopId: string;
  uploadId: string;
  periodType: "DAILY" | "WEEKLY" | "MONTHLY";
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  revenueData: object | null;
  narrative: string | null;
  computedAt: Date | null;
  // Unique constraint: (uploadId, periodType, periodStart, periodEnd)
  // — this is the cache key used by POST /api/reports/revenue
};
```

> `Upload.status` and `Report.status` are independent state machines tracked on separate records (`RawUpload.status` and `ReportSnapshot.status`). A `READY` upload can have zero, one, or many report snapshots in any `Report.status` state.

---

## Data Flow Summary

```
Client
  │
  ├─ POST /api/uploads
  │    Elysia: store file to disk → create RawUpload (UPLOADED)
  │    Elysia: update RawUpload (DETECTING_COLUMNS)
  │    Elysia → FastAPI: POST /internal/detect-columns
  │    FastAPI: read header row → fuzzy match against alias dictionary → return columnMap + confidence
  │    confidence "full"    → Elysia: save RawUpload.columnMap → update RawUpload (READY)
  │    confidence "partial" → Elysia: save partial RawUpload.columnMap → update RawUpload (NEEDS_MAPPING)
  │                              return unmappedRequired to client
  │
  ├─ PATCH /api/uploads/:uploadId/column-map     [only if NEEDS_MAPPING]
  │    Elysia: merge resolved fields into RawUpload.columnMap
  │    Elysia: update RawUpload (READY)
  │
  ├─ GET /api/uploads/:id/status
  │    Elysia: return RawUpload.status
  │
  ├─ POST /api/reports/revenue
  │    Elysia: check cache → ReportSnapshot exists? → return cached
  │    Elysia: create ReportSnapshot (status = PROCESSING)
  │    Elysia → FastAPI: POST /internal/revenue-summary (filePath + RawUpload.columnMap)
  │    FastAPI: pd.read_csv / read_excel → filter period → compute metrics → return JSON
  │    Elysia: store result → ReportSnapshot.revenueData (status = COMPLETED)
  │    Elysia → LLM: POST /v1/messages (compact JSON → Bahasa Indonesia narrative)
  │    Elysia: store narrative → ReportSnapshot.narrative
  │
  └─ GET /api/reports/:id
       Elysia: return ReportSnapshot (revenue + narrative)
```

---

## Notes

**Shared disk.** Elysia and FastAPI must share the same file system for `filePath` to resolve. In Docker Compose, mount a shared volume to both services at the same path (e.g. `/uploads`).

**Previous period calculation.** FastAPI automatically looks for data from the preceding equivalent period within the same file. For a weekly period of May 26–Jun 1, it looks for May 19–25. If no data exists for the previous period, `previousPeriod` is `null` and `growthVsPreviousPeriod` is `null`.

**Currency.** All monetary values are raw integers in IDR (Indonesian Rupiah). No decimal places. Formatting (e.g. `Rp 4.750.000`) is the responsibility of the frontend or the LLM narrative layer.

**Idempotency.** `POST /api/reports/revenue` is idempotent per `(uploadId, periodType, periodStart, periodEnd)`. Calling it twice with the same `uploadId` and period returns the cached `ReportSnapshot` rather than recomputing.

> **Why `uploadId` instead of `shopId`?** A shop may have multiple uploads covering overlapping or identical periods (e.g. a corrected re-upload of June's data). Keying the cache on `(shopId, periodType, periodStart)` alone would cause `POST /api/reports/revenue` for the new upload to incorrectly return a cached report computed from the old upload's data. Including `uploadId` (and `periodEnd`, for full period precision) in the cache key ensures each report is tied to the exact dataset it was computed from.
