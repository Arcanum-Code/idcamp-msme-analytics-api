import { t } from "elysia";
import { Value } from "@sinclair/typebox/value";

const NumericStringWithDefault = (def: string) =>
  t
    .Transform(t.String({ default: def }))
    .Decode((v) => Number(v))
    .Encode((v) => String(v));

/**
 * Environment variable schema
 * Fail fast on boot if something is missing or invalid
 */
const envSchema = t.Object({
  NODE_ENV: t.Union([
    t.Literal("development"),
    t.Literal("production"),
    t.Literal("test"),
  ]),
  LOG_LEVEL: t.Union([
    t.Literal("debug"),
    t.Literal("info"),
    t.Literal("warn"),
    t.Literal("error"),
  ]),
  PORT: NumericStringWithDefault("3000"),
  CORS_ORIGIN: t.String({ format: "uri", default: "http://localhost:5173" }),

  JWT_ACCESS_SECRET: t.String({ minLength: 32 }),
  JWT_ACCESS_EXPIRES_IN: t.String(),

  JWT_REFRESH_SECRET: t.String({ minLength: 32 }),
  JWT_REFRESH_EXPIRES_IN: t.String(),

  DATABASE_URL: t.String({ format: "uri" }),

  UPLOAD_DIR: t.String({ default: "../uploads" }),
  MAX_FILE_SIZE_MB: NumericStringWithDefault("10"),
  MINI_MODEL_URL: t.String({ format: "uri", default: "http://localhost:5000" }),
});

/**
 * Parse + validate process.env once
 */
const envData = { ...process.env };
Value.Default(envSchema, envData);

const envErrors = [...Value.Errors(envSchema, envData)];

if (envErrors.length > 0) {
  console.error("❌ Invalid environment variables");
  for (const error of envErrors) {
    console.error(`${error.path}: ${error.message}`);
  }
  process.exit(1);
}

export const env = Value.Decode(envSchema, envData);
