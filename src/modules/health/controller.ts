import { successResponse } from "@/libs/response";
import { HealthService } from "./service";
import type { Context } from "elysia";

export class HealthController {
  static async getHealth({
    set,
    locale,
  }: {
    set: Context["set"];
    locale: string;
  }) {
    const details = await HealthService.getHealthDetails();
    return successResponse(
      set,
      details,
      { key: "health.serverUp" },
      200,
      undefined,
      locale,
    );
  }
}
