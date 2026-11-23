-- Apply after 003. Shared counters and at-most-once mail attempts across server instances.
begin;
create table if not exists public.request_quotas (
  bucket_hash text primary key check(bucket_hash ~ '^[a-f0-9]{64}$'),
  request_count integer not null check(request_count>0),
  window_end timestamptz not null
);
create index if not exists request_quotas_expiry on public.request_quotas(window_end);
alter table public.request_quotas enable row level security;
revoke all on public.request_quotas from public, anon, authenticated;
create or replace function public.consume_request_quota(bucket_hash text,max_requests integer,window_ms integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare count_used integer;
begin
  if bucket_hash is null or bucket_hash !~ '^[a-f0-9]{64}$' or max_requests is null or max_requests not between 1 and 10000 or window_ms is null or window_ms not between 1 and 86400000 then raise exception 'Invalid quota'; end if;
  delete from public.request_quotas where ctid in (select ctid from public.request_quotas where window_end<now() limit 100);
  insert into public.request_quotas(bucket_hash,request_count,window_end)
    values(bucket_hash,1,now()+window_ms*interval '1 millisecond')
    on conflict on constraint request_quotas_pkey do update set
      request_count=case when public.request_quotas.window_end<=now() then 1 else least(public.request_quotas.request_count+1,max_requests+1) end,
      window_end=case when public.request_quotas.window_end<=now() then now()+window_ms*interval '1 millisecond' else public.request_quotas.window_end end
    returning request_count into count_used;
  return count_used<=max_requests;
end $$;
revoke all on function public.consume_request_quota(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_request_quota(text,integer,integer) to service_role;

create table if not exists public.mail_delivery_attempts (
  delivery_key text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.mail_delivery_attempts enable row level security;
revoke all on public.mail_delivery_attempts from public,anon,authenticated;
create or replace function public.reserve_quote_email(secret_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or secret_hash is null or secret_hash !~ '^[a-f0-9]{64}$' then raise exception 'Unauthorized' using errcode='42501'; end if;
  if not exists(select 1 from public.quote_shares where owner_id=auth.uid() and token_hash=secret_hash and revoked_at is null and status='Sent' and expires >= (now() at time zone 'Asia/Manila')::date) then raise exception 'Quote is not open' using errcode='42501'; end if;
  insert into public.mail_delivery_attempts(delivery_key,owner_id) values('quote-'||secret_hash,auth.uid()) on conflict do nothing;
  return found;
end $$;
revoke all on function public.reserve_quote_email(text) from public,anon;
grant execute on function public.reserve_quote_email(text) to authenticated;
create or replace function public.reserve_reminder_email(owner_identifier uuid,reminder_day date)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if owner_identifier is null or reminder_day is distinct from (now() at time zone 'Asia/Manila')::date then raise exception 'Invalid reminder'; end if;
  insert into public.mail_delivery_attempts(delivery_key,owner_id) values('reminders-'||owner_identifier::text||'-'||reminder_day::text,owner_identifier) on conflict do nothing;
  return found;
end $$;
revoke all on function public.reserve_reminder_email(uuid,date) from public,anon,authenticated;
grant execute on function public.reserve_reminder_email(uuid,date) to service_role;
commit;
