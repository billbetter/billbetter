import { localDataEngine } from "@/api/localDataEngine";

export const Invoice = {
  create: (payload) => localDataEngine.create("Invoice", payload),
  list: (filters, sort, limit) => localDataEngine.list("Invoice", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("Invoice", filters, sort, limit),
  get: (id) => localDataEngine.get("Invoice", id),
  update: (id, payload) => localDataEngine.update("Invoice", id, payload),
  delete: (id) => localDataEngine.delete("Invoice", id),
};
