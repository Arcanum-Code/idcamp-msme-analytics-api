import { describe, expect, it } from "bun:test";
import { TryRevenueSummarySchema } from "../../modules/reports/schema";
import { Value } from "@sinclair/typebox/value";

describe("TryRevenueSummarySchema", () => {
  it("should validate valid payload", () => {
    const valid = {
      file: new File(["data"], "test.csv"),
      periodType: "DAILY",
      periodStart: "2025-01-01",
      periodEnd: "2025-01-31",
    };
    expect(Value.Check(TryRevenueSummarySchema, valid)).toBe(true);
  });
});
