"""Run in the Langflow Pod as admin; exports a secret-free importable flow."""
import argparse
import copy
import importlib.util
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from langflow.custom.utils import build_custom_component_template

parser = argparse.ArgumentParser()
parser.add_argument('--component', default='/tmp/support_gateway.py')
parser.add_argument('--output', default='/tmp/support-assistant-flow.json')
parser.add_argument('--verify', action='store_true')
args = parser.parse_args()
base = 'http://localhost:7860'
session = requests.Session()
r = session.post(base + '/api/v1/login', data={
    'username': 'root', 'password': os.environ['LANGFLOW_SUPERUSER_PASSWORD']}, timeout=30)
r.raise_for_status()
session.headers['Authorization'] = 'Bearer ' + r.json()['access_token']
r = session.get(base + '/api/v1/all', timeout=60)
r.raise_for_status()
components = r.json()
source = Path(args.component).read_text(encoding='utf-8')
spec = importlib.util.spec_from_file_location('support_gateway', args.component)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
template, _ = build_custom_component_template(module.SupportGateway(_code=source))
template['template']['code']['value'] = source
templates = [copy.deepcopy(components['input_output']['ChatInput']), template,
             copy.deepcopy(components['input_output']['ChatOutput'])]
ids = ['ChatInput-support', 'SupportGateway-support', 'ChatOutput-support']
types = ['ChatInput', 'SupportGateway', 'ChatOutput']
templates[0]['template']['input_value']['value'] = '환불은 며칠 이내에 신청해야 하나요?'
templates[0]['template']['should_store_message']['value'] = False
templates[2]['template']['should_store_message']['value'] = False
nodes = []
for index, node in enumerate(templates):
    node['template']['_type'] = 'Component'
    nodes.append({'id': ids[index], 'type': 'genericNode',
                  'position': {'x': index * 400, 'y': 100},
                  'data': {'id': ids[index], 'type': types[index], 'node': node}})
edges = []
for index in range(2):
    target_type = 'str' if index == 0 else 'other'
    sh = {'dataType': types[index], 'id': ids[index], 'name': 'message', 'output_types': ['Message']}
    th = {'fieldName': 'input_value', 'id': ids[index+1], 'inputTypes': ['Message'], 'type': target_type}
    edges.append({'id': f'support-edge-{index}', 'source': ids[index], 'target': ids[index+1],
                  'sourceHandle': json.dumps(sh).replace('"', 'œ'),
                  'targetHandle': json.dumps(th).replace('"', 'œ'),
                  'data': {'sourceHandle': sh, 'targetHandle': th}, 'animated': False})
payload = {'name': 'LLMOps Support Assistant',
           'description': 'GitLab → Harbor → Argo CD; LangGraph + LangChain → LiteLLM → Gemini. Secrets stay in server environment.',
           'endpoint_name': 'llmops-support-assistant', 'access_type': 'PRIVATE',
           'data': {'nodes': nodes, 'edges': edges, 'viewport': {'x': 0, 'y': 0, 'zoom': 0.8}},
           'is_component': False}
existing = session.get(base + '/api/v1/flows/', timeout=30)
existing.raise_for_status()
flows = existing.json()
if isinstance(flows, dict):
    flows = flows.get('flows', flows.get('items', []))
flow = next((f for f in flows if f['name'] == payload['name']), None)
if flow:
    r = session.patch(base + '/api/v1/flows/' + flow['id'], json={'data': payload['data'], 'description': payload['description']}, timeout=60)
else:
    r = session.post(base + '/api/v1/flows/', json=payload, timeout=60)
if not r.ok:
    raise RuntimeError(f'Flow creation failed: {r.status_code} {r.text[:500]}')
flow_id = r.json()['id']
Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
print('Flow URL: https://langflow.clush.cloud/flow/' + flow_id)
if args.verify:
    # The run API requires an API key, whereas flow editing uses the login JWT.
    # Mint a 10-minute verification key and revoke it even if the test fails.
    r = session.post(base + '/api/v1/api_key/', json={
        'name': 'llmops-smoke-ephemeral',
        'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()}, timeout=30)
    r.raise_for_status()
    key = r.json()
    try:
        r = session.post(base + '/api/v1/run/' + flow_id, headers={'x-api-key': key['api_key']},
                         json={'input_value': '환불은 며칠 이내에 신청해야 하나요?', 'input_type': 'chat', 'output_type': 'chat'}, timeout=120)
        if not r.ok:
            raise RuntimeError(f'Flow execution failed: {r.status_code} {r.text[:2000]}')
        text = json.dumps(r.json(), ensure_ascii=False)
        if '7일' not in text or 'respond' not in text:
            raise RuntimeError('Flow response did not contain the expected policy and graph trace')
        print('Langflow → LangGraph → LangChain → LiteLLM → Gemini: passed')
    finally:
        cleanup = session.delete(base + '/api/v1/api_key/' + key['id'], timeout=30)
        cleanup.raise_for_status()
        key = None
