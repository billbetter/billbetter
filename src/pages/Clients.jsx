import React, { useEffect, useState } from "react";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  PlusCircle,
  Mail,
  Phone,
  MapPin,
  Trash2,
  Loader2,
  Edit,
  Star,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import PhoneInput from "../components/ui/PhoneInput";
import PullToRefresh from "@/components/utils/PullToRefresh";

/**
 * Helper: some projects model the owner field as `user_id` (string),
 * others as `user` (relation). We’ll detect/try both.
 */
async function createClientWithOwnerFallback(payload) {
  try {
    // Try common pattern 1: user_id
    return await sdk.entities.Client.create(payload);
  } catch (err) {
    // If we sent user_id and got a validation error, retry with `user`
    const msg = (
      err?.response?.data?.error ||
      err?.message ||
      ""
    ).toLowerCase();
    const isUnknownField =
      msg.includes("unknown field") ||
      msg.includes("invalid field") ||
      msg.includes("validation");
    const triedUserId = Object.prototype.hasOwnProperty.call(
      payload,
      "user_id",
    );
    if (triedUserId && isUnknownField) {
      const { user_id, ...rest } = payload;
      // Relation shapes vary; try simplest first
      const altPayloads = [
        { ...rest, user: user_id }, // user as string id
        { ...rest, user: { id: user_id } }, // user as object ref
        { ...rest, user: { connect: user_id } }, // connect-style
      ];
      let lastErr = err;
      for (const pp of altPayloads) {
        try {
          return await sdk.entities.Client.create(pp);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    }
    throw err;
  }
}

async function updateClientWithOwnerSafety(id, payload) {
  try {
    return await sdk.entities.Client.update(id, payload);
  } catch (err) {
    // If `user_id` isn’t accepted on update, retry without it.
    const msg = (
      err?.response?.data?.error ||
      err?.message ||
      ""
    ).toLowerCase();
    const isUnknownField =
      msg.includes("unknown field") ||
      msg.includes("invalid field") ||
      msg.includes("validation");
    const hasUserId = Object.prototype.hasOwnProperty.call(payload, "user_id");
    if (hasUserId && isUnknownField) {
      const { user_id, ...rest } = payload;
      return await sdk.entities.Client.update(id, rest);
    }
    throw err;
  }
}

import { useNavigate } from "react-router-dom";

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    client: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const me = await sdk.auth.me();

      // Load employee profile for permissions
      // Determine whose data to load (owner's or own)

      // If user is a crew member, only show clients connected to their assigned jobs
      if (profile) {
        // First get jobs assigned to this crew member
        const assignedJobs = await sdk.entities.Job.filter({
          user_id: me.id,
          assigned_to: me.id,
        });

        // Extract unique client IDs from assigned jobs
        const assignedClientIds = [
          ...new Set(
            assignedJobs
              .filter((job) => job.client_id)
              .map((job) => job.client_id),
          ),
        ];

        // Fetch only those clients
        if (assignedClientIds.length > 0) {
          const allClients = await sdk.entities.Client.filter({
            user_id: me.id,
          });
          const filteredClients = allClients.filter((client) =>
            assignedClientIds.includes(client.id),
          );
          setClients(filteredClients);
        } else {
          setClients([]);
        }
      } else {
        // Boss sees all clients
        const clientData = await sdk.entities.Client.filter(
          { user_id: me.id },
          "-created_date",
        );
        setClients(Array.isArray(clientData) ? clientData : []);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        notes: client.notes || "",
      });
    } else {
      setEditingClient(null);
      setFormData({ name: "", email: "", phone: "", address: "", notes: "" });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const me = await sdk.auth.me();

      // Check if user is an employee - save to owner's account
      // Basic validation
      const name = (formData.name || "").trim();
      if (!name) throw new Error("Name is required.");

      const payloadBase = {
        name,
        email: (formData.email || "").trim() || null,
        phone: (formData.phone || "").trim() || null,
        address: (formData.address || "").trim() || null,
        notes: (formData.notes || "").trim() || null,
      };

      if (editingClient?.id) {
        const payload = { ...payloadBase, user_id: me.id };
        await updateClientWithOwnerSafety(editingClient.id, payload);
      } else {
        const payload = { ...payloadBase, user_id: me.id };
        await createClientWithOwnerFallback(payload);
      }

      await loadClients();
      setDialogOpen(false);
      setEditingClient(null);
      setFormData({ name: "", email: "", phone: "", address: "", notes: "" });
    } catch (error) {
      console.error("Error saving client:", error);
      const serverMsg =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to save client.";
      alert("⚠️ Failed to save client.\n\n" + serverMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.client) return;
    setDeleting(true);
    try {
      await sdk.entities.Client.delete(deleteDialog.client.id);
      await loadClients();
      setDeleteDialog({ open: false, client: null });
    } catch (error) {
      console.error("❌ ERROR DELETING CLIENT:", error);
      alert("Failed to delete client. You might not have permission.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-8 h-8 animate-spin text-success-600 dark:text-success-400" />
          </div>
          <div className="text-center">
            <p className="text-content dark:text-content-inverted font-semibold text-base">
              Loading clients
            </p>
            <p className="text-content-muted dark:text-content-subtle text-sm mt-1">
              Please wait a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadClients}>
      <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 max-w-7xl mx-auto min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted mb-0.5 sm:mb-1">
              Clients
            </h1>
            <p className="text-sm sm:text-base text-content-muted dark:text-content-subtle">
              {clients.length} {clients.length === 1 ? "client" : "clients"}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {/* Only show Add Client button for the boss - employees see only assigned clients */}
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover flex items-center gap-2 flex-shrink-0 shadow-lg shadow-success-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Add Client</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] dark:bg-surface-inverted dark:border-ink-800">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Edit Client" : "Add New Client"}
                </DialogTitle>
                <DialogDescription>
                  Store your client’s contact info and notes.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    Name <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Client or company name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="dark:bg-ink-800 dark:border-ink-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="dark:bg-ink-800 dark:border-ink-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number</Label>
                  <PhoneInput
                    id="phone"
                    value={formData.phone}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                  />
                  <p className="text-xs text-content-subtle">
                    Format: +1 (555) 123-4567
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    rows={2}
                    placeholder="123 Main St, City, State"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="dark:bg-ink-800 dark:border-ink-700 resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Any notes about this client..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="dark:bg-ink-800 dark:border-ink-700 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="dark:border-ink-700 dark:text-ink-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover min-w-[110px]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : editingClient ? (
                      "Update Client"
                    ) : (
                      "Add Client"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {clients.length === 0 ? (
          <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line-subtle dark:border-ink-700 shadow-sm">
            <div className="p-10 sm:p-16 text-center">
              <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-content-subtle dark:text-content-muted" />
              </div>
              <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                No clients yet
              </h3>
              <p className="text-sm text-content-muted dark:text-content-subtle mb-6">
                Add your first client to get started
              </p>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover shadow-lg"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Your First Client
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-surface dark:bg-ink-800 rounded-2xl border border-line-subtle dark:border-ink-700 shadow-sm hover:shadow-md dark:hover:shadow-ink-900/30 transition-all duration-200 overflow-hidden"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-success-700 flex items-center justify-center text-content-inverted font-bold text-base sm:text-lg flex-shrink-0 shadow-md">
                        {client?.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black text-content dark:text-content-inverted truncate">
                          {client?.name || "—"}
                        </h3>
                        {!!client?.total_invoiced &&
                          client.total_invoiced > 0 && (
                            <span className="text-xs font-semibold text-success-600 dark:text-success-400">
                              ${Number(client.total_invoiced).toFixed(2)} total
                            </span>
                          )}
                      </div>
                    </div>
                    {
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleOpenDialog(client)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-content-muted hover:text-success-700 dark:hover:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/30 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteDialog({ open: true, client })
                          }
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-content-body hover:text-danger-700 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 transition-colors dark:text-ink-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    }
                  </div>

                  <div className="space-y-2 mt-3 pt-3 border-t border-ink-50 dark:border-ink-700">
                    {!!client?.email && (
                      <div className="flex items-center gap-2 text-sm text-content-body dark:text-content-subtle">
                        <Mail className="w-3.5 h-3.5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {!!client?.phone && (
                      <div className="flex items-center gap-2 text-sm text-content-body dark:text-content-subtle">
                        <Phone className="w-3.5 h-3.5 text-content-subtle dark:text-content-muted flex-shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {!!client?.address && (
                      <div className="flex items-start gap-2 text-sm text-content-body dark:text-content-subtle">
                        <MapPin className="w-3.5 h-3.5 text-content-subtle dark:text-content-muted flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{client.address}</span>
                      </div>
                    )}
                    {!!client?.notes && (
                      <div className="pt-2 border-t border-ink-50 dark:border-ink-700">
                        <p className="text-xs text-content-muted dark:text-content-subtle line-clamp-2">
                          {client.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ open, client: null })}
        >
          <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
            <DialogHeader className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto shadow-sm dark:bg-danger-900/30">
                <Trash2 className="w-7 h-7 text-danger-600 dark:text-danger-400" />
              </div>
              <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
                Delete Client
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-content dark:text-content-inverted">
                  {deleteDialog.client?.name}
                </span>
                ? This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setDeleteDialog({ open: false, client: null })}
                disabled={deleting}
                className="flex-1 h-12 text-sm font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-12 text-sm font-semibold bg-danger-600 hover:bg-danger-700 text-content-inverted rounded-xl"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
