import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { ServerResponse } from 'node:http'
import { createEvent, createError, getCookie, setCookie, deleteCookie } from 'h3'
import { saveSession, requireUser, supabase } from '../server/utils/supabase.ts'
const config={appUrl:'https://example.test',supabaseUrl:'https://provider.example.test',supabaseAnonKey:'anon-test',supabaseServiceKey:'service-test'}
Object.assign(globalThis,{useRuntimeConfig:()=>config,createError,getCookie,setCookie,deleteCookie,rateLimit:async()=>{},clientAddress:()=> '127.0.0.1'})
function event(cookie='') { const req=new PassThrough() as any;req.method='GET';req.url='/';req.headers={cookie};return createEvent(req,new ServerResponse(req)) }
function mockFetch(work:(url:string,options:any)=>Promise<any>) { Object.assign(globalThis,{$fetch:work}) }
test('production sessions set HttpOnly, Secure and SameSite cookies without exposing tokens in JSON',()=>{
 const e=event();saveSession(e,{access_token:'sample-access',refresh_token:'sample-refresh',expires_in:3600})
 const cookies=e.node.res.getHeader('set-cookie') as string[]
 assert.equal(cookies.length,2)
 for(const cookie of cookies) { assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=Lax/i);assert.match(cookie,/Path=\//) }
})
test('a missing session and an unverified provider token cannot become an authenticated user',async()=>{
 await assert.rejects(requireUser(event()),(e:any)=>e.statusCode===401)
 mockFetch(async()=>{throw {statusCode:401}})
 await assert.rejects(requireUser(event('qf-access=forged')),(e:any)=>e.statusCode===401)
})
test('verified users retain their own identity and a valid refresh rotates cookies',async()=>{
 mockFetch(async(url,options)=>{
  if(url.includes('grant_type=refresh_token')) { assert.equal(options.body.refresh_token,'refresh-a');return {access_token:'access-a',refresh_token:'rotated-a',expires_in:3600} }
  const bearer=options.headers.Authorization
  if(bearer==='Bearer access-a') return {id:'owner-a',email:'a@example.test'}
  if(bearer==='Bearer access-b') return {id:'owner-b',email:'b@example.test'}
  throw {statusCode:401}
 })
 const a=event('qf-access=expired; qf-refresh=refresh-a')
 assert.equal((await requireUser(a)).user.id,'owner-a')
 assert.equal((await requireUser(event('qf-access=access-b'))).user.id,'owner-b')
 assert.ok(String(a.node.res.getHeader('set-cookie')).includes('rotated-a'))
})
test('failed refresh clears session cookies and provider errors do not disclose secrets',async()=>{
 mockFetch(async()=>{throw {statusCode:500,data:{message:'sensitive provider credentials'}}})
 const e=event('qf-refresh=invalid')
 await assert.rejects(requireUser(e),(error:any)=>error.statusCode===401)
 const cookies=e.node.res.getHeader('set-cookie') as string[]
 assert.equal(cookies.length,2)
 assert.ok(cookies.every(c=>c.includes('Max-Age=0')))
 await assert.rejects(supabase('/auth/v1/user'),(error:any)=>error.statusCode===502 && !error.message.includes('sensitive'))
})

test('connection outages remain distinguishable without exposing provider details',async()=>{
 mockFetch(async()=>{throw {cause:{code:'ENOTFOUND',message:'private provider hostname and credentials'}}})
 await assert.rejects(supabase('/auth/v1/user'),(error:any)=>error.statusCode===503 && error.message.includes('Cloud service is unreachable') && !error.message.includes('private provider'))
})
