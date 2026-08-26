import React, { useState, useEffect } from "react";
import { RECEIPT_SCAN } from "@/lib/ai/schemas";
import { aiFailureMessage } from "@/lib/ai/failure";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Receipt,
  DollarSign,
  Upload,
  Loader2,
  Edit2,
  Package,
  Wrench,
  HardHat,
  FileText,
  Tag,
  TrendingUp,
  ExternalLink,
  Sparkles,
  Camera,
  CheckCircle,
  X,
} from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  {
    value: "materials",
    label: "Materials",
    icon: Package,
    color: "bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300",
  },
  {
    value: "labor",
    label: "Labor",
    icon: HardHat,
    color:
      "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300",
  },
  {
    value: "equipment",
    label: "Equipment",
    icon: Wrench,
    color:
      "bg-alert-100 text-alert-700 dark:bg-alert-900/30 dark:text-alert-300",
  },
  {
    value: "subcontractor",
    label: "Subcontractor",
    icon: HardHat,
    color:
      "bg-caution-100 text-caution-700 dark:bg-caution-900/30 dark:text-caution-300",
  },
  {
    value: "permit",
    label: "Permit",
    icon: FileText,
    color:
      "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300",
  },
  {
    value: "other",
    label: "Other",
    icon: Tag,
    color: "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300",
  },
];

const getCategoryStyle = (cat) =>
  CATEGORIES.find((c) => c.value === cat) || CATEGORIES[5];

const defaultForm = {
  description: "",
  vendor: "",
  amount: "",
  quantity: 1,
  unit_cost: "",
  category: "materials",
  receipt_url: "",
  expense_date: format(new Date(), "yyyy-MM-dd"),
  markup_percent: 0,
  include_in_invoice: true,
  notes: "",
};

export default function JobExpensesTab({ job, user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // AI Scan state
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanImageUrl, setScanImageUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [uploadingForScan, setUploadingForScan] = useState(false);
  const [scannedItems, setScannedItems] = useState([]);
  const [scannedVendor, setScannedVendor] = useState("");
  const [scannedDate, setScannedDate] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [savingScanned, setSavingScanned] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [job.id]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await sdk.entities.JobExpense.filter({ job_id: job.id });
      setExpenses(
        data.sort(
          (a, b) => new Date(b.created_date) - new Date(a.created_date),
        ),
      );
    } catch (e) {
      console.error("Error loading expenses:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setForm(defaultForm);
    setEditingExpense(null);
    setShowForm(true);
  };

  const handleOpenEdit = (expense) => {
    setForm({
      description: expense.description || "",
      vendor: expense.vendor || "",
      amount: expense.amount || "",
      quantity: expense.quantity || 1,
      unit_cost: expense.unit_cost || "",
      category: expense.category || "materials",
      receipt_url: expense.receipt_url || "",
      expense_date: expense.expense_date || format(new Date(), "yyyy-MM-dd"),
      markup_percent: expense.markup_percent || 0,
      include_in_invoice: expense.include_in_invoice !== false,
      notes: expense.notes || "",
    });
    setEditingExpense(expense);
    setShowForm(true);
  };

  const computeBillable = (amount, markup) => {
    const base = parseFloat(amount) || 0;
    const pct = parseFloat(markup) || 0;
    return base + (base * pct) / 100;
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "quantity" || field === "unit_cost") {
        const qty =
          parseFloat(field === "quantity" ? value : updated.quantity) || 1;
        const uc =
          parseFloat(field === "unit_cost" ? value : updated.unit_cost) || 0;
        if (uc > 0) updated.amount = (qty * uc).toFixed(2);
      }
      return updated;
    });
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const { file_url } = await sdk.integrations.Core.UploadFile({ file });
      setForm((prev) => ({ ...prev, receipt_url: file_url }));
    } catch (err) {
      console.error("Receipt upload failed:", err);
      alert(aiFailureMessage(err, "this receipt"));
    } finally {
      setUploadingReceipt(false);
    }
  };

  // ── AI Scan Handlers ──
  const handleScanReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingForScan(true);
    try {
      const { file_url } = await sdk.integrations.Core.UploadFile({ file });
      setScanImageUrl(file_url);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload image.");
    } finally {
      setUploadingForScan(false);
    }
  };

  const handleScanReceipt = async () => {
    if (!scanImageUrl) return;
    setScanning(true);
    setScannedItems([]);
    try {
      const result = await sdk.integrations.Core.InvokeLLM({
        prompt: `You are a receipt parser. Analyze this receipt image and extract every line item from it.
For each item, provide:
- description: the item name/description
- quantity: number purchased (default 1 if not shown)
- unit_cost: price per unit
- amount: total for that line (quantity × unit_cost)
- category: one of [materials, labor, equipment, subcontractor, permit, other] — best guess based on item

Also extract:
- vendor_name: store/vendor name
- receipt_date: date of purchase in YYYY-MM-DD format (or empty string if not found)
- total: grand total on receipt

Be accurate with prices. If a price is ambiguous, use your best reading.`,
        file_urls: [scanImageUrl],
        response_json_schema: RECEIPT_SCAN,
      });

      if (result.items && result.items.length > 0) {
        setScannedItems(result.items.map((item, i) => ({ ...item, id: i })));
        setScannedVendor(result.vendor_name || "");
        setScannedDate(result.receipt_date || format(new Date(), "yyyy-MM-dd"));
        setSelectedItems(result.items.map((_, i) => i)); // select all by default
      } else {
        alert(
          "Could not extract items from this receipt. Please try a clearer photo or add manually.",
        );
      }
    } catch (err) {
      console.error("AI scan failed:", err);
      alert("AI scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const toggleItemSelection = (idx) => {
    setSelectedItems((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const handleSaveScannedItems = async () => {
    if (selectedItems.length === 0) return;
    setSavingScanned(true);
    try {
      const toSave = scannedItems.filter((item) =>
        selectedItems.includes(item.id),
      );
      await Promise.all(
        toSave.map((item) =>
          sdk.entities.JobExpense.create({
            user_id: user.id,
            job_id: job.id,
            description: item.description,
            vendor: scannedVendor,
            amount: item.amount || 0,
            quantity: item.quantity || 1,
            unit_cost: item.unit_cost || 0,
            category: item.category || "materials",
            receipt_url: scanImageUrl,
            expense_date: scannedDate || format(new Date(), "yyyy-MM-dd"),
            markup_percent: 0,
            billable_amount: item.amount || 0,
            include_in_invoice: true,
            notes: "",
          }),
        ),
      );
      await loadExpenses();
      setShowScanDialog(false);
      setScanImageUrl(null);
      setScannedItems([]);
      setSelectedItems([]);
    } catch (err) {
      console.error("Error saving scanned items:", err);
      alert("Failed to save some items. Please try again.");
    } finally {
      setSavingScanned(false);
    }
  };

  const handleSave = async () => {
    if (!form.description.trim()) {
      alert("Please enter a description.");
      return;
    }
    if (!form.amount && form.amount !== 0) {
      alert("Please enter an amount.");
      return;
    }

    setSaving(true);
    try {
      const billableAmount = computeBillable(form.amount, form.markup_percent);
      const payload = {
        user_id: user.id,
        job_id: job.id,
        description: form.description,
        vendor: form.vendor,
        amount: parseFloat(form.amount) || 0,
        quantity: parseFloat(form.quantity) || 1,
        unit_cost: parseFloat(form.unit_cost) || 0,
        category: form.category,
        receipt_url: form.receipt_url,
        expense_date: form.expense_date,
        markup_percent: parseFloat(form.markup_percent) || 0,
        billable_amount: billableAmount,
        include_in_invoice: form.include_in_invoice,
        notes: form.notes,
      };

      if (editingExpense) {
        await sdk.entities.JobExpense.update(editingExpense.id, payload);
      } else {
        await sdk.entities.JobExpense.create(payload);
      }

      await loadExpenses();
      setShowForm(false);
      setEditingExpense(null);
    } catch (err) {
      console.error("Error saving expense:", err);
      alert("Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await sdk.entities.JobExpense.delete(expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const totalCost = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalBillable = expenses
    .filter((e) => e.include_in_invoice)
    .reduce((sum, e) => sum + (e.billable_amount || e.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-success-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-surface dark:bg-ink-800 rounded-xl p-4 border border-line dark:border-ink-700 shadow-sm">
          <p className="text-xs text-content-muted dark:text-content-subtle mb-1">
            Total Expenses
          </p>
          <p className="text-xl font-bold text-content dark:text-content-inverted">
            ${totalCost.toFixed(2)}
          </p>
          <p className="text-xs text-content-subtle dark:text-content-muted">
            {expenses.length} item{expenses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-success-50 dark:bg-success-900/20 rounded-xl p-4 border border-success-200 dark:border-success-800 shadow-sm">
          <p className="text-xs text-success-700 dark:text-success-400 mb-1">
            Billable to Client
          </p>
          <p className="text-xl font-bold text-success-700 dark:text-success-400">
            ${totalBillable.toFixed(2)}
          </p>
          <p className="text-xs text-success-600 dark:text-success-500">
            Incl. markup
          </p>
        </div>
        <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 border border-info-200 dark:border-info-800 shadow-sm hidden sm:block">
          <p className="text-xs text-info-700 dark:text-info-400 mb-1">
            Your Margin
          </p>
          <p className="text-xl font-bold text-info-700 dark:text-info-400">
            ${(totalBillable - totalCost).toFixed(2)}
          </p>
          <p className="text-xs text-info-600 dark:text-brand-600">
            From markup
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-content dark:text-content-inverted">
          Expenses & Receipts
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setScanImageUrl(null);
              setScannedItems([]);
              setSelectedItems([]);
              setShowScanDialog(true);
            }}
            className="h-9 border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-400 dark:hover:bg-brand-900/20"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Scan Receipt
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="bg-brand hover:bg-brand-hover h-9"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Expense List */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Receipt className="w-12 h-12 text-ink-300 dark:text-content-body mx-auto mb-3 dark:dark:text-ink-300" />
            <p className="text-content-body dark:text-content-subtle font-medium">
              No expenses yet
            </p>
            <p className="text-sm text-content-subtle dark:text-content-muted mb-4">
              Track materials, labor, and costs for this job
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  setScanImageUrl(null);
                  setScannedItems([]);
                  setSelectedItems([]);
                  setShowScanDialog(true);
                }}
                className="border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-400 dark:hover:bg-brand-900/20"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Scan a Receipt
              </Button>
              <Button
                onClick={handleOpenAdd}
                className="bg-brand hover:bg-brand-hover"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => {
            const catStyle = getCategoryStyle(expense.category);
            const CatIcon = catStyle.icon;
            const billable = expense.billable_amount || expense.amount || 0;
            return (
              <div
                key={expense.id}
                className="bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 p-4 flex items-start gap-3 group hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${catStyle.color}`}
                >
                  <CatIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-content dark:text-content-inverted text-sm truncate">
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <Badge className={`text-xs ${catStyle.color} border-0`}>
                          {catStyle.label}
                        </Badge>
                        {expense.vendor && (
                          <span className="text-xs text-content-muted dark:text-content-subtle">
                            {expense.vendor}
                          </span>
                        )}
                        {expense.expense_date && (
                          <span className="text-xs text-content-subtle dark:text-content-muted">
                            {format(
                              new Date(expense.expense_date),
                              "MMM d, yyyy",
                            )}
                          </span>
                        )}
                        {expense.receipt_url && (
                          <Badge className="text-xs bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border-0">
                            <Camera className="w-2.5 h-2.5 mr-1" />
                            Receipt
                          </Badge>
                        )}
                        {!expense.include_in_invoice && (
                          <Badge className="text-xs bg-ink-100 text-content-body dark:bg-ink-700 dark:text-ink-200 border-0">
                            Not billed
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-content dark:text-content-inverted">
                        ${(expense.amount || 0).toFixed(2)}
                      </p>
                      {expense.markup_percent > 0 && (
                        <p className="text-xs text-success-600 dark:text-success-400 flex items-center gap-1 justify-end">
                          <TrendingUp className="w-3 h-3" />$
                          {billable.toFixed(2)} billed
                        </p>
                      )}
                    </div>
                  </div>
                  {expense.notes && (
                    <p className="text-xs text-content-muted dark:text-content-subtle mt-1 truncate">
                      {expense.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {expense.receipt_url && (
                    <a
                      href={expense.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-brand-700 hover:text-info-700 hover:bg-info-50 dark:hover:bg-info-900/20 dark:text-brand-400 dark:hover:text-info-400"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-content-subtle hover:text-content-body dark:hover:text-ink-300"
                    onClick={() => handleOpenEdit(expense)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-danger-700 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-900/20 dark:text-danger-400 dark:hover:text-danger-400"
                    onClick={() => handleDelete(expense.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── AI Receipt Scan Dialog ── */}
      <Dialog
        open={showScanDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowScanDialog(false);
            setScanImageUrl(null);
            setScannedItems([]);
            setSelectedItems([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg bg-surface dark:bg-surface-inverted border-line dark:border-ink-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
              <Sparkles className="w-5 h-5 text-brand-600" />
              AI Receipt Scanner
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload area */}
            {!scanImageUrl ? (
              <div
                onClick={() =>
                  document.getElementById("scan-receipt-upload").click()
                }
                className="border-2 border-dashed border-brand-200 dark:border-brand-800 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all"
              >
                {uploadingForScan ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                    <p className="text-sm text-brand-600 font-medium">
                      Uploading...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <Camera className="w-7 h-7 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-content dark:text-content-inverted">
                        Upload Receipt Photo
                      </p>
                      <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                        Take a photo or upload from gallery — AI will extract
                        all items
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-brand-300 text-brand-700 dark:border-brand-700 dark:text-brand-400 mt-1"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Photo
                    </Button>
                  </div>
                )}
                <input
                  id="scan-receipt-upload"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleScanReceiptUpload}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Image preview */}
                <div className="relative rounded-xl overflow-hidden border border-line dark:border-ink-700">
                  <img
                    src={scanImageUrl}
                    alt="Receipt"
                    className="w-full max-h-48 object-contain bg-surface-sunken dark:bg-ink-800"
                  />
                  <button
                    onClick={() => {
                      setScanImageUrl(null);
                      setScannedItems([]);
                      setSelectedItems([]);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 bg-surface-inverted/70 text-content-inverted rounded-full flex items-center justify-center hover:bg-surface-inverted transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Scan button */}
                {scannedItems.length === 0 && (
                  <Button
                    onClick={handleScanReceipt}
                    disabled={scanning}
                    className="w-full bg-brand-700 hover:bg-brand text-content-inverted h-11"
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        AI is scanning your receipt...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Scan & Extract Items
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Scanned Items */}
            {scannedItems.length > 0 && (
              <div className="space-y-3">
                {/* Vendor / date info */}
                <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-3 border border-brand-100 dark:border-brand-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-brand-700 dark:text-brand-400 font-medium">
                        Vendor
                      </Label>
                      <Input
                        value={scannedVendor}
                        onChange={(e) => setScannedVendor(e.target.value)}
                        className="mt-1 h-8 text-sm dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-brand-700 dark:text-brand-400 font-medium">
                        Date
                      </Label>
                      <Input
                        type="date"
                        value={scannedDate}
                        onChange={(e) => setScannedDate(e.target.value)}
                        className="mt-1 h-8 text-sm dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-content dark:text-content-inverted">
                    {scannedItems.length} items found
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setSelectedItems(scannedItems.map((i) => i.id))
                      }
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-ink-300 dark:text-content-body dark:dark:text-ink-300">
                      |
                    </span>
                    <button
                      onClick={() => setSelectedItems([])}
                      className="text-xs text-content-muted dark:text-content-subtle hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {scannedItems.map((item) => {
                    const selected = selectedItems.includes(item.id);
                    const catStyle = getCategoryStyle(item.category);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItemSelection(item.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          selected
                            ? "border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
                            : "border-line dark:border-ink-700 hover:border-line-strong dark:hover:border-ink-600"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected
                              ? "border-brand-500 bg-brand-500"
                              : "border-line-strong dark:border-ink-600"
                          }`}
                        >
                          {selected && (
                            <CheckCircle className="w-3.5 h-3.5 text-content-inverted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-content dark:text-content-inverted truncate">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              className={`text-[10px] border-0 py-0 ${catStyle.color}`}
                            >
                              {catStyle.label}
                            </Badge>
                            <span className="text-xs text-content-muted dark:text-content-subtle">
                              {item.quantity > 1
                                ? `${item.quantity} × $${(item.unit_cost || 0).toFixed(2)}`
                                : ""}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-content dark:text-content-inverted flex-shrink-0">
                          ${(item.amount || 0).toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="bg-success-50 dark:bg-success-900/20 rounded-xl p-3 border border-success-200 dark:border-success-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-success-700 dark:text-success-400 font-medium">
                      {selectedItems.length} items selected
                    </p>
                    <p className="text-lg font-bold text-success-700 dark:text-success-400">
                      $
                      {scannedItems
                        .filter((i) => selectedItems.includes(i.id))
                        .reduce((s, i) => s + (i.amount || 0), 0)
                        .toFixed(2)}
                    </p>
                  </div>
                  <Button
                    onClick={handleSaveScannedItems}
                    disabled={savingScanned || selectedItems.length === 0}
                    className="bg-brand hover:bg-brand-hover text-content-inverted"
                  >
                    {savingScanned ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      `Add ${selectedItems.length} Expense${selectedItems.length !== 1 ? "s" : ""}`
                    )}
                  </Button>
                </div>

                {/* Re-scan option */}
                <button
                  onClick={() => {
                    setScannedItems([]);
                    setSelectedItems([]);
                  }}
                  className="w-full text-xs text-content-subtle hover:text-content-body dark:hover:text-ink-300 text-center py-1"
                >
                  ↺ Re-scan with different image
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg bg-surface dark:bg-surface-inverted border-line dark:border-ink-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
              <Receipt className="w-5 h-5 text-success-600" />
              {editingExpense ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                Description *
              </Label>
              <Input
                placeholder="e.g., PVC pipes, 2x4 lumber, drywall..."
                value={form.description}
                onChange={(e) =>
                  handleFormChange("description", e.target.value)
                }
                className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
              />
            </div>

            {/* Category + Vendor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                  Category
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => handleFormChange("category", v)}
                >
                  <SelectTrigger className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                  Vendor / Store
                </Label>
                <Input
                  placeholder="e.g., Home Depot"
                  value={form.vendor}
                  onChange={(e) => handleFormChange("vendor", e.target.value)}
                  className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
                />
              </div>
            </div>

            {/* Quantity + Unit Cost + Total */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                  Qty
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => handleFormChange("quantity", e.target.value)}
                  className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                  Unit Cost ($)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.unit_cost}
                  onChange={(e) =>
                    handleFormChange("unit_cost", e.target.value)
                  }
                  className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                  Total Cost ($) *
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => handleFormChange("amount", e.target.value)}
                  className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted font-semibold"
                />
              </div>
            </div>

            {/* Date + Markup */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                  Date
                </Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) =>
                    handleFormChange("expense_date", e.target.value)
                  }
                  className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                  Markup %{" "}
                  <span className="text-content-subtle font-normal">
                    (for invoice)
                  </span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.markup_percent}
                  onChange={(e) =>
                    handleFormChange("markup_percent", e.target.value)
                  }
                  className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
                />
              </div>
            </div>

            {/* Billable preview */}
            {(parseFloat(form.amount) > 0 ||
              parseFloat(form.markup_percent) > 0) && (
              <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-3 border border-success-200 dark:border-success-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-success-700 dark:text-success-400">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Billable amount to client:
                  </span>
                </div>
                <span className="text-lg font-bold text-success-700 dark:text-success-400">
                  $
                  {computeBillable(form.amount, form.markup_percent).toFixed(2)}
                </span>
              </div>
            )}

            {/* Include in invoice toggle */}
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-surface-sunken dark:bg-ink-800 rounded-lg border border-line dark:border-ink-700">
              <input
                type="checkbox"
                checked={form.include_in_invoice}
                onChange={(e) =>
                  handleFormChange("include_in_invoice", e.target.checked)
                }
                className="w-4 h-4 accent-success-600"
              />
              <div>
                <p className="text-sm font-medium text-content dark:text-content-inverted">
                  Include in invoice
                </p>
                <p className="text-xs text-content-muted dark:text-content-subtle">
                  Add this to the client's invoice as a line item
                </p>
              </div>
            </label>

            {/* Receipt upload */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                Receipt Photo{" "}
                <span className="text-content-subtle font-normal">
                  (optional)
                </span>
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    document.getElementById("expense-receipt-upload").click()
                  }
                  disabled={uploadingReceipt}
                  className="flex-1 border-dashed border-2 h-10 dark:border-ink-600 dark:text-ink-300"
                >
                  {uploadingReceipt ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {form.receipt_url ? "Replace Receipt" : "Upload Receipt"}
                    </>
                  )}
                </Button>
                {form.receipt_url && (
                  <a
                    href={form.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 dark:border-ink-600"
                    >
                      <ExternalLink className="w-4 h-4 text-info-600" />
                    </Button>
                  </a>
                )}
              </div>
              <input
                id="expense-receipt-upload"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleReceiptUpload}
              />
              {form.receipt_url && (
                <p className="text-xs text-success-600 dark:text-success-400 flex items-center gap-1">
                  <Receipt className="w-3 h-3" />
                  Receipt uploaded
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-700 dark:text-ink-300">
                Notes{" "}
                <span className="text-content-subtle font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                placeholder="Any additional notes..."
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                className="dark:bg-ink-800 dark:border-ink-600 dark:text-content-inverted"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={saving}
              className="flex-1 dark:border-ink-600 dark:text-ink-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-brand hover:bg-brand-hover"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingExpense ? (
                "Update Expense"
              ) : (
                "Add Expense"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
