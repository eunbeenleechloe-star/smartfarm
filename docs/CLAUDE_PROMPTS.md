# 역할별 Claude Code 프롬프트

## API 담당
CLAUDE.md와 src/types/analysis.ts를 먼저 읽어줘.
`src/services/weather.ts`만 구현해줘.
기상청 API 원본 응답을 별도 타입으로 정의하고,
최종적으로 WeatherData로 정규화해줘.
환경변수 누락, HTTP 오류, 빈 응답을 처리해줘.
다른 서비스나 UI 파일은 수정하지 마.
작업 후 타입체크 결과를 보고해줘.

## 토양 담당
CLAUDE.md와 공통 타입을 먼저 읽어줘.
`src/services/soil.ts`를 구현해줘.
pH, EC, 토성, 배수등급, 유효토심을 SoilData로 정규화하고,
없는 값은 null로 유지해줘.
데이터 수준과 출처도 반드시 반환해줘.

## 비료 담당
`src/services/fertilizer.ts`를 구현해줘.
공식 API 응답 또는 공식 정적 fallback만 사용하고,
LLM으로 처방량을 만들지 마.
면적과 단위를 명확히 보존해줘.

## 점수·위험 담당
CLAUDE.md와 src/types/analysis.ts, src/data/cropResearchStandards.ts를 먼저 읽어줘.
적합도 점수는 `src/lib/cropScoring.ts`(calculateCropScore, cropScoringWeights),
예보 기반 위험은 `src/lib/cropRiskAnalyzer.ts`(analyzeCropRisks)를 검토하고
결측값 제외, 작물별 가중치 재정규화, 이탈 거리 반영이 올바른지 개선해줘.
두 모듈 다 `src/services/analyze.ts`에서 overallScore/weatherScore/soilScore/
scoreDetails/risks의 원천으로 쓰이고 있으니, 반환 타입이나 필드를 바꾸면
analyze.ts의 매핑 로직도 함께 확인해줘.
순수 함수 형태를 유지하고 runCropScoringSelfChecks()/runCropRiskSelfChecks()에
검증 케이스를 추가해줘.
`src/lib/scoring.ts`는 weightedAverage만 남아 있고(다른 함수는 죽은 코드라 제거함),
`src/lib/risk.ts`는 cropRiskAnalyzer.ts로 완전히 대체되어 삭제됐어 — 되살리지 마.

## 프론트 담당
AnalysisResult 타입만 사용해서 입력 화면과 결과 화면을 구현해줘.
점수, 신뢰도, 위험 3개, 행동 3개, 비료 처방, 출처를 표시해줘.
서비스 내부 계산 로직은 UI에 넣지 마.
