/** Subtotal, tax and total for a list of line items at `taxRate` percent. */
export const calculateTotals = (items, taxRate) => {
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const tax_amount = (subtotal * taxRate) / 100;
  const total = subtotal + tax_amount;
  return { subtotal, tax_amount, total };
};
