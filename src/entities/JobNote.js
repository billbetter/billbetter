import { localDataEngine } from "@/api/localDataEngine";

export const JobNote = {
  create: (payload) => localDataEngine.create("JobNote", payload),
  list: (filters, sort, limit) => localDataEngine.list("JobNote", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("JobNote", filters, sort, limit),
  get: (id) => localDataEngine.get("JobNote", id),
  update: (id, payload) => localDataEngine.update("JobNote", id, payload),
  delete: (id) => localDataEngine.delete("JobNote", id),
};
