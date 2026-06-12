import { t, type Static } from "elysia";
import { createTbResponseSchema, createTbErrorSchema } from "@/libs/response";

/**
 * Input validation schemas
 */
export const LoginSchema = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 8 }),
});

export const TokenSchema = t.Object({
  access_token: t.Optional(t.String()),
  refresh_token: t.Optional(t.String()),
});

export const RefreshTokenSchema = t.Object({
  refresh_token: t.Optional(t.String()),
});

/**
 * Inferred input types
 */
export type LoginInput = Static<typeof LoginSchema>;

/**
 * Response schemas
 */
export const PublicUserSchema = t.Object({
  id: t.String(),
  email: t.String({ format: "email" }),
  name: t.String(),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

export const PublicUserWithRoleSchema = t.Object({
  id: t.String(),
  email: t.String({ format: "email" }),
  name: t.String(),
  roleName: t.String(),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

export const AuthTokenResponseSchema = t.Object({
  access_token: t.String(),
  refresh_token: t.String(),
  user: t.Object({
    id: t.String(),
    email: t.String({ format: "email" }),
    name: t.String(),
  }),
});

/**
 * Auth model schemas
 */
export const AuthLoginResponseSchema = createTbResponseSchema(
  AuthTokenResponseSchema,
);
export const AuthRefreshResponseSchema = createTbResponseSchema(
  AuthTokenResponseSchema,
);
export const AuthLogoutResponseSchema = createTbResponseSchema(t.Null());
export const AuthMeResponseSchema = createTbResponseSchema(
  PublicUserWithRoleSchema,
);

export const AuthErrorSchema = createTbErrorSchema(t.Null());

export const AuthValidationErrorSchema = createTbErrorSchema(
  t.Array(
    t.Object({
      path: t.String(),
      message: t.String(),
    }),
  ),
);

export const AuthUnauthorizedErrorSchema = createTbErrorSchema(
  t.Object({
    message: t.String(),
  }),
);

export const AuthAccountDisabledErrorSchema = createTbErrorSchema(
  t.Object({
    message: t.String(),
  }),
);
