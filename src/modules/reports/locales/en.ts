export const en = {
  uploadNotReady: "Upload is not ready for report generation.",
  invalidPeriod: "periodStart must be before or equal to periodEnd.",
  computationFailed: "Revenue computation failed.",
} as const;

export type ReportsLocale = Record<keyof typeof en, string>;
