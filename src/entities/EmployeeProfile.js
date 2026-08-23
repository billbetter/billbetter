import { localDataEngine } from "@/api/localDataEngine";

export const EmployeeProfile = {
  create: (payload) => localDataEngine.create("EmployeeProfile", payload),
  list: (filters, sort, limit) => localDataEngine.list("EmployeeProfile", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("EmployeeProfile", filters, sort, limit),
  get: (id) => localDataEngine.get("EmployeeProfile", id),
  update: (id, payload) => localDataEngine.update("EmployeeProfile", id, payload),
  delete: (id) => localDataEngine.delete("EmployeeProfile", id),
};
