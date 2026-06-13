import { t } from "@/libs/i18n";

export class UploadNotFoundError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.notFound"));
    this.key = "upload.notFound";
  }
}

export class UploadNotAwaitingMappingError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.notAwaitingMapping"));
    this.key = "upload.notAwaitingMapping";
  }
}
