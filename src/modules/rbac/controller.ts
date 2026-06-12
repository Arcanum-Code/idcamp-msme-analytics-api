import { RbacService } from "./service";
import { successResponse } from "@/libs/response";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type {
  CreateFeatureInput,
  UpdateFeatureInput,
  CreateRoleInput,
  UpdateRoleInput,
} from "./schema";

export class RbacController {
  // -------------------------
  // FEATURES CRUD
  // -------------------------
  static async getAllFeatures({
    query,
    set,
    log,
    locale,
  }: {
    query: {
      page?: number;
      limit?: number;
      search?: string;
    };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const { page = 1, limit = 10, search } = query;

    const { features, pagination } = await RbacService.getAllFeatures(
      {
        page,
        limit,
        search,
      },
      log,
    );

    return successResponse(
      set,
      features,
      { key: "rbac.featureNotFound" },
      200,
      {
        pagination,
      },
      locale,
    );
  }

  static async createFeature({
    body,
    set,
    log,
    locale,
  }: {
    body: CreateFeatureInput;
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const feature = await RbacService.createFeature(body, log);
    return successResponse(
      set,
      feature,
      { key: "rbac.createFeatureSuccess" },
      201,
      undefined,
      locale,
    );
  }

  static async updateFeature({
    params,
    body,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    body: UpdateFeatureInput;
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const feature = await RbacService.updateFeature(params.id, body, log);
    return successResponse(
      set,
      feature,
      { key: "rbac.updateFeatureSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async deleteFeature({
    params,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const deletedFeature = await RbacService.deleteFeature(params.id, log);
    return successResponse(
      set,
      deletedFeature,
      { key: "rbac.deleteFeatureSuccess" },
      200,
      undefined,
      locale,
    );
  }

  // -------------------------
  // ROLES CRUD
  // -------------------------
  static async getAllRoles({
    query,
    set,
    log,
    locale,
  }: {
    query: {
      page?: number;
      limit?: number;
      search?: string;
      feature?: string;
    };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const { page = 1, limit = 10, search, feature } = query;

    const { roles, pagination } = await RbacService.getAllRoles(
      {
        page,
        limit,
        search,
        feature,
      },
      log,
    );

    return successResponse(
      set,
      roles,
      { key: "rbac.createRoleSuccess" },
      200,
      {
        pagination,
      },
      locale,
    );
  }

  static async getRoleOptions({
    query,
    set,
    log,
    locale,
  }: {
    query: {
      page?: number;
      limit?: number;
      search?: string;
    };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const { page = 1, limit = 10, search } = query;
    const { roles, pagination } = await RbacService.getRoleOptions(
      {
        page,
        limit,
        search,
      },
      log,
    );
    return successResponse(
      set,
      roles,
      { key: "rbac.createRoleSuccess" },
      200,
      {
        pagination,
      },
      locale,
    );
  }

  static async getRole({
    params,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const role = await RbacService.getRole(params.id, log);
    return successResponse(
      set,
      role,
      { key: "rbac.roleNotFound" },
      200,
      undefined,
      locale,
    );
  }

  static async getMyRole({
    user,
    set,
    log,
    locale,
  }: {
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const myRole = await RbacService.getMyRole(user.id, log);
    return successResponse(
      set,
      myRole,
      { key: "rbac.roleNotFound" },
      200,
      undefined,
      locale,
    );
  }

  static async createRole({
    body,
    set,
    log,
    locale,
  }: {
    body: CreateRoleInput;
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const newRole = await RbacService.createRole(body, log);

    return successResponse(
      set,
      newRole,
      { key: "rbac.createRoleSuccess" },
      201,
      undefined,
      locale,
    );
  }

  static async updateRole({
    params,
    body,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    body: UpdateRoleInput;
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const updatedRole = await RbacService.updateRole(params.id, body, log);
    return successResponse(
      set,
      updatedRole,
      { key: "rbac.updateRoleSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async deleteRole({
    params,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const deletedRole = await RbacService.deleteRole(params.id, log);
    return successResponse(
      set,
      deletedRole,
      { key: "rbac.deleteRoleSuccess" },
      200,
      undefined,
      locale,
    );
  }
}
