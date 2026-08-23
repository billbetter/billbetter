/**
 * Where a crew invitation link lands.
 *
 * send-crew-invite has been emailing /AcceptCrewInvite?token=… for as long as
 * the function has existed; the page it points at was never built, so every
 * invitation ever sent led to a 404.
 *
 * Acceptance itself cannot happen here. The invitee is not in EmployeeProfile
 * yet, so RLS denies them the CrewInvite row -- the accept-crew-invite edge
 * function does the write on the service role. This page's job is to explain
 * what is being offered, make sure the right person is signed in, and call it.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { supabase } from "@/api/supabaseClient";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
  LogIn,
} from "lucide-react";
import { clearBusinessContext } from "@/lib/crew";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function Shell({ children }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4">
      <Card className="w-full">
        <CardContent className="p-8 text-center">{children}</CardContent>
      </Card>
    </div>
  );
}

export default function AcceptCrewInvite() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [invite, setInvite] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  /**
   * Describing the invite is a public read -- the invitee is not signed in yet
   * on a first visit, and often has no account at all. supabase.functions
   * .invoke() always POSTs, so this one call goes direct rather than through
   * the sdk helper.
   */
  const describe = useCallback(async (value) => {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/accept-crew-invite?token=${encodeURIComponent(value)}`,
      { headers: { apikey: SUPABASE_ANON_KEY } },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "That invitation link is not valid.");
    return body;
  }, []);

  useEffect(() => {
    (async () => {
      const value = new URLSearchParams(window.location.search).get("token");
      setToken(value);

      if (!value) {
        setError("This link is missing its invitation code.");
        setLoading(false);
        return;
      }

      try {
        const [details, session] = await Promise.all([
          describe(value),
          supabase.auth.getUser(),
        ]);
        setInvite(details);
        setUser(session?.data?.user || null);
        if (details.expired) setError("This invitation has expired. Ask for a new one.");
        if (details.status === "revoked") setError("This invitation has been revoked.");
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [describe]);

  const accept = async () => {
    setAccepting(true);
    setError(null);
    const res = await sdk.functions.invoke("acceptCrewInvite", { token });
    setAccepting(false);

    if (!res?.data?.success) {
      setError(res?.data?.error || "Could not accept that invitation.");
      return;
    }
    // The cached context still says "solo owner" -- clearing it is what makes
    // the next page load resolve as crew of the business just joined.
    clearBusinessContext();
    setDone(res.data.business_name || "the team");
  };

  if (loading) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-content-400" />
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <CheckCircle2 className="mx-auto h-12 w-12 text-success-600" />
        <h1 className="mt-4 text-2xl font-black text-content">You're in</h1>
        <p className="mt-2 text-content-500">
          You've joined <strong>{done}</strong>. Their jobs and clients are on
          your dashboard now.
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() => navigate(createPageUrl("Dashboard"))}
        >
          Go to the dashboard
        </Button>
      </Shell>
    );
  }

  if (error && !invite) {
    return (
      <Shell>
        <AlertCircle className="mx-auto h-12 w-12 text-danger-500" />
        <h1 className="mt-4 text-xl font-black text-content">
          This link doesn't work
        </h1>
        <p className="mt-2 text-content-500">{error}</p>
      </Shell>
    );
  }

  const alreadyAccepted = invite?.status === "accepted";
  const blocked = Boolean(error) || alreadyAccepted;

  // The invite is addressed to one email and the server enforces that. Saying
  // so here saves someone signing in as the wrong account and being refused.
  const wrongAccount =
    user?.email &&
    invite?.email &&
    user.email.trim().toLowerCase() !== invite.email.trim().toLowerCase();

  return (
    <Shell>
      <Users className="mx-auto h-12 w-12 text-brand-600" />
      <h1 className="mt-4 text-2xl font-black tracking-tight text-content">
        Join {invite?.business_name}
      </h1>
      <p className="mt-2 text-content-500">
        You've been invited as{" "}
        <strong className="text-content">{invite?.role || "a team member"}</strong>.
        Once you accept, their jobs, clients and schedule show up in your
        Invoicium account.
      </p>

      {alreadyAccepted ? (
        <p className="mt-4 rounded-lg bg-surface-100 px-3 py-2 text-sm text-content-600">
          This invitation has already been accepted.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </p>
      ) : null}

      {!user ? (
        <>
          <p className="mt-6 text-sm text-content-500">
            Sign in as <strong>{invite?.email}</strong> to accept. If you don't
            have an account yet, create one with that address.
          </p>
          <Button
            className="mt-4 w-full gap-2"
            onClick={() =>
              sdk.auth.redirectToLogin(
                `${window.location.pathname}${window.location.search}`,
              )
            }
          >
            <LogIn className="h-4 w-4" />
            Sign in to accept
          </Button>
        </>
      ) : wrongAccount ? (
        <p className="mt-6 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-900">
          You're signed in as {user.email}, but this invitation was sent to{" "}
          {invite.email}. Sign out and back in as that address to accept it.
        </p>
      ) : (
        <Button
          className="mt-6 w-full gap-2"
          onClick={accept}
          disabled={accepting || blocked}
        >
          {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Accept invitation
        </Button>
      )}
    </Shell>
  );
}
