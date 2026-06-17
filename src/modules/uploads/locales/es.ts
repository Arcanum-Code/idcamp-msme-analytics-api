export const es = {
  saveColumnMapSuccess: "Mapa de columnas guardado.",
  notFound: "Subida no encontrada.",
  notAwaitingMapping: "Esta subida ya no requiere mapeo de columnas manual.",
  uploadSuccess:
    "Archivo subido exitosamente. Todas las columnas fueron detectadas.",
  uploadNeedsMapping:
    "Algunas columnas requeridas no pudieron ser detectadas. Resuelva los campos en unmappedRequired.",
  invalidFileType: "El archivo debe ser CSV (.csv) o Excel (.xlsx, .xls).",
  fileTooLarge:
    "El archivo excede el tamaño máximo permitido de {{maxSize}} MB.",
  fileParseFailed:
    "No se pudo leer el archivo. Puede estar corrupto o en un formato incorrecto.",
  noShop: "Debe crear una tienda antes de subir archivos.",
  statusRetrieved: "Estado de subida recuperado.",
} as const;
