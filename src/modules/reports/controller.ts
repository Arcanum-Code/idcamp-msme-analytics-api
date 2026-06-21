import { ReportsService } from "./service";
import type { GenerateRevenueReportInput } from "./schema";
import { successResponse } from "@/libs/response";
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
}
