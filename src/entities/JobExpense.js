import { localDataEngine } from "@/api/localDataEngine";

export const JobExpense = {
  create: (payload) => localDataEngine.create("JobExpense", payload),
  list: (filters, sort, limit) => localDataEngine.list("JobExpense", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("JobExpense", filters, sort, limit),
  get: (id) => localDataEngine.get("JobExpense", id),
  update: (id, payload) => localDataEngine.update("JobExpense", id, payload),
  delete: (id) => localDataEngine.delete("JobExpense", id),
};
