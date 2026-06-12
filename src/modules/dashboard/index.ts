import { DashboardController } from "./controller";
import {
  DashboardResponseModelSchema,
  DashboardErrorModelSchema,
} from "./schema";
import { createBaseApp, createProtectedApp } from "@/libs/base";

const protectedDashboard = createProtectedApp().get(
  "/",
  DashboardController.getDashboard,
  {
    response: {
      200: DashboardResponseModelSchema,
      500: DashboardErrorModelSchema,
    },
  },
);

export const dashboard = createBaseApp({ tags: ["Dashboard"] }).group(
  "/dashboard",
  (app) => app.use(protectedDashboard),
);
