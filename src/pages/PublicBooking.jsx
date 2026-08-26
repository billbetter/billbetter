import React from "react";
import { CalendarClock } from "lucide-react";
import SEO from "@/components/seo/SEO";

/**
 * Online booking is not built. This page says so.
 *
 * -- Why this replaced a working-looking booking UI -------------------------
 *
 * What was here was a full calendar picker, slot list and booking form, and
 * none of it could ever complete. Four things are missing, and only the last is
 * the one the public-link pattern addresses:
 *
 *   1. `BusinessSettings.booking_slug` is not a column. PostgREST answers
 *      `42703 column BusinessSettings.booking_slug does not exist` -- verified
 *      against a control query on `business_name` that returns 200. The old
 *      page filtered on it, so it 400'd before it ever reached an RLS decision.
 *   2. `BusinessSettings.available_hours` is not a column either.
 *   3. `getAvailableSlots` returns not_implemented.
 *   4. `createBooking` returns not_implemented. An earlier version of it
 *      invented a booking_id and this page rendered "Booking Confirmed!" for an
 *      appointment that did not exist -- a client believing they have a slot
 *      they do not is the worst outcome this page can produce.
 *
 * The tempting fix was a get-public-booking edge function, matching what
 * get-public-invoice and get-public-quote do for their documents. It was
 * rejected: it would have made this page load and render the business's
 * branding while still being unable to take a booking. That is a facade, and
 * removing facades is most of what the current audit has been.
 *
 * So: the honest state, the same treatment recurring invoices got. Booking is a
 * feature to scope, not a page to port. The previous implementation is in git
 * (commit cd4ebab) if it is wanted as a starting point.
 *
 * See docs/feature-audit.md section 9.3.
 */
export default function PublicBooking() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "rgb(var(--accent-50))" }}
    >
      <SEO
        title="Booking unavailable"
        description="Online booking is not available yet."
        noindex={true}
      />
      <div className="max-w-md w-full bg-surface rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CalendarClock className="w-8 h-8 text-accent-600" />
        </div>
        <h1 className="text-xl font-black text-content mb-2">
          Online booking isn&apos;t available yet
        </h1>
        <p className="text-content-body">
          This business can&apos;t take bookings through Invoicium at the
          moment. Please contact them directly to arrange a time &mdash; they
          will have given you a phone number or email address.
        </p>
      </div>
    </div>
  );
}
