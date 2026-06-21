import { t } from "@/libs/i18n";

export class UploadNotReadyError extends Error {
  readonly key = "reports.uploadNotReady";
  constructor(locale: string = "en") {
    super(t(locale, "reports.uploadNotReady"));
  }
}

export class InvalidPeriodError extends Error {
  readonly key = "reports.invalidPeriod";
  constructor(locale: string = "en") {
    super(t(locale, "reports.invalidPeriod"));
  }
}

export class ComputationFailedError extends Error {
  readonly key = "reports.computationFailed";
  constructor(locale: string = "en") {
    super(t(locale, "reports.computationFailed"));
  }
}

export class ReportNotFoundError extends Error {
  readonly key = "reports.reportNotFound";
  constructor(locale: string = "en") {
    super(t(locale, "reports.reportNotFound"));
  }
}
