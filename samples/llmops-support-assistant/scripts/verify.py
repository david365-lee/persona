"""Wait for Argo CD's desired release, then verify the deployed graph."""
import json
import os
import time
import urllib.request
from pathlib import Path

base = os.getenv('SAMPLE_API_URL', 'http://support-assistant.llmops-sample.svc.cluster.local:8000')
expected = os.environ['CI_COMMIT_SHA']
Path('reports').mkdir(exist_ok=True)
result = {'expected_release': expected, 'ready': False}
deadline = time.monotonic() + 360
while time.monotonic() < deadline:
    try:
        with urllib.request.urlopen(base + '/health/ready', timeout=10) as r:
            ready = json.load(r)
        if ready.get('release') == expected:
            result['ready'] = True
            break
    except Exception:
        pass
    time.sleep(5)
if not result['ready']:
    Path('reports/deployment.json').write_text(json.dumps(result))
    raise SystemExit('Timed out waiting for Argo CD to deploy the evaluated image')
request = urllib.request.Request(base + '/api/assist',
    data=json.dumps({'question': '환불은 며칠 이내 신청해야 하나요?'}).encode(),
    headers={'Authorization': 'Bearer ' + os.environ['APP_API_TOKEN'], 'Content-Type': 'application/json'})
with urllib.request.urlopen(request, timeout=60) as r:
    answer = json.load(r)
result['response'] = answer
result['passed'] = answer['release'] == expected and '7일' in answer['answer'] and answer['category'] == 'refund'
Path('reports/deployment.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
if not result['passed']:
    raise SystemExit('Deployed endpoint did not pass its smoke test')
print('Argo CD deployment and live Gemini response verified:', expected)
