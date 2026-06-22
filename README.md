# MSME Revenue Summary API

An Elysia-based backend API for computing Micro, Small, and Medium Enterprises (MSME) revenue summaries using AI.

## Features

- **AI-Powered Revenue Computation:** Integrates with an external FastAPI model to compute daily, weekly, and monthly revenue summaries.
- **Role-Based Access Control (RBAC):** Granular permissions for user, role, and feature management.
- **Secure Authentication:** JWT access and refresh tokens, bcrypt password hashing, and token versioning.
- **Report Generation:** Generates comprehensive revenue reports from uploaded transaction data.
- **File Uploads:** Managed file uploads for transaction processing.

## Getting Started

```bash
bun install
cp .env.example .env
# Configure your .env file with appropriate DATABASE_URL and MINI_MODEL_URL
bun run prisma:generate
bun run prisma:migrate dev
bun run dev
```

The server will start at `http://localhost:4000`.

## Usage

Test that the server is running by hitting the health check endpoint:

```bash
curl http://localhost:4000/
```

For the full API reference, access the auto-generated Swagger OpenAPI documentation by navigating to `http://localhost:4000/openapi` in your browser.

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | - |
| `LOG_LEVEL` | Logging level | No | `info` |
| `PORT` | Server port | No | `4000` |
| `CORS_ORIGIN` | Allowed CORS origin | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `MINI_MODEL_URL` | URL of the companion FastAPI AI service | Yes | - |
| `JWT_ACCESS_SECRET` | JWT access token secret | Yes | - |
| `JWT_ACCESS_EXPIRES_IN`| Access token expiry | Yes | `15m` |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Yes | - |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token expiry | Yes | `7d` |
| `UPLOAD_DIR` | Directory for uploaded files | Yes | `./uploads` |
| `MAX_FILE_SIZE_MB` | Maximum file upload size in MB | Yes | `10` |

## Tech Stack

- [Bun](https://bun.sh/) — Runtime
- [Elysia](https://elysia.dev/) — Web framework
- [Prisma](https://www.prisma.io/) — Database ORM
- [PostgreSQL](https://www.postgresql.org/) — Database
- [Pino](https://getpino.io/) — Structured logging

## License

[MIT](LICENSE.md)
