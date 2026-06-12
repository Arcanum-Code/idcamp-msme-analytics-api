import { t, type Static } from "elysia";
import {
  TbPaginationSchema,
  createTbResponseSchema,
  createTbErrorSchema,
  createTbPaginatedResponseSchema,
} from "@/libs/response";

export const CreateUserSchema = t.Object({
  email: t.String({ format: "email" }),
  name: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
  password: t.String({ minLength: 8 }),
  roleId: t.String(),
  isActive: t.Boolean({ default: true }),
});

export const UpdateUserSchema = t.Object(
  {
    email: t.Optional(t.String({ format: "email" })),
    name: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
    password: t.Optional(t.String({ minLength: 8 })),
    roleId: t.Optional(t.String()),
    isActive: t.Optional(t.Boolean()),
  },
  { minProperties: 1 },
);

export const UserParamSchema = t.Object({
  id: t.String(),
});

export const GetUsersQuerySchema = t.Object({
  ...TbPaginationSchema.properties,
  search: t.Optional(t.String()),
  roleId: t.Optional(t.String()),
  isActive: t.Optional(
    t
      .Transform(t.Union([t.Boolean(), t.Literal("true"), t.Literal("false")]))
      .Decode((val) => val === true || val === "true")
      .Encode((val) => val),
  ),
});

/**
 * Inferred types
 */
export type CreateUserInput = Static<typeof CreateUserSchema>;
export type UpdateUserInput = Static<typeof UpdateUserSchema>;

/**
 * Response model schemas
 */
export const UserSafeSchema = t.Object({
  id: t.String(),
  email: t.String({ format: "email" }),
  name: t.Union([t.String(), t.Null()]),
  isActive: t.Boolean(),
  roleId: t.String(),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

export const UserWithRoleSchema = t.Object({
  ...UserSafeSchema.properties,
  roleName: t.String(),
});

export const UserResponseSchema = createTbResponseSchema(UserWithRoleSchema);
export const UsersResponseSchema = createTbPaginatedResponseSchema(
  t.Array(UserWithRoleSchema),
);
export const UserCreateResultResponseSchema =
  createTbResponseSchema(UserSafeSchema);
export const UserDeleteResultResponseSchema =
  createTbResponseSchema(UserSafeSchema);

export const UserErrorSchema = createTbErrorSchema(t.Null());
export const UserValidationErrorSchema = createTbErrorSchema(
  t.Array(
    t.Object({
      path: t.String(),
      message: t.String(),
    }),
  ),
);
