export const id = {
  saveColumnMapSuccess: "Peta kolom berhasil disimpan.",
  notFound: "Upload tidak ditemukan.",
  notAwaitingMapping: "Upload ini tidak lagi memerlukan pemetaan kolom manual.",
  uploadSuccess: "File berhasil diunggah. Semua kolom berhasil terdeteksi.",
  uploadNeedsMapping:
    "Beberapa kolom wajib tidak dapat terdeteksi. Silakan selesaikan kolom pada unmappedRequired.",
  invalidFileType: "File harus berupa CSV (.csv) atau Excel (.xlsx, .xls).",
  fileTooLarge:
    "File melebihi ukuran maksimum yang diizinkan sebesar {{maxSize}} MB.",
  fileParseFailed:
    "File tidak dapat dibaca. File mungkin rusak atau dalam format yang salah.",
  noShop: "Anda harus membuat toko terlebih dahulu sebelum mengunggah file.",
} as const;
