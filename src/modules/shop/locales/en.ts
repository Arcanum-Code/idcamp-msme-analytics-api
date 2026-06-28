export const en = {
  createSuccess: "Shop Successfully Created",
  updateSuccess: "Shop Successfully Updated",
  deleteSuccess: "Shop Successfully Deleted",
  getSuccess: "Shop details retrieved",
  listSuccess: "Shops retrieved successfully",
  shopNotFound: "Shop Not Found",
} as const;

export type ShopLocale = typeof en;
