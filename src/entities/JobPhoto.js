import { localDataEngine } from "@/api/localDataEngine";

export const JobPhoto = {
  create: (payload) => localDataEngine.create("JobPhoto", payload),
  list: (filters, sort, limit) => localDataEngine.list("JobPhoto", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("JobPhoto", filters, sort, limit),
  get: (id) => localDataEngine.get("JobPhoto", id),
  update: (id, payload) => localDataEngine.update("JobPhoto", id, payload),
  delete: (id) => localDataEngine.delete("JobPhoto", id),
};
