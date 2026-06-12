import { t, type Static } from "elysia";
import {
  TbPaginationSchema,
  createTbResponseSchema,
  createTbErrorSchema,
  createTbPaginatedResponseSchema,
} from "@/libs/response";

/**
 * Custom schema helper for trimmed string with minLength and maxLength validation.
 */
const TrimmedStringSchema = (options?: {
  minLength?: number;
  maxLength?: number;
}) =>
  t
    .Transform(t.String())
    .Decode((val) => {
      const trimmed = val.trim();
      if (
        options?.minLength !== undefined &&
        trimmed.length < options.minLength
      ) {
        throw new Error(
          `String must be at least ${options.minLength} characters`,
        );
      }
      if (
        options?.maxLength !== undefined &&
        trimmed.length > options.maxLength
      ) {
        throw new Error(
          `String must be at most ${options.maxLength} characters`,
        );
      }
      return trimmed;
    })
    .Encode((val) => val);

export const DefaultPermissionBaseSchema = t.Object({
  canCreate: t.Optional(t.Boolean({ default: false })),
  canRead: t.Optional(t.Boolean({ default: false })),
  canUpdate: t.Optional(t.Boolean({ default: false })),
  canDelete: t.Optional(t.Boolean({ default: false })),
  canPrint: t.Optional(t.Boolean({ default: false })),
});

export const DefaultPermissionSchema = t
  .Transform(t.Union([t.Record(t.String(), t.Any()), t.Null(), t.String()]))
  .Decode((val) => {
    if (val === null || typeof val === "string") {
      throw new Error("defaultPermissions must be an object");
    }
    const checkBool = (k: string) => {
      const v = (val as any)[k];
      if (v !== undefined && typeof v !== "boolean") {
        throw new Error(`defaultPermissions.${k} must be a boolean`);
      }
      return v ?? false;
    };
    return {
      canCreate: checkBool("canCreate"),
      canRead: checkBool("canRead"),
      canUpdate: checkBool("canUpdate"),
      canDelete: checkBool("canDelete"),
      canPrint: checkBool("canPrint"),
    };
  })
  .Encode((val) => val);

export const PermissionSchema = t.Object({
  ...DefaultPermissionBaseSchema.properties,
  featureId: t.String(),
});

export const CreateRoleSchema = t.Object({
  name: TrimmedStringSchema({ minLength: 3, maxLength: 50 }),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  permissions: t.Optional(
    t
      .Transform(t.Array(PermissionSchema, { default: [] }))
      .Decode((items) => {
        if (!items) return [];
        const featureIds = items.map((p) => p.featureId);
        if (new Set(featureIds).size !== featureIds.length) {
          throw new Error("Duplicate featureId found in permissions array");
        }
        return items;
      })
      .Encode((items) => items ?? []),
  ),
});

export const CreateFeatureSchema = t.Object({
  name: TrimmedStringSchema({ minLength: 3, maxLength: 50 }),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  defaultPermissions: DefaultPermissionSchema,
});

export const UpdateRoleSchema = t.Object(
  {
    name: t.Optional(TrimmedStringSchema({ minLength: 3, maxLength: 50 })),
    description: t.Optional(t.Union([t.String(), t.Null()])),
    permissions: t.Optional(
      t
        .Transform(t.Array(PermissionSchema))
        .Decode((items) => {
          if (!items) return [];
          const featureIds = items.map((p) => p.featureId);
          if (new Set(featureIds).size !== featureIds.length) {
            throw new Error("Duplicate featureId found in permissions array");
          }
          return items;
        })
        .Encode((items) => items),
    ),
  },
  { minProperties: 1 },
);

export const UpdateFeatureSchema = t.Object(
  {
    name: t.Optional(TrimmedStringSchema({ minLength: 3, maxLength: 50 })),
    description: t.Optional(t.Union([t.String(), t.Null()])),
    defaultPermissions: t.Optional(DefaultPermissionSchema),
  },
  { minProperties: 1 },
);

export const RoleParamSchema = t.Object({
  id: t.String(),
});

export const FeatureParamSchema = t.Object({
  id: t.String(),
});

export const GetFeaturesQuerySchema = t.Object({
  ...TbPaginationSchema.properties,
  search: t.Optional(t.String()),
});

export const GetRolesQuerySchema = t.Object({
  ...TbPaginationSchema.properties,
  search: t.Optional(t.String()),
  feature: t.Optional(t.String()),
});

export const GetRolesOptionsQuerySchema = t.Object({
  ...TbPaginationSchema.properties,
  search: t.Optional(t.String()),
});

/**
 * Inferred Types
 */
export type CreateRoleInput = Static<typeof CreateRoleSchema>;
export type CreateFeatureInput = Static<typeof CreateFeatureSchema>;
export type UpdateRoleInput = Static<typeof UpdateRoleSchema>;
export type UpdateFeatureInput = Static<typeof UpdateFeatureSchema>;
export type PermissionInput = Static<typeof PermissionSchema>;

/**
 * Response model schemas
 */
export const PublicFeatureSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

export const PublicPermissionSchema = t.Object({
  featureId: t.String(),
  canCreate: t.Boolean(),
  canRead: t.Boolean(),
  canUpdate: t.Boolean(),
  canDelete: t.Boolean(),
  canPrint: t.Boolean(),
  feature: t.Object({
    id: t.String(),
    name: t.String(),
  }),
});

export const PublicRoleSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  permissions: t.Array(PublicPermissionSchema),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});

export const RoleOptionSchema = t.Object({
  id: t.String(),
  name: t.String(),
});

export const PermissionInfoSchema = t.Object({
  featureId: t.String(),
  featureName: t.String(),
  canCreate: t.Boolean(),
  canRead: t.Boolean(),
  canUpdate: t.Boolean(),
  canDelete: t.Boolean(),
  canPrint: t.Boolean(),
});

export const MyRoleResponseSchema = t.Object({
  roleName: t.String(),
  permissions: t.Array(PermissionInfoSchema),
});

/**
 * Rbac Model exports for router
 */
export const RbacGetFeaturesResponseSchema = createTbPaginatedResponseSchema(
  t.Array(PublicFeatureSchema),
);
export const RbacCreateFeatureResponseSchema =
  createTbResponseSchema(PublicFeatureSchema);
export const RbacUpdateFeatureResponseSchema =
  createTbResponseSchema(PublicFeatureSchema);
export const RbacDeleteFeatureResponseSchema =
  createTbResponseSchema(PublicFeatureSchema);

export const RbacGetRoleResponseSchema =
  createTbResponseSchema(PublicRoleSchema);
export const RbacGetRolesResponseSchema = createTbPaginatedResponseSchema(
  t.Array(t.Omit(PublicRoleSchema, ["permissions"])),
);
export const RbacGetRoleOptionsResponseSchema = createTbPaginatedResponseSchema(
  t.Array(RoleOptionSchema),
);
export const RbacGetMyRoleResponseSchema =
  createTbResponseSchema(MyRoleResponseSchema);
export const RbacCreateRoleResponseSchema =
  createTbResponseSchema(PublicRoleSchema);
export const RbacUpdateRoleResponseSchema =
  createTbResponseSchema(PublicRoleSchema);

export const RbacDeleteRoleResponseSchema = createTbResponseSchema(
  t.Object({
    id: t.String(),
    name: t.String(),
    description: t.Union([t.String(), t.Null()]),
    createdAt: t.String({ format: "date-time" }),
    updatedAt: t.String({ format: "date-time" }),
  }),
);

export const RbacErrorSchema = createTbErrorSchema(t.Null());
export const RbacValidationErrorSchema = createTbErrorSchema(
  t.Array(
    t.Object({
      path: t.String(),
      message: t.String(),
    }),
  ),
);
