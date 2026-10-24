-- GiftMe! initial schema (FE GiftMe SRL practice company).
-- Run once in Supabase → SQL Editor (or `supabase db push`).
--
-- Security model: every table has row-level security ENABLED and NO policies, and all
-- privileges are revoked from the `anon` and `authenticated` roles. Only the server, using the
-- service-role key, can read or write. The Storage bucket is private with no policies either:
-- files are reachable only through short-lived signed URLs created by the server.

begin;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create sequence if not exists public.giftme_order_seq start with 1001;

create table if not exists public.orders (
  id            text primary key,                       -- e.g. GM-1001
  token         text not null,                          -- secret for tracking / approval links
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  lang          text not null check (lang in ('ro', 'en')),
  source        text not null check (source in ('web', 'agent_api', 'mcp', 'onsite_agent')),
  status        text not null check (status in ('awaiting_approval', 'received', 'preparing', 'delivered', 'cancelled')),
  buyer_email   text not null,
  total_mdl     integer not null check (total_mdl >= 0),
  simulated     boolean not null default true,          -- every order is a practice order
  data          jsonb not null                          -- full order document (see src/lib/orders.ts)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_buyer_email_idx on public.orders (buyer_email);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  order_id      text not null references public.orders (id) on delete cascade,
  box_id        text not null check (box_id ~ '^GM-0[1-9]$'),
  quantity      integer not null check (quantity between 1 and 100),
  unit_price    integer not null check (unit_price >= 0),
  line_total    integer not null check (line_total >= 0),
  primary key (order_id, box_id)
);

-- ---------------------------------------------------------------------------
-- Idempotency keys (24 h)
-- ---------------------------------------------------------------------------

-- No foreign key: the key is claimed just before the order row is written.
create table if not exists public.idempotency_keys (
  key           text primary key,
  order_id      text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idempotency_keys_created_idx on public.idempotency_keys (created_at);

-- ---------------------------------------------------------------------------
-- Discount codes: REFER A FRIEND (one per customer) and PASS-IT-ON (single use, 30 days)
-- ---------------------------------------------------------------------------

create table if not exists public.discount_codes (
  code              text primary key,
  type              text not null check (type in ('REFERRAL', 'PASS_IT_ON')),
  created_at        timestamptz not null default now(),
  owner_email       text,                                -- REFERRAL: who shares it
  expires_at        timestamptz,                         -- PASS_IT_ON
  source_order_id   text,                                -- PASS_IT_ON: revealed from this order's message
  used_by_order_id  text,                                -- PASS_IT_ON: set once, atomically
  check (type <> 'REFERRAL' or owner_email is not null)
);

-- One personal referral code per customer.
create unique index if not exists discount_codes_one_referral_per_owner
  on public.discount_codes (owner_email) where type = 'REFERRAL';

create table if not exists public.referral_uses (
  code          text not null references public.discount_codes (code) on delete cascade,
  order_id      text not null references public.orders (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (code, order_id)
);

-- −50 MDL credits earned by referrers, spent automatically on their next order.
create table if not exists public.referral_credits (
  email         text primary key,
  credits       integer not null default 0 check (credits >= 0),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rate-limit counters (fixed windows; old rows are pruned by giftme_rate_hit)
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  key           text primary key,
  hits          integer not null default 0,
  expires_at    timestamptz not null
);

create index if not exists rate_limits_expires_idx on public.rate_limits (expires_at);

-- ---------------------------------------------------------------------------
-- QR messages (audio / video / text). Files live in the private `messages` bucket.
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id              text primary key check (length(id) >= 22), -- long, unguessable (used in /mesaj/[id])
  order_id        text not null references public.orders (id) on delete cascade,
  kind            text not null check (kind in ('audio', 'video', 'text')),
  body            text check (body is null or length(body) <= 2000),
  storage_path    text,                                  -- object path inside the `messages` bucket
  mime_type       text,
  size_bytes      integer check (size_bytes is null or size_bytes <= 52428800),
  created_at      timestamptz not null default now(),
  revealed_at     timestamptz,                           -- recipient revealed the PASS-IT-ON code
  pass_code       text references public.discount_codes (code),
  delete_after    timestamptz                            -- set to revealed_at + 30 days
);

create index if not exists messages_order_idx on public.messages (order_id);
create index if not exists messages_delete_after_idx on public.messages (delete_after);

-- ---------------------------------------------------------------------------
-- Lock everything down: RLS on, no policies, no grants for client roles.
-- ---------------------------------------------------------------------------

alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.idempotency_keys  enable row level security;
alter table public.discount_codes    enable row level security;
alter table public.referral_uses     enable row level security;
alter table public.referral_credits  enable row level security;
alter table public.rate_limits       enable row level security;
alter table public.messages          enable row level security;

revoke all on table
  public.orders, public.order_items, public.idempotency_keys, public.discount_codes,
  public.referral_uses, public.referral_credits, public.rate_limits, public.messages
  from anon, authenticated;
revoke all on sequence public.giftme_order_seq from anon, authenticated;

-- The server's role (bypasses RLS) gets explicit privileges, independent of project defaults.
grant select, insert, update, delete on table
  public.orders, public.order_items, public.idempotency_keys, public.discount_codes,
  public.referral_uses, public.referral_credits, public.rate_limits, public.messages
  to service_role;

-- ---------------------------------------------------------------------------
-- Atomic helpers (called by the server through RPC with the service-role key)
-- ---------------------------------------------------------------------------

create or replace function public.giftme_next_order_id()
returns text language sql volatile set search_path = '' as $$
  select 'GM-' || nextval('public.giftme_order_seq')::text;
$$;

create or replace function public.giftme_rate_hit(p_key text, p_window_seconds integer)
returns integer language plpgsql volatile set search_path = '' as $$
declare
  n integer;
begin
  -- Prune expired windows now and then (about 1 call in 50).
  if random() < 0.02 then
    delete from public.rate_limits where expires_at < now();
  end if;
  insert into public.rate_limits as r (key, hits, expires_at)
    values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set hits = case when r.expires_at < now() then 1 else r.hits + 1 end,
        expires_at = case when r.expires_at < now() then excluded.expires_at else r.expires_at end
  returning hits into n;
  return n;
end;
$$;

create or replace function public.giftme_add_credit(p_email text)
returns integer language sql volatile set search_path = '' as $$
  insert into public.referral_credits as c (email, credits) values (p_email, 1)
  on conflict (email) do update set credits = c.credits + 1, updated_at = now()
  returning credits;
$$;

-- Spends one credit if available; returns true when a credit was spent.
create or replace function public.giftme_spend_credit(p_email text)
returns boolean language sql volatile set search_path = '' as $$
  with spent as (
    update public.referral_credits
       set credits = credits - 1, updated_at = now()
     where email = p_email and credits > 0
     returning 1
  )
  select exists (select 1 from spent);
$$;

-- Claims a PASS-IT-ON code for an order; false if it was already used or has expired.
create or replace function public.giftme_claim_pass_code(p_code text, p_order_id text)
returns boolean language sql volatile set search_path = '' as $$
  with claimed as (
    update public.discount_codes
       set used_by_order_id = p_order_id
     where code = p_code
       and type = 'PASS_IT_ON'
       and used_by_order_id is null
       and (expires_at is null or expires_at > now())
     returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke execute on function
  public.giftme_next_order_id(),
  public.giftme_rate_hit(text, integer),
  public.giftme_add_credit(text),
  public.giftme_spend_credit(text),
  public.giftme_claim_pass_code(text, text)
  from public, anon, authenticated;
grant execute on function
  public.giftme_next_order_id(),
  public.giftme_rate_hit(text, integer),
  public.giftme_add_credit(text),
  public.giftme_spend_credit(text),
  public.giftme_claim_pass_code(text, text)
  to service_role;
grant usage, select on sequence public.giftme_order_seq to service_role;

-- ---------------------------------------------------------------------------
-- Private Storage bucket for audio/video messages (50 MB max, audio/video only).
-- storage.objects already has RLS enabled; we add NO policies, so only the service role
-- (and signed URLs it creates) can read or write files.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'messages', 'messages', false, 52428800,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav',
        'video/webm', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;
