-- Run the demand-letter sweep once a day.
--
-- -- Why this is in a migration at all --------------------------------------
--
-- pg_cron is already installed on this project and already runs exactly one
-- job: cron.job id 1, the Stripe sync worker, which was created by hand from
-- the dashboard. That job is invisible to anyone reading this repository --
-- docs/feature-audit.md had to be written to record that it exists. A second
-- schedule created the same way would be the same problem twice, so this one
-- is checked in.
--
-- -- Why it skips instead of failing ---------------------------------------
--
-- The job needs two things that live outside the schema: the project's
-- Functions URL and the shared secret the sweep authenticates with. Neither
-- belongs in version control, so both are read from Vault at migration time.
--
-- On a machine that has not set them up -- a fresh clone, a local
-- `supabase db reset`, CI -- a migration that raised here would fail the whole
-- reset and block work that has nothing to do with cron. So a missing
-- prerequisite logs a NOTICE and leaves the schedule unregistered. The trade is
-- deliberate and it has a sharp edge: on production a silent skip means the
-- sweep never runs and nothing says so. Verify after deploying, with:
--
--     select jobname, schedule, active from cron.job
--      where jobname = 'sweep-demand-letters-daily';
--
-- Zero rows means the secrets were not in Vault when this ran. Add them and
-- re-run this file; cron.schedule() upserts on the job name, so applying it
-- twice is safe and never produces a duplicate schedule.
--
-- -- Setting the prerequisites ---------------------------------------------
--
--     select vault.create_secret(
--       'https://<project-ref>.supabase.co/functions/v1', 'project_functions_url');
--     select vault.create_secret('<the same value as the CRON_SECRET
--       edge-function secret>', 'cron_secret');
--
-- The secret must match what sweep-demand-letters reads from CRON_SECRET, or
-- every run returns 403 and the sweep silently does nothing. Push it to the
-- function with scripts/deploy-secrets.py.
--
-- -- Why 07:00 UTC ---------------------------------------------------------
--
-- Before the working day everywhere this app is used -- 3am Eastern, midnight
-- Pacific -- so the prompt is already waiting when a contractor opens the app,
-- rather than appearing under them mid-session. Nothing is sent, so the hour
-- carries no risk of a badly-timed message to a client; it only decides when a
-- banner becomes available.

do $$
declare
  functions_url text;
  cron_secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed - skipping sweep-demand-letters schedule';
    return;
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'pg_net not installed - skipping sweep-demand-letters schedule';
    return;
  end if;

  -- to_regclass rather than a plain select: on a database with no Vault at all
  -- the table does not exist and referencing it would be a hard parse error,
  -- which is exactly the failure this block exists to avoid.
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'vault not available - skipping sweep-demand-letters schedule';
    return;
  end if;

  select decrypted_secret into functions_url
    from vault.decrypted_secrets where name = 'project_functions_url';
  select decrypted_secret into cron_secret
    from vault.decrypted_secrets where name = 'cron_secret';

  if functions_url is null or cron_secret is null then
    raise notice 'project_functions_url or cron_secret missing from vault - skipping sweep-demand-letters schedule';
    return;
  end if;

  perform cron.schedule(
    'sweep-demand-letters-daily',
    '0 7 * * *',
    format(
      $cmd$select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb
      );$cmd$,
      functions_url || '/sweep-demand-letters',
      'Bearer ' || cron_secret
    )
  );

  raise notice 'scheduled sweep-demand-letters-daily at 07:00 UTC';
end
$$;
