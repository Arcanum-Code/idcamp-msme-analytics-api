import { createBaseApp } from "@/libs/base";
import { HealthController } from "./controller";
import { HealthResponse } from "./schema";

export const health = createBaseApp({ tags: ["Health"] }).get(
  "/health",
  HealthController.getHealth,
  {
    detail: {
      description:
        "Check the health status of the API service and its dependencies.",
    },
    response: {
      200: HealthResponse,
    },
  },
);
