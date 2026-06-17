import { UploadController } from "./controller";
import {
  ColumnMapParamSchema,
  SaveColumnMapBodySchema,
  SaveColumnMapResponseSchema,
  UploadErrorSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { UploadNotFoundError, UploadNotAwaitingMappingError } from "./error";
import { hasPermission } from "@/middleware/permission";

const FEATURE_NAME = "uploads_management";

const protectedUploads = createProtectedApp().patch(
  "/:uploadId/column-map",
  UploadController.saveColumnMap,
  {
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    params: ColumnMapParamSchema,
    body: SaveColumnMapBodySchema,
    response: {
      200: SaveColumnMapResponseSchema,
      403: UploadErrorSchema,
      404: UploadErrorSchema,
      409: UploadErrorSchema,
    },
  },
);

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
      })
      .use(protectedUploads),
);
