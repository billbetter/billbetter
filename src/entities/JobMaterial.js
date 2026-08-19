import { localDataEngine } from "@/api/localDataEngine";

export const JobMaterial = {
  create: (payload) => localDataEngine.create("JobMaterial", payload),
  list: (filters, sort, limit) => localDataEngine.list("JobMaterial", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("JobMaterial", filters, sort, limit),
  get: (id) => localDataEngine.get("JobMaterial", id),
  update: (id, payload) => localDataEngine.update("JobMaterial", id, payload),
  delete: (id) => localDataEngine.delete("JobMaterial", id),
};
