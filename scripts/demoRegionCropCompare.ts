/**
 * 시연 영상용 "지역 + 작물" 조합 추천 스크립트.
 *
 * scripts/smokeAnalyze.ts를 참고해 확장했다 — 로컬 dev 서버의 실제
 * POST /api/analyze(+ /api/analysis-report)를 후보 지역 × 5작물 전부에 대해 호출하고,
 * 시연 적합도 기준(간단 vs 정밀 실측 여부, 예보 위험 발생 여부, 점수 변별력, 안정성)으로
 * 순위를 매겨 표로 보여준다.
 *
 * 이 스크립트는 조회·비교만 한다 — cropScoring.ts/cropStandards.ts 등 계산 로직이나
 * 기준값은 절대 건드리지 않는다.
 *
 * 실행: npm run demo:compare  (또는 npx tsx scripts/demoRegionCropCompare.ts)
 * 사전 조건: 다른 터미널에서 `npm run dev`로 로컬 서버(http://localhost:3000)가 떠 있어야 하고,
 * .env에 KMA_API_KEY/SOIL_API_KEY/GEMINI_API_KEY 등 실제 키가 있어야 mock이 아닌 결과가 나온다.
 *
 * 참고: 지번(필지) 입력 없이 지역만으로 호출하므로 토양은 항상 "간편 분석"
 * (soil.parcel.status === "not-requested")이다. "정밀 분석"(필지 토성·배수·유효토심)은
 * 실제 존재하는 지번을 사람이 직접 입력해야 확인할 수 있어 이 스크립트로는 검증하지 않는다.
 */

const BASE_URL = "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 25_000;

const CROPS = ["apple", "pear", "cucumber", "potato", "lettuce"] as const;
type CropId = (typeof CROPS)[number];

const CROP_LABELS: Record<CropId, string> = {
  apple: "사과",
  pear: "배",
  cucumber: "오이",
  potato: "감자",
  lettuce: "상추",
};

/** 검색어만 넘긴다 — 실제 stdgCode/nx/ny는 /api/regions/search로 그때그때 조회한다(하드코딩 금지). */
const REGION_QUERIES: { label: string; query: string }[] = [
  { label: "전북 고창군", query: "고창군" },
  { label: "경북 안동시", query: "안동시" },
  { label: "경남 거창군", query: "거창군" },
  { label: "강원 홍천군", query: "홍천군" },
  { label: "전남 해남군", query: "해남군" },
  { label: "제주 서귀포시", query: "서귀포시" },
];

interface RegionSearchItem {
  code: string;
  displayName: string;
  nx: number | null;
  ny: number | null;
  weatherGridPrecision: "town" | "city" | "province" | null;
}

type SoilDataLevel = "parcel" | "district" | "city" | "sample";
type SoilDataStatus = "ok" | "no-data" | "mock";

interface ScoreDetail {
  field: string;
  score: number | null;
  actual: number | string | null;
  target: string | string[] | null;
  reason: string;
}

interface CropRiskItem {
  id: string;
  type: "cold" | "heat" | "heavyRain" | "waterlogging" | "highHumidity";
  title: string;
  severity: "info" | "warning" | "danger";
}

interface CropAnalysisResult {
  cropId: CropId;
  location: string;
  overallScore: number;
  confidenceScore: number;
  scoreDetails: ScoreDetail[];
  excludedFields: string[];
  risks: CropRiskItem[];
  soil: {
    dataLevel: SoilDataLevel;
    dataStatus?: SoilDataStatus;
    isMock: boolean;
    parcel?: { status: string };
  };
  dataQuality: {
    weatherIsMock: boolean;
    soilIsMock: boolean;
    soilDataLevel: SoilDataLevel;
    fertilizerIsFallback: boolean | null;
  };
}

interface ResolvedRegion {
  label: string;
  query: string;
  item: RegionSearchItem | null;
  error: string | null;
}

type CaseOutcome = "ok" | "region-not-found" | "analyze-failed" | "analyze-timeout" | "report-failed";

interface CaseRow {
  cropId: CropId;
  crop: string;
  region: string;
  outcome: CaseOutcome;
  overallScore: number | null;
  scoreSpread: number | null;
  soilLevel: string;
  soilMock: boolean | null;
  weatherMock: boolean | null;
  riskCount: number;
  riskTypes: string[];
  reportFallback: boolean | null;
  detail: string;
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number | null; error: string }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: timeoutSignal(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, status: res.status, error: `JSON 파싱 실패: ${text.slice(0, 200)}` };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}` };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: null,
      error: isAbort ? `타임아웃(${REQUEST_TIMEOUT_MS}ms 초과)` : error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkServerUp(): Promise<boolean> {
  const result = await fetchJson<unknown>("/api/regions/search?q=%EA%B3%A0%EC%B0%BD", { method: "GET" });
  return result.ok;
}

async function resolveRegion(entry: { label: string; query: string }): Promise<ResolvedRegion> {
  const result = await fetchJson<{ items: RegionSearchItem[] }>(
    `/api/regions/search?q=${encodeURIComponent(entry.query)}`,
  );
  if (!result.ok) {
    return { ...entry, item: null, error: result.error };
  }
  const item = result.data.items[0] ?? null;
  if (!item) {
    return { ...entry, item: null, error: "검색 결과 없음" };
  }
  return { ...entry, item, error: null };
}

/** 평가된(제외되지 않은) 필드 점수의 최댓값-최솟값 — "100점 만점 붙박이"가 아니라 실제 변별력이 있는지 판단용. */
function scoreSpread(scoreDetails: ScoreDetail[]): number | null {
  const values = scoreDetails.filter((d) => d.score !== null).map((d) => d.score as number);
  if (values.length < 2) return null;
  return Math.max(...values) - Math.min(...values);
}

async function runCase(cropId: CropId, region: ResolvedRegion): Promise<CaseRow> {
  const crop = `${CROP_LABELS[cropId]}(${cropId})`;

  if (!region.item) {
    return {
      cropId,
      crop,
      region: region.label,
      outcome: "region-not-found",
      overallScore: null,
      scoreSpread: null,
      soilLevel: "-",
      soilMock: null,
      weatherMock: null,
      riskCount: 0,
      riskTypes: [],
      reportFallback: null,
      detail: region.error ?? "지역 검색 실패",
    };
  }

  const location = {
    address: region.item.displayName,
    stdgCode: region.item.code,
    ...(region.item.nx !== null && region.item.ny !== null
      ? { nx: region.item.nx, ny: region.item.ny }
      : {}),
    ...(region.item.weatherGridPrecision ? { weatherGridPrecision: region.item.weatherGridPrecision } : {}),
    // parcel(지번)은 일부러 넘기지 않는다 — 실제 존재 여부를 확인할 지번이 없으므로 "간편 분석"만 검증한다.
  };

  const analyzeResult = await fetchJson<CropAnalysisResult>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, crop: cropId }),
  });

  if (!analyzeResult.ok) {
    const isTimeout = analyzeResult.error.startsWith("타임아웃");
    return {
      cropId,
      crop,
      region: region.label,
      outcome: isTimeout ? "analyze-timeout" : "analyze-failed",
      overallScore: null,
      scoreSpread: null,
      soilLevel: "-",
      soilMock: null,
      weatherMock: null,
      riskCount: 0,
      riskTypes: [],
      reportFallback: null,
      detail: analyzeResult.error,
    };
  }

  const analysis = analyzeResult.data;
  const riskTypes = Array.from(new Set(analysis.risks.map((r) => r.type)));

  const reportResult = await fetchJson<{ report: { isFallback: boolean } }>("/api/analysis-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, pests: null }),
  });

  const base = {
    cropId,
    crop,
    region: region.label,
    overallScore: analysis.overallScore,
    scoreSpread: scoreSpread(analysis.scoreDetails),
    soilLevel: analysis.dataQuality.soilDataLevel,
    soilMock: analysis.dataQuality.soilIsMock,
    weatherMock: analysis.dataQuality.weatherIsMock,
    riskCount: analysis.risks.length,
    riskTypes,
  };

  if (!reportResult.ok) {
    return {
      ...base,
      outcome: "report-failed",
      reportFallback: null,
      detail: `analyze는 성공, 리포트 호출 실패: ${reportResult.error}`,
    };
  }

  return {
    ...base,
    outcome: "ok",
    reportFallback: reportResult.data.report.isFallback,
    detail: "",
  };
}

const RISK_TYPE_LABELS: Record<string, string> = {
  cold: "저온",
  heat: "고온",
  heavyRain: "집중강우",
  waterlogging: "과습",
  highHumidity: "다습",
};

function formatRiskTypes(types: string[]): string {
  if (types.length === 0) return "-";
  return types.map((t) => RISK_TYPE_LABELS[t] ?? t).join("/");
}

/**
 * 시연 적합도 점수(스크립트 자체 집계용 — 채점 로직이 아니라 "어떤 조합을 녹화하면 좋은가"에 대한
 * 순수 표시/정렬 기준). 가중치 순서(요청 기준 그대로):
 * 1) 실측(mock 아님) — soil, weather 각각
 * 2) 예보 위험 1개 이상
 * 3) scoreSpread(변별력)
 * 4) AI 리포트가 fallback이 아님(안정성 신호로만 참고)
 */
function demoFitness(row: CaseRow): number {
  if (row.outcome !== "ok") return -1000;
  let score = 0;
  if (row.soilMock === false) score += 100;
  if (row.weatherMock === false) score += 100;
  if (row.soilLevel === "parcel") score += 20; // 실제로는 발생 안 함(간편 분석만 호출) — 향후 확장 대비
  if (row.riskCount > 0) score += 50;
  score += Math.min(row.scoreSpread ?? 0, 60); // 변별력, 상한을 둬서 극단값이 과대평가되지 않게
  if (row.reportFallback === false) score += 10;
  return score;
}

async function main() {
  console.log("=".repeat(70));
  console.log("Farm AI 시연 조합 추천 — 후보지역 × 5작물 실제 /api/analyze 비교");
  console.log(`대상 서버: ${BASE_URL}`);
  console.log("=".repeat(70));

  const serverUp = await checkServerUp();
  if (!serverUp) {
    console.error(
      `\n[중단] ${BASE_URL} 서버에 연결할 수 없습니다. \`npm run dev\`로 먼저 서버를 켠 뒤 다시 실행해주세요.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log("\n서버 연결 확인됨. 지역 검색부터 시작합니다...\n");

  const resolvedRegions = await Promise.all(REGION_QUERIES.map(resolveRegion));

  for (const region of resolvedRegions) {
    if (!region.item) {
      console.warn(`  [지역 검색 실패] ${region.label} ("${region.query}") — ${region.error}`);
    } else {
      console.log(`  [지역 확인] ${region.label} → ${region.item.displayName} (${region.item.code})`);
    }
  }

  const rows: CaseRow[] = [];
  for (const region of resolvedRegions) {
    for (const cropId of CROPS) {
      console.log(`\n조회 중: ${CROP_LABELS[cropId]}(${cropId}) × ${region.label} ...`);
      const row = await runCase(cropId, region);
      rows.push(row);
      if (row.outcome === "ok") {
        console.log(
          `  → overallScore=${row.overallScore}, risks=${row.riskCount}(${formatRiskTypes(row.riskTypes)}), soil=${row.soilLevel}${row.soilMock ? "/mock" : ""}, report=${row.reportFallback ? "fallback" : "AI"}`,
        );
      } else {
        console.log(`  → [${row.outcome}] ${row.detail}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("전체 결과 표");
  console.log("=".repeat(70));
  console.table(
    rows.map((row) => ({
      작물: row.crop,
      지역: row.region,
      상태: row.outcome,
      종합점수: row.overallScore ?? "-",
      "변별력(최대-최소)": row.scoreSpread ?? "-",
      토양수준: row.soilLevel,
      토양mock: row.soilMock === null ? "-" : row.soilMock ? "mock" : "실측",
      기상mock: row.weatherMock === null ? "-" : row.weatherMock ? "mock" : "실측",
      위험수: row.riskCount,
      위험유형: formatRiskTypes(row.riskTypes),
      AI리포트: row.reportFallback === null ? "-" : row.reportFallback ? "fallback" : "AI",
    })),
  );

  const failures = rows.filter((row) => row.outcome !== "ok");
  console.log("\n" + "=".repeat(70));
  if (failures.length === 0) {
    console.log(`모든 케이스(${rows.length}건) 정상 응답. 실패 없음.`);
  } else {
    console.log(`실패/문제 케이스: ${failures.length}건 / 전체 ${rows.length}건`);
    for (const failure of failures) {
      console.log(`  - [${failure.outcome}] ${failure.crop} × ${failure.region}: ${failure.detail}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("시연 적합도 순위 (기준: 실측 데이터 > 예보 위험 존재 > 점수 변별력 > 리포트 안정성)");
  console.log("=".repeat(70));
  const ranked = [...rows]
    .filter((row) => row.outcome === "ok")
    .sort((a, b) => demoFitness(b) - demoFitness(a));
  console.table(
    ranked.map((row, i) => ({
      순위: i + 1,
      작물: row.crop,
      지역: row.region,
      시연적합도: demoFitness(row),
      종합점수: row.overallScore,
      토양: row.soilMock ? "mock" : row.soilLevel,
      위험: `${row.riskCount}(${formatRiskTypes(row.riskTypes)})`,
      변별력: row.scoreSpread ?? "-",
    })),
  );

  console.log("=".repeat(70));

  const hardFailures = failures.filter(
    (row) => row.outcome === "region-not-found" || row.outcome === "analyze-failed" || row.outcome === "analyze-timeout",
  );
  if (hardFailures.length > 0) {
    process.exitCode = 1;
  }
}

void main();

// scripts/smokeAnalyze.ts와 이름이 겹치는 최상위 변수/타입이 있어(둘 다 import/export가 없어
// TS가 전역 스크립트로 취급함), 이 파일만 모듈로 강제해 충돌을 막는다.
export {};
