import { localDataEngine } from "@/api/localDataEngine";

export const CrewMemberSettings = {
  create: (payload) => localDataEngine.create("CrewMemberSettings", payload),
  list: (filters, sort, limit) => localDataEngine.list("CrewMemberSettings", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("CrewMemberSettings", filters, sort, limit),
  get: (id) => localDataEngine.get("CrewMemberSettings", id),
  update: (id, payload) => localDataEngine.update("CrewMemberSettings", id, payload),
  delete: (id) => localDataEngine.delete("CrewMemberSettings", id),
};
