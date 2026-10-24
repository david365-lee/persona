"""Versioned online evaluation. Failure prevents promotion to GitOps."""
import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree

from app.graph import MODEL, PROMPT_VERSION, ROOT, build_graph


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='reports')
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    cases_file = ROOT / 'evals/cases.json'
    cases = json.loads(cases_file.read_text(encoding='utf-8'))
    graph = build_graph()
    results = []
    suite = Element('testsuite', name='llm-quality', tests=str(len(cases)))
    for case in cases:
        start = time.monotonic()
        errors = []
        try:
            state = graph.invoke({'question': case['question']})
            if state['category'] != case['category']:
                errors.append('category mismatch')
            for word in case['must_contain']:
                if word not in state['answer']:
                    errors.append(f'missing required fact: {word}')
            for word in case.get('must_not_contain', []):
                if word in state['answer']:
                    errors.append(f'forbidden fact: {word}')
            if case['source'] and case['source'] not in state['sources']:
                errors.append('missing policy provenance')
        except Exception as exc:
            state = {}
            errors.append(type(exc).__name__)
        elapsed = time.monotonic() - start
        if elapsed > 60:
            errors.append('latency above 60 seconds')
        row = {'id': case['id'], 'passed': not errors, 'errors': errors,
               'latency_seconds': round(elapsed, 3), 'answer': state.get('answer', '')}
        results.append(row)
        test = SubElement(suite, 'testcase', name=case['id'], time=str(elapsed))
        if errors:
            SubElement(test, 'failure', message='; '.join(errors)).text = json.dumps(row, ensure_ascii=False)
    failed = sum(not r['passed'] for r in results)
    suite.set('failures', str(failed))
    ElementTree(suite).write(output / 'quality.xml', encoding='utf-8', xml_declaration=True)
    report = {'model': MODEL, 'prompt_version': PROMPT_VERSION,
              'commit': os.getenv('CI_COMMIT_SHA', 'local'),
              'dataset_sha256': hashlib.sha256(cases_file.read_bytes()).hexdigest(),
              'prompt_sha256': hashlib.sha256((ROOT / 'prompts/support-v1.txt').read_bytes()).hexdigest(),
              'passed': len(cases) - failed, 'total': len(cases), 'cases': results}
    (output / 'quality.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Quality gate: {len(cases) - failed}/{len(cases)} passed")
    raise SystemExit(1 if failed else 0)


if __name__ == '__main__':
    main()
