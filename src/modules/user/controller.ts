import { UserService } from "./service";
import { errorResponse, successResponse } from "@/libs/response";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type { CreateUserInput, UpdateUserInput } from "./schema";

export class UserController {
  static async getUsers({
    query,
    set,
    log,
    locale,
  }: {
    query: {
      page?: number;
      limit?: number;
      isActive?: boolean;
      roleId?: string;
      search?: string;
    };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const { page = 1, limit = 10, isActive, roleId, search } = query;

    const { users, pagination } = await UserService.getUsers(
      {
        page,
        limit,
        isActive,
        roleId,
        search,
      },
      log,
    );

    return successResponse(
      set,
      users,
      { key: "user.listSuccess" },
      200,
      {
        pagination,
      },
      locale,
    );
  }

  static async createUser({
    body,
    set,
    log,
    locale,
  }: {
    body: CreateUserInput;
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const data = await UserService.createUser(body, log, locale);
    return successResponse(
      set,
      data,
      { key: "user.createSuccess" },
      201,
      undefined,
      locale,
    );
  }

  static async getUser({
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
    const user = await UserService.getUser(params.id, log);
    if (!user) {
      return errorResponse(
        set,
        404,
        { key: "user.userNotFound" },
        null,
        locale,
      );
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

  static async updateUser({
    body,
    params,
    set,
    log,
    locale,
  }: {
    body: UpdateUserInput;
    params: { id: string };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const updatedUser = await UserService.updateUser(
      params.id,
      body,
      log,
      locale,
    );

    return successResponse(
      set,
      updatedUser,
      { key: "user.updateSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async deleteUser({
    params,
    user,
    set,
    log,
    locale,
  }: {
    params: { id: string };
    user: { id: string; tokenVersion: number };
    set: Context["set"];
    log: Logger;
    locale: string;
  }) {
    const deletedUser = await UserService.deleteUser(
      params.id,
      user.id,
      log,
      locale,
    );
    return successResponse(
      set,
      deletedUser,
      { key: "user.deleteSuccess" },
      200,
      undefined,
      locale,
    );
  }
}
