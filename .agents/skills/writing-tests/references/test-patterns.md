# Test Patterns Reference

Full API documentation for all helpers in `src/__tests__/test_utils.ts`, with real usage examples drawn from the existing test suite.

---

## Test Environment

Tests run against a **dedicated test database** — separate from the dev database — configured in `.env.test`.

| File | Purpose |
|------|---------|
| `.env` | Development database (`DATABASE_URL`) |
| `.env.test` | Test database (`DATABASE_URL` pointing to a different DB) |

**Always run `bun run test:setup` before executing any tests.** This command pushes the current Prisma schema to the test DB using the `.env.test` environment:

```bash
# What test:setup does (from package.json):
dotenv -e .env.test -- prisma db push

# Required before: first setup, schema changes, new migrations
bun run test:setup

# Then run tests normally
bun test
bun test <feature>
bun test <feature>/<operation>.test.ts
```

The test DB is **not** updated automatically when `prisma/schema.prisma` changes. If you skip `bun run test:setup` after a schema change, tests will fail with column/table not found errors.

---

## Available Helpers

### `resetDatabase()`

Deletes all rows from every table in dependency order. Call this in `beforeEach` — **always with `await`**.

```typescript
beforeEach(async () => {
  await resetDatabase(); // ✅ correct
});
```

> **Gotcha:** `resetDatabase()` without `await` returns a Promise that runs after the test starts, corrupting state. This bug already exists in `login.test.ts:8` — do not repeat it.

Tables cleared (in order):
1. `refreshToken`
2. `user`
3. `roleFeature`
4. `role`
5. `feature`

---

### `createTestUser(overrides?)`

Creates a single user in the DB. Returns the Prisma `User` record.

**Defaults:**
| Field    | Default value       |
|----------|---------------------|
| `id`     | `"test-user-id"`    |
| `email`  | `"test@test.com"`   |
| `name`   | `"John Doe"`        |
| `password` | `"password123"` (hashed automatically) |
| `roleId` | Auto-created `"TestUser"` role |
| `isActive` | `true` (Prisma schema default) |

**Usage:**

```typescript
// Basic — uses all defaults
const user = await createTestUser();

// Override email only
const user = await createTestUser({ email: "alice@test.com" });

// Override password (plain text — it's hashed internally)
const user = await createTestUser({ email: "admin@test.com", password: "MySecret!" });

// Create a disabled user
const user = await createTestUser({ email: "disabled@test.com", isActive: false });

// Assign a specific role
const role = await prisma.role.create({ data: { name: "Manager" } });
const user = await createTestUser({ email: "mgr@test.com", roleId: role.id });
```

> **Note:** The default `id` is always `"test-user-id"`. If you need two users in the same test, pass a unique `id` override for the second one, or use `prisma.user.create` directly.

---

### `createAuthenticatedUser(userOverrides?)`

Creates a user, logs them in via `POST /auth/login`, and returns their JWT access token plus convenience headers.

**Returns:**
```typescript
{
  user: User,            // the Prisma User record
  token: string,         // raw JWT access token string
  authHeaders: {
    Authorization: "Bearer <token>",
    "content-type": "application/json",
  }
}
```

**Usage:**

```typescript
// Basic — authenticated user with no special permissions
const { authHeaders, user, token } = await createAuthenticatedUser();

// Use in a request
const res = await app.handle(
  new Request("http://localhost/users", {
    headers: { ...authHeaders, "x-forwarded-for": randomIp() },
  }),
);

// Authenticated user with a custom email
const { authHeaders } = await createAuthenticatedUser({ email: "ops@test.com" });

// Authenticated user with a disabled account (to test forbidden state after login)
const { authHeaders, user } = await createAuthenticatedUser();
await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
// Now use authHeaders — the server should return 403
```

> **Pattern:** Always call `createAuthenticatedUser()` first, then call `createTestRoleWithPermissions("TestUser", [...])` to grant permissions to that user's role. The order matters — the role must exist before you add permissions.

---

### `createTestRoleWithPermissions(roleName, permissions[])`

Upserts a role and assigns it a set of `roleFeature` permission rows.

**Parameters:**
- `roleName` — the role's `name` field (default: `"TestUser"`, which matches the role created by `createTestUser` / `createAuthenticatedUser`)
- `permissions` — array of `{ featureName: string, action: "read" | "create" | "update" | "delete" | "print" }`

**Usage:**

```typescript
// Grant user_management create to the "TestUser" role (used by createAuthenticatedUser)
await createTestRoleWithPermissions("TestUser", [
  { featureName: "user_management", action: "create" },
]);

// Grant multiple permissions to one role
await createTestRoleWithPermissions("TestUser", [
  { featureName: "user_management", action: "read" },
  { featureName: "user_management", action: "create" },
]);

// Create a role for a second user
const role = await createTestRoleWithPermissions("ManagerRole", [
  { featureName: "order_management", action: "read" },
]);
const managerUser = await createTestUser({ email: "mgr@test.com", roleId: role.id });
```

> **Important:** This helper uses `upsert` for the role, so calling it twice with the same `roleName` overwrites the permissions (it deletes existing `roleFeature` rows first). This is intentional — it allows test cases to reconfigure permissions mid-test.

---

### `createTestFeature(name?, overrides?)`

Upserts a single feature record.

**Usage:**

```typescript
const feature = await createTestFeature("Settings");
// feature.id is now available for building roleFeature records manually

const feature = await createTestFeature("Analytics", { description: "Custom desc" });
```

---

### `randomIp()`

Returns a random IP like `"10.0.0.42"`. Required on every `app.handle()` call because the rate limiter plugin requires a client IP.

```typescript
headers: { "x-forwarded-for": randomIp() }
```

---

### `seedTestUsers()`

Inserts a fixed set of users with two roles (`TestAdminRole`, `TestEmployeeRole`) for testing list/search/pagination endpoints.

```typescript
const { roleAdmin, roleEmployee } = await seedTestUsers();
// Creates: Alice Johnson (admin), Bob Smith (employee, active), Charlie Disabled (employee, inactive)
```

---

### `seedTestFeatures()`

Inserts four features: `user_management`, `order_management`, `report_management`, `audit_log`.

```typescript
await seedTestFeatures();
// Useful before testing GET /rbac/features list endpoint
```

---

### `seedTestRoles()`

Inserts five named roles: `AdminUser`, `ManagerUser`, `EditorUser`, `ViewerUser`, `AuditorUser`.

```typescript
await seedTestRoles();
// Useful before testing GET /rbac/roles list/search endpoint
```

---

## Expired Token Pattern

Use `jsonwebtoken` (already installed) to forge a token with a past expiry:

```typescript
import jwt from "jsonwebtoken";

const { user } = await createAuthenticatedUser();

const expiredToken = jwt.sign(
  { userId: user.id, tokenVersion: user.tokenVersion },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "-1h" }, // past time = already expired
);

const res = await app.handle(
  new Request("http://localhost/users", {
    headers: {
      Authorization: `Bearer ${expiredToken}`,
      "x-forwarded-for": randomIp(),
    },
  }),
);
expect(res.status).toBe(401);
```

---

## Disabled Account Pattern

```typescript
const { authHeaders, user } = await createAuthenticatedUser();
// Grant any permission so it's not blocked by RBAC first
await createTestRoleWithPermissions("TestUser", [
  { featureName: "user_management", action: "create" },
]);

// Disable the account
await prisma.user.update({
  where: { id: user.id },
  data: { isActive: false },
});

const res = await app.handle(
  new Request("http://localhost/users", {
    method: "POST",
    headers: { ...authHeaders, "x-forwarded-for": randomIp() },
    body: JSON.stringify({}),
  }),
);
expect(res.status).toBe(403);
```

---

## Checking DB Side Effects

After a mutating request, query Prisma directly to verify the DB was updated correctly:

```typescript
// Verify the refresh token was stored
const refreshTokens = await prisma.refreshToken.findMany({
  where: { userId: user.id },
});
expect(refreshTokens.length).toBeGreaterThan(0);

// Verify a user was created with correct fields
const created = await prisma.user.findUnique({ where: { email: "new@test.com" } });
expect(created?.isActive).toBe(true);
expect(created?.password).not.toBe("Password123!"); // must be hashed
```

---

## Relative Import Paths

The depth of the relative path to `test_utils` depends on nesting:

| Test file location                          | Import path           |
|---------------------------------------------|-----------------------|
| `src/__tests__/auth/login.test.ts`          | `"../test_utils"`     |
| `src/__tests__/users/create.test.ts`        | `"../test_utils"`     |
| `src/__tests__/rbac/roles/create.test.ts`   | `"../../test_utils"`  |
| `src/__tests__/rbac/features/list.test.ts`  | `"../../test_utils"`  |
