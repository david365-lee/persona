"""Promote only a passing, current commit. Serialize GitOps writes in CI."""
import base64
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path

base = os.getenv('GITLAB_INTERNAL_API_URL', os.environ['CI_API_V4_URL']) + '/projects/' + os.environ['CI_PROJECT_ID']
token = os.environ['GITOPS_PROJECT_TOKEN']
sha = os.environ['CI_COMMIT_SHA']
branch = os.environ['CI_DEFAULT_BRANCH']


def api(path, data=None):
    request = urllib.request.Request(base + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'PRIVATE-TOKEN': token, 'Content-Type': 'application/json',
                 'User-Agent': 'llmops-support-assistant-ci/1.0'})
    with urllib.request.urlopen(request, timeout=30) as r:
        return json.load(r)


head = api('/repository/branches/' + urllib.parse.quote(branch, safe=''))['commit']['id']
if head != sha:
    raise SystemExit('Refusing to promote a stale pipeline: main has changed; run the latest pipeline.')
files = {
    'deploy/base/kustomization.yaml': lambda s: s.replace('newTag: bootstrap', 'newTag: ' + sha),
    'deploy/base/deployment.yaml': lambda s: s.replace('value: bootstrap', 'value: ' + sha),
}
actions = []
for name in files:
    current = api('/repository/files/' + urllib.parse.quote(name, safe='') + '?ref=' + urllib.parse.quote(branch))
    text = base64.b64decode(current['content']).decode()
    if name.endswith('kustomization.yaml'):
        import re
        text = re.sub(r'newTag: \S+', 'newTag: ' + sha, text)
    else:
        import re
        text = re.sub(r'(name: RELEASE_SHA\s+value:) \S+', r'\g<1> ' + sha, text)
    actions.append({'action': 'update', 'file_path': name, 'content': text,
                    'last_commit_id': current['last_commit_id']})
commit = api('/repository/commits', {'branch': branch,
    'commit_message': f'chore(deploy): promote {sha}', 'actions': actions})
Path('reports').mkdir(exist_ok=True)
Path('reports/promotion.json').write_text(json.dumps({'image_sha': sha, 'gitops_commit': commit['id']}, indent=2))
Path('reports/promotion.env').write_text('GITOPS_COMMIT=' + commit['id'] + '\n')
print('Promoted tested image:', sha)
