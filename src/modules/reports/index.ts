import { createBaseApp, createProtectedApp } from "@/libs/base";
import { ReportsController } from "./controller";
import { GenerateRevenueReportBodySchema } from "./schema";
import { errorResponse } from "@/libs/response";
import { UploadNotFoundError } from "../uploads/error";
import {
  UploadNotReadyError,
  InvalidPeriodError,
  ComputationFailedError,
} from "./error";

const protectedReports = createProtectedApp().post(
  "/revenue",
  ({ body, user, set, log, locale }) =>
    ReportsController.generateRevenueReport({
      body,
      user: user as { id: string },
      set,
      log,
      locale,
    }),
  {
    body: GenerateRevenueReportBodySchema,
    detail: {
      tags: ["Reports"],
      description:
        "Trigger revenue summary computation or fetch cached result.",
    },
  },
);

export const reports = createBaseApp({ tags: ["Reports"] }).group(
  "/api/reports",
  (app) =>
    app
      .onError(({ error, set, locale }) => {
        if (error instanceof UploadNotFoundError) {
          return errorResponse(
            set,
            404,
            { key: "upload.notFound" },
            null,
            locale,
          );
        }
        if (error instanceof UploadNotReadyError) {
          return errorResponse(
            set,
            400,
            { key: "reports.uploadNotReady" },
            null,
            locale,
          );
        }
        if (error instanceof InvalidPeriodError) {
          return errorResponse(
            set,
            400,
            { key: "reports.invalidPeriod" },
            null,
            locale,
          );
        }
        if (error instanceof ComputationFailedError) {
          return errorResponse(
            set,
            422,
            { key: "reports.computationFailed" },
            null,
            locale,
          );
        }
      })
      .use(protectedReports),
);
