import { UploadController } from "./controller";
import {
  ColumnMapParamSchema,
  SaveColumnMapBodySchema,
  SaveColumnMapResponseSchema,
  UploadErrorSchema,
  UploadFileBodySchema,
  UploadFileResponseSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import {
  UploadNotFoundError,
  UploadNotAwaitingMappingError,
  InvalidFileTypeError,
  FileTooLargeError,
  FileParseFailedError,
  NoShopError,
} from "./error";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "uploads_management";

const protectedUploads = createProtectedApp()
  .post("/", UploadController.uploadFile, {
    beforeHandle: hasPermission(FEATURE_NAME, "create"),
    body: UploadFileBodySchema,
    response: {
      202: UploadFileResponseSchema,
      400: UploadErrorSchema,
      422: UploadErrorSchema,
    },
  })
  .patch("/:uploadId/column-map", UploadController.saveColumnMap, {
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    params: ColumnMapParamSchema,
    body: SaveColumnMapBodySchema,
    response: {
      200: SaveColumnMapResponseSchema,
      403: UploadErrorSchema,
      404: UploadErrorSchema,
      409: UploadErrorSchema,
    },
  });

export const uploads = createBaseApp({ tags: ["Uploads"] }).group(
  "/api/uploads",
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

        if (error instanceof UploadNotAwaitingMappingError) {
          return errorResponse(
            set,
            409,
            { key: "upload.notAwaitingMapping" },
            null,
            locale,
          );
        }

        if (error instanceof InvalidFileTypeError) {
          return errorResponse(
            set,
            400,
            { key: "upload.invalidFileType" },
            null,
            locale,
          );
        }

        if (error instanceof FileTooLargeError) {
          return errorResponse(
            set,
            400,
            {
              key: "upload.fileTooLarge",
              params: { maxSize: error.maxSize },
            },
            null,
            locale,
          );
        }

        if (error instanceof FileParseFailedError) {
          return errorResponse(
            set,
            422,
            { key: "upload.fileParseFailed" },
            null,
            locale,
          );
        }

        if (error instanceof NoShopError) {
          return errorResponse(
            set,
            400,
            { key: "upload.noShop" },
            null,
            locale,
          );
        }
      })
      .use(protectedUploads),
);
