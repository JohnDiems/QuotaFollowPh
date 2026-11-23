-- Run once in Supabase SQL Editor. One business workspace per authenticated owner.
begin;
create extension if not exists pgcrypto with schema extensions;

create table public.workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
create policy owner_read on public.workspaces for select to authenticated using (owner_id = auth.uid());
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;

create table public.quote_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  quote_id text not null,
  token_hash text not null unique,
  snapshot jsonb not null,
  status text not null default 'Sent' check (status in ('Sent','Accepted','Declined')),
  expires date not null,
  revoked_at timestamptz,
  responded_at timestamptz,
  responder_name text,
  created_at timestamptz not null default now()
);
alter table public.quote_shares enable row level security;
create policy owner_read on public.quote_shares for select to authenticated using (owner_id = auth.uid());
revoke all on public.quote_shares from anon, authenticated;
grant select (id, owner_id, quote_id, status, expires, revoked_at, responded_at, responder_name, created_at) on public.quote_shares to authenticated;
create index on public.quote_shares(owner_id, quote_id);

create table public.quote_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  quote_id text not null,
  event text not null,
  actor_name text,
  created_at timestamptz not null default now()
);
alter table public.quote_events enable row level security;
create policy owner_read on public.quote_events for select to authenticated using (owner_id = auth.uid());
revoke all on public.quote_events from anon, authenticated;
grant select on public.quote_events to authenticated;

create or replace function public.save_workspace(document jsonb, expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare existing public.workspaces; q jsonb; n jsonb; item jsonb; next_version integer; col text;
begin
  if auth.uid() is null then raise exception 'Unauthorized' using errcode = '42501'; end if;
  if octet_length(document::text) > 2000000 or jsonb_typeof(document->'business') is distinct from 'object' then raise exception 'Invalid document'; end if;
  foreach col in array array['customers','services','quotes'] loop
    if jsonb_typeof(document->col) is distinct from 'array' or jsonb_array_length(document->col) > 5000 then raise exception 'Invalid collection'; end if;
    if exists (select 1 from jsonb_array_elements(document->col) r where coalesce(r->>'id','') = '') or
       (select count(*) from jsonb_array_elements(document->col)) <> (select count(distinct r->>'id') from jsonb_array_elements(document->col) r) then raise exception 'Duplicate identifiers'; end if;
  end loop;
  for q in select * from jsonb_array_elements(document->'quotes') loop
    if q->>'status' not in ('Draft','Sent','Accepted','Declined','Expired') or q->>'status' is null or
       jsonb_typeof(q->'items') is distinct from 'array' or jsonb_array_length(q->'items') not between 1 and 100 or
       length(coalesce(q->>'title','')) not between 1 and 120 or
       not exists (select 1 from jsonb_array_elements(document->'customers') c where c->>'id' = q->>'customerId') then raise exception 'Invalid quote'; end if;
    if (q->>'discount')::numeric < 0 or (q->>'tax')::numeric not between 0 and 100 then raise exception 'Invalid amounts'; end if;
    perform (q->>'expires')::date;
    for item in select * from jsonb_array_elements(q->'items') loop
      if coalesce((item->>'quantity')::numeric,0) <= 0 or coalesce((item->>'price')::numeric,-1) < 0 or
        (item->>'price')::numeric <> trunc((item->>'price')::numeric) then raise exception 'Invalid line item'; end if;
    end loop;
  end loop;
  -- Lock the owner row so saves cannot overwrite a customer response or another tab.
  select * into existing from public.workspaces where owner_id = auth.uid() for update;
  if not found then
    if expected_version <> 0 then raise exception 'Version conflict' using errcode = '40001'; end if;
    begin
      insert into public.workspaces(owner_id,payload) values(auth.uid(), document);
    exception when unique_violation then raise exception 'Version conflict' using errcode = '40001'; end;
    return 1;
  end if;
  if existing.version <> expected_version then raise exception 'Version conflict' using errcode = '40001'; end if;
  for q in select * from jsonb_array_elements(existing.payload->'quotes') loop
    if q->>'status' = 'Draft' then continue; end if;
    select value into n from jsonb_array_elements(document->'quotes') where value->>'id' = q->>'id';
    if n is null or (n - 'followUp' - 'status') is distinct from (q - 'followUp' - 'status') or n->>'status' = 'Draft' then raise exception 'Sent quotes are immutable'; end if;
    if q->>'status' in ('Accepted','Declined','Expired') and n->>'status' <> q->>'status' then raise exception 'Terminal status is immutable'; end if;
  end loop;
  update public.workspaces set payload=document, version=version+1, updated_at=now() where owner_id=auth.uid() returning version into next_version;
  -- Manual owner decisions also close any outstanding customer response page.
  update public.quote_shares s set status=q2.value->>'status', responded_at=coalesce(s.responded_at,now()), responder_name=coalesce(s.responder_name,'Recorded by owner')
    from jsonb_array_elements(document->'quotes') q2
    where s.owner_id=auth.uid() and s.quote_id=q2.value->>'id' and s.status='Sent' and q2.value->>'status' in ('Accepted','Declined');
  return next_version;
end $$;
revoke all on function public.save_workspace(jsonb,integer) from public;
grant execute on function public.save_workspace(jsonb,integer) to authenticated;

create or replace function public.publish_quote(quote_identifier text, secret_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare w public.workspaces; q jsonb; c jsonb; share_id uuid; idx integer;
begin
  if auth.uid() is null or secret_hash !~ '^[a-f0-9]{64}$' then raise exception 'Unauthorized'; end if;
  select * into strict w from public.workspaces where owner_id=auth.uid() for update;
  select value, ordinality::integer - 1 into q, idx from jsonb_array_elements(w.payload->'quotes') with ordinality where value->>'id'=quote_identifier;
  if q is null or q->>'status' not in ('Draft','Sent') or (q->>'expires')::date < (now() at time zone 'Asia/Manila')::date then raise exception 'Quote is not open'; end if;
  select value into strict c from jsonb_array_elements(w.payload->'customers') where value->>'id'=q->>'customerId';
  update public.quote_shares set revoked_at=now() where owner_id=auth.uid() and quote_id=quote_identifier and revoked_at is null;
  q := jsonb_set(q,'{status}','"Sent"');
  -- Only the quote recipient's name/company/address, business profile, and quote contents are public.
  insert into public.quote_shares(owner_id,quote_id,token_hash,snapshot,expires)
    values(auth.uid(),quote_identifier,secret_hash,jsonb_build_object('quote',q-'followUp'-'customerId','business',jsonb_build_object('name',w.payload->'business'->>'name','email',w.payload->'business'->>'email','phone',w.payload->'business'->>'phone','address',w.payload->'business'->>'address','terms',w.payload->'business'->>'terms'),'customer',jsonb_build_object('name',c->>'name','company',c->>'company','address',c->>'address')), (q->>'expires')::date) returning id into share_id;
  update public.workspaces set payload=jsonb_set(payload,array['quotes',idx::text],q), version=version+1, updated_at=now() where owner_id=auth.uid();
  insert into public.quote_events(owner_id,quote_id,event) values(auth.uid(),quote_identifier,'Published customer link');
  return share_id;
end $$;
revoke all on function public.publish_quote(text,text) from public;
grant execute on function public.publish_quote(text,text) to authenticated;

create or replace function public.revoke_quote(quote_identifier text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  -- Match the lock order used by customer responses.
  perform 1 from public.workspaces where owner_id=auth.uid() for update;
  update public.quote_shares set revoked_at=now() where owner_id=auth.uid() and quote_id=quote_identifier and revoked_at is null;
  insert into public.quote_events(owner_id,quote_id,event) values(auth.uid(),quote_identifier,'Revoked customer link');
end $$;
revoke all on function public.revoke_quote(text) from public;
grant execute on function public.revoke_quote(text) to authenticated;

-- These capability functions accept a high-entropy token's SHA-256 hash.
-- Tokens are generated only server-side and are never stored in clear text.
create or replace function public.read_shared_quote(secret_hash text)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('snapshot',snapshot,'status',case when status='Sent' and expires < (now() at time zone 'Asia/Manila')::date then 'Expired' else status end,'respondedAt',responded_at,'responderName',responder_name)
  from public.quote_shares where token_hash=secret_hash and revoked_at is null;
$$;
revoke all on function public.read_shared_quote(text) from public;
grant execute on function public.read_shared_quote(text) to anon, authenticated;

create or replace function public.respond_shared_quote(secret_hash text, decision text, signed_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.quote_shares; w public.workspaces; idx integer;
begin
  if decision not in ('Accepted','Declined') or length(trim(signed_name)) not between 2 and 100 then raise exception 'Invalid response'; end if;
  select * into s from public.quote_shares where token_hash=secret_hash;
  if not found then raise exception 'Unavailable quote'; end if;
  select * into strict w from public.workspaces where owner_id=s.owner_id for update;
  select * into strict s from public.quote_shares where token_hash=secret_hash for update;
  if s.revoked_at is not null or s.expires < (now() at time zone 'Asia/Manila')::date or s.status <> 'Sent' then raise exception 'Quote is no longer open'; end if;
  select ordinality::integer-1 into idx from jsonb_array_elements(w.payload->'quotes') with ordinality where value->>'id'=s.quote_id and value->>'status'='Sent';
  if idx is null then raise exception 'Quote is no longer open'; end if;
  update public.quote_shares set status=decision, responded_at=now(), responder_name=trim(signed_name) where id=s.id;
  update public.workspaces set payload=jsonb_set(payload,array['quotes',idx::text,'status'],to_jsonb(decision)),version=version+1,updated_at=now() where owner_id=s.owner_id;
  insert into public.quote_events(owner_id,quote_id,event,actor_name) values(s.owner_id,s.quote_id,decision,trim(signed_name));
  return jsonb_build_object('status',decision,'respondedAt',now());
end $$;
revoke all on function public.respond_shared_quote(text,text,text) from public;
grant execute on function public.respond_shared_quote(text,text,text) to anon, authenticated;
commit;
