import { Context, t } from "elysia";
import z, { ZodType } from "zod";
import { t as translate, type Translator } from "@/libs/i18n";

type ElysiaSet = Context["set"];

type MessageInput =
  | string
  | { key: string; params?: Record<string, string | number> };

const resolveMessage = (
  message: MessageInput,
  locale: string,
  translator?: Translator,
): string => {
  if (typeof message === "string") {
    if (translator) {
      return translator(message);
    }
    return message;
  }

  const { key, params } = message;
  return translate(locale, key, params);
};

export const successResponse = <T, E>(
  set: ElysiaSet,
  data: T,
  message: MessageInput = "Success",
  code: number = 200,
  extras?: E,
  locale: string = "en",
) => {
  set.status = code;
  const resolvedMessage = resolveMessage(message, locale);

  return {
    error: false,
    code,
    message: resolvedMessage,
    data,
    ...extras,
  } as any;
};

export const errorResponse = <TIssues = null>(
  set: ElysiaSet,
  code: number,
  message: MessageInput,
  issues: TIssues = null as unknown as TIssues,
  locale: string = "en",
) => {
  set.status = code;
  const resolvedMessage = resolveMessage(message, locale);

  return {
    error: true as const,
    code,
    message: resolvedMessage,
    issues,
  };
};

// =================-------------------------
// ZOD-BASED SCHEMAS (FOR BACKWARD COMPATIBILITY)
// =================-------------------------

export const PaginationSchema = z.object({
  page: z
    .preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z
        .number()
        .min(1, { message: "Page number must be at least 1" })
        .default(1),
    )
    .optional(),

  limit: z
    .preprocess(
      (val) => (val === undefined ? undefined : Number(val)),
      z
        .number()
        .min(1, { message: "Limit must be between 1 and 100" })
        .max(100, { message: "Limit must be between 1 and 100" })
        .default(10),
    )
    .optional(),
});

export const createResponseSchema = <T extends ZodType>(schema: T) =>
  z.object({
    error: z.boolean().default(false),
    code: z.number(),
    message: z.string(),
    data: z.union([schema, z.null()]),
  });

export const createErrorSchema = (schema: ZodType = z.any()) =>
  z.object({
    error: z.boolean().default(true),
    code: z.number(),
    message: z.string(),
    issues: z.union([schema, z.null()]),
  });

export const createPaginatedResponseSchema = <T extends ZodType>(
  itemSchema: T,
) =>
  z.object({
    error: z.boolean(),
    code: z.number(),
    message: z.string(),
    data: itemSchema,
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }),
  });

// =================-------------------------
// TYPEBOX-BASED SCHEMAS (NEW STANDARD)
// =================-------------------------

import { type TSchema } from "elysia";

export const TbPaginationSchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
});

export const createTbResponseSchema = <T extends TSchema>(schema: T) =>
  t.Object({
    error: t.Boolean({ default: false }),
    code: t.Number(),
    message: t.String(),
    data: t.Union([schema, t.Null()]),
  });

export const createTbErrorSchema = <T extends TSchema>(
  schema: T = t.Any() as unknown as T,
) =>
  t.Object({
    error: t.Boolean({ default: true }),
    code: t.Number(),
    message: t.String(),
    issues: t.Union([schema, t.Null()]),
  });

export const createTbPaginatedResponseSchema = <T extends TSchema>(
  itemSchema: T,
) =>
  t.Object({
    error: t.Boolean(),
    code: t.Number(),
    message: t.String(),
    data: itemSchema,
    pagination: t.Object({
      total: t.Number(),
      page: t.Number(),
      limit: t.Number(),
      totalPages: t.Number(),
    }),
  });
