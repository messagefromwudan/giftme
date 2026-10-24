-- GiftMe! — delete ONLY the listed test orders. Every other order stays, and so does the
-- order numbering (the next order keeps its number; nothing restarts at GM-1001).
-- Supabase → SQL Editor. Run STEP 1, check the list, delete the files, then run STEP 2, then STEP 3.
--
-- The SQL Editor shows only the last result, so each step is one query.
-- To add an order you found in /admin/, add it to the list in STEP 1 AND STEP 2 AND STEP 3
-- (the same list in all three places).
--
-- What goes, for each listed order: the order and its lines; its QR messages; its PASS-IT-ON
-- codes; its idempotency key; its referral uses; and the buyer's REFER A FRIEND code and credits
-- only if that buyer has no other order left. Anything a kept order still uses stays (marked KEEP).


-- STEP 1 — look, change nothing. Every row marked DELETE should be a test you recognise.
with ids(id) as (values ('GM-1001'), ('GM-1002'), ('GM-1003'), ('GM-1004'), ('GM-1005')),
gone as (select o.* from public.orders o join ids using (id)),
kept as (select o.* from public.orders o where o.id not in (select id from ids)),
kept_emails as (select distinct lower(trim(buyer_email)) as email from kept)
select * from (
  select 1 as n, 'ORDER' as what, o.id as ref,
         to_char(o.created_at at time zone 'Europe/Chisinau', 'DD Mon HH24:MI') || ' · ' || o.source
           || ' · ' || o.status || ' · ' || o.buyer_email || ' · ' || o.total_mdl || ' MDL' as details,
         'DELETE' as action
    from gone o
  union all
  select 0, 'NOT FOUND', i.id, 'no order with this number: fix the list', 'CHECK'
    from ids i where i.id not in (select id from public.orders)
  union all
  select 2, 'MESSAGE', m.order_id || ' · ' || m.kind,
         coalesce(m.storage_path, '(text)') || case when m.revealed_at is null then '' else ' · code revealed' end,
         'DELETE'
    from public.messages m join gone o on o.id = m.order_id
  union all
  select 3, 'FILE', s.name, coalesce((s.metadata->>'size')::bigint / 1024, 0) || ' KB',
         'DELETE in Storage (see below)'
    from storage.objects s
   where s.bucket_id = 'messages' and split_part(s.name, '/', 1) in (select id from ids)
  union all
  select 4, 'PASS-IT-ON', c.code,
         'from ' || c.source_order_id || coalesce(' · used by ' || c.used_by_order_id, ' · unused'),
         case when c.used_by_order_id in (select id from kept) then 'KEEP (a kept order used it)' else 'DELETE' end
    from public.discount_codes c
   where c.type = 'PASS_IT_ON' and c.source_order_id in (select id from ids)
  union all
  select 5, 'PASS-IT-ON USED', c.code,
         'from kept order ' || c.source_order_id || ', used by test order ' || c.used_by_order_id,
         'KEEP (stays marked as used)'
    from public.discount_codes c
   where c.type = 'PASS_IT_ON' and c.used_by_order_id in (select id from ids)
     and c.source_order_id not in (select id from ids)
  union all
  select 6, 'REFERRAL CODE', c.code, c.owner_email,
         case
           when lower(trim(c.owner_email)) in (select email from kept_emails) then 'KEEP (owner has a kept order)'
           when exists (select 1 from public.referral_uses u join kept k on k.id = u.order_id where u.code = c.code)
             then 'KEEP (a kept order used it)'
           else 'DELETE'
         end
    from public.discount_codes c
   where c.type = 'REFERRAL' and lower(trim(c.owner_email)) in (select lower(trim(buyer_email)) from gone)
  union all
  select 7, 'REFERRAL USE', u.order_id || ' used ' || u.code,
         'owner ' || c.owner_email || case
           when lower(trim(c.owner_email)) in (select email from kept_emails)
             then ' — a REAL customer got +1 credit from this test order; credits now: '
                  || coalesce((select r.credits::text from public.referral_credits r where r.email = c.owner_email), '0')
           else '' end,
         case when lower(trim(c.owner_email)) in (select email from kept_emails)
              then 'DELETE use · credit NOT changed (decide yourself)' else 'DELETE' end
    from public.referral_uses u join public.discount_codes c on c.code = u.code
   where u.order_id in (select id from ids)
  union all
  select 8, 'CREDITS', r.email, r.credits || ' credit(s)',
         case when exists (
           select 1 from public.discount_codes c join public.referral_uses u on u.code = c.code join kept k on k.id = u.order_id
            where c.type = 'REFERRAL' and lower(trim(c.owner_email)) = lower(trim(r.email))
         ) then 'KEEP (earned from a kept order)' else 'DELETE' end
    from public.referral_credits r
   where lower(trim(r.email)) in (select lower(trim(buyer_email)) from gone)
     and lower(trim(r.email)) not in (select email from kept_emails)
  union all
  select 9, 'IDEMPOTENCY KEY', k.order_id, to_char(k.created_at at time zone 'Europe/Chisinau', 'DD Mon HH24:MI'), 'DELETE'
    from public.idempotency_keys k where k.order_id in (select id from ids)
  union all
  select 10, 'KEPT ORDERS', count(*)::text,
         coalesce(min(id) || ' … ' || max(id) || ' · placed '
           || to_char(min(created_at) at time zone 'Europe/Chisinau', 'DD Mon HH24:MI') || ' → '
           || to_char(max(created_at) at time zone 'Europe/Chisinau', 'DD Mon HH24:MI'), 'none'), 'KEEP'
    from kept
  union all
  select 11, 'NEXT ORDER NUMBER', 'GM-' || (last_value + case when is_called then 1 else 0 end), 'numbering', 'UNCHANGED'
    from public.giftme_order_seq
) t
order by n, ref;


-- FILES — Supabase does not let SQL delete Storage files. After STEP 1, in the dashboard:
-- Storage → bucket "messages" → tick ONLY the folders named like the listed orders
-- (GM-1001 … GM-1005, plus any you added) → Delete. Leave every other folder alone.


-- STEP 2 — delete. Same list as STEP 1. All or nothing: any problem cancels everything.
do $$
declare
  ids text[] := array['GM-1001', 'GM-1002', 'GM-1003', 'GM-1004', 'GM-1005'];
  found int;
  orders_before int;
  orders_after int;
  next_before bigint;
  next_after bigint;
begin
  select count(*) into found from public.orders where id = any (ids);
  if found <> cardinality(ids) then
    raise exception 'Only % of % listed orders exist. Fix the list (STEP 1 shows NOT FOUND).', found, cardinality(ids);
  end if;
  select count(*) into orders_before from public.orders;
  select last_value into next_before from public.giftme_order_seq;

  create temp table _gone on commit drop as
    select id, lower(trim(buyer_email)) as email from public.orders where id = any (ids);
  create temp table _kept_emails on commit drop as
    select distinct lower(trim(buyer_email)) as email from public.orders where not (id = any (ids));

  delete from public.messages where order_id in (select id from _gone);
  delete from public.idempotency_keys where order_id in (select id from _gone);
  delete from public.discount_codes c
   where c.type = 'PASS_IT_ON' and c.source_order_id in (select id from _gone)
     and (c.used_by_order_id is null or c.used_by_order_id in (select id from _gone));
  delete from public.referral_uses where order_id in (select id from _gone);
  delete from public.discount_codes c
   where c.type = 'REFERRAL'
     and lower(trim(c.owner_email)) in (select email from _gone)
     and lower(trim(c.owner_email)) not in (select email from _kept_emails)
     and not exists (select 1 from public.referral_uses u where u.code = c.code);
  delete from public.referral_credits r
   where lower(trim(r.email)) in (select email from _gone)
     and lower(trim(r.email)) not in (select email from _kept_emails)
     and not exists (  -- the test orders' uses are gone, so any use left is by a kept order
       select 1 from public.discount_codes c join public.referral_uses u on u.code = c.code
        where c.type = 'REFERRAL' and lower(trim(c.owner_email)) = lower(trim(r.email)));
  delete from public.orders where id in (select id from _gone);  -- order lines go with it (cascade)

  select count(*) into orders_after from public.orders;
  select last_value into next_after from public.giftme_order_seq;
  if orders_after <> orders_before - cardinality(ids) then
    raise exception 'Expected to delete % orders, would delete %. Nothing was changed.', cardinality(ids), orders_before - orders_after;
  end if;
  if next_after <> next_before then
    raise exception 'Order numbering moved. Nothing was changed.';
  end if;
  raise notice 'Deleted % test orders; % orders kept; numbering unchanged.', cardinality(ids), orders_after;
end
$$;


-- STEP 3 — check. Same list again. Every "left" column must be 0; kept_orders is everything else.
with ids(id) as (values ('GM-1001'), ('GM-1002'), ('GM-1003'), ('GM-1004'), ('GM-1005'))
select
  (select count(*) from public.orders where id in (select id from ids))                        as orders_left,
  (select count(*) from public.messages where order_id in (select id from ids))                as messages_left,
  (select count(*) from public.discount_codes where source_order_id in (select id from ids)
     and used_by_order_id is null)                                                              as pass_codes_left,
  (select count(*) from storage.objects where bucket_id = 'messages'
     and split_part(name, '/', 1) in (select id from ids))                                      as files_left,
  (select count(*) from public.orders)                                                          as kept_orders,
  (select 'GM-' || (last_value + case when is_called then 1 else 0 end) from public.giftme_order_seq) as next_order;
