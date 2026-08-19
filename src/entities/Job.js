import { localDataEngine } from "@/api/localDataEngine";

export const Job = {
  create: (payload) => localDataEngine.create("Job", payload),
  list: (filters, sort, limit) => localDataEngine.list("Job", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("Job", filters, sort, limit),
  get: (id) => localDataEngine.get("Job", id),
  update: (id, payload) => localDataEngine.update("Job", id, payload),
  delete: (id) => localDataEngine.delete("Job", id),
};
