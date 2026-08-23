/**
 * The crew roster.
 *
 * Professional has sold "crew management" since the pricing page existed and
 * this screen is what it was selling. The tables (EmployeeProfile, CrewInvite)
 * and the invite email have been in the repo the whole time; what was missing
 * was any way to reach them, plus RLS that let a crew member see the business
 * they had joined. See supabase/migrations/20260823000000_crew_access.sql.
 */

import React, { useCallback, useEffect, useState } from "react";
import { sdk } from "@/api/sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Mail,
  Loader2,
  Trash2,
  ShieldCheck,
  Clock,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import FeatureGate from "@/components/access/FeatureGate";
import { getCrewSeatAllowance } from "@/components/utils/permissions";
import { CREW_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/crew";

const EMPTY_INVITE = { email: "", name: "", role: "employee", custom_title: "" };

/** Seats shown as "3 of 4", or "3" when the plan is unlimited. */
function seatLabel(used, allowed) {
  if (allowed === -1) return `${used} crew member${used === 1 ? "" : "s"}`;
  return `${used} of ${allowed} seat${allowed === 1 ? "" : "s"} used`;
}

function RoleBadge({ role }) {
  const tone =
    role === "admin"
      ? "bg-brand-100 text-brand-800"
      : role === "supervisor"
        ? "bg-warning-100 text-warning-800"
        : "bg-surface-200 text-content-600";
  return (
    <Badge className={`${tone} border-0 font-semibold`} variant="secondary">
      {ROLE_LABELS[role] || role}
    </Badge>
  );
}

function TeamInner() {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_INVITE);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await sdk.auth.me();
      const [memberRows, inviteRows, subs] = await Promise.all([
        sdk.entities.EmployeeProfile.filter({ owner_id: user.id }),
        sdk.entities.CrewInvite.filter({ owner_id: user.id }, "-created_date"),
        sdk.entities.Subscription.filter({ user_id: user.id }),
      ]);
      setMembers((memberRows || []).filter((m) => m.is_active));
      setInvites((inviteRows || []).filter((i) => i.status === "pending"));
      setSubscription(subs?.[0] || null);
    } catch (err) {
      console.error("Team: load failed", err);
      setError(err.message || "Could not load your team.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A pending invite holds a seat. Counting only accepted members would let
  // someone invite past the limit and let the race decide who actually gets in.
  const allowed = getCrewSeatAllowance(subscription);
  const used = members.length + invites.length;
  const seatsLeft = allowed === -1 ? Infinity : allowed - used;

  const sendInvite = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSending(true);
    const res = await sdk.functions.invoke("sendCrewInvite", {
      email: form.email,
      name: form.name,
      role: form.role,
      custom_title: form.custom_title,
    });
    setSending(false);

    if (!res?.data?.success) {
      setError(res?.data?.error || "Could not send that invitation.");
      return;
    }
    setInviteOpen(false);
    setForm(EMPTY_INVITE);
    setNotice(`Invitation sent to ${form.email}.`);
    load();
  };

  const changeRole = async (member, role) => {
    setBusyId(member.id);
    try {
      await sdk.entities.EmployeeProfile.update(member.id, { role });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role } : m)),
      );
    } catch (err) {
      setError(err.message || "Could not change that role.");
    }
    setBusyId(null);
  };

  // Deactivate rather than delete: the person's name is on jobs, photos and
  // timesheets, and deleting the row would orphan all of it. is_active=false
  // drops them out of accessible_owner_ids immediately, which is what actually
  // revokes access.
  const removeMember = async () => {
    const member = removeTarget;
    if (!member) return;
    setBusyId(member.id);
    try {
      await sdk.entities.EmployeeProfile.update(member.id, {
        is_active: false,
        removed_at: new Date().toISOString(),
      });
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setNotice(`${member.name || member.email} no longer has access.`);
    } catch (err) {
      setError(err.message || "Could not remove that person.");
    }
    setBusyId(null);
    setRemoveTarget(null);
  };

  const revokeInvite = async (invite) => {
    setBusyId(invite.id);
    try {
      await sdk.entities.CrewInvite.update(invite.id, {
        status: "revoked",
        token: null,
      });
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      setError(err.message || "Could not revoke that invitation.");
    }
    setBusyId(null);
  };

  const resendInvite = async (invite) => {
    setBusyId(invite.id);
    const res = await sdk.functions.invoke("sendCrewInvite", {
      email: invite.email,
      name: invite.name,
      role: invite.role,
      custom_title: invite.custom_title,
    });
    setBusyId(null);
    if (!res?.data?.success) {
      setError(res?.data?.error || "Could not resend that invitation.");
      return;
    }
    setNotice(`Invitation resent to ${invite.email}.`);
    load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-content-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-content sm:text-3xl">
            <Users className="h-7 w-7 text-brand-600" />
            Your team
          </h1>
          <p className="mt-1 text-sm text-content-500">
            {seatLabel(used, allowed)}. Crew members see your jobs and clients,
            and log their hours against them.
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            setInviteOpen(true);
          }}
          disabled={seatsLeft <= 0}
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Invite someone
        </Button>
      </div>

      {notice ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      ) : null}

      {allowed === 0 ? (
        <Card className="mt-6 border-warning-200 bg-warning-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-warning-900">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>
              Your plan is for a single operator. Upgrade to Professional to add
              your crew.
            </span>
          </CardContent>
        </Card>
      ) : null}

      {seatsLeft <= 0 && allowed > 0 ? (
        <Card className="mt-6 border-warning-200 bg-warning-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-warning-900">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>
              Every seat on your plan is in use. Remove someone, or upgrade to
              add more.
            </span>
          </CardContent>
        </Card>
      ) : null}

      {/* -- Members --------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-content-400">
          Members
        </h2>
        {members.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-content-300" />
              <p className="mt-3 font-semibold text-content">
                Nobody else yet
              </p>
              <p className="mt-1 text-sm text-content-500">
                Invite your crew and their hours, photos and job notes all land
                in one place.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 space-y-2">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                    {(member.name || member.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-content">
                      {member.name || member.email}
                    </p>
                    <p className="truncate text-xs text-content-500">
                      {member.custom_title
                        ? `${member.custom_title} · ${member.email}`
                        : member.email}
                    </p>
                  </div>

                  <select
                    value={member.role || "employee"}
                    onChange={(e) => changeRole(member, e.target.value)}
                    disabled={busyId === member.id}
                    aria-label={`Role for ${member.name || member.email}`}
                    className="h-9 rounded-md border border-line bg-surface px-2 text-sm font-semibold text-content"
                  >
                    {CREW_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name || member.email}`}
                    disabled={busyId === member.id}
                    onClick={() => setRemoveTarget(member)}
                  >
                    {busyId === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-danger-600" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* -- Pending invites -------------------------------------------- */}
      {invites.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-content-400">
            Pending invitations
          </h2>
          <div className="mt-3 space-y-2">
            {invites.map((invite) => (
              <Card key={invite.id} className="border-dashed">
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <Mail className="h-5 w-5 flex-shrink-0 text-content-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-content">
                      {invite.email}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-content-500">
                      <Clock className="h-3 w-3" />
                      Invited{" "}
                      {invite.created_date
                        ? format(new Date(invite.created_date), "d MMM")
                        : "recently"}
                      {invite.expires_at
                        ? ` · expires ${format(new Date(invite.expires_at), "d MMM")}`
                        : ""}
                    </p>
                  </div>
                  <RoleBadge role={invite.role || "employee"} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    disabled={busyId === invite.id}
                    onClick={() => resendInvite(invite)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-600"
                    disabled={busyId === invite.id}
                    onClick={() => revokeInvite(invite)}
                  >
                    Revoke
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* -- What the roles mean ---------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-content-400">
          What each role can do
        </h2>
        <Card className="mt-3">
          <CardContent className="divide-y divide-line p-0">
            {CREW_ROLES.slice()
              .reverse()
              .map((role) => (
                <div key={role} className="flex gap-3 p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-content-400" />
                  <div>
                    <p className="text-sm font-bold text-content">
                      {ROLE_LABELS[role]}
                    </p>
                    <p className="text-sm text-content-500">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </section>

      {/* -- Invite dialog ---------------------------------------------- */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <form onSubmit={sendInvite}>
            <DialogHeader>
              <DialogTitle>Invite a crew member</DialogTitle>
              <DialogDescription>
                They will get an email with a link to join. It expires in 14
                days.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="crew-email">Email</Label>
                <Input
                  id="crew-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="sam@example.com"
                />
              </div>
              <div>
                <Label htmlFor="crew-name">Name</Label>
                <Input
                  id="crew-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sam Rivera"
                />
              </div>
              <div>
                <Label htmlFor="crew-role">Role</Label>
                <select
                  id="crew-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-content"
                >
                  {CREW_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]} — {ROLE_DESCRIPTIONS[role]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="crew-title">Job title (optional)</Label>
                <Input
                  id="crew-title"
                  value={form.custom_title}
                  onChange={(e) =>
                    setForm({ ...form, custom_title: e.target.value })
                  }
                  placeholder="Lead installer"
                />
              </div>

              {error ? (
                <p className="text-sm font-medium text-danger-600">{error}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -- Remove confirmation ---------------------------------------- */}
      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {removeTarget?.name || removeTarget?.email}?
            </DialogTitle>
            <DialogDescription>
              They lose access immediately. Their logged hours, photos and job
              notes stay on your records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeMember}
              disabled={busyId === removeTarget?.id}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Team() {
  return (
    <FeatureGate feature="crew_management" title="Crew Management">
      <TeamInner />
    </FeatureGate>
  );
}
