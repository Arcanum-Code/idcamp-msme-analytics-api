import { t, type Static } from "elysia";
import {
  PaginationSchema,
  createResponseSchema,
  createErrorSchema,
  createPaginatedResponseSchema,
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
  ...PaginationSchema.properties,
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

export const UserResponseSchema = createResponseSchema(UserWithRoleSchema);
export const UsersResponseSchema = createPaginatedResponseSchema(
  t.Array(UserWithRoleSchema),
);
export const UserCreateResultResponseSchema =
  createResponseSchema(UserSafeSchema);
export const UserDeleteResultResponseSchema =
  createResponseSchema(UserSafeSchema);

export const UserErrorSchema = createErrorSchema(t.Null());
export const UserValidationErrorSchema = createErrorSchema(
  t.Array(
    t.Object({
      path: t.String(),
      message: t.String(),
    }),
  ),
);
