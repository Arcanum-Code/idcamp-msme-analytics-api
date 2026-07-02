import { Static, t } from "elysia";
import { PeriodType } from "@generated/prisma";
import { createResponseSchema } from "@/libs/response";

export const GenerateRevenueReportBodySchema = t.Object({
  uploadId: t.String(),
  periodType: t.Enum(PeriodType),
  periodStart: t.String({ format: "date", examples: ["2025-05-26"] }),
  periodEnd: t.String({ format: "date", examples: ["2025-06-01"] }),
});

export type GenerateRevenueReportInput =
  typeof GenerateRevenueReportBodySchema.static;

export const GenerateRevenueReportAcceptedResponseSchema = createResponseSchema(
  t.Object({
    reportId: t.String(),
    status: t.String(),
    message: t.String(),
    cached: t.Boolean(),
  }),
);

export const GenerateRevenueReportCachedResponseSchema = createResponseSchema(
  t.Object({
    reportId: t.String(),
    status: t.String(),
    cached: t.Boolean(),
    computedAt: t.Optional(t.String()),
  }),
);

export const ReportsErrorSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});

export const GetReportParamsSchema = t.Object({
  reportId: t.String(),
});

export const TryRevenueSummarySchema = t.Object({
  file: t.File(),
  periodType: t.Union([
    t.Literal("DAILY"),
    t.Literal("WEEKLY"),
    t.Literal("MONTHLY"),
  ]),
  periodStart: t.String({ format: "date" }),
  periodEnd: t.String({ format: "date" }),
  timezone: t.Optional(t.String()),
  columnMap: t.Optional(t.String()),
});
export type TryRevenueSummaryInput = Static<typeof TryRevenueSummarySchema>;
