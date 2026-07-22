# Farm AI Integration Starter

4인 팀이 Cursor + Claude Code로 병렬 개발한 결과물을 합치기 위한 공통 스타터입니다.

## 포함 내용
- 공통 TypeScript 타입
- 작물 기준 데이터 구조
- 점수 계산 및 위험 탐지 뼈대
- 기상·토양·비료 서비스 인터페이스
- mock 데이터
- `/api/analyze` 통합 라우트
- 팀 Git/PR 규칙
- 역할별 Claude Code 프롬프트
- 4일 일정

## 사용법
1. Next.js 프로젝트 루트에 이 패키지 내용을 복사합니다.
2. `@/*` 경로 별칭이 `src/*`를 가리키는지 확인합니다.
3. `.env.example`을 `.env.local`로 복사합니다.
4. 처음에는 `NEXT_PUBLIC_USE_MOCK_DATA=true`로 실행합니다.
5. API 담당자가 `src/services/`의 함수 내부를 실제 API로 교체합니다.
6. 프론트 담당자는 `POST /api/analyze`만 호출합니다.

## 테스트 요청 예시
```json
{
  "location": {
    "address": "전북 고창군"
  },
  "crop": "pear",
  "growthStage": "개화기",
  "areaM2": 1000
}
```

## 주의
이 패키지는 기존 Next.js 전체 프로젝트가 아니라 통합용 소스 뼈대입니다.
작물 기준값은 제출 전 팀이 확보한 공식 출처와 다시 대조해야 합니다.
