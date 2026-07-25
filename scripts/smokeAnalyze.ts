/**
 * 5작물 × 대표지역 조합으로 로컬 dev 서버의 POST /api/analyze(+ /api/analysis-report)를
 * 실제로 호출해보는 스모크 테스트.
 *
 * 실행: npm run smoke  (또는 npx tsx scripts/smokeAnalyze.ts)
 * 사전 조건: 다른 터미널에서 `npm run dev`로 로컬 서버(http://localhost:3000)가 떠 있어야 한다.
 *
 * self-check(run*SelfChecks)와 달리 이 스크립트는 실제 네트워크 호출(공공데이터 API, Gemini)을
 * 그대로 태운다 — CI에서 상시 자동 실행하는 용도가 아니라, 사람이 필요할 때 수동으로 돌려
 * "실제로 5작물 다 죽지 않고 응답이 오는지"를 눈으로 확인하는 용도다.
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
  { label: "전북 고창군 고창읍", query: "고창군 고창읍" },
  { label: "강원 강릉시 강동면", query: "강릉시 강동면" },
  { label: "경북 안동시", query: "안동시" },
  { label: "제주 제주시", query: "제주시" },
];

interface RegionSearchItem {
  code: string;
  displayName: string;
  nx: number | null;
  ny: number | null;
  weatherGridPrecision: "town" | "city" | "province" | null;
}

interface ScoreDetail {
  field: string;
  score: number | null;
  actual: number | string | null;
  target: string | string[] | null;
  reason: string;
}

interface CropAnalysisResult {
  cropId: CropId;
  location: string;
  overallScore: number;
  confidenceScore: number;
  scoreDetails: ScoreDetail[];
  excludedFields: string[];
  risks: unknown[];
  soil: {
    dataStatus?: "ok" | "no-data" | "mock";
    isMock: boolean;
    parcel?: { status: string };
  };
  dataQuality: {
    weatherIsMock: boolean;
    soilIsMock: boolean;
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
  crop: string;
  region: string;
  outcome: CaseOutcome;
  overallScore: number | string;
  confidenceScore: number | string;
  weatherScore: number | string;
  soilScore: number | string;
  risks: number | string;
  soilStatus: string;
  weatherMock: string;
  soilMock: string;
  reportFallback: string;
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

/**
 * scoreDetails에는 API가 직접 제공하는 weatherScore/soilScore가 없어(overallScore와
 * 개별 field 점수만 있음), 기상 계열(temperature/rainfall)과 토양 계열(ph/ec/texture)
 * 점수의 단순 평균으로 이 스크립트가 파생 계산한다. 표에는 이 사실을 각주로 남긴다.
 */
function deriveGroupScore(scoreDetails: ScoreDetail[], fields: string[]): number | string {
  const values = scoreDetails
    .filter((detail) => fields.includes(detail.field) && detail.score !== null)
    .map((detail) => detail.score as number);
  if (values.length === 0) return "-";
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

async function runCase(cropId: CropId, region: ResolvedRegion): Promise<CaseRow> {
  const crop = `${CROP_LABELS[cropId]}(${cropId})`;

  if (!region.item) {
    return {
      crop,
      region: region.label,
      outcome: "region-not-found",
      overallScore: "-",
      confidenceScore: "-",
      weatherScore: "-",
      soilScore: "-",
      risks: "-",
      soilStatus: "-",
      weatherMock: "-",
      soilMock: "-",
      reportFallback: "-",
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
  };

  const analyzeResult = await fetchJson<CropAnalysisResult>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, crop: cropId }),
  });

  if (!analyzeResult.ok) {
    const isTimeout = analyzeResult.error.startsWith("타임아웃");
    return {
      crop,
      region: region.label,
      outcome: isTimeout ? "analyze-timeout" : "analyze-failed",
      overallScore: "-",
      confidenceScore: "-",
      weatherScore: "-",
      soilScore: "-",
      risks: "-",
      soilStatus: "-",
      weatherMock: "-",
      soilMock: "-",
      reportFallback: "-",
      detail: analyzeResult.error,
    };
  }

  const analysis = analyzeResult.data;
  const weatherScore = deriveGroupScore(analysis.scoreDetails, ["temperature", "rainfall"]);
  const soilScore = deriveGroupScore(analysis.scoreDetails, ["ph", "ec", "texture"]);
  const soilStatus = analysis.soil.dataStatus ?? (analysis.soil.isMock ? "mock" : "ok");

  const reportResult = await fetchJson<{ report: { isFallback: boolean } }>("/api/analysis-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, pests: null }),
  });

  if (!reportResult.ok) {
    return {
      crop,
      region: region.label,
      outcome: "report-failed",
      overallScore: analysis.overallScore,
      confidenceScore: analysis.confidenceScore,
      weatherScore,
      soilScore,
      risks: analysis.risks.length,
      soilStatus,
      weatherMock: analysis.dataQuality.weatherIsMock ? "mock" : "실측",
      soilMock: analysis.dataQuality.soilIsMock ? "mock" : "실측",
      reportFallback: "리포트 오류",
      detail: `analyze는 성공, 리포트 호출 실패: ${reportResult.error}`,
    };
  }

  return {
    crop,
    region: region.label,
    outcome: "ok",
    overallScore: analysis.overallScore,
    confidenceScore: analysis.confidenceScore,
    weatherScore,
    soilScore,
    risks: analysis.risks.length,
    soilStatus,
    weatherMock: analysis.dataQuality.weatherIsMock ? "mock" : "실측",
    soilMock: analysis.dataQuality.soilIsMock ? "mock" : "실측",
    reportFallback: reportResult.data.report.isFallback ? "fallback" : "AI",
    detail: "",
  };
}

async function main() {
  console.log("=".repeat(70));
  console.log("Farm AI 스모크 테스트 — 5작물 × 대표지역 실제 /api/analyze 호출");
  console.log(`대상 서버: ${BASE_URL}`);
  console.log("사전 조건: 다른 터미널에서 `npm run dev`를 실행해 서버를 켜두세요.");
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
        console.log(`  → overallScore=${row.overallScore}, risks=${row.risks}, report=${row.reportFallback}`);
      } else {
        console.log(`  → [${row.outcome}] ${row.detail}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("결과 표 (weatherScore/soilScore는 scoreDetails에서 파생 계산한 값입니다 — API 직접 제공 필드 아님)");
  console.log("=".repeat(70));
  console.table(
    rows.map((row) => ({
      작물: row.crop,
      지역: row.region,
      상태: row.outcome,
      종합점수: row.overallScore,
      신뢰도: row.confidenceScore,
      "기상점수*": row.weatherScore,
      "토양점수*": row.soilScore,
      위험수: row.risks,
      토양상태: row.soilStatus,
      기상: row.weatherMock,
      토양: row.soilMock,
      AI리포트: row.reportFallback,
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
  console.log("=".repeat(70));

  const hardFailures = failures.filter(
    (row) => row.outcome === "region-not-found" || row.outcome === "analyze-failed" || row.outcome === "analyze-timeout",
  );
  if (hardFailures.length > 0) {
    process.exitCode = 1;
  }
}

void main();
