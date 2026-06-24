import { AuthController } from "./controller";
import {
  LoginSchema,
  RefreshTokenSchema,
  TokenSchema,
  AuthLoginResponseSchema,
  AuthRefreshResponseSchema,
  AuthLogoutResponseSchema,
  AuthMeResponseSchema,
  AuthErrorSchema,
  AuthValidationErrorSchema,
  AuthUnauthorizedErrorSchema,
  AuthAccountDisabledErrorSchema,
} from "./schema";
import { accessJwt, refreshJwt } from "@/plugins/jwt";
import { authRateLimit } from "@/plugins/rate-limit";
import { createBaseApp, createProtectedApp } from "@/libs/base";

const publicAuth = createBaseApp()
  .use(authRateLimit)
  .use(accessJwt)
  .use(refreshJwt)
  .post("/login", AuthController.login, {
    body: LoginSchema,
    security: [{}], // Public route
    response: {
      200: AuthLoginResponseSchema,
      400: AuthValidationErrorSchema,
      401: AuthUnauthorizedErrorSchema,
      403: AuthAccountDisabledErrorSchema,
      500: AuthErrorSchema,
    },
    detail: {
      description: "Authenticate user and receive access and refresh tokens.",
    },
  })
  .post("/refresh", AuthController.refresh, {
    body: RefreshTokenSchema,
    security: [{}], // Public route
    response: {
      200: AuthRefreshResponseSchema,
      400: AuthValidationErrorSchema,
      500: AuthErrorSchema,
    },
    detail: {
      description: "Refresh access token using a valid refresh token.",
    },
  })
  .post("/logout", AuthController.logout, {
    body: TokenSchema,
    response: {
      200: AuthLogoutResponseSchema,
      401: AuthUnauthorizedErrorSchema,
      500: AuthErrorSchema,
    },
    detail: {
      description: "Logout current device by invalidating the refresh token.",
    },
  });

const protectedAuth = createProtectedApp()
  .use(refreshJwt)
  .post("/logout/all", AuthController.logoutAll, {
    body: TokenSchema,
    response: {
      200: AuthLogoutResponseSchema,
      400: AuthValidationErrorSchema,
      401: AuthUnauthorizedErrorSchema,
      403: AuthAccountDisabledErrorSchema,
      500: AuthErrorSchema,
    },
    detail: {
      description:
        "Logout all devices by invalidating all refresh tokens for the user.",
    },
  })
  .get("/me", AuthController.me, {
    response: {
      200: AuthMeResponseSchema,
      404: AuthErrorSchema,
      500: AuthErrorSchema,
    },
    detail: {
      description:
        "Get profile information of the currently authenticated user.",
    },
  });

export const auth = createBaseApp({ tags: ["Auth"] }).group("/auth", (app) =>
  app.use(publicAuth).use(protectedAuth),
);
