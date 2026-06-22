import { Context, t, type TSchema } from "elysia";
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
// TYPEBOX-BASED SCHEMAS (STANDARD)
// =================-------------------------

export const PaginationSchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
});

export const createResponseSchema = <T extends TSchema>(schema: T) =>
  t.Object({
    error: t.Boolean({ default: false }),
    code: t.Number(),
    message: t.String(),
    data: t.Union([schema, t.Null()]),
  });

export const createErrorSchema = <T extends TSchema>(
  schema: T = t.Any() as unknown as T,
) =>
  t.Object({
    error: t.Boolean({ default: true }),
    code: t.Number(),
    message: t.String(),
    issues: t.Union([schema, t.Null()]),
  });

export const createPaginatedResponseSchema = <T extends TSchema>(
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
