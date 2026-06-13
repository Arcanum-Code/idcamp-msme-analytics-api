import { prisma } from "@/libs/prisma";
import { UploadStatus } from "@generated/prisma";
import type { SaveColumnMapInput } from "./schema";
import { UploadNotFoundError, UploadNotAwaitingMappingError } from "./error";
import type { Logger } from "pino";

export abstract class UploadService {
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
}
