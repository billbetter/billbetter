import { localDataEngine } from "@/api/localDataEngine";

export const Client = {
  create: (payload) => localDataEngine.create("Client", payload),
  list: (filters, sort, limit) => localDataEngine.list("Client", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("Client", filters, sort, limit),
  get: (id) => localDataEngine.get("Client", id),
  update: (id, payload) => localDataEngine.update("Client", id, payload),
  delete: (id) => localDataEngine.delete("Client", id),
};
