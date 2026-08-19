import { localDataEngine } from "@/api/localDataEngine";

export const InvoiceTemplate = {
  create: (payload) => localDataEngine.create("InvoiceTemplate", payload),
  list: (filters, sort, limit) => localDataEngine.list("InvoiceTemplate", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("InvoiceTemplate", filters, sort, limit),
  get: (id) => localDataEngine.get("InvoiceTemplate", id),
  update: (id, payload) => localDataEngine.update("InvoiceTemplate", id, payload),
  delete: (id) => localDataEngine.delete("InvoiceTemplate", id),
};
