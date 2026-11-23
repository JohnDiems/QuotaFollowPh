import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
test('database isolation, stale-save bypass, response validation, and direct-RPC billing', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema extensions; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;`)
    for (const file of ['001_workspace.sql','002_billing_and_reminders.sql']) {
      // PGlite has gen_random_uuid built in; pgcrypto is not installed in this harness.
      await db.exec(readFileSync(new URL('../supabase/migrations/'+file, import.meta.url),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''))
    }
    const owner='11111111-1111-4111-8111-111111111111'
    const doc={ business:{name:'Sample',owner:'',email:'',phone:'',address:''},customers:[{id:'c',name:'Customer'}],services:[],quotes:[{id:'q',customerId:'c',title:'Cleaning',status:'Draft',expires:'2099-01-01',items:[{name:'Cleaning',quantity:1,price:10000}],discount:0,tax:0}] }
    await db.query('insert into auth.users(id,email) values($1,$2)',[owner,'owner@example.test'])
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`)
    await db.query('select public.save_workspace($1::jsonb,0)',[JSON.stringify(doc)])
    // Reproduce the original null-version bypass before applying the repair.
    await db.query('select public.save_workspace($1::jsonb,null)',[JSON.stringify(doc)])
    await db.exec(`reset role; update public.subscriptions set period_end=now()-interval '1 day'; set role authenticated`)
    // Original publish RPC accepts an expired subscriber directly; the app-only gate is bypassed.
    await db.query('select public.publish_quote($1,$2)',['q','b'.repeat(64)])
    await db.exec('reset role')
    await db.exec(readFileSync(new URL('../supabase/migrations/003_security_hardening.sql',import.meta.url),'utf8'))
    await db.exec(readFileSync(new URL('../supabase/migrations/004_abuse_and_delivery_guards.sql',import.meta.url),'utf8'))
    await db.exec(`set role authenticated`)
    await assert.rejects(db.query('select public.save_workspace($1::jsonb,null)',[JSON.stringify(doc)]), /Invalid workspace version/)
    await assert.rejects(db.query('select public.save_workspace($1::jsonb,1)',[JSON.stringify(doc)]), /Version conflict/)
    await db.exec(`reset role; update public.subscriptions set period_end=now()-interval '1 day'; update public.app_security_settings set billing_required=true; set role authenticated`)
    await assert.rejects(db.query('select public.publish_quote($1,$2)',['q','a'.repeat(64)]), /Active subscription required/)
    await db.exec('reset role; update public.app_security_settings set billing_required=false; set role authenticated')
    await db.query('select public.publish_quote($1,$2)',['q','a'.repeat(64)])
    const firstMail=await db.query<{reserve_quote_email:boolean}>('select public.reserve_quote_email($1)',['a'.repeat(64)])
    const secondMail=await db.query<{reserve_quote_email:boolean}>('select public.reserve_quote_email($1)',['a'.repeat(64)])
    assert.equal(firstMail.rows[0]!.reserve_quote_email,true)
    assert.equal(secondMail.rows[0]!.reserve_quote_email,false)
    await assert.rejects(db.query('select public.consume_request_quota($1,2,60000)',['c'.repeat(64)]),/permission denied/)
    await db.exec('set role service_role')
    const concurrent=await Promise.all(Array.from({length:8},()=>db.query<{consume_request_quota:boolean}>('select public.consume_request_quota($1,2,60000)',['c'.repeat(64)])))
    assert.equal(concurrent.filter(r=>r.rows[0]!.consume_request_quota).length,2)
    const reminder1=await db.query<{reserve_reminder_email:boolean}>("select public.reserve_reminder_email($1,(now() at time zone 'Asia/Manila')::date)",[owner])
    const reminder2=await db.query<{reserve_reminder_email:boolean}>("select public.reserve_reminder_email($1,(now() at time zone 'Asia/Manila')::date)",[owner])
    assert.equal(reminder1.rows[0]!.reserve_reminder_email,true)
    assert.equal(reminder2.rows[0]!.reserve_reminder_email,false)
    await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false)")
    await assert.rejects(db.query('select public.respond_shared_quote($1,$2,$3)',['a'.repeat(64),'Accepted',null]), /Invalid response/)
    await assert.rejects(db.query('select * from public.workspaces'), /permission denied/)
    await assert.rejects(db.query('select public.reserve_quote_email($1)',['a'.repeat(64)]),/permission denied/)
    await assert.rejects(db.query('select public.consume_request_quota($1,2,60000)',['c'.repeat(64)]),/permission denied/)
    await db.exec('reset role; delete from auth.users;')
    await db.exec(readFileSync(new URL('../supabase/tests/isolation.sql',import.meta.url),'utf8'))
  } finally { await db.close() }
})
