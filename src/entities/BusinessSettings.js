import { localDataEngine } from "@/api/localDataEngine";

export const BusinessSettings = {
  create: (payload) => localDataEngine.create("BusinessSettings", payload),
  list: (filters, sort, limit) => localDataEngine.list("BusinessSettings", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("BusinessSettings", filters, sort, limit),
  get: (id) => localDataEngine.get("BusinessSettings", id),
  update: (id, payload) => localDataEngine.update("BusinessSettings", id, payload),
  delete: (id) => localDataEngine.delete("BusinessSettings", id),
};
