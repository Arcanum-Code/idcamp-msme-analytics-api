import { describe, expect, it } from "bun:test";
import { app } from "@/server";

describe("POST /api/reports/try-revenue-summary", () => {
  it("should return 400 when body is empty", async () => {
    const res = await app.handle(
      new Request("http://localhost/api/reports/try-revenue-summary", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("should compute revenue successfully when column detection is full", async () => {
    const formData = new FormData();
    const csvContent =
      "date,product,quantity,price,total\n2025-05-26,Item A,2,10000,20000";
    const file = new File([csvContent], "sales.csv", { type: "text/csv" });

    formData.append("file", file);
    formData.append("periodType", "DAILY");
    formData.append("periodStart", "2025-05-26");
    formData.append("periodEnd", "2025-06-01");

    const res = await app.handle(
      new Request("http://localhost/api/reports/try-revenue-summary", {
        method: "POST",
        body: formData,
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.error).toBe(false);
    expect(json.data.result.totalRevenue).toBeGreaterThan(0);
  });

  it("should return 400 with needs_mapping error when columns cannot be auto-detected", async () => {
    const formData = new FormData();
    const csvContent = "unknown_col1,unknown_col2\n2025-05-26,Item A";
    const file = new File([csvContent], "sales.csv", { type: "text/csv" });

    formData.append("file", file);
    formData.append("periodType", "DAILY");
    formData.append("periodStart", "2025-05-26");
    formData.append("periodEnd", "2025-06-01");

    const res = await app.handle(
      new Request("http://localhost/api/reports/try-revenue-summary", {
        method: "POST",
        body: formData,
      }),
    );

    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.error).toBe(true);
    expect(json.issues.unmappedRequired).toContain("date");
  });

  it("should compute revenue successfully when column overrides are provided", async () => {
    const formData = new FormData();
    const csvContent =
      "tgl_transaksi,nama_produk,kuantitas,harga,total\n2025-05-26,Item A,2,10000,20000";
    const file = new File([csvContent], "sales.csv", { type: "text/csv" });

    formData.append("file", file);
    formData.append("periodType", "DAILY");
    formData.append("periodStart", "2025-05-26");
    formData.append("periodEnd", "2025-06-01");

    const overrides = {
      date: "tgl_transaksi",
      product: "nama_produk",
      quantity: "kuantitas",
      unitPrice: "harga",
      revenue: "total",
    };
    formData.append("columnMap", JSON.stringify(overrides));

    const res = await app.handle(
      new Request("http://localhost/api/reports/try-revenue-summary", {
        method: "POST",
        body: formData,
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.error).toBe(false);
  });
});
