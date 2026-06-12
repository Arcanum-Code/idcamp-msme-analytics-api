# =========================================
# Stage 1: Install Dependencies
# =========================================
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./ 
RUN bun install --frozen-lockfile

# =========================================
# Stage 2: Build Application
# =========================================
FROM base AS build
WORKDIR /app

COPY . .

RUN bunx prisma generate
RUN bun run build

# =========================================
# Stage 3: Production Runner
# =========================================
FROM oven/bun:1-slim AS release
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
