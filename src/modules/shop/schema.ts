import { t, type Static } from "elysia";
import {
  PaginationSchema,
  createResponseSchema,
  createErrorSchema,
  createPaginatedResponseSchema,
} from "@/libs/response";

export const CreateShopSchema = t.Object({
  name: t.String({ minLength: 2, maxLength: 255 }),
  description: t.Optional(t.String()),
});

export const UpdateShopSchema = t.Object(
  {
    name: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
    description: t.Optional(t.String()),
  },
  { minProperties: 1 },
);

export const ShopParamSchema = t.Object({
  id: t.String(),
});

export const GetShopsQuerySchema = t.Object({
  ...PaginationSchema.properties,
  search: t.Optional(t.String()),
  ownerId: t.Optional(t.String()),
});

export type CreateShopInput = Static<typeof CreateShopSchema>;
export type UpdateShopInput = Static<typeof UpdateShopSchema>;

export const ShopSafeSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  ownerId: t.String(),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

export const ShopResponseSchema = createResponseSchema(ShopSafeSchema);
export const ShopMeResponseSchema = createResponseSchema(
  t.Union([ShopSafeSchema, t.Null()]),
);
export const ShopsResponseSchema = createPaginatedResponseSchema(
  t.Array(ShopSafeSchema),
);

export const ShopCreateResultResponseSchema =
  createResponseSchema(ShopSafeSchema);
export const ShopDeleteResultResponseSchema =
  createResponseSchema(ShopSafeSchema);

export const ShopErrorSchema = createErrorSchema(t.Null());
export const ShopValidationErrorSchema = createErrorSchema(
  t.Array(
    t.Object({
      path: t.String(),
      message: t.String(),
    }),
  ),
);
