import { describe, expect, it } from "bun:test";
import { ReportsService } from "../../modules/reports/service";

describe("ReportsService.tryComputeRevenue", () => {
  it("should exist as a method", () => {
    expect(typeof ReportsService.tryComputeRevenue).toBe("function");
  });
});
