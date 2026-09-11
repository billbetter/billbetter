import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ServiceAutofill from "@/components/invoice/ServiceAutofill";
import { calculateTotals } from "@/components/documentForm/lineItemMath";

/** The line items, with add / remove. `notice` renders above them (the invoice
 * says where prefilled figures came from). */
export default function LineItemsEditor({
  addItem,
  descriptionLabel,
  formData,
  handleItemChange,
  notice,
  removeItem,
  setFormData,
  title,
  userSpecialty,
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {notice}
      <div className="flex items-center justify-between">
        <Label className="text-ink-700 dark:text-ink-300 font-semibold text-sm sm:text-base flex items-center gap-2">
          <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-content-subtle dark:text-content-muted" />
          {title}
        </Label>
        <Button
          type="button"
          onClick={addItem}
          size="sm"
          className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted shadow-md transition-all hover:scale-105 active:scale-95 h-8 sm:h-9"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
          Add
        </Button>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {formData.items.map((item, index) => (
          <div
            key={index}
            className="group p-3 sm:p-4 bg-surface dark:bg-surface-inverted-deep border border-line dark:border-ink-700 rounded-xl space-y-2.5 sm:space-y-3 hover:border-info-400 dark:hover:border-info-600 transition-all shadow-sm hover:shadow-md"
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                  {descriptionLabel}
                </Label>
                <ServiceAutofill
                  value={item.description}
                  onChange={(value) =>
                    handleItemChange(index, "description", value)
                  }
                  onServiceSelect={(lineItem) => {
                    const newItems = [...formData.items];
                    newItems[index] = lineItem;
                    const totals = calculateTotals(
                      newItems,
                      formData.tax_rate,
                    );
                    setFormData({
                      ...formData,
                      items: newItems,
                      ...totals,
                    });
                  }}
                  userSpecialty={userSpecialty}
                />
              </div>
              {formData.items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="mt-5 sm:mt-6 text-content-body hover:text-danger-700 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-all h-7 w-7 sm:h-8 sm:w-8 shrink-0 dark:text-ink-300"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                  Qty
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      "quantity",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="h-9 sm:h-10 border-line dark:border-ink-600 bg-surface-sunken dark:bg-surface-inverted text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20 font-medium text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                  Rate ($)
                </Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={item.rate}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      "rate",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="h-9 sm:h-10 border-line dark:border-ink-600 bg-surface-sunken dark:bg-surface-inverted text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20 font-medium text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                  Total
                </Label>
                <div className="h-9 sm:h-10 px-2 sm:px-3 bg-ink-100 dark:bg-ink-800 border border-line dark:border-ink-700 rounded-md flex items-center justify-between font-semibold text-content dark:text-ink-50 text-sm">
                  <span className="text-content-subtle dark:text-content-muted text-xs">
                    $
                  </span>
                  <span>{item.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
