import { createBaseApp } from "@/libs/base";
import { HealthController } from "./controller";
import { HealthResponse } from "./schema";

export const health = createBaseApp({ tags: ["Health"] }).get(
  "/health",
  HealthController.getHealth,
  {
    response: {
      200: HealthResponse,
    },
  },
);
