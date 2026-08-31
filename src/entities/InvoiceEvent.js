import { localDataEngine } from "@/api/localDataEngine";

export const InvoiceEvent = {
  create: (payload) => localDataEngine.create("InvoiceEvent", payload),
  list: (filters, sort, limit) => localDataEngine.list("InvoiceEvent", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("InvoiceEvent", filters, sort, limit),
  get: (id) => localDataEngine.get("InvoiceEvent", id),
  update: (id, payload) => localDataEngine.update("InvoiceEvent", id, payload),
  delete: (id) => localDataEngine.delete("InvoiceEvent", id),
};
