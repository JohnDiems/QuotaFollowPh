begin;
create table public.subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'trialing' check(status in ('trialing','active')),
  period_end timestamptz not null default now() + interval '14 days',
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy owner_read on public.subscriptions for select to authenticated using(owner_id=auth.uid());
revoke all on public.subscriptions from anon,authenticated;
grant select on public.subscriptions to authenticated;
create function public.start_trial() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.subscriptions(owner_id) values(new.owner_id) on conflict do nothing; return new; end $$;
create trigger start_trial after insert on public.workspaces for each row execute function public.start_trial();
revoke all on function public.start_trial() from public;
insert into public.subscriptions(owner_id) select owner_id from public.workspaces on conflict do nothing;

create table public.billing_orders (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check(amount>0),
  currency text not null default 'PHP',
  session_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.billing_orders enable row level security;
create policy owner_read on public.billing_orders for select to authenticated using(owner_id=auth.uid());
revoke all on public.billing_orders from anon,authenticated;
grant select on public.billing_orders to authenticated;
grant all on public.billing_orders, public.subscriptions to service_role;
create table public.billing_events(event_id text primary key, created_at timestamptz not null default now());
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon,authenticated;

create function public.fulfill_order(order_identifier uuid, checkout_identifier text, paid_amount integer, event_identifier text)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.billing_orders;
begin
  select * into strict o from public.billing_orders where id=order_identifier for update;
  if o.amount<>paid_amount or (o.session_id is not null and o.session_id<>checkout_identifier) then raise exception 'Order mismatch'; end if;
  if o.paid_at is not null then return false; end if;
  insert into public.billing_events(event_id) values(event_identifier) on conflict do nothing;
  if not found then return false; end if;
  insert into public.subscriptions(owner_id,status,period_end) values(o.owner_id,'active',now()+interval '1 month')
  on conflict(owner_id) do update set status='active',period_end=greatest(now(),public.subscriptions.period_end)+interval '1 month',updated_at=now();
  update public.billing_orders set paid_at=now(),session_id=checkout_identifier where id=o.id;
  return true;
end $$;
revoke all on function public.fulfill_order(uuid,text,integer,text) from public;
grant execute on function public.fulfill_order(uuid,text,integer,text) to service_role;

create table public.ai_usage(owner_id uuid references auth.users(id) on delete cascade, day date, count integer not null default 0, primary key(owner_id,day));
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon,authenticated;
create function public.consume_ai_quota() returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  insert into public.ai_usage(owner_id,day,count) values(auth.uid(),current_date,1)
  on conflict(owner_id,day) do update set count=public.ai_usage.count+1 where public.ai_usage.count<30 returning count into n;
  return n is not null;
end $$;
revoke all on function public.consume_ai_quota() from public;
grant execute on function public.consume_ai_quota() to authenticated;

create function public.owner_share_matches(quote_identifier text,secret_hash text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.quote_shares where owner_id=auth.uid() and quote_id=quote_identifier and token_hash=secret_hash and revoked_at is null and status='Sent' and expires >= (now() at time zone 'Asia/Manila')::date);
$$;
revoke all on function public.owner_share_matches(text,text) from public;
grant execute on function public.owner_share_matches(text,text) to authenticated;

create function public.due_reminders() returns jsonb language sql security definer set search_path='' as $$
select coalesce(jsonb_agg(x),'[]'::jsonb) from (
  select w.owner_id, u.email, w.payload->'business'->>'name' as business_name, jsonb_agg(jsonb_build_object('id',q->>'id','title',q->>'title')) as quotes
  from public.workspaces w join auth.users u on u.id=w.owner_id
  cross join lateral jsonb_array_elements(w.payload->'quotes') q
  where w.payload->'business'->>'emailReminders'='true' and q->>'status'='Sent' and coalesce(q->>'followUp','')<>'' and (q->>'followUp')::date <= (now() at time zone 'Asia/Manila')::date and (q->>'expires')::date >= (now() at time zone 'Asia/Manila')::date
  group by w.owner_id,u.email,w.payload->'business'->>'name'
  order by w.owner_id limit 100
) x;
$$;
revoke all on function public.due_reminders() from public;
grant execute on function public.due_reminders() to service_role;
commit;
