-- Run against a disposable Supabase project AFTER both migrations.
-- All data is rolled back. Raises an exception if an assertion fails.
begin;
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','owner-a@example.test'),('22222222-2222-4222-8222-222222222222','owner-b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.save_workspace('{"business":{"name":"A","owner":"A","email":"","phone":"","address":""},"customers":[{"id":"c1","name":"Customer","company":"","email":"","phone":"","address":""}],"services":[],"quotes":[{"id":"QF-1","customerId":"c1","title":"Cleaning","status":"Draft","created":"2026-11-11","expires":"2099-01-01","followUp":"","items":[{"name":"Cleaning","quantity":1,"price":50000}],"discount":0,"tax":0,"notes":""}]}',0);
select public.publish_quote('QF-1',repeat('a',64));
do $$ begin
  if (select version from public.workspaces) <> 2 then raise exception 'Publish did not version workspace'; end if;
  begin
    perform public.save_workspace((select payload from public.workspaces),1);
    raise exception 'Stale save was allowed';
  exception when serialization_failure then null; end;
  begin
    perform public.save_workspace(jsonb_set((select payload from public.workspaces),'{quotes,0,title}','"Tampered"'),2);
    raise exception 'Sent quote was editable';
  exception when raise_exception then if sqlerrm='Sent quote was editable' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
  if (select count(*) from public.workspaces)<>0 then raise exception 'Cross-owner workspace leak'; end if;
  if (select count(*) from public.quote_events)<>0 then raise exception 'Cross-owner activity leak'; end if;
  begin
    perform public.publish_quote('QF-1',repeat('b',64));
    raise exception 'Cross-owner publish was allowed';
  exception when no_data_found then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if public.read_shared_quote(repeat('b',64)) is not null then raise exception 'Invalid token revealed quote'; end if;
  if public.read_shared_quote(repeat('a',64))->'snapshot'->'customer' ? 'email' then raise exception 'Customer contact leaked'; end if;
end $$;
select public.respond_shared_quote(repeat('a',64),'Accepted','Sample Customer');
do $$ begin
  begin
    perform public.respond_shared_quote(repeat('a',64),'Declined','Another Response');
    raise exception 'Duplicate response was allowed';
  exception when raise_exception then if sqlerrm='Duplicate response was allowed' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
  if (select payload->'quotes'->0->>'status' from public.workspaces) <> 'Accepted' then raise exception 'Customer response was not applied'; end if;
end $$;
select public.revoke_quote('QF-1');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if public.read_shared_quote(repeat('a',64)) is not null then raise exception 'Revoked token still works'; end if;
end $$;
rollback;
