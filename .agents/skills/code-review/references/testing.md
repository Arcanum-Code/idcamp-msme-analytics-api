# Testing Guidelines

This document outlines the testing strategy, frameworks, and patterns used in the Elysia Auth Starter project.

## Testing Stack

- **Framework**: `bun:test`
- **Database**: Real PostgreSQL instance (no database mocking is allowed)
- **Test setup**: Database cleaned and reset between runs to guarantee test isolation

## Test Commands

```bash
# Run all tests
bun test

# Run only unit tests
bun test unit

# Run only integration tests
bun test integration

# Run a single test file
bun test auth/unit.test.ts

# Run all tests matching a specific directory
bun test auth

# Bootstrap/Push schema to test DB
dotenv -e .env.test -- prisma db push
```

## Testing Patterns

- Use `beforeEach()` to reset database state between tests.
- Use `describe()` for grouping, and `it()` or `test()` for individual cases.
- Place test files in `src/__tests__/[feature]/` named `*.test.ts` (unit) or `integration.test.ts` (integration).
- Import test utilities from `src/__tests__/test_utils.ts`:
  - `getAuthToken()` - Retrieve a valid JWT token for authenticated requests
  - `resetDatabase()` - Reset database state between test runs

## i18n Testing

Create explicit internationalization tests in `src/__tests__/i18n/` to ensure headers and localized messages are correctly respected:

- `auth.test.ts` - Test auth endpoint i18n
- `user.test.ts` - Test user endpoint i18n
- `rbac.test.ts` - Test RBAC endpoint i18n
- `dashboard.test.ts` - Test dashboard endpoint i18n
- `health.test.ts` - Test health endpoint i18n

### Example i18n Test Case

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "@/app";
import { resetDatabase, createTestUser, randomIp } from "@tests/test_utils";

describe("POST /auth/login - Login i18n", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("should return Spanish message when Accept-Language is es", async () => {
    await createTestUser({ email: "test@test.com" });

    const response = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept-language": "es",
          "x-forwarded-for": randomIp(),
        },
        body: JSON.stringify({
          email: "test@test.com",
          password: "wrongpassword",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.message).toBe("Email o contraseña inválidos");
  });
});
```
