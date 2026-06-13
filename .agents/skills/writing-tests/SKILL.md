---
name: writing-tests
description: Write integration tests for new or existing endpoints in this Elysia + Bun project. Use when asked to "write tests", "add test coverage", "test this endpoint", or when implementing a new feature that needs test files created under src/__tests__/.
---

# Writing Tests

**Announce at start:** "I'm using the writing-tests skill to implement the test suite."

## Overview

This project uses `bun:test` for integration testing against a real PostgreSQL database. All tests are colocated under `src/__tests__/<feature>/` as `*.test.ts` files. No mocking of the database or the Elysia app is used — tests hit the real `app.handle()` method.

Read the **[test-patterns reference](./references/test-patterns.md)** before writing any tests. It documents every helper available in `test_utils.ts` with real usage examples.

---

## Test Environment

> **Critical:** Tests run against a **separate test database**, not the development database.

The test database is configured via `.env.test` (separate from `.env`). The test runner picks it up automatically because the `test:setup` command injects it:

```bash
# From package.json — what bun run test:setup executes:
dotenv -e .env.test -- prisma db push
```

**You MUST run `bun run test:setup` before executing any tests** — including after:
- First cloning / setting up the project
- Any change to `prisma/schema.prisma`
- Any new migration being applied

Skipping this step causes tests to fail with schema mismatch or connection errors against the wrong database.

```bash
# Always run this first
bun run test:setup

# Then run your tests
bun test <pattern>
```

---

## Step-by-Step Process

### 1. Identify the Feature and Endpoint(s)

- Find the module under `src/modules/<feature-name>/` to understand the route, its handler, and its service.
- Note: the HTTP method, URL path, request body/params, and expected success status codes.
- Note: which RBAC permission (feature + action) gates the endpoint, if any.

### 2. Locate or Create the Test File

Test files live at:
```
src/__tests__/<feature>/<operation>.test.ts
```

Examples:
- `src/__tests__/users/create.test.ts`     → `POST /users`
- `src/__tests__/rbac/roles/list.test.ts`  → `GET /rbac/roles`
- `src/__tests__/auth/login.test.ts`       → `POST /auth/login`

For nested resources (e.g., `rbac/roles`, `rbac/features`), mirror the module nesting.

### 3. Use the Standard File Skeleton

Every test file MUST follow this structure exactly:

```typescript
import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { app } from "@/server";
import { prisma } from "@/libs/prisma";
import {
  resetDatabase,
  createTestUser,
  createAuthenticatedUser,
  createTestRoleWithPermissions,
  randomIp,
  // ... other helpers as needed
} from "../test_utils"; // adjust relative path depth

describe("<METHOD> /<path>", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ... test cases
});
```

**Critical rules:**
- `resetDatabase()` is called in `beforeEach` (not `beforeAll`) to guarantee isolation between tests.
- `prisma.$disconnect()` is called in `afterAll` to cleanly close the connection.
- Always `await resetDatabase()` — the missing `await` is a known gotcha (see existing `login.test.ts` line 8).
- Every `app.handle()` request MUST include the `"x-forwarded-for": randomIp()` header (rate limiter requires an IP).

### 4. Write the Test Cases

Cover these categories in order (skip any that don't apply):

#### Auth & Guard Tests (always first)
1. **Unauthenticated** → `401` (no token)
2. **Expired token** → `401` (use `jwt.sign` with `expiresIn: "-1h"`)
3. **Invalid token** → `401` (use `"Bearer invalid-token"`)
4. **Disabled account** → `403` (set `isActive: false` on user via `prisma.user.update`)

#### RBAC Permission Tests (for guarded endpoints)
5. **No permissions at all** → `403`
6. **Wrong action** (e.g., has `read` but endpoint needs `create`) → `403`
7. **Wrong feature** (has `create` on different feature) → `403`
8. **Correct permission** → success status (e.g., `200`, `201`)

#### Validation Tests
9. **Missing required fields** → `400`
10. **Invalid field format** (bad email, too-short password, etc.) → `400`
11. **Empty string for required field** → `400`

#### Business Logic Tests
12. **Happy path** — assert response status, `body.data` shape, and that sensitive fields (`password`, etc.) are absent
13. **Conflict** (duplicate unique field) → `409`
14. **Not found** (resource doesn't exist) → `404`
15. **Edge cases** specific to the feature (e.g., SuperAdmin uniqueness, pagination, etc.)

#### Data Integrity Tests (where applicable)
16. Verify DB side-effects with direct `prisma` queries (e.g., record was created, token was stored, field was updated)
17. Verify sensitive data is NOT in the response (e.g., `expect(body.data.password).toBeUndefined()`)

### 5. Use Helpers Correctly

See **[test-patterns reference](./references/test-patterns.md)** for the full API of each helper.

**Quick reference — most-used patterns:**

```typescript
// Unauthenticated request (no headers needed beyond IP + content-type)
const res = await app.handle(
  new Request("http://localhost/users", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": randomIp() },
    body: JSON.stringify({ ... }),
  }),
);

// Authenticated request using createAuthenticatedUser
const { authHeaders, user, token } = await createAuthenticatedUser();
// authHeaders = { Authorization: "Bearer <token>", "content-type": "application/json" }
const res = await app.handle(
  new Request("http://localhost/users", {
    method: "GET",
    headers: { ...authHeaders, "x-forwarded-for": randomIp() },
  }),
);

// Grant a permission to the logged-in user's role ("TestUser")
await createTestRoleWithPermissions("TestUser", [
  { featureName: "user_management", action: "create" },
]);

// Expired token
import jwt from "jsonwebtoken";
const expiredToken = jwt.sign(
  { userId: user.id, tokenVersion: user.tokenVersion },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "-1h" },
);
```

### 6. Run and Verify

**Always** sync the test DB before running tests:

```bash
# Step 1 — push schema to the test DB (uses .env.test)
bun run test:setup

# Step 2 — run your new tests
bun test <feature>/<operation>

# Or run all tests for a module
bun test <feature>

# Or the full suite
bun test
```

The `test:setup` command is idempotent — it is safe to re-run at any time and costs only a few seconds.

---

## Checklist Before Finishing

- [ ] `bun run test:setup` was run before executing any tests
- [ ] File lives in `src/__tests__/<feature>/` with `.test.ts` extension
- [ ] `beforeEach` calls `await resetDatabase()`
- [ ] `afterAll` calls `await prisma.$disconnect()`
- [ ] Every request includes `"x-forwarded-for": randomIp()`
- [ ] Auth guard tests are present (401 unauthenticated, 403 disabled account)
- [ ] RBAC tests cover wrong permission and correct permission paths
- [ ] Validation tests cover missing/invalid fields
- [ ] Happy path test asserts `body.data` shape and absence of sensitive fields
- [ ] Relative import path to `test_utils` is correct for the nesting depth
- [ ] `bun test <feature>` passes with no failures
