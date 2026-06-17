import { UploadService } from "./service";
import { successResponse } from "@/libs/response";
import { UploadStatus } from "@generated/prisma";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type { SaveColumnMapInput, UploadFileInput } from "./schema";

export class UploadController {
  static async uploadFile({
    body,
    user,
    set,
    log,
    locale,
  }: {
    body: UploadFileInput;
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await UploadService.uploadFile(
      user.id,
      body.file,
      log,
      locale,
    );

    const messageKey =
      result.status === UploadStatus.READY
        ? "upload.uploadSuccess"
        : "upload.uploadNeedsMapping";

    return successResponse(
      set,
      result,
      { key: messageKey },
      202,
      undefined,
      locale,
    );
  }

  static async saveColumnMap({
    params,
    body,
    user,
    set,
    log,
    locale,
  }: {
    params: { uploadId: string };
    body: SaveColumnMapInput;
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const columnMap = await UploadService.saveColumnMap(
      params.uploadId,
      user.id,
      body,
      log,
      locale,
    );

    return successResponse(
      set,
      { columnMap },
      { key: "upload.saveColumnMapSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async getUploadStatus({
    params,
    user,
    set,
    log,
    locale,
  }: {
    params: { uploadId: string };
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const result = await UploadService.getUploadStatus(
      params.uploadId,
      user.id,
      log,
      locale,
    );

    return successResponse(
      set,
      result,
      { key: "upload.statusRetrieved" },
      200,
      undefined,
      locale,
    );
  }
}
