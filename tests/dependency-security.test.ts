import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const rollupRequire=createRequire(require.resolve('@rollup/plugin-node-resolve'))
const merge=rollupRequire('deepmerge')
test('the actual Rollup merge dependency rejects prototype keys from source and target', () => {
  for (const key of ['__proto__','constructor','prototype']) {
    const input=Object.create(null); input[key]={polluted:true}
    for (const result of [merge({},input),merge(input,{safe:1}),merge({nested:{}},{nested:input})]) {
      assert.equal(Object.getPrototypeOf(result),Object.prototype)
      assert.equal(Object.hasOwn(result,key),false)
      assert.equal(result.polluted,undefined)
      if(result.nested) assert.equal(Object.hasOwn(result.nested,key),false)
    }
  }
  assert.equal(({} as any).polluted,undefined)
})
test('patched merge preserves arrays, symbols, cloning and custom merge used by build tooling', () => {
  const symbol=Symbol('sample');const a={array:[1],nested:{first:1},[symbol]:'value'}
  const result=merge(a,{array:[2],nested:{second:2}})
  assert.deepEqual(result.array,[1,2]);assert.deepEqual(result.nested,{first:1,second:2});assert.equal(result[symbol],'value')
  assert.notEqual(result.nested,a.nested)
  assert.deepEqual(merge.all([{a:1},{b:2}]),{a:1,b:2})
  assert.deepEqual(merge({x:[1]},{x:[2]},{arrayMerge:(_a:any,b:any)=>b}),{x:[2]})
})
