-- Tighten what anon and authenticated hold on the two new tables.
--
-- The previous two migrations revoked the privileges that matter -- INSERT,
-- UPDATE, DELETE, TRUNCATE on "AuditEvent", and SELECT/UPDATE/DELETE on
-- "DemoRequest" -- and a probe against the live database afterwards showed both
-- roles still holding REFERENCES and TRIGGER on each table, plus SELECT on
-- "AuditEvent" for anon. All three come from Supabase's default grants to the
-- API roles and were never named, so `revoke <list>` left them behind.
--
-- -- Is any of it exploitable? ---------------------------------------------
--
-- Checked rather than assumed: has_schema_privilege('anon','public','CREATE')
-- and the same for authenticated both return false. Without CREATE on the
-- schema neither role can define a function, so TRIGGER has nothing to attach
-- and REFERENCES has no table to point at. And anon's SELECT on "AuditEvent"
-- returns nothing, because the policy there is `for select to authenticated`
-- and RLS denies what no policy permits.
--
-- So this changes no outcome today. It is worth a migration anyway: all three
-- depend on a default staying the way it is, and the whole argument for this
-- feature is that the record cannot be reached -- an argument that should not
-- require a reader to first go and check a schema privilege.
--
-- `revoke all` then grant back exactly what is used, which is the form that
-- does not silently keep whatever gets added to the defaults next.

revoke all on public."AuditEvent" from anon, authenticated;
grant select on public."AuditEvent" to authenticated;

revoke all on public."DemoRequest" from anon, authenticated;
grant insert on public."DemoRequest" to anon, authenticated;

notify pgrst, 'reload schema';
