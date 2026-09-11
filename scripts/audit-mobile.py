"""Audit every page at phone size for the two things that make people zoom.

  1. A text field under 16px. iOS Safari zooms the whole page in when one is
     focused, and does not zoom back out when it loses focus -- so the
     contractor taps "Client name", types, and is left pinch-zooming out of a
     page that is now too big for the screen.
  2. Anything wider than the screen. Mobile browsers let the page be panned
     sideways and zoomed out to fit it, which reads as "the site is zoomed in".

Neither shows up in lint, in `vite build`, or on a desktop monitor.

-- What it writes -----------------------------------------------------------

By default, no application data. It mints a session for the owner account
(see _session.py -- an auth session, like any sign-in) and reads one invoice
and one quote to have real detail pages to load. The browser half aborts every
write to Supabase and every edge-function call except the reads the pages need.

--public-links adds the two pages a contractor's CLIENT sees, and those are
not free to load. get-public-invoice / get-public-quote log every request to
"PublicLinkHit", because that table is what the public-link rate limiter
counts: one row per page load, keyed to this machine's requester hash, so it
can only ever rate-limit the audit itself (60s window). What they must never
do is register a VIEW -- a stray one would be sealed into the append-only paper
trail as "client opened the invoice", and could never be removed. So
`record_view` is aborted in the browser AND the pages open with ?preview=1,
which the server already refuses to record. Checked against the live database
on 2026-09-10: five runs left 28 hit rows, and view_count, first_viewed_at and
the paper trail did not move.

Requires a build (`npx vite build`); serves dist/ with `vite preview`.

Usage: python scripts/audit-mobile.py [outDir] [--public-links]
"""
import os
import sys
import tempfile

from _page_harness import run_browser_pass

PORT = 4181


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out_dir = args[0] if args else os.path.join(
        tempfile.gettempdir(), 'invoicium-mobile-audit')
    sys.exit(run_browser_pass('audit-mobile.cjs', out_dir, PORT,
                              public_links='--public-links' in sys.argv[1:]))


if __name__ == '__main__':
    main()
