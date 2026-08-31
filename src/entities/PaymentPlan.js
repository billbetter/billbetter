import { localDataEngine } from "@/api/localDataEngine";

export const PaymentPlan = {
  create: (payload) => localDataEngine.create("PaymentPlan", payload),
  list: (filters, sort, limit) => localDataEngine.list("PaymentPlan", filters, sort, limit),
  filter: (filters, sort, limit) => localDataEngine.list("PaymentPlan", filters, sort, limit),
  get: (id) => localDataEngine.get("PaymentPlan", id),
  update: (id, payload) => localDataEngine.update("PaymentPlan", id, payload),
  delete: (id) => localDataEngine.delete("PaymentPlan", id),
};
