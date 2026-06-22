import { t, type Static } from "elysia";
import { createResponseSchema, createErrorSchema } from "@/libs/response";

export const RoleDistributionItemSchema = t.Object({
  roleName: t.String(),
  count: t.Number(),
});

export const DashboardResponseSchema = t.Object({
  totalUsers: t.Number(),
  activeUsers: t.Number(),
  inactiveUsers: t.Number(),
  totalRoles: t.Number(),
  totalFeatures: t.Number(),
  userDistribution: t.Array(RoleDistributionItemSchema),
});

export type DashboardResponse = Static<typeof DashboardResponseSchema>;

export const DashboardResponseModelSchema = createResponseSchema(
  DashboardResponseSchema,
);
export const DashboardErrorModelSchema = createErrorSchema(t.Null());
