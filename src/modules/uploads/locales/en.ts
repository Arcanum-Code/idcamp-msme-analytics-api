export const en = {
  saveColumnMapSuccess: "Column map saved.",
  notFound: "Upload not found.",
  notAwaitingMapping: "This upload no longer requires manual column mapping.",
  uploadSuccess: "File uploaded successfully. All columns detected.",
  uploadNeedsMapping:
    "Some required columns could not be detected. Please resolve the fields in unmappedRequired.",
  invalidFileType: "File must be CSV (.csv) or Excel (.xlsx, .xls).",
  fileTooLarge: "File exceeds the maximum allowed size of {{maxSize}} MB.",
  fileParseFailed:
    "File could not be read. It may be corrupted or in the wrong format.",
  noShop: "You must create a shop before uploading files.",
} as const;

export type UploadLocale = typeof en;
