import { localDataEngine } from "@/api/localDataEngine";

export const CrewInvite = {
  create: (payload) => localDataEngine.create("CrewInvite", payload),
  list: (filters, sort, limit) => localDataEngine.list("CrewInvite", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("CrewInvite", filters, sort, limit),
  get: (id) => localDataEngine.get("CrewInvite", id),
  update: (id, payload) => localDataEngine.update("CrewInvite", id, payload),
  delete: (id) => localDataEngine.delete("CrewInvite", id),
};
