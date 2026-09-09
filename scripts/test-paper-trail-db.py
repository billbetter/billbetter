"""Prove the paper trail's guarantees against the LIVE database.

The whole feature rests on one claim -- "the account holder cannot change this,
and neither can we" -- and that claim lives in Postgres, not in JavaScript. A
test suite that exercised the React components and never attempted a forbidden
write would tell us nothing about the only thing that matters.

So this attempts the forbidden writes. It runs through the Management API,
which is a far more privileged connection than anything the app or an edge
function holds: if the guards hold against THIS, they hold against a browser.

-- Nothing here leaves a trace ---------------------------------------------

Every probe that writes runs inside a subtransaction ended by a deliberate
`rollback-sentinel` exception, so the invoice it creates and the ledger entries
the triggers append are all rolled back. That matters more than usual here,
because AuditEvent rows are append-only by design: a test row inserted for real
could never be cleaned up afterwards, and would sit in the contractor's Paper
Trail screen forever, attached to an invoice that does not exist.

Run this AFTER applying supabase/migrations/20260908120000_paper_trail.sql.

Usage: python scripts/test-paper-trail-db.py
"""
import json
import sys

from q import run_sql

PASS, FAIL = [], []


def sql(query):
    status, body = run_sql(query)
    if status >= 300:
        sys.exit(f'SQL failed: {status} {body}')
    return json.loads(body)


def check(label, cond, detail=''):
    (PASS if cond else FAIL).append(label)
    print(f'  {"PASS" if cond else "FAIL"}  {label}'
          f'{(" -- " + str(detail)) if detail and not cond else ""}')


PROBE = r"""
create or replace function pg_temp.trail_probe()
returns table (name text, ok boolean, note text)
language plpgsql
as $probe$
declare
  v_id     uuid;
  v_user   uuid;
  v_inv    uuid;
  n1 bigint; n2 bigint; n3 bigint;
begin
  select id into v_id from public."AuditEvent" order by seq limit 1;
  select user_id into v_user from public."AuditEvent" limit 1;

  -- ---- an UPDATE must be refused, even from here -------------------------
  --
  -- The sentinel is what keeps this safe. If the guard is missing the update
  -- succeeds, and we then raise our own error to roll the subtransaction back
  -- rather than leaving a tampered row behind. Either way nothing persists;
  -- the message tells us which of the two happened.
  name := 'UPDATE on AuditEvent is refused'; ok := false; note := '';
  if v_id is not null then
    begin
      update public."AuditEvent" set detail = coalesce(detail,'') || ' [tampered]'
       where id = v_id;
      raise exception 'rollback-sentinel';
    exception when others then
      ok := (sqlerrm <> 'rollback-sentinel');
      note := sqlerrm;
    end;
  else
    note := 'no rows to test against';
  end if;
  return next;

  -- ---- and so must a DELETE ----------------------------------------------
  name := 'DELETE on AuditEvent is refused'; ok := false; note := '';
  if v_id is not null then
    begin
      delete from public."AuditEvent" where id = v_id;
      raise exception 'rollback-sentinel';
    exception when others then
      ok := (sqlerrm <> 'rollback-sentinel');
      note := sqlerrm;
    end;
  else
    note := 'no rows to test against';
  end if;
  return next;

  -- ---- the triggers actually fire ----------------------------------------
  --
  -- The one test that proves the feature does anything at all. An invoice is
  -- created already 'sent' (which is how CreateInvoice's send path writes it),
  -- then marked paid, and the ledger is expected to have gained three entries:
  -- created, sent, paid. All of it is rolled back.
  name := 'creating and paying an invoice appends 3 sealed entries';
  ok := false; note := '';
  begin
    select user_id into v_user from public."Invoice" limit 1;
    if v_user is null then
      note := 'no invoices to borrow a user_id from';
      return next;
    else
      insert into public."Invoice" (user_id, invoice_number, client_name, total, status)
        values (v_user, 'PAPERTRAIL-PROBE', 'Probe Client', 123.45, 'sent')
        returning id into v_inv;

      select count(*) into n1 from public."AuditEvent" where document_id = v_inv;

      update public."Invoice" set status = 'paid' where id = v_inv;
      select count(*) into n2 from public."AuditEvent" where document_id = v_inv;

      -- An update that changes nothing the ledger watches must add nothing.
      -- A trail that grows on every incidental save is noise, and noise in a
      -- record is indistinguishable from padding.
      update public."Invoice" set client_name = client_name where id = v_inv;
      select count(*) into n3 from public."AuditEvent" where document_id = v_inv;

      ok := (n1 = 2 and n2 = 3 and n3 = 3);
      note := format('after insert=%s, after paid=%s, after no-op=%s', n1, n2, n3);
      raise exception 'rollback-sentinel';
    end if;
  exception when others then
    if sqlerrm <> 'rollback-sentinel' then
      ok := false; note := sqlerrm;
    end if;
  end;
  return next;

  -- ---- the probe left nothing behind -------------------------------------
  name := 'the probe invoice and its entries were rolled back'; ok := false;
  select count(*) into n1 from public."AuditEvent"
   where document_number = 'PAPERTRAIL-PROBE';
  select count(*) into n2 from public."Invoice"
   where invoice_number = 'PAPERTRAIL-PROBE';
  ok := (n1 = 0 and n2 = 0);
  note := format('%s ledger rows, %s invoices', n1, n2);
  return next;
end;
$probe$;

select * from pg_temp.trail_probe();
"""


AUTH_PROBE = r"""
create or replace function pg_temp.trail_authprobe()
returns table (name text, ok boolean, note text)
language plpgsql
as $auth$
declare
  v_uid uuid := '__UID__';
  v_id  uuid;
  v_when timestamptz;
begin
  select id, occurred_at into v_id, v_when
    from public."AuditEvent" where user_id = v_uid order by seq limit 1;

  name := 'cannot INSERT a forged entry'; ok := false; note := '';
  begin
    insert into public."AuditEvent"
      (user_id, document_type, document_id, document_number, client_name,
       kind, detail, occurred_at, source, seq, hash)
    values (v_uid, 'invoice', gen_random_uuid(), 'FORGED-001', 'Made Up Ltd',
            'sent', 'I definitely sent this', now() - interval '30 days',
            'system', 999999, 'deadbeef');
    raise exception 'rollback-sentinel';
  exception when others then
    ok := (sqlerrm <> 'rollback-sentinel'); note := sqlerrm;
  end;
  return next;

  name := 'cannot backdate an existing entry'; ok := false; note := '';
  begin
    update public."AuditEvent" set occurred_at = occurred_at - interval '30 days'
     where id = v_id;
    raise exception 'rollback-sentinel';
  exception when others then
    ok := (sqlerrm <> 'rollback-sentinel'); note := sqlerrm;
  end;
  return next;

  name := 'cannot DELETE an entry'; ok := false; note := '';
  begin
    delete from public."AuditEvent" where id = v_id;
    raise exception 'rollback-sentinel';
  exception when others then
    ok := (sqlerrm <> 'rollback-sentinel'); note := sqlerrm;
  end;
  return next;

  -- The one that matters most. audit_append is SECURITY DEFINER and writes
  -- straight through RLS, so if this role could call it none of the above
  -- would be worth anything.
  --
  -- All ELEVEN arguments, deliberately. An earlier version of this probe
  -- passed ten and "passed" on a signature mismatch -- a refusal that had
  -- nothing to do with permissions and would have gone on reporting PASS with
  -- the function wide open.
  name := 'cannot call audit_append directly'; ok := false; note := '';
  begin
    perform public.audit_append(v_uid, 'invoice', gen_random_uuid(), 'FORGED-002',
      'Made Up Ltd', 'viewed', 'They definitely opened it', 1234.00,
      now() - interval '10 days', 'system', null::uuid);
    raise exception 'rollback-sentinel';
  exception when others then
    ok := (sqlerrm <> 'rollback-sentinel')
          and sqlerrm ilike '%permission denied%';
    note := sqlerrm;
  end;
  return next;

  name := 'the entry survived all of that unchanged'; ok := false;
  ok := (select occurred_at from public."AuditEvent" where id = v_id) = v_when;
  note := 'occurred_at is where it was';
  return next;

  name := 'a visitor can still submit a demo request'; ok := false; note := '';
  begin
    insert into public."DemoRequest" (name, phone, trade, team_size, source)
    values ('Probe Person', '5551234567', 'Electrical', 'solo', 'probe');
    ok := true;
    raise exception 'rollback-sentinel';
  exception when others then
    if sqlerrm <> 'rollback-sentinel' then ok := false; note := sqlerrm; end if;
  end;
  return next;

  name := 'but cannot read the lead list back'; ok := false; note := '';
  begin
    perform 1 from public."DemoRequest" limit 1;
    ok := not found;
    note := 'select returned without error';
  exception when others then
    ok := true; note := sqlerrm;
  end;
  return next;
end;
$auth$;

select set_config('request.jwt.claims',
  '{"sub":"__UID__","role":"authenticated"}', true);
set local role authenticated;
select * from pg_temp.trail_authprobe();
"""


def main():
    print('Paper trail, against the live database\n')

    # --- The table exists at all -----------------------------------------
    print('shape:')
    cols = sql("""select column_name from information_schema.columns
                   where table_schema='public' and table_name='AuditEvent'""")
    names = {c['column_name'] for c in cols}
    if not names:
        sys.exit('AuditEvent does not exist. Apply '
                 'supabase/migrations/20260908120000_paper_trail.sql first.')
    check('every column the record needs is present',
          {'user_id', 'document_type', 'document_id', 'document_number', 'kind',
           'detail', 'occurred_at', 'recorded_at', 'source', 'seq', 'prev_hash',
           'hash'} <= names,
          sorted(names))
    check('RLS is enabled',
          sql("""select relrowsecurity as on from pg_class
                  where oid = 'public."AuditEvent"'::regclass""")[0]['on'] is True)

    # --- Only reading is allowed ------------------------------------------
    print('\npermissions:')
    policies = sql("""select policyname, cmd from pg_policies
                       where schemaname='public' and tablename='AuditEvent'""")
    check('there is exactly one policy and it is SELECT',
          len(policies) == 1 and policies[0]['cmd'] == 'SELECT', policies)

    grants = sql("""select grantee, privilege_type
                      from information_schema.role_table_grants
                     where table_schema='public' and table_name='AuditEvent'
                       and grantee in ('anon','authenticated')
                       and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')""")
    check('anon and authenticated hold no write grant at all', grants == [], grants)

    # A client holding the anon key must not be able to call the writer
    # directly -- RLS on the table is irrelevant if the SECURITY DEFINER
    # function that bypasses it is callable by anyone.
    execs = sql("""select r.rolname
                     from pg_proc p, unnest(p.proacl) acl,
                          pg_roles r
                    where p.pronamespace = 'public'::regnamespace
                      and p.proname = 'audit_append'
                      and r.rolname = split_part(acl::text, '=', 1)
                      and r.rolname in ('anon','authenticated','public')""")
    check('audit_append is not callable by anon or authenticated', execs == [], execs)

    definer = sql("""select prosecdef from pg_proc
                      where pronamespace='public'::regnamespace
                        and proname='audit_append'""")
    check('audit_append is SECURITY DEFINER', definer and definer[0]['prosecdef'] is True)

    # --- The guards --------------------------------------------------------
    print('\nimmutability:')
    trigs = sql("""select tgname from pg_trigger
                    where tgrelid = 'public."AuditEvent"'::regclass
                      and not tgisinternal""")
    tnames = {t['tgname'] for t in trigs}
    check('an UPDATE guard trigger exists', 'auditevent_no_update' in tnames, tnames)
    check('a DELETE guard trigger exists', 'auditevent_no_delete' in tnames, tnames)

    doc_trigs = sql("""select c.relname, t.tgname from pg_trigger t
                         join pg_class c on c.oid = t.tgrelid
                        where not t.tgisinternal
                          and t.tgname in ('invoice_audit_trg','quote_audit_trg',
                                           'payment_audit_trg')""")
    on = {t['relname'] for t in doc_trigs}
    check('Invoice, Quote and InvoicePayment all record',
          on == {'Invoice', 'Quote', 'InvoicePayment'}, on)

    # --- The behaviour, proved by attempting it ---------------------------
    print('\nattempting the forbidden (all rolled back):')
    for r in sql(PROBE):
        check(r['name'], r['ok'] is True, r['note'])

    # --- The history that was already there -------------------------------
    print('\nthe back catalogue:')
    counts = sql("""select source, count(*) as n from public."AuditEvent"
                     group by source order by source""")
    by_source = {c['source']: int(c['n']) for c in counts}
    check('existing invoices and quotes were imported',
          by_source.get('imported', 0) > 0, by_source)
    check('every entry carries a hash',
          sql("""select count(*) as n from public."AuditEvent"
                  where hash is null or length(hash) <> 64""")[0]['n'] == 0)
    check('sequence numbers are contiguous per account',
          sql("""select count(*) as n from (
                   select user_id, seq,
                          row_number() over (partition by user_id order by seq) as rn
                     from public."AuditEvent") x
                  where x.seq <> x.rn""")[0]['n'] == 0)

    # --- The chain ---------------------------------------------------------
    print('\nthe hash chain:')
    verified = sql("""
        with chain as (
          select e.*, lag(e.hash) over (partition by e.user_id order by e.seq) as expected_prev
            from public."AuditEvent" e
        )
        select count(*) as total,
               count(*) filter (where
                 hash = encode(sha256(convert_to(public.audit_row_payload(
                   seq, user_id, document_type, document_id, document_number,
                   client_name, kind, detail, amount, occurred_at, recorded_at,
                   source, actor_id, prev_hash), 'UTF8')), 'hex')
                 and prev_hash is not distinct from expected_prev) as good
          from chain""")[0]
    check('every stored hash recomputes to itself and links to the one before',
          int(verified['total']) == int(verified['good']),
          f"{verified['good']} of {verified['total']}")

    # A chain that verifies is only meaningful if it would FAIL on a change.
    # Recomputing one row's digest with a single altered field is the cheap way
    # to show the digest actually depends on the contents.
    differs = sql("""
        select encode(sha256(convert_to(public.audit_row_payload(
                 seq, user_id, document_type, document_id, document_number,
                 client_name, kind, detail, amount, occurred_at, recorded_at,
                 source, actor_id, prev_hash), 'UTF8')), 'hex') <>
               encode(sha256(convert_to(public.audit_row_payload(
                 seq, user_id, document_type, document_id, document_number,
                 client_name, kind, detail, amount,
                 occurred_at + interval '1 second',
                 recorded_at, source, actor_id, prev_hash), 'UTF8')), 'hex') as changed
          from public."AuditEvent" order by seq limit 1""")
    check('moving a date by one second changes the hash',
          bool(differs) and differs[0]['changed'] is True)

    # --- The surface anyone would actually attack -------------------------
    #
    # Everything above runs as the Management API's role, which is a superuser.
    # That proves the triggers hold against the strongest caller there is, and
    # it is NOT how anybody would try this: a real attempt comes from a browser
    # holding a user's JWT and the anon key that ships in the bundle.
    #
    # This section repeats the attempts as `authenticated` with a real uid set,
    # which is where the grant revokes rather than the triggers do the work.
    # Worth its own section because the two mechanisms fail independently -- a
    # future migration that re-grants INSERT would leave every assertion above
    # passing.
    print('\nas a logged-in user (not a superuser):')
    uid = sql('select id from auth.users limit 1')
    if not uid:
        print('  SKIP  no users to borrow an id from')
    else:
        for r in sql(AUTH_PROBE.replace('__UID__', uid[0]['id'])):
            check(r['name'], r['ok'] is True, r['note'])

    # --- What the app reads ------------------------------------------------
    print('\nthe read path:')
    for fn in ('paper_trail_summary', 'audit_verify'):
        acl = sql(f"""select count(*) as n from pg_proc p, unnest(p.proacl) acl
                       where p.pronamespace='public'::regnamespace
                         and p.proname='{fn}'
                         and acl::text like 'authenticated=%'""")[0]['n']
        check(f'{fn}() is callable by authenticated', int(acl) > 0)

    print(f'\n{len(PASS)} passed, {len(FAIL)} failed')
    sys.exit(0 if not FAIL else 1)


if __name__ == '__main__':
    main()
