import { Elysia, type ElysiaConfig } from "elysia";
import { loggerMiddleware } from "@/middleware/logger";
import { authMiddleware } from "@/middleware/auth";
import { i18nMiddleware } from "@/middleware/i18n";
import { errorResponse } from "./response";
import { AccountDisabledError, UnauthorizedError } from "./exceptions";

/**
 * BASE APP
 * Use this for public routes (Login, Register, Webhooks, Health)
 * - Includes: Logger, Error Handling (You can add it in here)
 * - Excludes: Auth checks
 */
export const createBaseApp = <Prefix extends string = "">(
  config?: ElysiaConfig<Prefix>,
) =>
  new Elysia(config)
    .use(i18nMiddleware)
    .onError(({ code, error, set, locale }) => {
      if (
        code === "UNKNOWN" &&
        (error.message.startsWith("String must be") ||
          error.message.includes("Duplicate featureId") ||
          error.message.includes("defaultPermissions must be") ||
          error.message.includes("defaultPermissions."))
      ) {
        let field = "name";
        if (error.message.includes("Duplicate featureId")) {
          field = "permissions";
        } else if (error.message.includes("defaultPermissions")) {
          field = "defaultPermissions";
        }
        return errorResponse(
          set,
          400,
          { key: "common.badRequest", params: { field: "validation" } },
          [
            {
              field,
              message: error.message,
            },
          ],
          locale,
        );
      }

      if (code === "VALIDATION") {
        const issues = error.all.map((issue: any) => {
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

      if (error instanceof UnauthorizedError) {
        const key =
          (error as unknown as { key: string }).key || "common.unauthorized";
        return errorResponse(set, 401, { key }, null, locale);
      }

      if (error instanceof AccountDisabledError) {
        const key =
          (error as unknown as { key: string }).key || "auth.accountDisabled";
        return errorResponse(set, 403, { key }, null, locale);
      }
    })
    .use(loggerMiddleware)
    .as("scoped");

/**
 * PROTECTED APP
 * Use this for private routes (Profile, Dashboard, Payments)
 * - Includes: Everything in Base App + Auth Checks
 * - Result: 'user' is guaranteed to exist in context
 */
export const createProtectedApp = <Prefix extends string = "">(
  config?: ElysiaConfig<Prefix>,
) =>
  createBaseApp(config)
    .guard({
      detail: {
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
    })
    .use(authMiddleware)
    .as("scoped");
