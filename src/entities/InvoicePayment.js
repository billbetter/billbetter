import { localDataEngine } from "@/api/localDataEngine";

export const InvoicePayment = {
  create: (payload) => localDataEngine.create("InvoicePayment", payload),
  list: (filters, sort, limit) => localDataEngine.list("InvoicePayment", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("InvoicePayment", filters, sort, limit),
  get: (id) => localDataEngine.get("InvoicePayment", id),
  update: (id, payload) => localDataEngine.update("InvoicePayment", id, payload),
  delete: (id) => localDataEngine.delete("InvoicePayment", id),
};
