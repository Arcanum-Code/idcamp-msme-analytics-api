import { t } from "elysia";
import { PeriodType } from "@generated/prisma";

export const GenerateRevenueReportBodySchema = t.Object({
  uploadId: t.String(),
  periodType: t.Enum(PeriodType),
  periodStart: t.String({ format: "date", examples: ["2025-05-26"] }),
  periodEnd: t.String({ format: "date", examples: ["2025-06-01"] }),
});

export type GenerateRevenueReportInput =
  typeof GenerateRevenueReportBodySchema.static;

export const GenerateRevenueReportAcceptedResponseSchema = t.Object({
  reportId: t.String(),
  status: t.String(),
  message: t.String(),
});

export const GenerateRevenueReportCachedResponseSchema = t.Object({
  reportId: t.String(),
  status: t.String(),
  cached: t.Boolean(),
  computedAt: t.Optional(t.String()),
});

export const ReportsErrorSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
  }),
});
