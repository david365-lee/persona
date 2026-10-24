"""A small, inspectable LangGraph with a LangChain generation node."""
import json
import os
from pathlib import Path
from typing import TypedDict

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = json.loads((ROOT / 'data/knowledge.json').read_text(encoding='utf-8'))
PROMPT = (ROOT / 'prompts/support-v1.txt').read_text(encoding='utf-8')
MODEL = os.getenv('LLM_MODEL', 'gemini-3.5-flash-lite')
PROMPT_VERSION = 'support-v1'


class SupportState(TypedDict, total=False):
    question: str
    category: str
    context: str
    answer: str
    sources: list[str]
    steps: list[str]


def classify(state: SupportState) -> dict:
    question = state['question'].casefold()
    # Deterministic routing keeps this sample inexpensive and reproducible.
    scores = {category: sum(word in question for word in item['keywords'])
              for category, item in KNOWLEDGE.items()}
    best = max(scores, key=scores.get)
    category = best if scores[best] else 'unknown'
    return {'category': category, 'steps': ['classify']}


def retrieve(state: SupportState) -> dict:
    item = KNOWLEDGE[state['category']]
    return {'context': item['policy'], 'sources': [item['source']],
            'steps': state['steps'] + ['retrieve']}


def escalate(state: SupportState) -> dict:
    return {'answer': '확인 가능한 정책이 없습니다. 고객센터에 문의해 주세요.',
            'sources': [], 'steps': state['steps'] + ['escalate']}


def build_graph(llm=None):
    def respond(state: SupportState) -> dict:
        model = llm if llm is not None else ChatOpenAI(
            model=MODEL,
            base_url=os.environ['LITELLM_BASE_URL'],
            api_key=os.environ['LITELLM_API_KEY'],
            temperature=0, max_tokens=300, timeout=45, max_retries=1,
        )
        chain = ChatPromptTemplate.from_messages([
            ('system', PROMPT),
            ('human', 'Policy:\n{context}\n\nCustomer question:\n{question}'),
        ]) | model
        message = chain.invoke({'context': state['context'], 'question': state['question']})
        if isinstance(message.content, str):
            answer = message.content
        else:
            answer = '\n'.join(x.get('text', '') for x in message.content if isinstance(x, dict))
        return {'answer': answer, 'steps': state['steps'] + ['respond']}

    graph = StateGraph(SupportState)
    graph.add_node('classify', classify)
    graph.add_node('retrieve', retrieve)
    graph.add_node('respond', respond)
    graph.add_node('escalate', escalate)
    graph.add_edge(START, 'classify')
    graph.add_conditional_edges('classify', lambda s: 'escalate' if s['category'] == 'unknown' else 'retrieve')
    graph.add_edge('retrieve', 'respond')
    graph.add_edge('respond', END)
    graph.add_edge('escalate', END)
    return graph.compile()
