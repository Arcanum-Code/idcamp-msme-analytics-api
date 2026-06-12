import { prisma } from "@/libs/prisma";
import { healthState } from "./state";

export abstract class HealthService {
  static async check() {
    if (healthState.shuttingDown) {
      return {
        status: "shutting_down" as const,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    }

    let db: "up" | "down" = "up";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }

    return {
      status: "ok" as const,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db,
    };
  }

  static async getHealthDetails() {
    const checkResult = await this.check();
    return {
      status: checkResult.status,
      timestamp: checkResult.timestamp,
      uptime: checkResult.uptime,
      database: {
        status: "db" in checkResult ? checkResult.db : "down",
      },
    };
  }
}
