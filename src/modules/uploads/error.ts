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

export class InvalidFileTypeError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.invalidFileType"));
    this.key = "upload.invalidFileType";
  }
}

export class FileTooLargeError extends Error {
  readonly key: string;
  readonly maxSize: number;

  constructor(maxSize: number, locale: string = "en") {
    super(t(locale, "upload.fileTooLarge", { maxSize }));
    this.key = "upload.fileTooLarge";
    this.maxSize = maxSize;
  }
}

export class FileParseFailedError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.fileParseFailed"));
    this.key = "upload.fileParseFailed";
  }
}

export class NoShopError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "upload.noShop"));
    this.key = "upload.noShop";
  }
}
