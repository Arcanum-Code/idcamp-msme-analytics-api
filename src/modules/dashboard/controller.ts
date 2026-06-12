import { successResponse } from "@/libs/response";
import { DashboardService } from "./service";
import type { Context } from "elysia";
import type { Logger } from "pino";

export class DashboardController {
  static async getDashboard({
    set,
    log,
    locale,
  }: {
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const dashboard = await DashboardService.getDashboard(log);
    return successResponse(
      set,
      dashboard,
      { key: "dashboard.dashboardSuccess" },
      200,
      undefined,
      locale,
    );
  }
}
