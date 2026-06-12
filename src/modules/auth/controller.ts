import { AuthService } from "./service";
import { errorResponse, successResponse } from "@/libs/response";
import { env } from "@/config/env";
import { parseDuration } from "@/utils/time";
import type { Context } from "elysia";
import type { Logger } from "pino";
import type { LoginInput } from "./schema";

const REFRESH_TOKEN_MAX_AGE = parseDuration(env.JWT_REFRESH_EXPIRES_IN || "7d");
const isProduction = env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
  domain: isProduction ? undefined : undefined,
};

const secureCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
};

interface JwtSignVerify {
  sign: (
    payload: Record<string, string | number | undefined>,
  ) => Promise<string>;
  verify: (token: string) => Promise<any>;
}

export class AuthController {
  static async login({
    body,
    set,
    cookie,
    log,
    accessJwt,
    refreshJwt,
    locale,
  }: {
    body: LoginInput;
    set: Context["set"];
    cookie: Context["cookie"];
    log: Logger;
    accessJwt: JwtSignVerify;
    refreshJwt: JwtSignVerify;
    locale: string;
  }) {
    const user = await AuthService.login(body, log, locale);

    if (!user) {
      return errorResponse(
        set,
        401,
        { key: "auth.invalidCredentials" },
        null,
        locale,
      );
    }

    const tokenId = await AuthService.createRefreshToken(user.id);

    const accessToken = await accessJwt.sign({
      sub: user.id,
      tv: user.tokenVersion,
    });

    const refreshToken = await refreshJwt.sign({
      sub: user.id,
      tv: user.tokenVersion,
      jti: tokenId,
    });

    cookie.refresh_token.set({
      value: refreshToken,
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

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

  static async refresh({
    body,
    set,
    cookie,
    log,
    accessJwt,
    refreshJwt,
    locale,
  }: {
    body: { refresh_token?: string };
    set: Context["set"];
    cookie: Context["cookie"];
    log: Logger;
    accessJwt: JwtSignVerify;
    refreshJwt: JwtSignVerify;
    locale: string;
  }) {
    const incomingRefreshToken =
      cookie.refresh_token.value || body.refresh_token;

    if (!incomingRefreshToken) {
      return errorResponse(
        set,
        400,
        { key: "auth.tokenRequired" },
        null,
        locale,
      );
    }

    const payload = await refreshJwt.verify(incomingRefreshToken as string);

    if (
      !payload ||
      !payload.jti ||
      typeof payload.sub !== "string" ||
      typeof payload.tv !== "number"
    ) {
      return errorResponse(
        set,
        401,
        { key: "auth.refreshFailed" },
        null,
        locale,
      );
    }

    const data = await AuthService.refresh({
      refreshToken: payload.jti,
      userId: payload.sub,
      tokenVersion: payload.tv,
      log,
      locale,
    });

    const newAccessToken = await accessJwt.sign({
      sub: data.user.id,
      tv: data.tokenVersion,
    });

    const newRefreshToken = await refreshJwt.sign({
      sub: data.user.id,
      tv: data.tokenVersion,
      jti: data.refreshToken,
    });

    cookie.refresh_token.set({
      value: newRefreshToken,
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return successResponse(
      set,
      {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        user: data.user,
      },
      { key: "auth.refreshSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async logout({
    body,
    set,
    log,
    cookie,
    refreshJwt,
    locale,
  }: {
    body: { refresh_token?: string };
    set: Context["set"];
    log: Logger;
    cookie: Context["cookie"];
    refreshJwt: JwtSignVerify;
    locale: string;
  }) {
    const incomingRefreshToken =
      cookie.refresh_token.value || body.refresh_token;

    if (incomingRefreshToken) {
      const payload = await refreshJwt.verify(incomingRefreshToken as string);

      if (payload && payload.jti && typeof payload.sub === "string") {
        await AuthService.logout({
          refreshToken: payload.jti,
          userId: payload.sub,
          log,
        });
      }
    }

    cookie.refresh_token.set({
      value: "",
      ...secureCookieOptions,
      maxAge: 0,
    });

    return successResponse(
      set,
      null,
      { key: "auth.logoutSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async logoutAll({
    user,
    body,
    log,
    cookie,
    set,
    refreshJwt,
    locale,
  }: {
    user: { id: string; tokenVersion: number };
    body: { refresh_token?: string };
    log: Logger;
    cookie: Context["cookie"];
    set: Context["set"];
    refreshJwt: JwtSignVerify;
    locale: string;
  }) {
    const incomingRefreshToken =
      cookie.refresh_token.value || body.refresh_token;

    if (!incomingRefreshToken) {
      return errorResponse(
        set,
        400,
        { key: "auth.tokenRequired" },
        null,
        locale,
      );
    }

    const payload = await refreshJwt.verify(incomingRefreshToken as string);

    if (!payload || !payload.jti || typeof payload.sub !== "string") {
      return errorResponse(
        set,
        401,
        { key: "auth.invalidToken" },
        null,
        locale,
      );
    }

    // This prevents User A from using their Access Token to revoke User B's session
    if (payload.sub !== user.id) {
      return errorResponse(
        set,
        403,
        { key: "auth.invalidToken" },
        null,
        locale,
      );
    }

    await AuthService.logoutAll({
      userId: user.id,
      requestingTokenId: payload.jti,
      log,
      locale,
    });

    cookie.refresh_token.set({
      value: "",
      ...secureCookieOptions,
      maxAge: 0,
    });

    return successResponse(
      set,
      null,
      { key: "auth.logoutAllSuccess" },
      200,
      undefined,
      locale,
    );
  }

  static async me({
    user,
    log,
    set,
    locale,
  }: {
    user: { id: string; tokenVersion: number };
    log: Logger;
    set: Context["set"];
    locale: string;
  }) {
    const data = await AuthService.me(user.id, log, locale);

    return successResponse(
      set,
      {
        id: data.id,
        email: data.email,
        name: data.name,
        roleName: data.roleName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
      { key: "user.getSuccess" },
      200,
      undefined,
      locale,
    );
  }
}
