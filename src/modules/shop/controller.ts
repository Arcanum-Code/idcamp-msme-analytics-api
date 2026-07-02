import { ShopService } from "./service";
import { errorResponse, successResponse } from "@/libs/response";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type { CreateShopInput, UpdateShopInput } from "./schema";

export class ShopController {
  static async getShops({
    query,
    set,
    log,
    locale,
  }: {
    query: {
      page?: number;
      limit?: number;
      search?: string;
      ownerId?: string;
    };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const { page = 1, limit = 10, search, ownerId } = query;

    const { shops, pagination } = await ShopService.getShops(
      { page, limit, search, ownerId },
      log,
    );

    return successResponse(
      set,
      shops,
      { key: "shop.listSuccess" },
      200,
      { pagination },
      locale,
    );
  }

  static async createShop({
    body,
    user,
    set,
    log,
    locale,
  }: {
    body: CreateShopInput;
    user: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const data = await ShopService.createShop(body, user.id, log, locale);

    return successResponse(
      set,
      data,
      { key: "shop.createSuccess" },
      201,
      undefined,
      locale,
    );
  }

  static async getShop({
    params,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    try {
      const shop = await ShopService.getShop(params.id, log);
      return successResponse(
        set,
        shop,
        { key: "shop.getSuccess" },
        200,
        undefined,
        locale,
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "NotFoundError") {
        return errorResponse(
          set,
          404,
          { key: "shop.shopNotFound" },
          null,
          locale,
        );
      }
      throw e;
    }
  }

  static async getMyShop({
    user,
    set,
    log,
    locale,
  }: {
    user: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const shop = await ShopService.getMyShop(user.id, log);

    return successResponse(
      set,
      shop,
      { key: "shop.getSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async updateShop({
    body,
    params,
    set,
    log,
    locale,
  }: {
    body: UpdateShopInput;
    params: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const updatedShop = await ShopService.updateShop(
      params.id,
      body,
      log,
      locale,
    );

    return successResponse(
      set,
      updatedShop,
      { key: "shop.updateSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async deleteShop({
    params,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const deletedShop = await ShopService.deleteShop(params.id, log, locale);

    return successResponse(
      set,
      deletedShop,
      { key: "shop.deleteSuccess" },
      200,
      undefined,
      locale,
    );
  }
}
