import { UploadService } from "./service";
import { successResponse } from "@/libs/response";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type { SaveColumnMapInput } from "./schema";

export class UploadController {
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
}
