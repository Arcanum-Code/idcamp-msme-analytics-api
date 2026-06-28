import { ShopController } from "./controller";
import {
  CreateShopSchema,
  GetShopsQuerySchema,
  UpdateShopSchema,
  ShopParamSchema,
  ShopResponseSchema,
  ShopsResponseSchema,
  ShopCreateResultResponseSchema,
  ShopDeleteResultResponseSchema,
  ShopErrorSchema,
  ShopValidationErrorSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";
import { Prisma } from "@generated/prisma";

const FEATURE_NAME = "shop_management";

const protectedShop = createProtectedApp()
  .get("/", ShopController.getShops, {
    detail: { description: "Retrieve a paginated list of shops." },
    query: GetShopsQuerySchema,
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    response: {
      200: ShopsResponseSchema,
      500: ShopErrorSchema,
    },
  })
  .post("/", ShopController.createShop, {
    detail: { description: "Create a new shop." },
    beforeHandle: hasPermission(FEATURE_NAME, "create"),
    body: CreateShopSchema,
    response: {
      201: ShopCreateResultResponseSchema,
      400: ShopValidationErrorSchema,
      500: ShopErrorSchema,
    },
  })
  .get("/:id", ShopController.getShop, {
    detail: { description: "Retrieve details of a specific shop." },
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    params: ShopParamSchema,
    response: {
      200: ShopResponseSchema,
      404: ShopErrorSchema,
      500: ShopErrorSchema,
    },
  })
  .patch("/:id", ShopController.updateShop, {
    detail: { description: "Update an existing shop." },
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    params: ShopParamSchema,
    body: UpdateShopSchema,
    response: {
      200: ShopCreateResultResponseSchema,
      400: ShopValidationErrorSchema,
      404: ShopErrorSchema,
      500: ShopErrorSchema,
    },
  })
  .delete("/:id", ShopController.deleteShop, {
    detail: { description: "Delete a shop." },
    beforeHandle: hasPermission(FEATURE_NAME, "delete"),
    params: ShopParamSchema,
    response: {
      200: ShopDeleteResultResponseSchema,
      404: ShopErrorSchema,
      500: ShopErrorSchema,
    },
  });

export const shop = createBaseApp({ tags: ["Shop"] }).group(
  "/api/shops",
  (app) =>
    app
      .onError(({ error, set, locale }) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          return errorResponse(
            set,
            404,
            { key: "shop.shopNotFound" },
            null,
            locale,
          );
        }
      })
      .use(protectedShop),
);
