import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const base=process.argv[2] || 'http://127.0.0.1:3211'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local targets only')
const browser=await chromium.launch({executablePath:process.env.VAPT_BROWSER_PATH || '/usr/bin/brave-browser',headless:true})
const results=[]
try {
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const context=await browser.newContext({viewport})
    const page=await context.newPage()
    const errors=[]
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin ? route.continue() : route.abort())
    page.on('pageerror',error=>errors.push(error.message))
    await page.addInitScript(()=>{window.__cspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.__cspViolations.push(event.violatedDirective))})
    const response=await page.goto(base+'/about')
    await page.getByRole('link',{name:'Start your workspace',exact:true}).waitFor()
    // Hydration, rather than a static SSR screenshot, must succeed under CSP.
    await page.waitForFunction(()=>document.querySelector('#__nuxt')?.__vue_app__)
    const csp=response.headers()['content-security-policy']
    assert.match(csp,/script-src 'nonce-[^']+' 'strict-dynamic'/)
    assert.ok(!csp.includes("'unsafe-eval'"))
    const nonces=await page.locator('script').evaluateAll(nodes=>nodes.map(node=>node.nonce))
    assert.ok(nonces.length && nonces.every(Boolean))
    await page.locator('summary').first().click()
    assert.equal(await page.locator('details').first().getAttribute('open'),'')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    await page.getByRole('link',{name:'Start your workspace',exact:true}).click()
    await page.getByRole('heading',{name:'Start your workspace'}).waitFor()
    const password=page.getByLabel('Password',{exact:true})
    assert.equal(await password.getAttribute('type'),'password')
    await password.fill('sample-passphrase-2026')
    await page.getByRole('button',{name:'Show password'}).click()
    assert.equal(await password.getAttribute('type'),'text')
    await page.getByRole('button',{name:'Hide password'}).click()
    assert.equal(await password.getAttribute('type'),'password')
    // Mock the response in the browser: never create accounts or send emails during VAPT.
    await page.route('**/api/auth/signup',route=>route.fulfill({json:{message:'Local test: confirmation required.'}}))
    await page.getByLabel('Email',{exact:true}).fill('sample@example.test')
    await page.getByRole('button',{name:'Create account',exact:true}).click()
    await page.getByRole('status').filter({hasText:'Local test: confirmation required.'}).waitFor()
    await page.getByRole('button',{name:'Already registered? Sign in'}).click()
    assert.equal(await password.inputValue(),'')
    await page.getByRole('button',{name:'Forgot password?'}).click()
    await page.route('**/api/auth/recover',route=>route.fulfill({json:{message:'Local test: recovery email requested.'}}))
    await page.getByRole('button',{name:'Send reset email'}).click()
    await page.getByRole('status').filter({hasText:'Local test: recovery email requested.'}).waitFor()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    assert.deepEqual(await page.evaluate(()=>window.__cspViolations),[])
    assert.deepEqual(errors,[])
    await page.goto(base+'/auth/reset?token_hash=local-test')
    await page.getByLabel('New password',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Show password'}).click()
    assert.equal(await page.getByLabel('New password',{exact:true}).getAttribute('type'),'text')
    // Inject untrusted parser markup into the response, preserving the real CSP header.
    // CDP-evaluated DOM insertion is not a valid strict-dynamic injection test.
    await page.route('**/auth/reset?token_hash=local-test&csp_probe=1',async route=>{
      const response=await route.fetch()
      const html=(await response.text()).replace('</body>','<script>window.__unexpectedScriptRan = true</script></body>')
      await route.fulfill({response,body:html})
    })
    await page.goto(base+'/auth/reset?token_hash=local-test&csp_probe=1')
    await page.getByLabel('New password',{exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.__unexpectedScriptRan),undefined)
    results.push({viewport,hydration:true,passwordControls:true,signupAndRecoveryForms:true,nonceCsp:true,untrustedScriptBlocked:true,overflow:false})
    await context.close()
  }
  console.log(JSON.stringify({browser:'local Chromium/Brave',externalRequests:'blocked',providerResponses:'mocked',results},null,2))
} finally { await browser.close() }
