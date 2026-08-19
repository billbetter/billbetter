import { localDataEngine } from "@/api/localDataEngine";

export const Quote = {
  create: (payload) => localDataEngine.create("Quote", payload),
  list: (filters, sort, limit) => localDataEngine.list("Quote", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("Quote", filters, sort, limit),
  get: (id) => localDataEngine.get("Quote", id),
  update: (id, payload) => localDataEngine.update("Quote", id, payload),
  delete: (id) => localDataEngine.delete("Quote", id),
};
