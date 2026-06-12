import { t, type Static } from "elysia";
import { createTbResponseSchema, createTbErrorSchema } from "@/libs/response";

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

export const DashboardResponseModelSchema = createTbResponseSchema(
  DashboardResponseSchema,
);
export const DashboardErrorModelSchema = createTbErrorSchema(t.Null());
