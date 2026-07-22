# 4인 팀 통합 작업 방법

## 역할
### PM/통합
- `src/types/`
- `src/data/`
- `src/lib/`
- PR 검수와 최종 통합

### API 담당
- `src/services/weather.ts`
- `src/services/soil.ts`
- `src/services/fertilizer.ts`
- 원본 API 타입을 별도 파일로 추가 가능

### 프론트 담당
- `src/app/`
- `src/components/`
- 공통 타입을 import해서 사용

### 기획/영상 담당
- `docs/`
- 서비스 소개서, 출처표, 영상 대본 관리

## 브랜치
- `feature/weather-soil-api`
- `feature/fertilizer-api`
- `feature/scoring-risk`
- `feature/frontend`
- `docs/planning-video`

## PR 규칙
1. 한 PR에 한 기능만 넣는다.
2. 공통 타입을 바꿀 때는 팀 채팅에 먼저 공유한다.
3. PR 설명에 실행 명령과 결과를 적는다.
4. API 키나 실제 `.env` 파일은 올리지 않는다.
5. 병합 전 `npm run build` 또는 `npm run typecheck`를 실행한다.

## Day 1 오전에 합의할 계약
- 함수명
- 필드명
- 단위
- null 처리
- mock 여부 표시
- 데이터 출처 표시

## API 담당이 넘겨야 하는 형태
```ts
getWeather(location): Promise<WeatherData>
getSoil(location): Promise<SoilData>
getFertilizer(crop, location, areaM2?): Promise<FertilizerPrescription | null>
```

## 프론트가 사용하는 최종 형태
```ts
POST /api/analyze
{
  "location": { "address": "전북 고창군" },
  "crop": "pear",
  "growthStage": "개화기",
  "areaM2": 1000
}
```

## 통합 충돌 방지
- API 담당은 UI 파일 수정 금지
- 프론트 담당은 서비스 함수 내부 수정 금지
- 작물 기준은 PM 승인 후 변경
- 기획 담당은 코드의 수치와 소개서의 수치가 같은지 검수
