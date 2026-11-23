"""Non-destructive local HTTP regression checks. No accounts, mail, AI, or payments are created."""
import http.client, json, sys
from urllib.parse import urlparse
base=urlparse(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:3211')
assert base.scheme=='http' and base.hostname in ('localhost','127.0.0.1'), 'Use a localhost HTTP server'
origin=base.geturl().rstrip('/')
results=[]
def check(label,method,path,expected,body=None,headers=None,chunked=False,secure_headers=False):
    c=http.client.HTTPConnection(base.hostname,base.port or 80,timeout=20)
    c.request(method,path,body,headers or {},encode_chunked=chunked)
    r=c.getresponse(); data=r.read()
    assert r.status==expected,(label,r.status,expected)
    if secure_headers:
        assert 'no-store' in (r.getheader('Cache-Control') or ''),(label,'cache')
        assert r.getheader('X-Frame-Options')=='DENY',(label,'frames')
        assert r.getheader('Referrer-Policy')=='no-referrer',(label,'referrer')
        assert "frame-ancestors 'none'" in (r.getheader('Content-Security-Policy') or ''),(label,'csp')
    results.append({'check':label,'status':r.status,'result':'pass'})
    c.close()
    return data
check('Private workspace requires login','GET','/api/workspace',401)
check('Billing status requires login','GET','/api/billing/status',401)
check('Cross-site publish rejected','POST','/api/quotes/publish',403,'{}',{'Origin':'https://example.invalid','Content-Type':'application/json'})
check('Mixed-case API cannot bypass origin check','POST','/API/auth/logout',403,'{}',{'Origin':'https://example.invalid','Content-Type':'application/json'})
check('Missing Origin rejected','POST','/api/auth/logout',403,'{}',{'Content-Type':'application/json'})
check('Invalid public token rejected','GET','/api/public/invalid',404)
check('Private env file not served','GET','/.env',404)
check('Login page security headers','GET','/login',200,secure_headers=True)
check('Public homepage renders','GET','/',200,secure_headers=True)
check('Marketing page renders','GET','/about',200,secure_headers=True)
check('Invalid token page protected from caching/framing','GET','/q/invalid',200,secure_headers=True)
check('Null auth payload rejected','POST','/api/auth/confirm',400,'null',{'Origin':origin,'Content-Type':'application/json'})
check('Non-JSON auth payload rejected','POST','/api/auth/confirm',415,'{}',{'Origin':origin,'Content-Type':'text/plain'})
body=b'{"padding":"'+b'a'*2000001+b'"}'
check('Chunked oversized request rejected','POST','/api/public/invalid',413,iter([body]),{'Origin':origin,'Content-Type':'application/json'},True)
check('Declared oversized request rejected','POST','/api/public/invalid',413,body,{'Origin':origin,'Content-Type':'application/json'})
check('Unsigned reminder job rejected','POST','/api/reminders',401,'{}',{'Content-Type':'application/json'})
check('Payment webhook disabled without credentials','POST','/api/billing/webhook',503,'{}',{'Content-Type':'application/json'})
check('Health endpoint responds','GET','/api/health',200)
print(json.dumps({'target':origin,'checks':results,'passed':len(results)},indent=2))
