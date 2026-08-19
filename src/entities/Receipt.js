import { localDataEngine } from "@/api/localDataEngine";

export const Receipt = {
  create: (payload) => localDataEngine.create("Receipt", payload),
  list: (filters, sort, limit) => localDataEngine.list("Receipt", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("Receipt", filters, sort, limit),
  get: (id) => localDataEngine.get("Receipt", id),
  update: (id, payload) => localDataEngine.update("Receipt", id, payload),
  delete: (id) => localDataEngine.delete("Receipt", id),
};
