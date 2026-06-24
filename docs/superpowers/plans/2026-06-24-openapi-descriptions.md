# OpenAPI Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive OpenAPI documentation for all API groups and individual endpoints.

**Architecture:** We will update the global Swagger configuration to include missing module tags (Reports, Uploads), and then systematically modify the Elysia route definitions across all modules to inject the `detail.description` property.

**Tech Stack:** Bun, ElysiaJS, @elysiajs/swagger

---

### Task 1: Update OpenAPI Plugin Configuration

**Files:**
- Modify: `src/plugins/openapi.ts`

- [ ] **Step 1: Add missing tags for Reports and Uploads**

In `src/plugins/openapi.ts`, add the "Reports" and "Uploads" tags to the `tags` array inside the `documentation` configuration.

```typescript
      {
        name: "Reports",
        description:
          "Report generation and summary endpoints. Handles AI-powered revenue summarization and reporting.",
      },
      {
        name: "Uploads",
        description:
          "File upload and data mapping endpoints. Supports uploading MSME data files and mapping columns.",
      },
```

### Task 2: Add OpenAPI descriptions to Auth Module

**Files:**
- Modify: `src/modules/auth/index.ts`

- [ ] **Step 1: Add `detail.description` to Auth endpoints**

Update the `publicAuth` and `protectedAuth` endpoint configurations in `src/modules/auth/index.ts` to include descriptions:

```typescript
// For /login
    detail: {
      description: "Authenticate user and receive access and refresh tokens.",
    },

// For /refresh
    detail: {
      description: "Refresh access token using a valid refresh token.",
    },

// For /logout
    detail: {
      description: "Logout current device by invalidating the refresh token.",
    },

// For /logout/all
    detail: {
      description: "Logout all devices by invalidating all refresh tokens for the user.",
    },

// For /me
    detail: {
      description: "Get profile information of the currently authenticated user.",
    },
```

### Task 3: Add OpenAPI descriptions to Dashboard Module

**Files:**
- Modify: `src/modules/dashboard/index.ts`

- [ ] **Step 1: Add `detail.description` to Dashboard endpoints**

Update the `protectedDashboard` endpoint configuration in `src/modules/dashboard/index.ts`:

```typescript
// For /
    detail: {
      description: "Retrieve dashboard statistics including users, roles, and feature counts.",
    },
```

### Task 4: Add OpenAPI descriptions to Health Module

**Files:**
- Modify: `src/modules/health/index.ts`

- [ ] **Step 1: Add `detail.description` to Health endpoints**

Update the `/health` endpoint configuration in `src/modules/health/index.ts`:

```typescript
// For /health
    detail: {
      description: "Check the health status of the API service and its dependencies.",
    },
```

### Task 5: Add OpenAPI descriptions to RBAC Module

**Files:**
- Modify: `src/modules/rbac/index.ts`

- [ ] **Step 1: Add `detail.description` to RBAC Features endpoints**

Update the features endpoints in `src/modules/rbac/index.ts`:

```typescript
// For GET /features
    detail: { description: "Retrieve a paginated list of all features." },

// For POST /features
    detail: { description: "Create a new feature for RBAC." },

// For PATCH /features/:id
    detail: { description: "Update an existing feature." },

// For DELETE /features/:id
    detail: { description: "Delete a feature." },
```

- [ ] **Step 2: Add `detail.description` to RBAC Roles endpoints**

Update the roles endpoints in `src/modules/rbac/index.ts`:

```typescript
// For GET /roles
    detail: { description: "Retrieve a paginated list of all roles with their associated features." },

// For GET /roles/options
    detail: { description: "Retrieve a simplified list of roles for dropdown options." },

// For GET /roles/me
    detail: { description: "Retrieve the role and features of the currently authenticated user." },

// For GET /roles/:id
    detail: { description: "Retrieve detailed information about a specific role." },

// For POST /roles
    detail: { description: "Create a new role with specific feature permissions." },

// For PATCH /roles/:id
    detail: { description: "Update an existing role and its permissions." },

// For DELETE /roles/:id
    detail: { description: "Delete an existing role." },
```

### Task 6: Add OpenAPI descriptions to Uploads Module

**Files:**
- Modify: `src/modules/uploads/index.ts`

- [ ] **Step 1: Add `detail.description` to Uploads endpoints**

Update the `protectedUploads` endpoint configurations in `src/modules/uploads/index.ts`:

```typescript
// For POST /
    detail: { description: "Upload a CSV/Excel file containing MSME transaction data." },

// For PATCH /:uploadId/column-map
    detail: { description: "Save column mapping for an uploaded file to standardize data structure." },

// For GET /:uploadId/status
    detail: { description: "Get the current processing status of an uploaded file." },
```

### Task 7: Add OpenAPI descriptions to User Module

**Files:**
- Modify: `src/modules/user/index.ts`

- [ ] **Step 1: Add `detail.description` to User endpoints**

Update the `protectedUser` endpoint configurations in `src/modules/user/index.ts`:

```typescript
// For GET /
    detail: { description: "Retrieve a paginated list of users." },

// For POST /
    detail: { description: "Create a new user and assign a role." },

// For GET /:id
    detail: { description: "Retrieve details of a specific user." },

// For PATCH /:id
    detail: { description: "Update an existing user's information or status." },

// For DELETE /:id
    detail: { description: "Delete a user from the system." },
```

### Task Final: Commit all plan changes

- [ ] **Step 1: Commit everything**

> This is the **only** commit step in the entire plan. All files created/modified are committed together.

```bash
git add src/plugins/openapi.ts src/modules/auth/index.ts src/modules/dashboard/index.ts src/modules/health/index.ts src/modules/rbac/index.ts src/modules/uploads/index.ts src/modules/user/index.ts
git commit -m "docs(openapi): add comprehensive OpenAPI descriptions for all API groups and endpoints"
```
