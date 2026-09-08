/**
 * Four questions, then the calendar.
 *
 * -- Why ask anything at all -----------------------------------------------
 *
 * /BookDemo used to be a button straight to a Google appointment link, so the
 * only thing ever learned about a lead was the name and email Google collects,
 * delivered as a calendar invite. Four questions asked before the handoff turn
 * that into something you can sort, count and open a conversation with.
 *
 * -- Why these four --------------------------------------------------------
 *
 *   name        so the call does not open with "hi, who am I speaking to"
 *   phone       NOT email. A trade will give you a number they answer sooner
 *               than an address they check on Sundays, and a text gets read.
 *               Google takes the email at the booking step anyway, so asking
 *               here would be asking twice for the weaker of the two.
 *   trade       doing double duty: it qualifies the lead AND personalises the
 *               follow-up, which is the difference between "thanks for
 *               booking" and "here is how we handle progress billing for
 *               electrical work".
 *   team size   one click, and it decides which plan the demo should show.
 *
 * And no more than four. Every extra box on a form between someone wanting a
 * demo and getting one costs conversions, so anything that can be asked on the
 * call is asked on the call.
 *
 * -- Why the calendar is a link and not window.open() ----------------------
 *
 * Opening it in code means opening it AFTER an await, by which point the
 * browser no longer credits the click as a user gesture and the popup blocker
 * eats it silently -- the same class of failure that made PDFs look broken
 * (see src/lib/pdfDelivery.js). A link the visitor clicks cannot be blocked,
 * and it doubles as confirmation that their details went through.
 */

import React, { useState } from "react";
import { ArrowRight, Calendar, CheckCircle, Loader2 } from "lucide-react";

import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PhoneInput from "@/components/ui/PhoneInput";
import { TEAM_SIZES, TRADE_OPTIONS } from "@/config/trades";

const BOOKING_URL = "https://calendar.app.google/oMcQbdWok7g1wYrm9";

export default function DemoRequestForm({ source = "BookDemo" }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!teamSize) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("DemoRequest").insert([
        {
          name: name.trim().slice(0, 120),
          phone: phone.trim().slice(0, 40),
          trade,
          team_size: teamSize,
          source,
        },
      ]);
      if (error) throw error;
    } catch (err) {
      // Deliberately not shown to the visitor. Their booking still works and
      // Google still collects a name and an email at that step, so the lead is
      // not lost -- only the qualifying answers are. Telling somebody "our
      // database is unavailable" when the thing they came to do is about to
      // work fine is noise that costs a booking.
      console.warn("Demo request could not be stored:", err);
    } finally {
      setSaving(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 shadow-sm text-center max-w-xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-success-50 border border-success-200 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-7 h-7 text-success-600" />
        </div>
        <h3 className="text-2xl font-black text-content mb-2">
          Got it{name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}.
        </h3>
        <p className="text-content-body mb-6">
          One more step: pick a time that suits you. It takes about thirty
          seconds and you will get an instant confirmation.
        </p>
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-content-inverted h-14 px-8 rounded-2xl font-black shadow-2xl shadow-brand-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
        >
          <Calendar className="w-5 h-5 flex-shrink-0" />
          Pick my time
          <ArrowRight className="w-5 h-5 flex-shrink-0" />
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface border border-line rounded-3xl p-6 sm:p-8 shadow-sm space-y-5 max-w-xl mx-auto text-left"
    >
      <div className="space-y-1.5">
        <Label htmlFor="demo-name" className="text-sm font-semibold text-ink-700">
          Your name <span className="text-danger-400">*</span>
        </Label>
        <Input
          id="demo-name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dave Whelan"
          autoComplete="name"
          className="h-12 rounded-xl border-line focus:border-brand-400 focus:ring-brand-400/20"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="demo-phone" className="text-sm font-semibold text-ink-700">
          Mobile number <span className="text-danger-400">*</span>
        </Label>
        <PhoneInput
          id="demo-phone"
          required
          value={phone}
          onChange={setPhone}
          placeholder="(555) 123-4567"
          autoComplete="tel"
          className="h-12 rounded-xl border-line focus:border-brand-400 focus:ring-brand-400/20"
        />
        <p className="text-xs text-content-muted">
          We will text you the confirmation. No spam, ever.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="demo-trade" className="text-sm font-semibold text-ink-700">
          Your trade <span className="text-danger-400">*</span>
        </Label>
        {/*
          A native <select>, not the Radix one used inside the app. On a phone
          this opens the OS picker, which is faster to use one-handed on a job
          site and needs no JavaScript to be usable at all -- and this is the
          page a lead meets before they trust us with anything.
        */}
        <select
          id="demo-trade"
          required
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border border-line bg-surface text-content focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
        >
          <option value="" disabled>
            Choose your trade
          </option>
          {TRADE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-ink-700">
          Who is on the tools? <span className="text-danger-400">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {TEAM_SIZES.map((option) => {
            const active = teamSize === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTeamSize(option.id)}
                aria-pressed={active}
                className={`h-auto py-3 px-4 rounded-xl border text-left transition-all ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-400/30"
                    : "border-line bg-surface hover:border-brand-300"
                }`}
              >
                <span className="block font-bold text-content">
                  {option.label}
                </span>
                <span className="block text-xs text-content-muted mt-0.5">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        type="submit"
        disabled={saving || !teamSize}
        className="w-full bg-brand hover:bg-brand-hover text-content-inverted h-14 rounded-2xl font-black text-base shadow-2xl shadow-brand-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <Calendar className="w-5 h-5 mr-2 flex-shrink-0" />
        )}
        {saving ? "One moment..." : "Book my free demo"}
      </Button>

      <p className="text-xs text-content-muted text-center">
        Four questions so the demo is about your business, not a generic tour.
      </p>
    </form>
  );
}
