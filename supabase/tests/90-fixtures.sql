-- Three businesses, so "can a crew member see the wrong employer's data?" is a
-- question the test can actually answer.
--
--   owner  A  Professional, active      employs  crew
--   owner  B  Professional, active      employs  nobody      (the stranger test)
--   lapsed C  canceled                  employs  orphan
--   crew      active member of A
--   orphan    active member of C, whose employer has lapsed
--   nomad     signed in, member of nobody, no subscription

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test'),
  ('00000000-0000-0000-0000-0000000000c1', 'lapsed-c@test'),
  ('00000000-0000-0000-0000-0000000000d1', 'crew@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'orphan@test'),
  ('00000000-0000-0000-0000-0000000000f1', 'nomad@test');

insert into public."Subscription" (user_id, status, plan_name, trial_end_date) values
  ('00000000-0000-0000-0000-0000000000a1', 'active',   'professional', null),
  ('00000000-0000-0000-0000-0000000000b1', 'active',   'professional', null),
  ('00000000-0000-0000-0000-0000000000c1', 'canceled', 'professional', null);

insert into public."EmployeeProfile" (owner_id, user_id, role, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'employee', true),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000e1', 'employee', true);

insert into public."Client" (id, user_id, name) values
  ('11111111-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'A client'),
  ('11111111-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B client');

insert into public."Invoice" (id, user_id, invoice_number, total) values
  ('22222222-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'A-001', 100),
  ('22222222-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B-001', 200);

insert into public."Job" (id, user_id, job_title) values
  ('33333333-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'A job'),
  ('33333333-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B job');

insert into public."BusinessSettings" (user_id, business_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Business A'),
  ('00000000-0000-0000-0000-0000000000b1', 'Business B');
