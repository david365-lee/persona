# dialect-stt

사투리·한영 혼용 STT 기준선 평가와 학습용 증강 도구. 설계: [docs/DIALECT-STT-PIPELINE.md](../../docs/DIALECT-STT-PIPELINE.md).

```bash
pip install -r requirements.txt
export LITELLM_BASE_URL=https://llmapi.clush.cloud/v1
export LITELLM_API_KEY=<virtual key>

# 1) 기준선: 실제 음성만 담은 평가 manifest
python evaluate_baseline.py eval/manifest.jsonl --limit 50 --out baseline-report.json

# 2) 증강(학습 전용): 기본은 dry run, --execute 시 Cloud TTS 크레딧 소비
python synthesize_augmentation.py --limit 20
python synthesize_augmentation.py --limit 20 --execute --out augmented
```

manifest 형식은 `evaluate_baseline.py` 상단 docstring 참고. 기술 용어는 라틴 문자로 표기한다. 합성 행(`synthetic: true`)이 들어간 manifest는 평가에서 거부된다.
