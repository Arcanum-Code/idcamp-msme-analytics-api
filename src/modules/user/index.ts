import { UserController } from "./controller";
import {
  CreateUserSchema,
  GetUsersQuerySchema,
  UpdateUserSchema,
  UserParamSchema,
  UserResponseSchema,
  UsersResponseSchema,
  UserCreateResultResponseSchema,
  UserDeleteResultResponseSchema,
  UserErrorSchema,
  UserValidationErrorSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";
import { Prisma } from "@generated/prisma";
import { DeleteSystemError } from "../rbac/error";
import { CreateSystemError, DeleteSelfError, UpdateSystemError } from "./error";

const FEATURE_NAME = "user_management";

const protectedUser = createProtectedApp()
  .get("/", UserController.getUsers, {
    detail: {
      description: "Retrieve a paginated list of users.",
    },
    query: GetUsersQuerySchema,
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    response: {
      200: UsersResponseSchema,
      500: UserErrorSchema,
    },
  })
  .post("/", UserController.createUser, {
    detail: {
      description: "Create a new user and assign a role.",
    },
    beforeHandle: hasPermission(FEATURE_NAME, "create"),
    body: CreateUserSchema,
    response: {
      201: UserCreateResultResponseSchema,
      400: UserValidationErrorSchema,
      409: UserErrorSchema,
      500: UserErrorSchema,
    },
  })
  .get("/:id", UserController.getUser, {
    detail: {
      description: "Retrieve details of a specific user.",
    },
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    params: UserParamSchema,
    response: {
      200: UserResponseSchema,
      404: UserErrorSchema,
      500: UserErrorSchema,
    },
  })
  .patch("/:id", UserController.updateUser, {
    detail: {
      description: "Update an existing user's information or status.",
    },
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    params: UserParamSchema,
    body: UpdateUserSchema,
    response: {
      200: UserCreateResultResponseSchema,
      400: UserValidationErrorSchema,
      404: UserErrorSchema,
      500: UserErrorSchema,
    },
  })
  .delete("/:id", UserController.deleteUser, {
    detail: {
      description: "Delete a user from the system.",
    },
    beforeHandle: hasPermission(FEATURE_NAME, "delete"),
    params: UserParamSchema,
    response: {
      200: UserDeleteResultResponseSchema,
      404: UserErrorSchema,
      500: UserErrorSchema,
    },
  });

export const user = createBaseApp({ tags: ["User"] }).group("/users", (app) =>
  app
    .onError(({ error, set, locale }) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        const rawField = (error.meta?.field_name as string) || "unknown";
        const match = rawField.match(/_([a-zA-Z0-9]+)_fkey/);
        const fieldName = match ? match[1] : rawField;

        return errorResponse(
          set,
          400,
          { key: "common.badRequest", params: { field: fieldName } },
          null,
          locale,
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[])?.join(", ") || "field";
        return errorResponse(
          set,
          409,
          { key: "common.error", params: { field: target } },
          null,
          locale,
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return errorResponse(
          set,
          404,
          { key: "common.notFound" },
          null,
          locale,
        );
      }

      if (error instanceof DeleteSystemError) {
        return errorResponse(
          set,
          403,
          { key: "user.deleteSelf" },
          null,
          locale,
        );
      }

      if (error instanceof DeleteSelfError) {
        return errorResponse(
          set,
          403,
          { key: "user.deleteSelf" },
          null,
          locale,
        );
      }

      if (error instanceof CreateSystemError) {
        return errorResponse(
          set,
          403,
          { key: "user.createSystemAdmin" },
          null,
          locale,
        );
      }

      if (error instanceof UpdateSystemError) {
        return errorResponse(
          set,
          403,
          { key: "user.updateSystemAdmin" },
          null,
          locale,
        );
      }
    })
    .use(protectedUser),
);
