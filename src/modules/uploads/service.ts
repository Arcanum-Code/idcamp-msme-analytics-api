import { prisma } from "@/libs/prisma";
import { UploadStatus } from "@generated/prisma";
import type { SaveColumnMapInput } from "./schema";
import {
  UploadNotFoundError,
  UploadNotAwaitingMappingError,
  InvalidFileTypeError,
  FileTooLargeError,
  FileParseFailedError,
  NoShopError,
} from "./error";
import { detectColumns } from "./detect-columns";
import { env } from "@/config/env";
import { resolve, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { Logger } from "pino";

const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls"];

export abstract class UploadService {
  /**
   * Handle a file upload: validate → save to disk → create DB record →
   * run column detection → return final status.
   */
  static async uploadFile(
    userId: string,
    file: File,
    log: Logger,
    locale: string = "en",
  ): Promise<{
    uploadId: string;
    filename: string;
    status: UploadStatus;
    unmappedRequired?: string[];
    detectedColumns?: string[];
  }> {
    log.debug(
      { userId, filename: file.name, size: file.size },
      "Processing file upload",
    );

    // 1. Validate file extension.
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      log.warn({ filename: file.name, ext }, "Rejected: invalid file type");
      throw new InvalidFileTypeError(locale);
    }

    // 2. Validate file size.
    const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      log.warn(
        { filename: file.name, size: file.size, maxBytes },
        "Rejected: file too large",
      );
      throw new FileTooLargeError(env.MAX_FILE_SIZE_MB, locale);
    }

    // 3. Resolve user's shop (MVP: one user → one shop).
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!shop) {
      log.warn({ userId }, "Rejected: user has no shop");
      throw new NoShopError(locale);
    }

    // 4. Save file to disk with a unique name.
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeFilename = `${timestamp}-${suffix}-${sanitizedName}`;
    const uploadDir = resolve(env.UPLOAD_DIR);
    const shopDir = join(uploadDir, shop.id);
    const filePath = join(shopDir, safeFilename);

    await mkdir(shopDir, { recursive: true });
    await Bun.write(filePath, file);

    log.info(
      { filePath, shopId: shop.id, originalName: file.name },
      "File saved to disk",
    );

    // 5. Create RawUpload record (status: UPLOADED).
    const upload = await prisma.rawUpload.create({
      data: {
        shopId: shop.id,
        filename: file.name,
        filePath,
        status: UploadStatus.UPLOADED,
      },
    });

    // 6. Run column detection.
    try {
      const detection = await detectColumns(filePath, log);

      if (detection.confidence === "full") {
        const updated = await prisma.rawUpload.update({
          where: { id: upload.id },
          data: {
            status: UploadStatus.READY,
            columnMap: detection.columnMap,
            processedAt: new Date(),
          },
        });

        log.info(
          { uploadId: updated.id, status: updated.status },
          "Upload complete — all columns detected",
        );

        return {
          uploadId: updated.id,
          filename: updated.filename,
          status: updated.status,
        };
      }

      // Partial detection → NEEDS_MAPPING
      const updated = await prisma.rawUpload.update({
        where: { id: upload.id },
        data: {
          status: UploadStatus.NEEDS_MAPPING,
          columnMap: detection.columnMap,
          unmappedRequired: detection.unmappedRequired,
        },
      });

      log.info(
        {
          uploadId: updated.id,
          status: updated.status,
          unmappedRequired: detection.unmappedRequired,
        },
        "Upload complete — manual column mapping required",
      );

      return {
        uploadId: updated.id,
        filename: updated.filename,
        status: updated.status,
        unmappedRequired: detection.unmappedRequired,
        detectedColumns: detection.detectedColumns,
      };
    } catch (err) {
      // Column detection failed — mark upload as FAILED.
      await prisma.rawUpload.update({
        where: { id: upload.id },
        data: {
          status: UploadStatus.FAILED,
          error: {
            code: "COLUMN_DETECTION_FAILED",
            message: err instanceof Error ? err.message : "Unknown error",
          },
        },
      });

      log.error(
        { uploadId: upload.id, err },
        "Column detection failed — upload marked FAILED",
      );

      throw new FileParseFailedError(locale);
    }
  }

  static async saveColumnMap(
    uploadId: string,
    userId: string,
    data: SaveColumnMapInput,
    log: Logger,
    locale: string = "en",
  ): Promise<Record<string, string | null>> {
    log.debug({ uploadId, userId }, "Saving column map for upload");

    // 1. Resolve the authenticated user's shop (MVP: one user → one shop).
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    // 2. Find upload and verify ownership in a single query.
    //    If the user has no shop, shop?.id is undefined and the sentinel
    //    "__no_shop__" will never match any real shopId → null → 404.
    const upload = await prisma.rawUpload.findFirst({
      where: {
        id: uploadId,
        shopId: shop?.id ?? "__no_shop__",
      },
    });

    if (!upload) {
      log.warn(
        { uploadId, userId },
        "Upload not found or does not belong to user's shop",
      );
      throw new UploadNotFoundError(locale);
    }

    // 3. Guard: only NEEDS_MAPPING uploads may be updated.
    if (upload.status !== UploadStatus.NEEDS_MAPPING) {
      log.warn(
        { uploadId, status: upload.status },
        "Column map update rejected: upload is not in NEEDS_MAPPING state",
      );
      throw new UploadNotAwaitingMappingError(locale);
    }

    // 4. Merge submitted fields into the existing partial columnMap.
    //    Already-detected (non-null) values are preserved; only submitted
    //    keys are added or overwritten.
    const existingColumnMap =
      (upload.columnMap as Record<string, string | null>) ?? {};

    const mergedColumnMap: Record<string, string | null> = {
      ...existingColumnMap,
      ...data.resolvedMappings,
    };

    // 5. Persist merged map and transition status → READY.
    const updated = await prisma.rawUpload.update({
      where: { id: uploadId },
      data: {
        columnMap: mergedColumnMap,
        status: UploadStatus.READY,
      },
    });

    log.info(
      { uploadId, resolvedKeys: Object.keys(data.resolvedMappings) },
      "Column map saved — upload marked READY",
    );

    return updated.columnMap as Record<string, string | null>;
  }

  static async getUploadStatus(
    uploadId: string,
    userId: string,
    log: Logger,
    locale: string = "en",
  ) {
    log.debug({ uploadId, userId }, "Fetching upload status");

    // Resolve shop
    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    const upload = await prisma.rawUpload.findFirst({
      where: {
        id: uploadId,
        shopId: shop?.id ?? "__no_shop__",
      },
      select: {
        id: true,
        filename: true,
        status: true,
        rowCount: true,
        uploadedAt: true,
        processedAt: true,
        error: true,
      },
    });

    if (!upload) {
      log.warn(
        { uploadId, userId },
        "Upload not found or does not belong to user",
      );
      throw new UploadNotFoundError(locale);
    }

    return {
      uploadId: upload.id,
      filename: upload.filename,
      status: upload.status,
      rowCount: upload.rowCount,
      uploadedAt: upload.uploadedAt,
      processedAt: upload.processedAt,
      ...(upload.error
        ? { error: upload.error as { code: string; message: string } }
        : {}),
    };
  }
}
