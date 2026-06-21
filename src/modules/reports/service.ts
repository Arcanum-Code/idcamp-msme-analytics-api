import { prisma } from "@/libs/prisma";
import {
  ReportStatus,
  UploadStatus,
  PeriodType,
  RawUpload,
} from "@generated/prisma";
import type { GenerateRevenueReportInput } from "./schema";
import {
  InvalidPeriodError,
  UploadNotReadyError,
  ReportNotFoundError,
} from "./error";
import { UploadNotFoundError } from "../uploads/error";
import { computeRevenueSummary } from "./compute-revenue";
import type { Logger } from "pino";

export abstract class ReportsService {
  static async generateRevenueReport(
    userId: string,
    data: GenerateRevenueReportInput,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug(
      { userId, uploadId: data.uploadId, periodType: data.periodType },
      "Generating revenue report",
    );

    // 1. Validate period
    if (new Date(data.periodStart) > new Date(data.periodEnd)) {
      log.warn(
        { periodStart: data.periodStart, periodEnd: data.periodEnd },
        "Invalid period: start date is after end date",
      );
      throw new InvalidPeriodError(locale);
    }

    // 2. Resolve shop
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    const upload = await prisma.rawUpload.findFirst({
      where: {
        id: data.uploadId,
        shopId: shop?.id ?? "__no_shop__",
      },
    });

    if (!upload) {
      log.warn(
        { uploadId: data.uploadId, userId },
        "Upload not found or does not belong to user's shop",
      );
      throw new UploadNotFoundError(locale);
    }

    if (upload.status !== UploadStatus.READY) {
      log.warn(
        { uploadId: data.uploadId, status: upload.status },
        "Upload not ready for report generation",
      );
      throw new UploadNotReadyError(locale);
    }

    // 3. Check for existing snapshot (unique key: uploadId, periodType, periodStart, periodEnd)
    const existingSnapshot = await prisma.reportSnapshot.findUnique({
      where: {
        uploadId_periodType_periodStart_periodEnd: {
          uploadId: data.uploadId,
          periodType: data.periodType as PeriodType,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
        },
      },
    });

    if (existingSnapshot) {
      log.info(
        { reportId: existingSnapshot.id, uploadId: data.uploadId },
        "Serving revenue report from cache",
      );
      return {
        cached: true,
        reportId: existingSnapshot.id,
        status: existingSnapshot.status,
        computedAt: existingSnapshot.computedAt?.toISOString(),
      };
    }

    // 4. Create new snapshot in PROCESSING state
    const snapshot = await prisma.reportSnapshot.create({
      data: {
        shopId: upload.shopId,
        uploadId: upload.id,
        periodType: data.periodType as PeriodType,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        status: ReportStatus.PROCESSING,
      },
    });

    log.info(
      { reportId: snapshot.id, uploadId: upload.id },
      "Created report snapshot, starting background computation",
    );

    // 5. Fire background computation asynchronously
    this.runBackgroundComputation(snapshot.id, upload, data, log).catch(
      (err) => {
        log.error(
          { err, snapshotId: snapshot.id },
          "Background computation failed unexpectedly",
        );
      },
    );

    return {
      cached: false,
      reportId: snapshot.id,
      status: "PROCESSING",
      message: "Revenue summary is being computed.",
    };
  }

  static async getReport(
    userId: string,
    reportId: string,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug({ userId, reportId }, "Fetching report");

    const report = await prisma.reportSnapshot.findFirst({
      where: {
        id: reportId,
        shop: { ownerId: userId },
      },
    });

    if (!report) {
      log.warn({ userId, reportId }, "Report not found or not owned by user");
      throw new ReportNotFoundError(locale);
    }

    if (report.status === ReportStatus.PROCESSING) {
      return {
        reportId: report.id,
        status: report.status,
      };
    }

    return {
      reportId: report.id,
      shopId: report.shopId,
      periodType: report.periodType,
      periodStart: report.periodStart.toISOString().split("T")[0],
      periodEnd: report.periodEnd.toISOString().split("T")[0],
      status: report.status,
      computedAt: report.computedAt?.toISOString(),
      revenue: report.revenueData,
      narrative: report.narrative,
      ...(report.status === ReportStatus.FAILED ? { error: report.error } : {}),
    };
  }

  private static async runBackgroundComputation(
    snapshotId: string,
    upload: RawUpload,
    data: GenerateRevenueReportInput,
    log: Logger,
  ) {
    try {
      const result = await computeRevenueSummary(
        {
          filePath: upload.filePath,
          columnMap: upload.columnMap as Record<string, string | null>,
          periodType: data.periodType,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
        },
        log,
      );

      // Save success - mock narrative for now since LLM integration isn't fully defined yet
      await prisma.reportSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: ReportStatus.COMPLETED,
          revenueData: result.result,
          computedAt: new Date(),
          narrative: `Minggu ini kedai Anda mencatat pendapatan sebesar Rp ${result.result.totalRevenue.toLocaleString("id-ID")} dari ${result.result.totalTransactions} transaksi.`,
        },
      });

      log.info(
        { snapshotId },
        "Background computation completed and snapshot updated successfully",
      );
    } catch (error) {
      log.error(
        { error, snapshotId },
        "FastAPI mini model computation failed during background run",
      );
      // Save failure
      await prisma.reportSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: ReportStatus.FAILED,
          error: {
            message: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });
    }
  }
}
