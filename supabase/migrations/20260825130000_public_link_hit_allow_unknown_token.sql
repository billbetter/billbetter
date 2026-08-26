-- PublicLinkHit.invoice_id becomes nullable, so the table can rate-limit
-- attempts against tokens that match nothing.
--
-- -- Why this is a correction to the plan -----------------------------------
--
-- docs/invoice-links-plan.md specifies PublicLinkHit as the rate-limit store
-- AND gives invoice_id a NOT NULL foreign key. Those two requirements are in
-- conflict, and the conflict only shows up when you write the limiter: a
-- request carrying an unknown token has no invoice to reference, so it cannot
-- be recorded, so it cannot be counted -- and the one caller a rate limit is
-- actually FOR is the one hammering the endpoint with tokens that do not
-- resolve. As specified, the limiter would have throttled only legitimate
-- viewers.
--
-- The rejected alternative was an in-memory per-isolate counter for the unknown
-- case. Deno edge functions run per-isolate with no shared memory, so that
-- counter limits nothing across invocations while looking exactly like a rate
-- limit in the source. That is the "looks like protection, isn't" pattern
-- recorded in docs/feature-audit.md, and it is not worth repeating to preserve
-- a NOT NULL.
--
-- So: PublicLinkHit is the log of every public-link REQUEST. A view is the
-- subset with invoice_id not null. Every existing read filters on
-- invoice_id=eq.<id>, so those rows are naturally excluded from view counts.

alter table public."Invoice"
  drop constraint if exists invoice_public_token_present_noop;  -- no-op guard, keeps this file re-runnable

alter table public."PublicLinkHit"
  alter column invoice_id drop not null;

comment on column public."PublicLinkHit".invoice_id is
  'Null means the request carried a token that resolved to no invoice. Such a
   row exists only so the rate limiter can count it; it is not a view. Anything
   reporting views must filter invoice_id is not null.';

comment on table public."PublicLinkHit" is
  'Every request to a public document link, successful or not. Retention: rows
   with an invoice_id are pruned at 180 days; rows without one are pure
   rate-limit exhaust and can go far sooner. Nothing prunes this yet -- there is
   no scheduler (see docs/feature-audit.md section 3) -- so this table grows
   unbounded until one exists. At current volume that is measured in kilobytes
   per year.';
