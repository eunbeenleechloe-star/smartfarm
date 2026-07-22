# Farm AI 해커톤 프로젝트 규칙

## 프로젝트 목표
사용자가 지역과 작물을 선택하면 기상·토양 공공데이터를 수집하고,
작물별 공식 생육 기준과 비교하여 적합도 점수, 미래 위험, 비료사용처방,
초보 농업인용 설명을 제공한다.

## 고정 작물
- apple: 사과
- pear: 배
- cucumber: 오이
- potato: 감자
- lettuce: 상추

새 작물을 임의로 추가하지 않는다.

## 개발 원칙
1. API 원본 응답과 내부 정규화 타입을 분리한다.
2. 모든 모듈은 `src/types/analysis.ts`의 공통 타입을 사용한다.
3. 결측값을 0점으로 처리하지 않는다.
4. 공식 출처가 없는 작물 기준값을 임의 생성하지 않는다.
5. 적합도 점수와 단기 위험 등급을 분리한다.
6. 비료 처방량은 API 또는 공식 표준값만 사용한다.
7. LLM은 계산하지 않고 이미 계산된 결과를 쉽게 설명만 한다.
8. 환경변수와 API 키를 코드에 직접 작성하지 않는다.
9. 외부 API 오류 시 mock fallback 여부를 결과에 표시한다.
10. 작업 후 반드시 타입체크 또는 빌드를 실행한다.

## 담당 영역
- API 담당: `src/services/`
- 점수/위험 담당: `src/lib/`, `src/data/`
- 프론트 담당: `src/app/`, `src/components/`
- 기획/영상 담당: `docs/`

## 공통 함수 계약
- `getWeather(location)`
- `getSoil(location)`
- `getFertilizer(crop, location, area?)`
- `calculateSuitability(input)`
- `detectRisks(input)`
- `generateGuide(result)`

함수 이름과 반환 타입을 임의로 바꾸지 않는다.

## Claude Code 작업 순서
1. 기존 구조와 관련 파일을 먼저 읽는다.
2. 변경 예정 파일을 먼저 나열한다.
3. 한 번에 한 기능만 구현한다.
4. 기존 공통 타입을 재사용한다.
5. 구현 후 검증 명령과 결과를 보고한다.
6. 저장소 전체를 재작성하지 않는다.
