// src/modules/shop/service.ts
import { prisma } from "@/libs/prisma";
import type { CreateShopInput, UpdateShopInput } from "./schema";
import { Prisma } from "@generated/prisma";
import type { Logger } from "pino";

export const SAFE_SHOP_SELECT = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export abstract class ShopService {
  static async getShops(
    params: {
      page: number;
      limit: number;
      search?: string;
      ownerId?: string;
    },
    log: Logger,
  ) {
    log.debug(
      {
        page: params.page,
        limit: params.limit,
        search: params.search,
        ownerId: params.ownerId,
      },
      "Fetching shops list",
    );

    const { page, limit, search, ownerId } = params;
    const where: Prisma.ShopWhereInput = {};

    if (ownerId) {
      where.ownerId = ownerId;
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const skip = (page - 1) * limit;

    const [shops, total] = await prisma.$transaction([
      prisma.shop.findMany({
        where,
        select: SAFE_SHOP_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.shop.count({ where }),
    ]);

    log.info({ count: shops.length, total }, "Shops retrieved successfully");

    const shopsWithStringDates = shops.map((shop) => ({
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    }));

    return {
      shops: shopsWithStringDates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async createShop(
    data: CreateShopInput,
    ownerId: string,
    log: Logger,
    _locale: string = "en",
  ) {
    log.debug({ name: data.name, ownerId }, "Creating new shop");

    const shop = await prisma.shop.create({
      data: {
        ...data,
        ownerId,
      },
      select: SAFE_SHOP_SELECT,
    });

    log.info({ shopId: shop.id, name: shop.name }, "Shop created successfully");

    return {
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    };
  }

  static async getShop(id: string, log: Logger) {
    log.debug({ shopId: id }, "Fetching shop details");

    const shop = await prisma.shop.findUniqueOrThrow({
      where: { id },
      select: SAFE_SHOP_SELECT,
    });

    log.info({ shopId: id }, "Shop details retrieved successfully");

    return {
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    };
  }

  static async getMyShop(userId: string, log: Logger) {
    log.debug({ userId }, "Fetching shop for authenticated user");

    const shop = await prisma.shop.findFirst({
      where: { ownerId: userId },
      select: SAFE_SHOP_SELECT,
    });

    log.info({ shopId: shop?.id, userId }, "User shop retrieved");

    if (!shop) return null;

    return {
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    };
  }

  static async updateShop(
    id: string,
    data: UpdateShopInput,
    log: Logger,
    _locale: string = "en",
  ) {
    log.debug({ shopId: id }, "Updating shop");

    const shop = await prisma.shop.update({
      where: { id },
      select: SAFE_SHOP_SELECT,
      data,
    });

    log.info({ shopId: id }, "Shop updated successfully");

    return {
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    };
  }

  static async deleteShop(id: string, log: Logger, _locale: string = "en") {
    log.debug({ shopId: id }, "Attempting to delete shop");

    const shop = await prisma.shop.delete({
      where: { id },
      select: SAFE_SHOP_SELECT,
    });

    log.info({ shopId: id }, "Shop deleted successfully");

    return {
      ...shop,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    };
  }
}
