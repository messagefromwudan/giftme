-- ⚠ DO NOT RUN. Since checkout opened on 24 Oct the database holds real practice orders, and this
-- script deletes ALL of them. Use supabase/cleanup-selected-orders.sql instead.
--
-- GiftMe! — remove ALL test data before the launch (run once, on 1 Nov 2026, after the last test).
-- Supabase → SQL Editor. Preview and Production share this database, so until launch every
-- order in it is a test order. Run STEP 1 first and check the list before running STEP 2.
--
-- Files: Supabase blocks deleting Storage files with SQL. First delete them in the dashboard:
-- Storage → bucket "messages" → select every folder (GM-1001, GM-1002, …) → Delete.

-- STEP 1 — look before deleting: every row here should be a test you recognise.
select id, created_at, source, status, buyer_email, total_mdl from public.orders order by created_at;
select count(*) as messages from public.messages;
select type, count(*) from public.discount_codes group by type;

-- STEP 2 — delete everything and restart order numbers at GM-1001.
begin;
truncate table
  public.messages,
  public.referral_uses,
  public.order_items,
  public.idempotency_keys,
  public.referral_credits,
  public.rate_limits,
  public.discount_codes,
  public.orders;
alter sequence public.giftme_order_seq restart with 1001;
commit;

-- STEP 3 — check: all zero, and the next order number is GM-1001.
select
  (select count(*) from public.orders) as orders,
  (select count(*) from public.messages) as messages,
  (select count(*) from public.discount_codes) as codes;
