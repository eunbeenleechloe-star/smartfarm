# Farm AI — 귀농인을 위한 지역·작물 재배 적합도 분석 서비스

초보 귀농인이 지역과 작물을 선택하면, 공공데이터 기반 기상·토양 정보를 작물별 공식 생육 기준과 비교해 **재배 적합도 점수·단기 위험·비료 처방·병해충 정보**를 알려주고, 이를 AI가 쉬운 말로 설명해주는 웹 서비스입니다.

## 해결하는 문제

작물을 키우기 전 "이 지역, 이 땅에 이 작물이 잘 맞을까?"를 판단하려면 기상청·농촌진흥청 등 여러 공공데이터를 각각 찾아 작물별 공식 생육 기준과 직접 대조해야 합니다. 이 서비스는 그 과정을 지역·작물 선택 한 번으로 자동화합니다.

**대상 작물 (5종, 고정)**: 사과, 배, 오이, 감자, 상추

## 주요 기능

- **재배 적합도 점수**: 기온·pH·EC·토성·강수량 실측값을 작물별 공식 생육 기준과 비교해 0~100점을 계산합니다. 결측값은 0점 처리하지 않고 평가에서 제외하며, 제외된 항목은 결과에 그대로 표시됩니다. 강수량처럼 작물 기준값이 아직 확정되지 않아 항상 제외되는 항목은 결과 화면에 카드 자체가 표시되지 않습니다(사과·오이·상추).
- **단기 위험 탐지**: 기상청 단기예보(최대 며칠 뒤까지)를 기준으로 저온·고온·집중강우·과습·다습 위험을 판단하며, 예보 기반 주의 카드는 위험 유형별로 합쳐서 보여줍니다.
- **정밀 토양 분석(선택)**: 지역 선택만으로는 pH·EC(지역 표본 평균)까지만 나오는 "간편 분석"이 기본입니다. 농지 지번(산/일반·본번·부번)을 추가로 입력하면 필지 단위 토성·배수 상태·유효토심까지 확인하는 "정밀 분석"으로 전환됩니다.
- **비료사용처방**: 작물별 표준 시비량(N/P/K)을 재배면적에 맞춰 환산해 보여줍니다.
- **병해충 정보**: 작물별 주요 병·해충의 증상·방제법을 원본 그대로 보여줍니다(위험도·발생확률을 임의로 가공하지 않음).
- **AI 맞춤 재배 리포트**: `/analyze` 결과 화면에서, 이미 계산된 점수·위험·처방 결과를 Gemini가 초보자 눈높이로 요약 설명합니다. LLM은 수치를 다시 계산하거나 추측하지 않으며, 호출 실패 시 규칙 기반 fallback 리포트가 항상 대신 생성됩니다.
- **AI 농사 상담**(`/ai-chat`): 특정 분석 결과와 무관하게 자유 형식으로 농사 관련 질문을 Gemini에게 물어보는 별도 챗봇입니다. 리포트 설명과 달리 사전에 계산된 값이 없으므로, 수치·처방을 단정적으로 답하지 않도록 안내 문구를 함께 노출합니다.
- **결측/mock 표시**: 외부 API가 실패하거나 키가 없을 때만 대체(mock) 데이터를 쓰고, 이 경우 결과 화면에 mock 여부를 항상 함께 표시합니다.

## 화면 구성

| 경로 | 내용 | 내비게이션 노출 |
|---|---|---|
| `/` | 히어로 + 랜딩(지역·작물 입력 진입점) | 노출 |
| `/guide` | 서비스 소개, 기능 가이드(`#features`) | 노출 |
| `/risk` | 위험분석 진입점(입력 후 `/analyze`로 이동) | 노출 |
| `/ai-chat` | AI 농사 상담 챗봇 | 노출 |
| `/contact` | 문의 | 노출 |
| `/analyze` | 실제 분석 결과 화면(점수·위험·처방·병해충·AI 리포트) | `/`·`/risk` 입력에서 이동 |
| `/data-sources` | 연동 공공데이터 통계 소개 | 링크로만 접근 |
| `/mypage`, `/community` | 로그인/마이페이지/커뮤니티 | **미노출**(심사 범위 밖 미완성 부가기능. 라우트·컴포넌트 파일은 남겨둠 — `src/app/mypage`, `src/app/community`, `src/components/landing/{LoginModal,CommunitySection}`) |

## 아키텍처

Next.js App Router 기반 단일 프로젝트입니다.

```
src/
  app/
    analyze/             # 분석 화면(지역·작물 입력 → 결과)
    ai-chat/              # AI 농사 상담 챗봇 화면
    risk/ guide/ contact/ data-sources/  # 랜딩에서 분기되는 정적/입력 화면
    mypage/ community/    # 미완성 부가기능(내비게이션에서 숨김, 심사 범위 밖)
    api/analyze/          # POST — 기상·토양·비료 조회 후 점수·위험 계산까지 한 번에 처리하는 통합 라우트
    api/analysis-report/  # POST — 계산된 분석 결과를 Gemini(또는 규칙 기반 fallback)로 설명
    api/ai-chat/          # POST — AI 농사 상담 챗봇 응답(Gemini)
    api/crop-pests/       # GET — 작물별 병해충 정보(NCPMS)
    api/regions/search/   # GET — 전국 법정동(읍면동/리) 검색
  services/              # 외부 공공 API 연동 계층 (fetch 원본 응답 → 공통 정규화 타입)
    soil.ts weather.ts fertilizer.ts aiChat.ts farmReport.ts ncpms/ shared/(pnu, kmaGrid, publicApi, legalDistrictSearch ...)
  lib/                   # 순수 계산 로직 (외부 API 호출 없음)
    cropScoring.ts       # 적합도 점수
    cropRiskAnalyzer.ts  # 단기 위험 탐지
  data/                  # 작물별 공식 생육 기준값, 출처 레지스트리, 법정동/기상격자 정적 인덱스
    cropStandards.ts             # 레거시 flat 구조(강수량 등)
    cropResearchStandards.ts     # 작물 단위 연구 기준값(기온/pH/EC/토성)
    cropStandardSources.ts       # 위 두 파일이 실제로 쓰는 기준값의 출처(기관명·근거) 레지스트리
  types/analysis.ts       # 서비스 전역 공통 타입(모든 모듈이 이 타입을 공유)
```

- **API 원본 응답과 내부 정규화 타입을 분리**합니다: `services/`는 XML을 파싱해 `types/analysis.ts`의 공통 타입(`WeatherData`, `SoilData`, `FertilizerPrescription` 등)으로만 변환하고, 점수·위험 계산(`lib/`)은 이 정규화 타입만 입력으로 받습니다.
- **작물 기준값과 출처를 분리**합니다: `cropStandards.ts`/`cropResearchStandards.ts`는 점수 계산이 실제로 읽는 값이고, `cropStandardSources.ts`는 그 값이 어느 공식 자료에서 나왔는지만 기록하는 별도 레지스트리입니다. 두 종류를 섞지 않으므로, 기준값을 바꾸지 않고 출처만 보강하거나 반대로 출처 검증 없이 값만 추가하는 실수를 구조적으로 막습니다.
- **테스트**: 별도 테스트 러너(Jest 등) 없이, 각 모듈이 `run*SelfChecks()` 형태의 자체 검증 함수를 내보냅니다. `npm run smoke`(`scripts/smokeAnalyze.ts`)로 핵심 분석 흐름을 점검합니다.

## 연동 공공 API

| 데이터 | API | 필요 환경변수 |
|---|---|---|
| 단기 기상예보(기온·강수량·습도·풍속) | 기상청 단기예보 조회서비스 (`VilageFcstInfoService_2.0/getVilageFcst`) | `KMA_API_KEY` |
| 지역 토양 화학성(pH·EC) | 농촌진흥청 국립농업과학원 토양검정 화학성 상세정보 (`SoilEnviron/SoilExam/V2/getSoilExamList`) | `SOIL_API_KEY` |
| 필지 단위 토양특성(토성·배수등급·유효토심) | 농촌진흥청 국립농업과학원 토양도 기반 토양특성 상세정보 (`SoilEnviron/SoilCharac/V3/getSoilCharacter`) — 지번(PNU) 입력 시에만 호출 | `SOIL_MAP_DETAIL_API_KEY` |
| 작물별 비료 표준사용량 처방 | 농촌진흥청 국립농업과학원 작물별 비료 표준사용량 처방 정보 (`SoilEnviron/FrtlzrStdUse/getSoilFrtlzrQyList`) | `FERTILIZER_API_KEY` |
| 병해충 검색·상세정보 | 농사로 국가농작물병해충관리시스템(NCPMS) 병/해충 검색·상세 서비스(SVC01/SVC03/SVC05/SVC07) | `PEST_API_KEY` |
| AI 맞춤 재배 리포트 · AI 농사 상담 | Google Gemini API (`gemini-3.6-flash`, `generateContent`) | `GEMINI_API_KEY` |

전국 법정동(읍면동/리) 검색은 외부 API 호출 없이, 행정안전부 "법정동코드 전체자료"를 빌드 시점에 전처리한 정적 JSON(`src/data/legalDistricts.json`)을 서버 메모리에서 검색합니다. `.env.example`의 `REGION_API_KEY`는 현재 코드 어디에서도 읽지 않는 미사용 항목입니다.

작물별 생육 기준값(적정 기온·pH·EC·선호 토성·강수량, 저온/고온 위험 기준)의 출처는 농촌진흥청 『농업기술길잡이』 시리즈, 농사로 농업기술포털, 흙토람, 한국농촌경제연구원 자료이며, 필드 단위 출처와 검증 여부는 `src/data/cropStandardSources.ts`에 기록되어 있습니다. 아직 공식 출처를 대조하지 못한 항목(현재 오이 강수량 1건)은 `verified: false`로 남아 있으며, 값이 없는 채 임의로 채우지 않습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env   # 실제 키 채우기 (또는 NEXT_PUBLIC_USE_MOCK_DATA=true로 mock 모드 실행)
npm run dev             # http://localhost:3000
```

검증:
```bash
npm run typecheck
npm run build
npm run smoke
```

`.env`에 필요한 키(`.env.example` 기준): `KMA_API_KEY`, `SOIL_API_KEY`(+ `SOIL_CHEMISTRY_API_KEY`/`SOIL_MAP_DETAIL_API_KEY`는 대체/보조용), `FERTILIZER_API_KEY`, `PEST_API_KEY`, `GEMINI_API_KEY`. 하나라도 없으면 해당 데이터만 mock으로 대체되고 나머지는 정상 동작합니다.

## 데이터 한계

- **토양 화학성(pH·EC)은 읍면동 단위 표본 평균**입니다. 선택한 필지의 실측값이 아니며, 최근 3년 내 그 지역 표본이 없으면 값 없이 "무데이터"로 표시됩니다(0으로 채우지 않음).
- **필지 단위 토성·배수·유효토심**은 지번을 입력했을 때만 조회하며, 존재 여부를 확인하는 별도 지번/주소 API가 없어 "이 필지가 실제로 존재하지 않는다"고 단정하지 않고 "확인 가능한 자료 없음"으로만 표시합니다.
- **비료 처방**은 5개 고정 작물 각각 대표 재배조건 1개(예: 사과 비옥지 1~4년)의 표준값입니다. 같은 작물이라도 실제 재배조건에 따라 달라질 수 있습니다.
- **집중강우 위험 임계값**(30mm/50mm, 3일 누적 80mm)은 공식 작물 기준이 아니라 이 서비스가 설계한 값입니다.
- **강수량 적합도 기준은 연간·생육기 단위**(예: 배 mm/년, 감자 mm/생육기)인 반면 결과 화면에는 기상청 단기예보 강수량이 함께 표시되므로, 두 값의 적용 기간이 다릅니다. 이를 오해하지 않도록 강수량이 실제로 채점에 쓰이는 작물(배·감자)에는 참고 지표 각주를 표시합니다.
- **AI 리포트/AI 농사 상담은 계산하지 않습니다.** 이미 계산된 점수·위험·처방 값을 설명만 하며, 결측값을 추측해 채우지 않습니다.
- 외부 API가 실패하거나 키가 없으면 해당 데이터만 mock으로 대체되고, 결과 화면에 mock 여부가 항상 표시됩니다.
