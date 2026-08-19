import { localDataEngine } from "@/api/localDataEngine";

export const RecurringInvoice = {
  create: (payload) => localDataEngine.create("RecurringInvoice", payload),
  list: (filters, sort, limit) => localDataEngine.list("RecurringInvoice", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("RecurringInvoice", filters, sort, limit),
  get: (id) => localDataEngine.get("RecurringInvoice", id),
  update: (id, payload) => localDataEngine.update("RecurringInvoice", id, payload),
  delete: (id) => localDataEngine.delete("RecurringInvoice", id),
};
