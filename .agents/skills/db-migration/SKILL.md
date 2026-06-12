---
name: db-migration
description: Manage Prisma database migrations for a PostgreSQL + Bun stack. Use this skill whenever the user mentions schema changes, adding/removing columns or tables, creating or running migrations, rolling back migrations, seeding data, resolving migration drift, or any Prisma-related database tasks — even if they just say "update the schema", "I need a new table", "migrate", or "prisma migrate". Always invoke this skill for anything touching prisma/schema.prisma, migration files, or the DATABASE_URL.
---

# DB Migration — Prisma + PostgreSQL + Bun

Handles the full migration lifecycle: schema changes → migration file generation → applying to dev/prod → rollback and drift resolution.

## Stack Assumptions

- **ORM**: Prisma (v6+)
- **Database**: PostgreSQL
- **Runtime**: Bun (use `bunx` instead of `npx`)
- **Schema file**: `prisma/schema.prisma`
- **Migrations folder**: `prisma/migrations/`
- **Env file**: `.env` with `DATABASE_URL`

If the project deviates from these (e.g. custom output path, multiple schema files), read `prisma/schema.prisma` and `package.json` first before running any command.

---

## Phase 1 — Understand the Change Request

Before touching any file, clarify:

1. **What changed?** New model, new field, renamed field, deleted field, index, relation, enum?
2. **Is this destructive?** Dropping a column or table = data loss risk. Always flag this explicitly.
3. **Which environment?** Dev only, or needs to go to prod?
4. **Is there existing data?** If yes, a data migration step may be needed alongside the schema migration.

If the user's request is vague ("add user stuff"), ask the minimum needed to write a correct schema change. Don't guess model names or field types.

---

## Phase 2 — Schema Change

Edit `prisma/schema.prisma` directly. Follow these rules:

- Use `snake_case` for field names mapped to PostgreSQL columns: `@@map("table_name")`, `@map("column_name")`
- Always add `@db.VarChar(n)` for string fields where length matters
- New required fields on existing models **must** have a `@default(...)` or be added as `?` (optional) to avoid migration failure on existing rows
- Use `@updatedAt` for `updatedAt` fields
- Relations: define both sides, use explicit `@relation(fields: [...], references: [...])`

**Common additions:**

```prisma
// New model
model Post {
  id        String   @id @default(cuid())
  title     String   @db.VarChar(255)
  body      String
  published Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])

  @@map("posts")
}

// New field on existing model (safe — has default)
newField  String  @default("") @db.VarChar(100)

// Optional field (safe — nullable)
bio  String?
```

---

## Phase 3 — Generate the Migration

```bash
# Dev: generate + apply in one step (use descriptive snake_case name)
bunx prisma migrate dev --name <migration_name>

# Examples of good migration names:
# add_posts_table
# add_bio_to_users
# drop_legacy_tokens
# add_index_on_users_email
```

This command will:

1. Diff the schema against the current DB state
2. Generate a SQL file in `prisma/migrations/<timestamp>_<name>/migration.sql`
3. Apply it to the dev database
4. Regenerate the Prisma Client

**Always review the generated SQL** before applying to staging/prod:

```bash
cat prisma/migrations/<latest>/migration.sql
```

Flag anything that looks like: `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE` (type coercion) — these need explicit confirmation.

---

## Phase 4 — Apply to Production

Never use `migrate dev` in production. Use:

```bash
bunx prisma migrate deploy
```

This applies all pending migrations in order without re-generating anything. It is safe to run on every deploy (idempotent for already-applied migrations).

**Pre-deploy checklist:**

- [ ] `DATABASE_URL` points to the correct prod database
- [ ] Reviewed the SQL for destructive operations
- [ ] Backup taken if dropping columns/tables
- [ ] No pending unapplied migrations locally (`bunx prisma migrate status`)

---

## Phase 5 — Verify

```bash
# Check migration status (shows applied vs pending)
bunx prisma migrate status

# Validate schema is in sync with DB
bunx prisma db pull --print   # shows what DB actually has (read-only, no writes)

# Regenerate client after any schema change
bunx prisma generate
```

---

## Rollback Procedures

Prisma does not have built-in rollback. Handle it manually:

### Undo last unapplied migration (dev only)

```bash
# If migrate dev failed mid-way or you want to discard:
bunx prisma migrate reset     # ⚠️ DESTRUCTIVE — drops and recreates DB
```

Only use `migrate reset` locally. Never in prod.

### Undo last applied migration (prod)

```bash
# 1. Write a new "down" migration manually
bunx prisma migrate dev --name revert_<previous_migration_name> --create-only
# 2. Edit the generated SQL file to reverse the previous migration
# 3. Apply it
bunx prisma migrate deploy
```

### Schema drift (DB is out of sync with migration history)

```bash
bunx prisma migrate status   # will show "drift detected"

# Option A: Bring migration history in sync with actual DB (non-destructive)
bunx prisma migrate resolve --applied <migration_name>

# Option B: Force DB to match schema (DESTRUCTIVE in prod)
bunx prisma db push --force-reset   # local only
```

---

## Seeding

```bash
bunx prisma db seed
```

Seed file is defined in `package.json`:

```json
"prisma": {
  "seed": "bun run prisma/seed.ts"
}
```

If no seed script exists and the user needs one, scaffold `prisma/seed.ts` using the Prisma client with `upsert` (idempotent, safe to re-run).

---

## Summary

<One sentence: what changed and why>

## Schema Changes

- [ ] `prisma/schema.prisma` — <describe the change>

## Migration File

- Path: `prisma/migrations/<timestamp>_<name>/migration.sql`
- Destructive: yes/no
- Data migration needed: yes/no

## Commands

\`\`\`bash

# Dev

bunx prisma migrate dev --name <migration_name>

# Prod

bunx prisma migrate deploy
\`\`\`

## Verification

\`\`\`bash
bunx prisma migrate status
bunx prisma generate
\`\`\`

## Risks

- <List any DROP, type change, or nullable→required changes>

```

---

## Common Errors & Fixes

| Error                                    | Cause                                        | Fix                                                  |
| ---------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `P3006: Migration failed`                | SQL error in generated migration             | Read the SQL, fix schema, re-run `migrate dev`       |
| `P1001: Can't reach database`            | `DATABASE_URL` wrong or DB not running       | Check `.env`, verify Postgres is running             |
| `P3009: migrate found failed migrations` | Previously failed migration stuck            | `bunx prisma migrate resolve --rolled-back <name>`   |
| `drift detected`                         | DB changed outside Prisma                    | See rollback section — drift resolution              |
| `Field does not exist in DB`             | Client out of sync with schema               | `bunx prisma generate`                               |
| `Unique constraint failed`               | Seed or migration data violates unique index | Check existing data before adding unique constraints |
```
