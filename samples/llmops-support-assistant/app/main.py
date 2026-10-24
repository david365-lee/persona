import logging
import os
import secrets
import time
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, Field

from app.graph import MODEL, PROMPT_VERSION, build_graph

app = FastAPI(title='LLMOps Support Assistant', version='1.0.0')
auth = HTTPBearer(auto_error=False)
requests_total = Counter('support_requests_total', 'Support requests', ['category', 'status'])
latency = Histogram('support_latency_seconds', 'Support request duration')
logger = logging.getLogger('support')


def authorize(credentials: HTTPAuthorizationCredentials | None = Depends(auth)):
    token = os.getenv('APP_API_TOKEN', '')
    if not token:
        raise HTTPException(503, 'Application authentication is not configured')
    if not credentials or not secrets.compare_digest(credentials.credentials, token):
        raise HTTPException(401, 'Invalid API token')


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=2000, pattern=r'\S')


class Answer(BaseModel):
    answer: str
    category: str
    sources: list[str]
    steps: list[str]
    model: str
    prompt_version: str
    release: str
    latency_ms: float


@lru_cache
def get_graph():
    return build_graph()


@app.get('/health/live')
def live():
    return {'status': 'ok'}


@app.get('/health/ready')
def ready():
    if any(not os.getenv(k) for k in ['APP_API_TOKEN', 'LITELLM_API_KEY', 'LITELLM_BASE_URL']):
        raise HTTPException(503, 'Configuration incomplete')
    return {'status': 'ready', 'release': os.getenv('RELEASE_SHA', 'local')}


@app.get('/metrics')
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post('/api/assist', response_model=Answer, dependencies=[Depends(authorize)])
def assist(body: Question):
    start = time.monotonic()
    try:
        state = get_graph().invoke({'question': body.question})
    except Exception as error:
        requests_total.labels('unknown', 'error').inc()
        logger.error('generation_failed type=%s', type(error).__name__)
        raise HTTPException(502, 'LLM provider request failed') from None
    elapsed = time.monotonic() - start
    latency.observe(elapsed)
    requests_total.labels(state['category'], 'ok').inc()
    return Answer(**{k: state[k] for k in ['answer', 'category', 'sources', 'steps']},
                  model=MODEL, prompt_version=PROMPT_VERSION,
                  release=os.getenv('RELEASE_SHA', 'local'), latency_ms=round(elapsed * 1000, 1))
