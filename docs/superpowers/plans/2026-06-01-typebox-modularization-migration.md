# Typebox Migration & Module Modularization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the codebase validation and API schemas from Zod to Typebox (the native and high-performance Elysia standard) and restructure feature modules to prevent bloat by fully separating Routing, Controllers, Services, and Schemas.

**Architecture:** Each feature module (e.g., `user`, `auth`, `rbac`) will be cleanly split into:
1. `schema.ts`: Consolidates all input validations (body, query, params) and output/response schemas in a single file using Typebox (`t.*`).
2. `controller.ts`: Implements the request handler methods (unpacking request params, calling the service, and returning structured responses).
3. `index.ts` (or pure router): Defines only the route endpoints, mapping methods and paths directly to the Controller methods and validating them using the Schemas.
4. `service.ts` (unchanged): Implements core database and business logic operations.

**Tech Stack:** Elysia, Typebox (`@sinclair/typebox` / `elysia.t`), Bun, Prisma.

---

## Plan Roadmap & Tasks

### Task 1: Migrate Base Response Helpers to Typebox

**Files:**
- Modify: `src/libs/response.ts`
- Test: Core verification

- [ ] **Step 1: Update response helpers to Typebox**
  Rewrite `src/libs/response.ts` to export Typebox-native schema generators:

  ```typescript
  import { Context, t } from "elysia";
  import { t as translate, type Translator } from "@/libs/i18n";

  type ElysiaSet = Context["set"];

  type MessageInput =
    | string
    | { key: string; params?: Record<string, string | number> };

  const resolveMessage = (
    message: MessageInput,
    locale: string,
    translator?: Translator,
  ): string => {
    if (typeof message === "string") {
      if (translator) {
        return translator(message);
      }
      return message;
    }

    const { key, params } = message;
    return translate(locale, key, params);
  };

  export const successResponse = <T, E>(
    set: ElysiaSet,
    data: T,
    message: MessageInput = "Success",
    code: number = 200,
    extras?: E,
    locale: string = "en",
  ) => {
    set.status = code;
    const resolvedMessage = resolveMessage(message, locale);

    return {
      error: false,
      code,
      message: resolvedMessage,
      data,
      ...extras,
    } as any;
  };

  export const errorResponse = (
    set: ElysiaSet,
    code: number,
    message: MessageInput,
    issues: unknown = null,
    locale: string = "en",
  ) => {
    set.status = code;
    const resolvedMessage = resolveMessage(message, locale);

    return {
      error: true,
      code,
      message: resolvedMessage,
      issues,
    };
  };

  export const createResponseSchema = <T extends any>(schema: T) =>
    t.Object({
      error: t.Boolean({ default: false }),
      code: t.Number(),
      message: t.String(),
      data: t.Union([schema, t.Null()]),
    });

  export const createErrorSchema = <T extends any>(schema: T = t.Any() as any) =>
    t.Object({
      error: t.Boolean({ default: true }),
      code: t.Number(),
      message: t.String(),
      issues: t.Union([schema, t.Null()]),
    });

  export const PaginationSchema = t.Object({
    page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
  });

  export const createPaginatedResponseSchema = <T extends any>(itemSchema: T) =>
    t.Object({
      error: t.Boolean(),
      code: t.Number(),
      message: t.String(),
      data: itemSchema,
      pagination: t.Object({
        total: t.Number(),
        page: t.Number(),
        limit: t.Number(),
        totalPages: t.Number(),
      }),
    });
  ```

- [ ] **Step 2: Commit response utility modifications**
  ```bash
  git add src/libs/response.ts
  git commit -m "refactor(response): migrate response schema builders to Typebox"
  ```

---

### Task 2: Refactor Health Module to Controller/Typebox Pattern

**Files:**
- Create: `src/modules/health/controller.ts`
- Create: `src/modules/health/schema.ts`
- Modify: `src/modules/health/index.ts`
- Remove: `src/modules/health/model.ts`

- [ ] **Step 1: Create Health Schemas**
  Create `src/modules/health/schema.ts` containing the health check Typebox responses:
  ```typescript
  import { t } from "elysia";
  import { createResponseSchema } from "@/libs/response";

  export const HealthDetailsSchema = t.Object({
    status: t.String(),
    timestamp: t.String(),
    uptime: t.Number(),
    database: t.Object({
      status: t.String(),
    }),
  });

  export const HealthResponse = createResponseSchema(HealthDetailsSchema);
  ```

- [ ] **Step 2: Create Health Controller**
  Create `src/modules/health/controller.ts`:
  ```typescript
  import { successResponse } from "@/libs/response";
  import { HealthService } from "./service";

  export class HealthController {
    static async getHealth({ set, locale }) {
      const details = await HealthService.getHealthDetails();
      return successResponse(
        set,
        details,
        { key: "health.success" },
        200,
        undefined,
        locale,
      );
    }
  }
  ```

- [ ] **Step 3: Refactor Health Index (Router)**
  Update `src/modules/health/index.ts` to be a pure router:
  ```typescript
  import { createBaseApp } from "@/libs/base";
  import { HealthController } from "./controller";
  import { HealthResponse } from "./schema";

  export const health = createBaseApp({ tags: ["Health"] }).get(
    "/health",
    HealthController.getHealth,
    {
      response: {
        200: HealthResponse,
      },
    },
  );
  ```

- [ ] **Step 4: Clean up old model file & commit**
  ```bash
  rm -f src/modules/health/model.ts
  git add src/modules/health/
  git commit -m "refactor(health): restructure to modular router-controller-schema pattern"
  ```

---

### Task 3: Refactor Dashboard Module to Controller/Typebox Pattern

**Files:**
- Create: `src/modules/dashboard/controller.ts`
- Create: `src/modules/dashboard/schema.ts`
- Modify: `src/modules/dashboard/index.ts`
- Remove: `src/modules/dashboard/model.ts`
- Remove: `src/modules/dashboard/schema.ts` (old Zod schema)

- [ ] **Step 1: Create Typebox Dashboard Schemas**
  Create `src/modules/dashboard/schema.ts` containing the unified dashboard input/output definitions:
  ```typescript
  import { t } from "elysia";
  import { createResponseSchema } from "@/libs/response";

  export const DashboardStatsSchema = t.Object({
    users: t.Object({
      total: t.Number(),
      active: t.Number(),
      inactive: t.Number(),
    }),
    roles: t.Object({
      total: t.Number(),
    }),
  });

  export const DashboardResponse = createResponseSchema(DashboardStatsSchema);
  ```

- [ ] **Step 2: Create Dashboard Controller**
  Create `src/modules/dashboard/controller.ts`:
  ```typescript
  import { successResponse } from "@/libs/response";
  import { DashboardService } from "./service";

  export class DashboardController {
    static async getStats({ set, log, locale }) {
      const stats = await DashboardService.getStats(log);
      return successResponse(
        set,
        stats,
        { key: "dashboard.getSuccess" },
        200,
        undefined,
        locale,
      );
    }
  }
  ```

- [ ] **Step 3: Refactor Dashboard Index (Router)**
  Update `src/modules/dashboard/index.ts` as a pure router:
  ```typescript
  import { createProtectedApp } from "@/libs/base";
  import { DashboardController } from "./controller";
  import { DashboardResponse } from "./schema";

  export const dashboard = createProtectedApp({ tags: ["Dashboard"] }).get(
    "/dashboard",
    DashboardController.getStats,
    {
      response: {
        200: DashboardResponse,
      },
    },
  );
  ```

- [ ] **Step 4: Clean up old files and commit**
  ```bash
  rm -f src/modules/dashboard/model.ts
  git add src/modules/dashboard/
  git commit -m "refactor(dashboard): modularize and migrate to Typebox"
  ```

---

### Task 4: Refactor Auth Module to Controller/Typebox Pattern

**Files:**
- Create: `src/modules/auth/controller.ts`
- Modify: `src/modules/auth/schema.ts` (Rewrite in Typebox + Merge model)
- Modify: `src/modules/auth/index.ts`
- Remove: `src/modules/auth/model.ts`

- [ ] **Step 1: Create Unified Typebox Auth Schemas**
  Overwrite `src/modules/auth/schema.ts` containing all Auth Typebox schemas:
  ```typescript
  import { t } from "elysia";
  import { createResponseSchema, createErrorSchema } from "@/libs/response";

  export const LoginSchema = t.Object({
    email: t.String({ format: "email" }),
    password: t.String({ minLength: 8 }),
  });

  export const RefreshTokenSchema = t.Object({
    refresh_token: t.Optional(t.String()),
  });

  export const PublicUser = t.Object({
    id: t.String(),
    email: t.String({ format: "email" }),
    name: t.Union([t.String(), t.Null()]),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  });

  export const PublicUserWithRole = t.Object({
    id: t.String(),
    email: t.String({ format: "email" }),
    name: t.Union([t.String(), t.Null()]),
    roleName: t.String(),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  });

  export const AuthTokenResponse = t.Object({
    access_token: t.String(),
    refresh_token: t.String(),
    user: t.Object({
      id: t.String(),
      email: t.String({ format: "email" }),
      name: t.Union([t.String(), t.Null()]),
    }),
  });

  export const AuthSchemas = {
    login: createResponseSchema(AuthTokenResponse),
    refresh: createResponseSchema(AuthTokenResponse),
    logout: createResponseSchema(t.Null()),
    me: createResponseSchema(PublicUserWithRole),
    error: createErrorSchema(t.Null()),
    validationError: createErrorSchema(
      t.Array(
        t.Object({
          path: t.String(),
          message: t.String(),
        }),
      ),
    ),
    unauthorizedError: createErrorSchema(
      t.Object({
        message: t.String(),
      }),
    ),
    accountDisabledError: createErrorSchema(
      t.Object({
        message: t.String(),
      }),
    ),
  };
  ```

- [ ] **Step 2: Create Auth Controller**
  Create `src/modules/auth/controller.ts`:
  ```typescript
  import { successResponse, errorResponse } from "@/libs/response";
  import { AuthService } from "./service";

  export class AuthController {
    static async login({ body, set, log, locale }) {
      const user = await AuthService.login(body, log, locale);
      if (!user) {
        return errorResponse(set, 401, { key: "auth.invalidCredentials" }, null, locale);
      }

      const accessToken = await AuthService.createAccessToken(user);
      const refreshToken = await AuthService.createRefreshToken(user.id);

      return successResponse(
        set,
        {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        },
        { key: "auth.loginSuccess" },
        200,
        undefined,
        locale,
      );
    }

    static async refresh({ body, set, log, locale, jwt }) {
      const { refresh_token } = body;
      if (!refresh_token) {
        return errorResponse(set, 400, { key: "auth.refreshTokenRequired" }, null, locale);
      }

      // Verify token in DB
      const result = await AuthService.verifyRefreshToken(refresh_token, log, locale);
      if (!result) {
        return errorResponse(set, 401, { key: "auth.refreshFailed" }, null, locale);
      }

      const accessToken = await AuthService.createAccessToken(result.user);
      const newRefreshToken = await AuthService.rotateRefreshToken(refresh_token, result.user.id);

      return successResponse(
        set,
        {
          access_token: accessToken,
          refresh_token: newRefreshToken,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
          },
        },
        { key: "auth.refreshSuccess" },
        200,
        undefined,
        locale,
      );
    }

    static async logout({ body, set, log, locale }) {
      const { refresh_token } = body;
      if (!refresh_token) {
        return errorResponse(set, 400, { key: "auth.refreshTokenRequired" }, null, locale);
      }

      await AuthService.logout(refresh_token, log);

      return successResponse(
        set,
        null,
        { key: "auth.logoutSuccess" },
        200,
        undefined,
        locale,
      );
    }

    static async me({ user, set, log, locale }) {
      const userDetails = await AuthService.getUserWithRole(user.id, log);
      if (!userDetails) {
        return errorResponse(set, 401, { key: "auth.unauthorized" }, null, locale);
      }

      return successResponse(
        set,
        userDetails,
        { key: "auth.meSuccess" },
        200,
        undefined,
        locale,
      );
    }
  }
  ```

- [ ] **Step 3: Refactor Auth Index (Router)**
  Update `src/modules/auth/index.ts` to register endpoints with Typebox validations and controller bindings:
  ```typescript
  import { createBaseApp, createProtectedApp } from "@/libs/base";
  import { AuthController } from "./controller";
  import { LoginSchema, RefreshTokenSchema, AuthSchemas } from "./schema";

  const publicAuth = createBaseApp()
    .post("/login", AuthController.login, {
      body: LoginSchema,
      response: {
        200: AuthSchemas.login,
        401: AuthSchemas.unauthorizedError,
        500: AuthSchemas.error,
      },
    })
    .post("/refresh", AuthController.refresh, {
      body: RefreshTokenSchema,
      response: {
        200: AuthSchemas.refresh,
        400: AuthSchemas.validationError,
        401: AuthSchemas.unauthorizedError,
        500: AuthSchemas.error,
      },
    })
    .post("/logout", AuthController.logout, {
      body: RefreshTokenSchema,
      response: {
        200: AuthSchemas.logout,
        400: AuthSchemas.validationError,
        500: AuthSchemas.error,
      },
    });

  const protectedAuth = createProtectedApp().get("/me", AuthController.me, {
    response: {
      200: AuthSchemas.me,
      401: AuthSchemas.unauthorizedError,
      500: AuthSchemas.error,
    },
  });

  export const auth = createBaseApp({ tags: ["Auth"] }).group("/auth", (app) =>
    app.use(publicAuth).use(protectedAuth),
  );
  ```

- [ ] **Step 4: Clean up old files and commit**
  ```bash
  rm -f src/modules/auth/model.ts
  git add src/modules/auth/
  git commit -m "refactor(auth): modularize auth and migrate to native Typebox"
  ```

---

### Task 5: Refactor User Module to Controller/Typebox Pattern

**Files:**
- Create: `src/modules/user/controller.ts`
- Modify: `src/modules/user/schema.ts` (Rewrite in Typebox + Merge model)
- Modify: `src/modules/user/index.ts`
- Remove: `src/modules/user/model.ts`

- [ ] **Step 1: Overwrite User Schema**
  Update `src/modules/user/schema.ts` with unified Typebox schemas:
  ```typescript
  import { t } from "elysia";
  import {
    createResponseSchema,
    createPaginatedResponseSchema,
    createErrorSchema,
    PaginationSchema,
  } from "@/libs/response";

  export const CreateUserSchema = t.Object({
    email: t.String({ format: "email" }),
    name: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
    password: t.String({ minLength: 8 }),
    roleId: t.String(),
    isActive: t.Optional(t.Boolean({ default: true })),
  });

  export const UpdateUserSchema = t.Object({
    email: t.Optional(t.String({ format: "email" })),
    name: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
    password: t.Optional(t.String({ minLength: 8 })),
    roleId: t.Optional(t.String()),
    isActive: t.Optional(t.Boolean()),
  });

  export const UserParamSchema = t.Object({
    id: t.String(),
  });

  export const GetUsersQuerySchema = t.Composite([
    PaginationSchema,
    t.Object({
      search: t.Optional(t.String()),
      roleId: t.Optional(t.String()),
      isActive: t.Optional(t.Boolean()),
    }),
  ]);

  export const UserSafe = t.Object({
    id: t.String(),
    email: t.String({ format: "email" }),
    name: t.Union([t.String(), t.Null()]),
    isActive: t.Boolean(),
    roleId: t.String(),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  });

  export const UserSchemas = {
    user: createResponseSchema(
      t.Intersect([
        UserSafe,
        t.Object({
          roleName: t.String(),
        }),
      ]),
    ),
    users: createPaginatedResponseSchema(
      t.Array(
        t.Intersect([
          UserSafe,
          t.Object({
            roleName: t.String(),
          }),
        ]),
      ),
    ),
    createResult: createResponseSchema(UserSafe),
    deleteResult: createResponseSchema(UserSafe),
    error: createErrorSchema(t.Null()),
    validationError: createErrorSchema(
      t.Array(
        t.Object({
          path: t.String(),
          message: t.String(),
        }),
      ),
    ),
  };
  ```

- [ ] **Step 2: Create User Controller**
  Create `src/modules/user/controller.ts`:
  ```typescript
  import { successResponse, errorResponse } from "@/libs/response";
  import { UserService } from "./service";
  import { Prisma } from "@generated/prisma";
  import { CreateSystemError, DeleteSelfError, UpdateSystemError } from "./error";

  export class UserController {
    static async getUsers({ query, set, log, locale }) {
      const { page = 1, limit = 10, isActive, roleId, search } = query;

      const { users, pagination } = await UserService.getUsers(
        { page, limit, isActive, roleId, search },
        log,
      );

      return successResponse(
        set,
        users,
        { key: "user.listSuccess" },
        200,
        { pagination },
        locale,
      );
    }

    static async createUser({ body, set, log, locale }) {
      try {
        const user = await UserService.createUser(body, log, locale);
        return successResponse(
          set,
          user,
          { key: "user.createSuccess" },
          201,
          undefined,
          locale,
        );
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return errorResponse(set, 409, { key: "user.emailExists" }, null, locale);
        }
        if (err instanceof CreateSystemError) {
          return errorResponse(set, 400, { key: "user.createSystemAdmin" }, null, locale);
        }
        throw err;
      }
    }

    static async getUser({ params, set, log, locale }) {
      const user = await UserService.getUser(params.id, log);
      if (!user) {
        return errorResponse(set, 404, { key: "user.userNotFound" }, null, locale);
      }

      return successResponse(
        set,
        user,
        { key: "user.getSuccess" },
        200,
        undefined,
        locale,
      );
    }

    static async updateUser({ params, body, set, log, locale }) {
      try {
        if (Object.keys(body).length === 0) {
          return errorResponse(set, 400, { key: "user.atLeastOneField" }, null, locale);
        }

        const user = await UserService.updateUser(params.id, body, log, locale);
        return successResponse(
          set,
          user,
          { key: "user.updateSuccess" },
          200,
          undefined,
          locale,
        );
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === "P2002") {
            return errorResponse(set, 409, { key: "user.emailExists" }, null, locale);
          }
          if (err.code === "P2025") {
            return errorResponse(set, 404, { key: "user.userNotFound" }, null, locale);
          }
        }
        if (err instanceof UpdateSystemError) {
          return errorResponse(set, 400, { key: "user.updateSystemAdmin" }, null, locale);
        }
        throw err;
      }
    }

    static async deleteUser({ params, set, log, locale, user }) {
      try {
        if (user.id === params.id) {
          throw new DeleteSelfError(locale);
        }

        const deletedUser = await UserService.deleteUser(params.id, log, locale);
        return successResponse(
          set,
          deletedUser,
          { key: "user.deleteSuccess" },
          200,
          undefined,
          locale,
        );
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return errorResponse(set, 404, { key: "user.userNotFound" }, null, locale);
        }
        if (err instanceof DeleteSelfError) {
          return errorResponse(set, 400, { key: "user.deleteSelf" }, null, locale);
        }
        throw err;
      }
    }
  }
  ```

- [ ] **Step 3: Refactor User Index (Router)**
  Update `src/modules/user/index.ts` to declare endpoints cleanly:
  ```typescript
  import { createProtectedApp } from "@/libs/base";
  import { hasPermission } from "@/middleware/permission";
  import { UserController } from "./controller";
  import {
    GetUsersQuerySchema,
    CreateUserSchema,
    UpdateUserSchema,
    UserParamSchema,
    UserSchemas,
  } from "./schema";

  const FEATURE_NAME = "user_management";

  export const user = createProtectedApp({ tags: ["User"] }).group(
    "/users",
    (app) =>
      app
        .get("/", UserController.getUsers, {
          query: GetUsersQuerySchema,
          beforeHandle: hasPermission(FEATURE_NAME, "read"),
          response: {
            200: UserSchemas.users,
            500: UserSchemas.error,
          },
        })
        .post("/", UserController.createUser, {
          body: CreateUserSchema,
          beforeHandle: hasPermission(FEATURE_NAME, "create"),
          response: {
            201: UserSchemas.createResult,
            400: UserSchemas.validationError,
            409: UserSchemas.error,
            500: UserSchemas.error,
          },
        })
        .get("/:id", UserController.getUser, {
          params: UserParamSchema,
          beforeHandle: hasPermission(FEATURE_NAME, "read"),
          response: {
            200: UserSchemas.user,
            404: UserSchemas.error,
            500: UserSchemas.error,
          },
        })
        .patch("/:id", UserController.updateUser, {
          params: UserParamSchema,
          body: UpdateUserSchema,
          beforeHandle: hasPermission(FEATURE_NAME, "update"),
          response: {
            200: UserSchemas.user,
            400: UserSchemas.validationError,
            404: UserSchemas.error,
            409: UserSchemas.error,
            500: UserSchemas.error,
          },
        })
        .delete("/:id", UserController.deleteUser, {
          params: UserParamSchema,
          beforeHandle: hasPermission(FEATURE_NAME, "delete"),
          response: {
            200: UserSchemas.deleteResult,
            400: UserSchemas.error,
            404: UserSchemas.error,
            500: UserSchemas.error,
          },
        }),
  );
  ```

- [ ] **Step 4: Clean up old files and commit**
  ```bash
  rm -f src/modules/user/model.ts
  git add src/modules/user/
  git commit -m "refactor(user): split into route-controller-schema with native Typebox"
  ```

---

### Task 6: Refactor RBAC Module to Controller/Typebox Pattern

**Files:**
- Create: `src/modules/rbac/controller.ts`
- Modify: `src/modules/rbac/schema.ts` (Rewrite in Typebox + Merge model)
- Modify: `src/modules/rbac/index.ts`
- Remove: `src/modules/rbac/model.ts`

- [ ] **Step 1: Overwrite RBAC Schema**
  Update `src/modules/rbac/schema.ts` with unified Typebox definitions:
  ```typescript
  import { t } from "elysia";
  import {
    createResponseSchema,
    createPaginatedResponseSchema,
    createErrorSchema,
    PaginationSchema,
  } from "@/libs/response";

  export const CreateRoleSchema = t.Object({
    name: t.String({ minLength: 3, maxLength: 50 }),
    description: t.Optional(t.String({ maxLength: 255 })),
    permissions: t.Array(
      t.Object({
        featureId: t.String(),
        canCreate: t.Boolean(),
        canRead: t.Boolean(),
        canUpdate: t.Boolean(),
        canDelete: t.Boolean(),
        canPrint: t.Boolean(),
      }),
    ),
  });

  export const UpdateRoleSchema = t.Object({
    name: t.Optional(t.String({ minLength: 3, maxLength: 50 })),
    description: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
    permissions: t.Optional(
      t.Array(
        t.Object({
          featureId: t.String(),
          canCreate: t.Boolean(),
          canRead: t.Boolean(),
          canUpdate: t.Boolean(),
          canDelete: t.Boolean(),
          canPrint: t.Boolean(),
        }),
      ),
    ),
  });

  export const RoleParamSchema = t.Object({
    id: t.String(),
  });

  export const GetRolesQuerySchema = t.Composite([
    PaginationSchema,
    t.Object({
      search: t.Optional(t.String()),
    }),
  ]);

  export const CreateFeatureSchema = t.Object({
    name: t.String({ minLength: 3, maxLength: 50 }),
    description: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
    defaultPermissions: t.Object({
      canCreate: t.Optional(t.Boolean({ default: false })),
      canRead: t.Optional(t.Boolean({ default: false })),
      canUpdate: t.Optional(t.Boolean({ default: false })),
      canDelete: t.Optional(t.Boolean({ default: false })),
      canPrint: t.Optional(t.Boolean({ default: false })),
    }),
  });

  export const UpdateFeatureSchema = t.Object({
    name: t.Optional(t.String({ minLength: 3, maxLength: 50 })),
    description: t.Optional(t.Union([t.String({ maxLength: 255 }), t.Null()])),
  });

  export const GetFeaturesQuerySchema = t.Composite([
    PaginationSchema,
    t.Object({
      search: t.Optional(t.String()),
    }),
  ]);

  // Model schema structures
  export const RoleFeaturePermission = t.Object({
    id: t.String(),
    roleId: t.String(),
    featureId: t.String(),
    featureName: t.String(),
    canCreate: t.Boolean(),
    canRead: t.Boolean(),
    canUpdate: t.Boolean(),
    canDelete: t.Boolean(),
    canPrint: t.Boolean(),
  });

  export const RoleDetails = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.Union([t.String(), t.Null()]),
    createdAt: t.Date(),
    updatedAt: t.Date(),
    permissions: t.Array(RoleFeaturePermission),
  });

  export const FeatureDetails = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.Union([t.String(), t.Null()]),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  });

  export const RBACSchemas = {
    role: createResponseSchema(RoleDetails),
    roles: createPaginatedResponseSchema(t.Array(RoleDetails)),
    feature: createResponseSchema(FeatureDetails),
    features: createPaginatedResponseSchema(t.Array(FeatureDetails)),
    deleteRoleResult: createResponseSchema(t.Object({ id: t.String(), name: t.String() })),
    deleteFeatureResult: createResponseSchema(FeatureDetails),
    error: createErrorSchema(t.Null()),
    validationError: createErrorSchema(
      t.Array(
        t.Object({
          path: t.String(),
          message: t.String(),
        }),
      ),
    ),
  };
  ```

- [ ] **Step 2: Create RBAC Controller**
  Create `src/modules/rbac/controller.ts`:
  ```typescript
  import { successResponse, errorResponse } from "@/libs/response";
  import { RBACService } from "./service";
  import { Prisma } from "@generated/prisma";
  import { DeleteSystemRoleError } from "./error";

  export class RBACController {
    // Roles
    static async getRoles({ query, set, log, locale }) {
      const { page = 1, limit = 10, search } = query;
      const { roles, pagination } = await RBACService.getRoles({ page, limit, search }, log);
      return successResponse(set, roles, { key: "rbac.listRolesSuccess" }, 200, { pagination }, locale);
    }

    static async createRole({ body, set, log, locale }) {
      try {
        const role = await RBACService.createRole(body, log, locale);
        return successResponse(set, role, { key: "rbac.createRoleSuccess" }, 201, undefined, locale);
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return errorResponse(set, 409, { key: "rbac.roleExists" }, null, locale);
        }
        throw err;
      }
    }

    static async getRole({ params, set, log, locale }) {
      const role = await RBACService.getRole(params.id, log);
      if (!role) {
        return errorResponse(set, 404, { key: "rbac.roleNotFound" }, null, locale);
      }
      return successResponse(set, role, { key: "rbac.getRoleSuccess" }, 200, undefined, locale);
    }

    static async updateRole({ params, body, set, log, locale }) {
      try {
        const role = await RBACService.updateRole(params.id, body, log, locale);
        return successResponse(set, role, { key: "rbac.updateRoleSuccess" }, 200, undefined, locale);
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === "P2002") {
            return errorResponse(set, 409, { key: "rbac.roleExists" }, null, locale);
          }
          if (err.code === "P2025") {
            return errorResponse(set, 404, { key: "rbac.roleNotFound" }, null, locale);
          }
        }
        throw err;
      }
    }

    static async deleteRole({ params, set, log, locale }) {
      try {
        const deleted = await RBACService.deleteRole(params.id, log, locale);
        return successResponse(set, deleted, { key: "rbac.deleteRoleSuccess" }, 200, undefined, locale);
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return errorResponse(set, 404, { key: "rbac.roleNotFound" }, null, locale);
        }
        if (err instanceof DeleteSystemRoleError) {
          return errorResponse(set, 400, { key: "rbac.deleteSystemRole" }, null, locale);
        }
        throw err;
      }
    }

    // Features
    static async getFeatures({ query, set, log, locale }) {
      const { page = 1, limit = 10, search } = query;
      const { features, pagination } = await RBACService.getFeatures({ page, limit, search }, log);
      return successResponse(set, features, { key: "rbac.listFeaturesSuccess" }, 200, { pagination }, locale);
    }

    static async createFeature({ body, set, log, locale }) {
      try {
        const feature = await RBACService.createFeature(body, log);
        return successResponse(set, feature, { key: "rbac.createFeatureSuccess" }, 201, undefined, locale);
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return errorResponse(set, 409, { key: "rbac.featureExists" }, null, locale);
        }
        throw err;
      }
    }

    static async getFeature({ params, set, log, locale }) {
      const feature = await RBACService.getFeature(params.id, log);
      if (!feature) {
        return errorResponse(set, 404, { key: "rbac.featureNotFound" }, null, locale);
      }
      return successResponse(set, feature, { key: "rbac.getFeatureSuccess" }, 200, undefined, locale);
    }

    static async updateFeature({ params, body, set, log, locale }) {
      try {
        const feature = await RBACService.updateFeature(params.id, body, log);
        return successResponse(set, feature, { key: "rbac.updateFeatureSuccess" }, 200, undefined, locale);
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === "P2002") {
            return errorResponse(set, 409, { key: "rbac.featureExists" }, null, locale);
          }
          if (err.code === "P2025") {
            return errorResponse(set, 404, { key: "rbac.featureNotFound" }, null, locale);
          }
        }
        throw err;
      }
    }

    static async deleteFeature({ params, set, log, locale }) {
      try {
        const feature = await RBACService.deleteFeature(params.id, log);
        return successResponse(set, feature, { key: "rbac.deleteFeatureSuccess" }, 200, undefined, locale);
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
          return errorResponse(set, 404, { key: "rbac.featureNotFound" }, null, locale);
        }
        throw err;
      }
    }
  }
  ```

- [ ] **Step 3: Refactor RBAC Index (Router)**
  Update `src/modules/rbac/index.ts` to map and validate routes cleanly:
  ```typescript
  import { createProtectedApp } from "@/libs/base";
  import { hasPermission } from "@/middleware/permission";
  import { RBACController } from "./controller";
  import {
    GetRolesQuerySchema,
    CreateRoleSchema,
    RoleParamSchema,
    UpdateRoleSchema,
    GetFeaturesQuerySchema,
    CreateFeatureSchema,
    UpdateFeatureSchema,
    RBACSchemas,
  } from "./schema";

  const FEATURE_NAME = "rbac_management";

  export const rbac = createProtectedApp({ tags: ["RBAC"] }).group("/rbac", (app) =>
    app
      // Roles
      .get("/roles", RBACController.getRoles, {
        query: GetRolesQuerySchema,
        beforeHandle: hasPermission(FEATURE_NAME, "read"),
        response: {
          200: RBACSchemas.roles,
          500: RBACSchemas.error,
        },
      })
      .post("/roles", RBACController.createRole, {
        body: CreateRoleSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "create"),
        response: {
          201: RBACSchemas.role,
          400: RBACSchemas.validationError,
          409: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      })
      .get("/roles/:id", RBACController.getRole, {
        params: RoleParamSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "read"),
        response: {
          200: RBACSchemas.role,
          404: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      })
      .patch("/roles/:id", RBACController.updateRole, {
        params: RoleParamSchema,
        body: UpdateRoleSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "update"),
        response: {
          200: RBACSchemas.role,
          400: RBACSchemas.validationError,
          404: RBACSchemas.error,
          409: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      })
      .delete("/roles/:id", RBACController.deleteRole, {
        params: RoleParamSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "delete"),
        response: {
          200: RBACSchemas.deleteRoleResult,
          400: RBACSchemas.error,
          404: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      })
      // Features
      .get("/features", RBACController.getFeatures, {
        query: GetFeaturesQuerySchema,
        beforeHandle: hasPermission(FEATURE_NAME, "read"),
        response: {
          200: RBACSchemas.features,
          500: RBACSchemas.error,
        },
      })
      .post("/features", RBACController.createFeature, {
        body: CreateFeatureSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "create"),
        response: {
          201: RBACSchemas.feature,
          400: RBACSchemas.validationError,
          409: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      })
      .get("/features/:id", RBACController.getFeature, {
        params: RoleParamSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "read"),
        response: {
          200: RBACSchemas.feature,
          404: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      })
      .patch("/features/:id", RBACController.updateFeature, {
        params: RoleParamSchema,
        body: UpdateFeatureSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "update"),
        response: {
          200: RBACSchemas.feature,
          400: RBACSchemas.validationError,
          404: RBACSchemas.error,
          409: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      })
      .delete("/features/:id", RBACController.deleteFeature, {
        params: RoleParamSchema,
        beforeHandle: hasPermission(FEATURE_NAME, "delete"),
        response: {
          200: RBACSchemas.deleteFeatureResult,
          400: RBACSchemas.error,
          404: RBACSchemas.error,
          500: RBACSchemas.error,
        },
      }),
  );
  ```

- [ ] **Step 4: Clean up old files and commit**
  ```bash
  rm -f src/modules/rbac/model.ts
  git add src/modules/rbac/
  git commit -m "refactor(rbac): split into route-controller-schema with native Typebox"
  ```

---

### Task 7: Execute Testing & Quality Assurance

**Files:**
- Modify: `AGENTS.md` (Update references to new architecture and Typebox standards)

- [ ] **Step 1: Update AGENTS.md guide mapping**
  Update `AGENTS.md` and `.claude/code-style.md` files to note the Typebox usage and new Controller patterns so subsequent agents are guided correctly.

- [ ] **Step 2: Run all validation checks**
  Execute code linting, bundling, and full test commands to verify absolute correctness:
  ```bash
  bun run lint
  bun run build
  bun test
  ```

- [ ] **Step 3: Commit final updates**
  ```bash
  git commit -a -m "chore(docs): update developer and agent reference guides for Typebox/Modular architectural standards"
  ```
