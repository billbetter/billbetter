import { localDataEngine } from "@/api/localDataEngine";

export const TimeEntry = {
  create: (payload) => localDataEngine.create("TimeEntry", payload),
  list: (filters, sort, limit) => localDataEngine.list("TimeEntry", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("TimeEntry", filters, sort, limit),
  get: (id) => localDataEngine.get("TimeEntry", id),
  update: (id, payload) => localDataEngine.update("TimeEntry", id, payload),
  delete: (id) => localDataEngine.delete("TimeEntry", id),
};
