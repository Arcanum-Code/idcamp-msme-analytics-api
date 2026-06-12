import { t } from "elysia";
import { createTbResponseSchema } from "@/libs/response";

export const HealthDetailsSchema = t.Object({
  status: t.String(),
  timestamp: t.String(),
  uptime: t.Number(),
  database: t.Object({
    status: t.String(),
  }),
});

export const HealthResponse = createTbResponseSchema(HealthDetailsSchema);
