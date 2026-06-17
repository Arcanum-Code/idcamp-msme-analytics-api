import type { Logger } from "pino";

/**
 * Standard field keys → list of known column-name aliases.
 * Matching is case-insensitive. Spaces in headers are normalized to underscores.
 */
const ALIAS_MAP: Record<string, string[]> = {
  date: [
    "transaction_date",
    "tanggal",
    "date",
    "tgl",
    "order_date",
    "tanggal_transaksi",
    "tgl_transaksi",
  ],
  product: [
    "product_detail",
    "product_name",
    "nama_menu",
    "product",
    "menu",
    "item",
    "nama_produk",
    "produk",
  ],
  category: [
    "product_category",
    "category",
    "kategori",
    "category_name",
    "kategori_produk",
    "product_type",
  ],
  quantity: ["transaction_qty", "quantity", "jumlah", "qty", "kuantitas"],
  unitPrice: ["unit_price", "harga_satuan", "price", "harga", "harga_unit"],
  totalPrice: ["total_price", "total_harga", "total", "amount", "jumlah_harga"],
  paymentMethod: [
    "payment_method",
    "metode_bayar",
    "payment",
    "metode_pembayaran",
  ],
};

/** Required standard keys — if any are unresolved, confidence is "partial". */
const REQUIRED_KEYS = ["date", "product", "quantity", "unitPrice"];

export interface DetectColumnsResult {
  status: "success";
  confidence: "full" | "partial";
  columnMap: Record<string, string | null>;
  detectedColumns: string[];
  unmappedRequired: string[];
}

/**
 * Mock implementation of FastAPI `POST /internal/detect-columns`.
 *
 * Reads the header row of a CSV file and matches each column to a
 * standard field key using case-insensitive alias matching.
 *
 * **Excel limitation:** The mock cannot parse binary Excel files without
 * a third-party library. Excel uploads return `confidence: "partial"` with
 * all required keys unmapped so the user can resolve them manually via
 * `PATCH /api/uploads/:uploadId/column-map`. The real FastAPI service
 * (pandas) handles Excel natively.
 *
 * **Swap instructions:** When FastAPI is ready, replace the body of this
 * function with an HTTP call:
 * ```
 * const res = await fetch("http://localhost:5000/internal/detect-columns", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ filePath }),
 * });
 * return res.json();
 * ```
 */
export async function detectColumns(
  filePath: string,
  log: Logger,
): Promise<DetectColumnsResult> {
  log.debug({ filePath }, "Mock detect-columns: reading file headers");

  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    throw new Error("FILE_NOT_FOUND");
  }

  const ext = filePath.split(".").pop()?.toLowerCase();

  // ── Excel: mock cannot parse binary files ──────────────────────────
  if (ext === "xlsx" || ext === "xls") {
    log.warn(
      { filePath },
      "Mock detect-columns: Excel header detection not supported — returning partial result requiring manual mapping",
    );

    const columnMap: Record<string, string | null> = {};
    for (const key of Object.keys(ALIAS_MAP)) {
      columnMap[key] = null;
    }

    return {
      status: "success",
      confidence: "partial",
      columnMap,
      detectedColumns: [],
      unmappedRequired: [...REQUIRED_KEYS],
    };
  }

  // ── CSV: parse first line ──────────────────────────────────────────
  if (ext !== "csv") {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  const text = await file.text();
  const firstLine = text.split(/\r?\n/)[0];

  if (!firstLine || firstLine.trim().length === 0) {
    throw new Error("FILE_PARSE_FAILED");
  }

  const headers = firstLine
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  if (headers.length === 0) {
    throw new Error("FILE_PARSE_FAILED");
  }

  // ── Alias matching ─────────────────────────────────────────────────
  const headersNormalized = headers.map((h) =>
    h.toLowerCase().replace(/\s+/g, "_"),
  );

  const columnMap: Record<string, string | null> = {};

  for (const [key, aliases] of Object.entries(ALIAS_MAP)) {
    const matchIndex = headersNormalized.findIndex((h) =>
      aliases.some((alias) => alias.toLowerCase() === h),
    );
    columnMap[key] = matchIndex !== -1 ? headers[matchIndex] : null;
  }

  const unmappedRequired = REQUIRED_KEYS.filter((k) => columnMap[k] === null);
  const confidence = unmappedRequired.length === 0 ? "full" : "partial";

  log.info(
    { confidence, unmappedRequired, detectedColumns: headers },
    "Mock detect-columns: detection complete",
  );

  return {
    status: "success",
    confidence,
    columnMap,
    detectedColumns: headers,
    unmappedRequired,
  };
}
