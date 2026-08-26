-- Public invoice links -- STEP 2 of 3: backfill, ONE BATCH.
--
-- Run repeatedly until it reports zero rows. scripts/backfill-public-tokens.py
-- does exactly that, and reports the count per batch.
--
-- This file is deliberately a single batch rather than a loop. Step 1 explains
-- why at length; the short version is that the Management API wraps whatever
-- SQL it is sent in a transaction, so a DO block cannot COMMIT between
-- iterations and every batch would hold its locks until the last one finished.
-- Driving the loop from outside means each batch is its own HTTP request and so
-- its own transaction, which is the property that makes batching worth doing.
--
-- The subselect with LIMIT is what bounds the batch. Without it this is one
-- UPDATE over the whole table, holding a row lock on every invoice for its
-- duration -- fine at 3 rows, an outage at 100k, and indistinguishable between
-- the two until you are at 100k.

update public."Invoice"
   set public_token = gen_random_uuid()
 where id in (
   select id from public."Invoice" where public_token is null limit 1000
 );
