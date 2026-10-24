import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.graph import build_graph, classify
from app.main import app, get_graph


@pytest.mark.parametrize('question,category', [
    ('환불 신청', 'refund'), ('delivery status', 'shipping'),
    ('비밀번호 분실', 'account'), ('주식 시세', 'unknown'),
])
def test_classification(question, category):
    assert classify({'question': question})['category'] == category


def test_unknown_does_not_call_provider():
    class ForbiddenModel:
        def invoke(self, *args, **kwargs):
            raise AssertionError('Unknown questions must not call the LLM')
    result = build_graph(ForbiddenModel()).invoke({'question': '주식 시세'})
    assert result['steps'] == ['classify', 'escalate']
    assert result['sources'] == []


def test_graph_passes_only_matching_policy():
    model = FakeListChatModel(responses=['수령 후 7일 이내 신청하세요.'])
    result = build_graph(model).invoke({'question': '환불 신청 방법'})
    assert result['steps'] == ['classify', 'retrieve', 'respond']
    assert result['sources'] == ['policy/refund-v1']
    assert '7일' in result['context']
    assert '2~3일' not in result['context']


def test_api_auth_validation_and_contract(monkeypatch):
    monkeypatch.setenv('APP_API_TOKEN', 'test-only-token')
    monkeypatch.setenv('LITELLM_API_KEY', 'test-only-provider-key')
    monkeypatch.setenv('LITELLM_BASE_URL', 'http://unused/v1')
    app.dependency_overrides[get_graph] = lambda: None
    # Endpoint uses a cached factory, so replace it directly for a provider-free contract test.
    monkeypatch.setattr('app.main.get_graph', lambda: build_graph(FakeListChatModel(responses=['7일 이내 환불'])) )
    client = TestClient(app)
    assert client.post('/api/assist', json={'question': '환불'}).status_code == 401
    headers = {'Authorization': 'Bearer test-only-token'}
    assert client.post('/api/assist', json={'question': ' '}, headers=headers).status_code == 422
    assert client.post('/api/assist', json={'question': 'x' * 2001}, headers=headers).status_code == 422
    response = client.post('/api/assist', json={'question': '환불'}, headers=headers)
    assert response.status_code == 200
    assert response.json()['category'] == 'refund'
    assert response.json()['prompt_version'] == 'support-v1'
    assert client.get('/health/ready').status_code == 200
    app.dependency_overrides.clear()


def test_provider_errors_do_not_leak_secrets(monkeypatch):
    monkeypatch.setenv('APP_API_TOKEN', 'test-only-token')
    class BrokenGraph:
        def invoke(self, state):
            raise RuntimeError('secret-provider-key')
    monkeypatch.setattr('app.main.get_graph', lambda: BrokenGraph())
    r = TestClient(app).post('/api/assist', json={'question': '환불'},
                           headers={'Authorization': 'Bearer test-only-token'})
    assert r.status_code == 502
    assert 'secret-provider-key' not in r.text
