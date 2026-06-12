# Code Style Guidelines

These are the coding style and architectural standards for the Elysia Auth Starter project.

## Imports

- Use path aliases: `@/*` for `src/*`, `@modules/*`, `@plugins/*`, `@libs/*`, `@middlewares/*`, `@utils/*`, `@generated/*`
- Place standard library imports first, then third-party libraries, then local files (absolute paths using aliases are preferred)
- ESLint auto-removes unused imports on lint/fix

## Formatting

- Prettier config: semicolons, trailing commas, no single quotes, 2-space indent, 80-char width
- Run `bun run format` before committing

## Types and Schemas

- **No `any`** - Use `unknown` or specific types instead (ESLint warns on `any`)
- Enable `strict: true` in `tsconfig.json`
- Use TypeBox (Elysia's `t` utility) for both input/validation and output/response schemas.
- Merge validation schemas and response schemas inside `schema.ts`.
- Export typed inputs from the schema using `Static<typeof ...>` (e.g., `type LoginInput = Static<typeof LoginSchema>`).

## Naming Conventions

- **Classes**: PascalCase (e.g., `AuthService`, `AuthController`, `AccountDisabledError`)
- **Functions/variables**: camelCase (e.g., `login`, `refreshToken`)
- **Constants**: SCREAMING_SNAKE_CASE for configs (e.g., `JWT_REFRESH_EXPIRES_IN`)
- **Files**: kebab-case for modules (e.g. `feature-name`), standard filenames (`index.ts`, `controller.ts`, `service.ts`, `schema.ts`)
- **Test files**: `*.test.ts` (unit) or `integration.test.ts` (integration)

## Error Handling

- Create custom error classes extending `Error` in `@/libs/exceptions`
- Use `throw new AccountDisabledError()` or `throw new UnauthorizedError()`
- Log with structured pino logger at appropriate levels (debug/warn/error)
- Global error handler catches unhandled errors and returns 500 with safe message

## Logging

- **Log in the Service Layer** - All logging must be implemented in the service layer (see `src/modules/auth/service.ts` as reference)
- Use pino logger from `@/libs/logger` - inject via method parameter: `log: Logger`
- Log levels:
  - `debug`: Method entry, operation details, parameter values
  - `info`: Successful operations (creation, updates, deletions), counts of retrieved data
  - `warn`: Security blocks, validation failures, unauthorized attempts
  - `error`: System errors, database failures, unexpected exceptions
- Include structured context: `log.info({ userId, email, count }, "message")`
- **Never log passwords, tokens, or sensitive data**
- Pattern example:
  ```typescript
  static async getUsers(params: {...}, log: Logger) {
    log.debug({ page, limit }, "Fetching users list");
    // ... database operations
    log.info({ count: users.length, total }, "Users retrieved successfully");
  }
  ```

## Architecture

Every feature-based module resides under `src/modules/[name]/` and conforms to a strict layered separation:

1. **`schema.ts`**: Contains both validation and response schemas defined via TypeBox (`t`). This is the single source of truth for request body formats and standard API response payloads.
2. **`controller.ts`**: Handles the HTTP request/response lifecycles. It accepts controllers parameters, manages cookies, calls the service layer, constructs success/error responses using response helpers, and signs JWT tokens.
3. **`service.ts`**: Handles core business logic, permissions, and Prisma database queries. Services accept a `log: Logger` context. They never touch cookies, Elysia routing context, or raw API response structures.
4. **`index.ts`**: Plugs endpoints into the Elysia application. Associates paths, methods, schemas, and rate-limiting / JWT plugins directly to their controller handlers.
5. **`locales/`**: Module-specific localization key-value translation files.

## Internationalization (i18n)

The project uses a module-based i18n structure:

**Common locales** (shared across all modules):

```
src/locales/
  en.ts    # English common + validation messages
  es.ts    # Spanish common + validation messages
  id.ts    # Indonesian common + validation messages
```

**Module-specific locales** (each module has its own):

```
src/modules/
  auth/
    locales/
      en.ts, es.ts, id.ts
```

**Using i18n in controller / response helper:**

```typescript
import { successResponse, errorResponse } from "@/libs/response";

// Success message with i18n
return successResponse(
  set,
  data,
  { key: "user.createSuccess" }, // uses module-specific translation
  201,
  undefined,
  locale,
);
```

**Frontend:** Send `Accept-Language` header with requests (e.g., `es-ES`, `id-ID`, `en`)
