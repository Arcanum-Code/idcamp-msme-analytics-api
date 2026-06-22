import { ReportsService } from "./service";
import type {
  GenerateRevenueReportInput,
  TryRevenueSummaryInput,
} from "./schema";
import { successResponse, errorResponse } from "@/libs/response";
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
      locale,
    );

    return successResponse(
      set,
      result,
      result.cached
        ? "Revenue report retrieved from cache."
        : "Revenue summary is being computed.",
      result.cached ? 200 : 202,
      undefined,
      locale,
    );
  }

  static async getReport({
    params,
    user,
    set,
    log,
    locale,
  }: {
    params: { reportId: string };
    user: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await ReportsService.getReport(
      user.id,
      params.reportId,
      log,
      locale,
    );

    return successResponse(
      set,
      result,
      "Report retrieved successfully.",
      200,
      undefined,
      locale,
    );
  }

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
    const result = await ReportsService.tryComputeRevenue(body, log);

    if (result.status === "needs_mapping") {
      return errorResponse(
        set,
        400,
        {
          key: "uploads.needsMapping",
          params: { fields: result.unmappedRequired!.join(", ") },
        },
        {
          detectedColumns: result.detectedColumns,
          unmappedRequired: result.unmappedRequired,
        },
        locale,
      );
    }

    return successResponse(
      set,
      result.data,
      "Revenue summary computed successfully.",
      200,
      undefined,
      locale,
    );
  }
}
