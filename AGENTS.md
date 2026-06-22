# Agent Guidelines for MSME Revenue Summary API

Elysia-based backend API for MSME revenue summary using AI. Powered by Bun, Prisma ORM, PostgreSQL, and a FastAPI companion service.

## Setup & Bootstrap

Before executing any development or test commands, ensure your environment is set up:
1. **Install Dependencies**: `bun install`
2. **Environment Variables**: `cp .env.example .env` and configure `DATABASE_URL` and `MINI_MODEL_URL` (and `.env.test` for testing)
3. **Generate Prisma Client**: `bun run prisma:generate` (creates output in `generated/prisma` and `generated/prismabox`)
4. **Seed Database**: `bun run db:reset` or `bun run prisma:migrate`

---

## Commands

```bash
# Development
bun run dev                    # Start dev server with hot reload

# Build
bun run build                  # Build the production server bundle
bun run start                  # Start production server from bundle (dist/server.js)

# Database
bun run prisma:generate        # Generate Prisma client and Typebox types
bun run prisma:migrate         # Apply migrations and generate types (dev)
bun run prisma:deploy          # Deploy migrations (production)
bun run prisma:reset           # Reset database & seed (dev)

# Testing
bun test                       # Run all tests
bun test unit                  # Run unit tests
bun test int                   # Run integration tests
bun run test:setup             # Setup/Push schema to the test DB
bun test <pattern>             # Run test matching a pattern/file (e.g. `bun test auth`)

# Linting & Formatting
bun run lint                   # Run ESLint check
bun run lint:fix               # Autofix ESLint issues
bun run format                 # Format files with Prettier
bun run prepare                # Configure Husky git hooks
```

---

## Gotchas

- **External AI Model Dependency**: The AI revenue computation relies on an external FastAPI service (`MINI_MODEL_URL`).
  - *Trigger*: Writing or testing logic that hits the revenue computation endpoint.
  - *Corrective Action*: Be aware that `process.env.NODE_ENV === "test"` automatically skips the network call and returns mock data. In `development`, it falls back to mock data if FastAPI is unreachable. Do not manually mock the `fetch` call in tests, as the service handles it natively.
- **Refresh Token Reuse Alert**: When a revoked refresh token is reused, **YOU MUST** revoke all other tokens for that user and increment `tokenVersion` to prevent brute-force attacks.
  - *Trigger*: Reused token detected in `AuthService.refresh`
  - *Corrective Action*: Run both updates inside a transaction:
    ```typescript
    await prisma.$transaction([
      prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } }),
      prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })
    ]);
    ```
- **Custom Prisma Output Directory**: The Prisma client and Prismabox schemas are generated into a non-standard custom directory (`generated/prisma` and `generated/prismabox`).
  - *Trigger*: Importing Prisma models or classes
  - *Corrective Action*: **NEVER** import directly from the global `@prisma/client`. Always import from the generated alias paths: `@generated/prisma` or `@generated/prismabox`.
- **Never Log Sensitive Information**: Services accept a `log: Logger` context.
  - *Trigger*: Writing `log.debug()`, `log.info()`, `log.warn()`, or `log.error()` statements
  - *Corrective Action*: **NEVER** include raw passwords, JWT tokens, keys, or secrets in logged strings or contextual objects.
- **Test DB Out of Sync**: Schema changes are not automatically applied to the test database.
  - *Trigger*: Modifying `prisma/schema.prisma` followed by running tests
  - *Corrective Action*: Run `bun run test:setup` before executing `bun test` to align the test DB schema.
- **Accept-Language Localization**: Success/error response wrappers are dynamic and rely on localization.
  - *Trigger*: Returning an API response with `successResponse()` or `errorResponse()`
  - *Corrective Action*: Always extract `locale` from the Elysia context (`locale`) and pass it as the final parameter to formatting helpers.

---

## Conventions

- **Injected Service Logging**: All business logic and operations logging **MUST** occur in the service layer, not in route files. Always inject a `log: Logger` argument into service methods.
- **Strict Typing**: Set `"strict": true` in TypeScript configs. **NEVER** use `any`; use `unknown` or concrete TypeScript types.
- **Feature-based Modules**: Organise modules by domain feature under `src/modules/[feature-name]/`.

---

## References

For deep-dives on patterns, standards, and step-by-step templates:
- **Code Style & i18n Guidelines**: [.agents/skills/code-review/references/code-style.md](.agents/skills/code-review/references/code-style.md)
- **Testing & Test DB Setup**: [.agents/skills/code-review/references/testing.md](.agents/skills/code-review/references/testing.md)
- **Writing Integration Tests**: [.agents/skills/writing-tests/SKILL.md](.agents/skills/writing-tests/SKILL.md) / [test-patterns reference](.agents/skills/writing-tests/references/test-patterns.md)
- **Feature Implementation Walkthrough**: [.agents/skills/writing-plans/references/feature-template.md](.agents/skills/writing-plans/references/feature-template.md) / [executing-plans version](.agents/skills/executing-plans/references/feature-template.md)
