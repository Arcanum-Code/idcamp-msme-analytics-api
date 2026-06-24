import { createBaseApp, createProtectedApp } from "@/libs/base";
import { ReportsController } from "./controller";
import {
  GenerateRevenueReportBodySchema,
  GetReportParamsSchema,
  TryRevenueSummarySchema,
  TryRevenueSummaryInput,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { UploadNotFoundError } from "../uploads/error";
import {
  UploadNotReadyError,
  InvalidPeriodError,
  ComputationFailedError,
  ReportNotFoundError,
} from "./error";

const protectedReports = createProtectedApp()
  .post(
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
  )
  .get(
    "/:reportId",
    ({ params, user, set, log, locale }) =>
      ReportsController.getReport({
        params: params as { reportId: string },
        user: user as { id: string },
        set,
        log,
        locale,
      }),
    {
      params: GetReportParamsSchema,
      detail: {
        tags: ["Reports"],
        description:
          "Fetch a completed revenue report or its processing status.",
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
        if (error instanceof ReportNotFoundError) {
          return errorResponse(
            set,
            404,
            { key: "reports.reportNotFound" },
            null,
            locale,
          );
        }
      })
      .post(
        "/try-revenue-summary",
        ({ body, set, log, locale }) =>
          ReportsController.tryRevenueSummary({
            body: body as TryRevenueSummaryInput,
            set,
            log,
            locale,
          }),
        {
          body: TryRevenueSummarySchema,
          parse: "multipart/form-data",
          detail: {
            tags: ["Reports"],
            description: "Try revenue summary without login",
          },
        },
      )
      .use(protectedReports),
);
