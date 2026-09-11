import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";









import { canAccessFeature } from "@/components/utils/permissions";
import ListLoadingState from "@/components/documentList/ListLoadingState";
import ConfirmDeleteDialog from "@/components/documentList/ConfirmDeleteDialog";
import RecurringActionSheet from "@/components/invoice/recurring/RecurringActionSheet";
import RecurringInvoiceList from "@/components/invoice/recurring/RecurringInvoiceList";
import FrequentServicesCard from "@/components/invoice/recurring/FrequentServicesCard";
import RecurringFilterBar from "@/components/invoice/recurring/RecurringFilterBar";
import RecurringDesktopHeader from "@/components/invoice/recurring/RecurringDesktopHeader";
import RecurringMobileHeader from "@/components/invoice/recurring/RecurringMobileHeader";
import SchedulerNotRunningNotice from "@/components/invoice/recurring/SchedulerNotRunningNotice";

export default function RecurringInvoices() {
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    invoice: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [recentServices, setRecentServices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(null);
  const [stats, setStats] = useState({
    active: 0,
    paused: 0,
    monthlyRevenue: 0,
    total: 0,
  });

  useEffect(() => {
    loadRecurringInvoices();
  }, []);

  const loadRecurringInvoices = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const currentUser = await sdk.auth.me();

      const [data, subscriptionData, customTemplates] =
        await Promise.all([
          sdk.entities.RecurringInvoice.filter(
            { user_id: currentUser.id },
            "-created_date",
          ),
          sdk.entities.Subscription.filter({ user_id: currentUser.id }),
          sdk.entities.CustomServiceTemplate.filter(
            { user_id: currentUser.id },
            "-use_count",
            5,
          ),
        ]);

      setRecurringInvoices(data);
      setSubscription(subscriptionData.length > 0 ? subscriptionData[0] : null);
      setRecentServices(customTemplates);

      const active = data.filter((inv) => inv.status === "active").length;
      const paused = data.filter((inv) => inv.status === "paused").length;
      const monthlyRevenue = data
        .filter((inv) => inv.status === "active")
        .reduce((sum, inv) => sum + (inv.total || 0), 0);

      setStats({
        active,
        paused,
        monthlyRevenue,
        total: data.length,
      });
    } catch (error) {
      console.error("Error loading recurring invoices:", error);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const handleToggleStatus = async (recurringInvoice) => {
    setUpdatingStatus(recurringInvoice.id);
    try {
      const newStatus =
        recurringInvoice.status === "active" ? "paused" : "active";
      await sdk.entities.RecurringInvoice.update(recurringInvoice.id, {
        status: newStatus,
      });
      await loadRecurringInvoices(true);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
    setUpdatingStatus(null);
  };

  const handleDelete = async () => {
    if (!deleteDialog.invoice) return;
    setDeleting(true);
    try {
      await sdk.entities.RecurringInvoice.delete(deleteDialog.invoice.id);
      setDeleteDialog({ open: false, invoice: null });
      loadRecurringInvoices(true);
    } catch (error) {
      console.error("Error deleting recurring invoice:", error);
      alert("Failed to delete recurring invoice. Please try again.");
    }
    setDeleting(false);
  };

  const filteredInvoices = recurringInvoices.filter((invoice) => {
    const matchesSearch =
      invoice.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.template_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const hasRecurringAccess = canAccessFeature(
    subscription,
    "recurring_invoices",
  );

  if (loading && recurringInvoices.length === 0) {
    return (
      <ListLoadingState
        label="Loading recurring invoices"
        spinnerClassName="text-success-600 dark:text-success-400"
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        <SchedulerNotRunningNotice />
        <RecurringMobileHeader
          loadRecurringInvoices={loadRecurringInvoices}
          refreshing={refreshing}
          stats={stats}
        />

        <RecurringDesktopHeader
          loadRecurringInvoices={loadRecurringInvoices}
          refreshing={refreshing}
          stats={stats}
        />

        <RecurringFilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          setStatusFilter={setStatusFilter}
          statusFilter={statusFilter}
        />

        <FrequentServicesCard
          recentServices={recentServices}
        />

        <RecurringInvoiceList
          filteredInvoices={filteredInvoices}
          handleToggleStatus={handleToggleStatus}
          hasRecurringAccess={hasRecurringAccess}
          searchTerm={searchTerm}
          setDeleteDialog={setDeleteDialog}
          setMobileMenuOpen={setMobileMenuOpen}
          statusFilter={statusFilter}
          updatingStatus={updatingStatus}
        />
      </div>

      <RecurringActionSheet
        filteredInvoices={filteredInvoices}
        mobileMenuOpen={mobileMenuOpen}
        setDeleteDialog={setDeleteDialog}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <ConfirmDeleteDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          !deleting && setDeleteDialog({ open, invoice: null })
        }
        title="Delete Recurring Invoice?"
        deleting={deleting}
        onCancel={() => setDeleteDialog({ open: false, invoice: null })}
        onConfirm={handleDelete}
      >
        This will stop all future invoices for{" "}
        <span className="font-bold text-content dark:text-content-inverted">
          {deleteDialog.invoice?.client_name}
        </span>
        . This action cannot be undone.
      </ConfirmDeleteDialog>
    </div>
  );
}
