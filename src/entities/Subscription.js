import { localDataEngine } from "@/api/localDataEngine";

export const Subscription = {
  create: (payload) => localDataEngine.create("Subscription", payload),
  list: (filters, sort, limit) => localDataEngine.list("Subscription", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("Subscription", filters, sort, limit),
  get: (id) => localDataEngine.get("Subscription", id),
  update: (id, payload) => localDataEngine.update("Subscription", id, payload),
  delete: (id) => localDataEngine.delete("Subscription", id),
};
