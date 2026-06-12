import { RbacController } from "./controller";
import {
  CreateFeatureSchema,
  CreateRoleSchema,
  FeatureParamSchema,
  GetFeaturesQuerySchema,
  GetRolesOptionsQuerySchema,
  GetRolesQuerySchema,
  RoleParamSchema,
  UpdateFeatureSchema,
  UpdateRoleSchema,
  RbacGetFeaturesResponseSchema,
  RbacCreateFeatureResponseSchema,
  RbacUpdateFeatureResponseSchema,
  RbacDeleteFeatureResponseSchema,
  RbacGetRoleResponseSchema,
  RbacGetRolesResponseSchema,
  RbacGetRoleOptionsResponseSchema,
  RbacGetMyRoleResponseSchema,
  RbacCreateRoleResponseSchema,
  RbacUpdateRoleResponseSchema,
  RbacDeleteRoleResponseSchema,
  RbacErrorSchema,
  RbacValidationErrorSchema,
} from "./schema";
import { errorResponse } from "@/libs/response";
import { createBaseApp, createProtectedApp } from "@/libs/base";
import { hasPermission } from "@/middleware/permission";
import {
  DeleteSystemError,
  ForeignKeyError,
  InvalidFeatureIdError,
  RecordNotFoundError,
  UniqueConstraintError,
  UpdateSystemError,
} from "./error";

const FEATURE_NAME = "RBAC_management";

const protectedRbac = createProtectedApp()
  // -------------------------
  // FEATURES CRUD
  // -------------------------
  .get("/features", RbacController.getAllFeatures, {
    query: GetFeaturesQuerySchema,
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    response: {
      200: RbacGetFeaturesResponseSchema,
      500: RbacErrorSchema,
    },
  })
  .post("/features", RbacController.createFeature, {
    beforeHandle: hasPermission(FEATURE_NAME, "create"),
    body: CreateFeatureSchema,
    response: {
      201: RbacCreateFeatureResponseSchema,
      400: RbacValidationErrorSchema,
      500: RbacErrorSchema,
    },
  })
  .patch("/features/:id", RbacController.updateFeature, {
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    params: FeatureParamSchema,
    body: UpdateFeatureSchema,
    response: {
      200: RbacUpdateFeatureResponseSchema,
      400: RbacValidationErrorSchema,
      500: RbacErrorSchema,
    },
  })
  .delete("/features/:id", RbacController.deleteFeature, {
    beforeHandle: hasPermission(FEATURE_NAME, "delete"),
    params: FeatureParamSchema,
    response: {
      200: RbacDeleteFeatureResponseSchema,
      500: RbacErrorSchema,
    },
  })

  // -------------------------
  // ROLES CRUD
  // -------------------------
  .get("/roles", RbacController.getAllRoles, {
    query: GetRolesQuerySchema,
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    response: {
      200: RbacGetRolesResponseSchema,
      500: RbacErrorSchema,
    },
  })
  .get("/roles/options", RbacController.getRoleOptions, {
    query: GetRolesOptionsQuerySchema,
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    response: {
      200: RbacGetRoleOptionsResponseSchema,
      500: RbacErrorSchema,
    },
  })
  .get("/roles/me", RbacController.getMyRole, {
    response: {
      200: RbacGetMyRoleResponseSchema,
      500: RbacErrorSchema,
    },
  })
  .get("/roles/:id", RbacController.getRole, {
    beforeHandle: hasPermission(FEATURE_NAME, "read"),
    params: RoleParamSchema,
    response: {
      200: RbacGetRoleResponseSchema,
      404: RbacErrorSchema,
      500: RbacErrorSchema,
    },
  })
  .post("/roles", RbacController.createRole, {
    beforeHandle: hasPermission(FEATURE_NAME, "create"),
    body: CreateRoleSchema,
    response: {
      201: RbacCreateRoleResponseSchema,
      400: RbacValidationErrorSchema,
      500: RbacErrorSchema,
    },
  })
  .patch("/roles/:id", RbacController.updateRole, {
    beforeHandle: hasPermission(FEATURE_NAME, "update"),
    params: RoleParamSchema,
    body: UpdateRoleSchema,
    response: {
      200: RbacUpdateRoleResponseSchema,
      400: RbacValidationErrorSchema,
      500: RbacErrorSchema,
    },
  })
  .delete("/roles/:id", RbacController.deleteRole, {
    beforeHandle: hasPermission(FEATURE_NAME, "delete"),
    params: RoleParamSchema,
    response: {
      200: RbacDeleteRoleResponseSchema,
      500: RbacErrorSchema,
    },
  });

export const rbac = createBaseApp({ tags: ["RBAC"] }).group("/rbac", (app) =>
  app
    .onError(({ code, error, set, locale }) => {
      if (code === "VALIDATION") {
        const issues = (error as any).all.map((issue: any) => {
          let field = "root";

          // 🛡️ Robust Path Handling
          if (Array.isArray(issue.path)) {
            field = issue.path.join(".");
          } else if (typeof issue.path === "string") {
            field = issue.path.startsWith("/")
              ? issue.path.slice(1)
              : issue.path;
          }

          if (!field) field = "root";

          return {
            field,
            message: issue.message || error.message,
          };
        });

        return errorResponse(
          set,
          400,
          { key: "common.badRequest", params: { field: "validation" } },
          issues,
          locale,
        );
      }

      if (error instanceof ForeignKeyError) {
        return errorResponse(
          set,
          400,
          { key: error.key, params: { fieldName: error.field } },
          null,
          locale,
        );
      }

      if (error instanceof UniqueConstraintError) {
        return errorResponse(
          set,
          409,
          { key: error.key, params: { field: error.field } },
          null,
          locale,
        );
      }

      if (error instanceof RecordNotFoundError) {
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
          { key: "rbac.deleteSystemRole" },
          null,
          locale,
        );
      }

      if (error instanceof UpdateSystemError) {
        return errorResponse(
          set,
          403,
          { key: "rbac.updateSystemRole" },
          null,
          locale,
        );
      }

      if (error instanceof InvalidFeatureIdError) {
        return errorResponse(
          set,
          400,
          { key: "rbac.invalidFeatureId" },
          null,
          locale,
        );
      }
    })
    .use(protectedRbac),
);
