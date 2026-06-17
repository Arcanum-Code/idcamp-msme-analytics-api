import { describe, it, expect, afterAll } from "bun:test";
import { detectColumns } from "@/modules/uploads/detect-columns";
import { resolve, join } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import pino from "pino";

const log = pino({ level: "silent" });
const FIXTURE_DIR = resolve(import.meta.dir, "fixtures");

/** Write a temporary CSV file for testing. */
async function writeCsv(
  filename: string,
  headers: string[],
  rows: string[][] = [],
): Promise<string> {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const filePath = join(FIXTURE_DIR, filename);
  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  await Bun.write(filePath, lines.join("\n"));
  return filePath;
}

afterAll(async () => {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
});

describe("detectColumns (mock)", () => {
  it("should return full confidence when all required columns match aliases", async () => {
    const filePath = await writeCsv("full.csv", [
      "transaction_date",
      "product_detail",
      "product_category",
      "transaction_qty",
      "unit_price",
    ]);

    const result = await detectColumns(filePath, log);

    expect(result.status).toBe("success");
    expect(result.confidence).toBe("full");
    expect(result.columnMap.date).toBe("transaction_date");
    expect(result.columnMap.product).toBe("product_detail");
    expect(result.columnMap.quantity).toBe("transaction_qty");
    expect(result.columnMap.unitPrice).toBe("unit_price");
    expect(result.unmappedRequired).toEqual([]);
  });

  it("should return partial confidence when a required column is missing", async () => {
    const filePath = await writeCsv("partial.csv", [
      "transaction_date",
      "transaction_qty",
      "unit_price",
      "product_category",
    ]);

    const result = await detectColumns(filePath, log);

    expect(result.status).toBe("success");
    expect(result.confidence).toBe("partial");
    expect(result.columnMap.product).toBeNull();
    expect(result.unmappedRequired).toContain("product");
  });

  it("should list all file headers in detectedColumns", async () => {
    const headers = [
      "transaction_date",
      "custom_col",
      "transaction_qty",
      "unit_price",
      "product_detail",
    ];
    const filePath = await writeCsv("headers.csv", headers);

    const result = await detectColumns(filePath, log);

    expect(result.detectedColumns).toEqual(headers);
  });

  it("should match column names case-insensitively", async () => {
    const filePath = await writeCsv("case.csv", [
      "Transaction_Date",
      "Product_Detail",
      "Transaction_Qty",
      "Unit_Price",
    ]);

    const result = await detectColumns(filePath, log);

    expect(result.confidence).toBe("full");
    expect(result.columnMap.date).toBe("Transaction_Date");
    expect(result.columnMap.product).toBe("Product_Detail");
  });

  it("should handle quoted CSV headers", async () => {
    const filePath = join(FIXTURE_DIR, "quoted.csv");
    await mkdir(FIXTURE_DIR, { recursive: true });
    await Bun.write(
      filePath,
      '"transaction_date","product_detail","transaction_qty","unit_price"\n',
    );

    const result = await detectColumns(filePath, log);

    expect(result.confidence).toBe("full");
    expect(result.columnMap.date).toBe("transaction_date");
  });

  it("should throw FILE_NOT_FOUND for missing files", async () => {
    await expect(detectColumns("/nonexistent/file.csv", log)).rejects.toThrow(
      "FILE_NOT_FOUND",
    );
  });

  it("should throw UNSUPPORTED_FILE_TYPE for invalid extensions", async () => {
    const filePath = join(FIXTURE_DIR, "data.json");
    await mkdir(FIXTURE_DIR, { recursive: true });
    await Bun.write(filePath, '{"a": 1}');

    await expect(detectColumns(filePath, log)).rejects.toThrow(
      "UNSUPPORTED_FILE_TYPE",
    );
  });

  it("should return partial for Excel files (mock limitation)", async () => {
    const filePath = join(FIXTURE_DIR, "data.xlsx");
    await mkdir(FIXTURE_DIR, { recursive: true });
    // Write a minimal placeholder — mock can't parse real Excel
    await Bun.write(filePath, "fake-excel-content");

    const result = await detectColumns(filePath, log);

    expect(result.status).toBe("success");
    expect(result.confidence).toBe("partial");
    expect(result.unmappedRequired.length).toBeGreaterThan(0);
  });
});
