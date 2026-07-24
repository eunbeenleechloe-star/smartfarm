import { NextResponse } from "next/server";
import { generateFarmAnalysisReport, buildFallbackReport } from "@/services/farmReport";
import type { CropAnalysisResult, CropDataQuality } from "@/services/cropAnalysis";
import type { ScoreDetail } from "@/lib/cropScoring";
import type { CropRiskItem } from "@/lib/cropRiskAnalyzer";
import type {
  CropId,
  FertilizerPrescription,
  SoilData,
  SoilDataStatus,
} from "@/types/analysis";
import type {
  CropPestsResponse,
  DiseaseCardItem,
  InsectCardItem,
} from "@/types/cropPests";

/**
 * "AI 맞춤 재배 리포트" 생성 API. GEMINI_API_KEY는 이 서버 라우트 안에서만 쓰이고
 * 클라이언트로 전달되지 않는다. 요청 바디는 신뢰하지 않고 허용된 필드만 뽑아 사용한다
 * (프론트가 그대로 넘겨준 /api/analyze, /api/crop-pests 결과라도 그대로 믿지 않음).
 */

const MAX_BODY_LENGTH = 300_000;
const VALID_CROP_IDS: CropId[] = ["apple", "pear", "cucumber", "potato", "lettuce"];
const VALID_SOIL_DATA_STATUS: SoilDataStatus[] = ["ok", "no-data", "mock"];

function isString(value: unknown): value is string {
  return typeof value === "string";
}
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
function asStringOrNull(value: unknown): string | null {
  return isString(value) ? value : null;
}
function asNumberOrNull(value: unknown): number | null {
  return isNumber(value) ? value : null;
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString) : [];
}

function pickScoreDetail(raw: unknown): ScoreDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.field) || !isString(r.reason)) return null;
  const target = Array.isArray(r.target) ? asStringArray(r.target) : asStringOrNull(r.target);
  return {
    field: r.field,
    score: asNumberOrNull(r.score),
    actual: isString(r.actual) || isNumber(r.actual) ? r.actual : null,
    target,
    reason: r.reason,
  };
}

function pickRisk(raw: unknown): CropRiskItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.id) || !isString(r.title) || !isString(r.severity) || !isString(r.evidence) || !isString(r.action)) {
    return null;
  }
  return {
    id: r.id,
    type: isString(r.type) ? (r.type as CropRiskItem["type"]) : "highHumidity",
    title: r.title,
    severity: r.severity as CropRiskItem["severity"],
    date: asStringOrNull(r.date) ?? undefined,
    evidence: r.evidence,
    threshold: asNumberOrNull(r.threshold) ?? undefined,
    actualValue: asNumberOrNull(r.actualValue) ?? undefined,
    action: r.action,
    source: asStringOrNull(r.source) ?? undefined,
  };
}

function pickSoil(raw: unknown): SoilData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isBoolean(r.isMock) || !isString(r.dataLevel) || !isString(r.source)) return null;
  const dataStatus = VALID_SOIL_DATA_STATUS.includes(r.dataStatus as SoilDataStatus)
    ? (r.dataStatus as SoilDataStatus)
    : undefined;
  return {
    ph: asNumberOrNull(r.ph),
    ecDsM: asNumberOrNull(r.ecDsM),
    texture: asStringOrNull(r.texture),
    drainage: asStringOrNull(r.drainage),
    effectiveDepthCm: asNumberOrNull(r.effectiveDepthCm),
    dataLevel: r.dataLevel as SoilData["dataLevel"],
    source: r.source,
    observedAt: asStringOrNull(r.observedAt),
    isMock: r.isMock,
    dataStatus,
  };
}

function pickFertilizer(raw: unknown): FertilizerPrescription | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.source) || !isBoolean(r.isFallback)) return null;
  return {
    nitrogenKg: asNumberOrNull(r.nitrogenKg),
    phosphorusKg: asNumberOrNull(r.phosphorusKg),
    potassiumKg: asNumberOrNull(r.potassiumKg),
    compostKg: asNumberOrNull(r.compostKg),
    limeKg: asNumberOrNull(r.limeKg),
    기준면적M2: asNumberOrNull(r.기준면적M2),
    source: r.source,
    isFallback: r.isFallback,
  };
}

function pickDataQuality(raw: unknown): CropDataQuality | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isBoolean(r.weatherIsMock) || !isBoolean(r.soilIsMock) || !isString(r.soilDataLevel)) return null;
  return {
    weatherIsMock: r.weatherIsMock,
    soilIsMock: r.soilIsMock,
    soilDataLevel: r.soilDataLevel as CropDataQuality["soilDataLevel"],
    fertilizerIsFallback: typeof r.fertilizerIsFallback === "boolean" ? r.fertilizerIsFallback : null,
  };
}

/** 요청 바디의 analysis 필드에서 허용된 필드만 뽑는다. 신뢰하지 않은 원본을 그대로 쓰지 않는다. */
function pickAnalysis(raw: unknown): CropAnalysisResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (!VALID_CROP_IDS.includes(r.cropId as CropId)) return null;
  if (!isString(r.location) || !isNumber(r.overallScore) || !isNumber(r.confidenceScore)) return null;
  if (!Array.isArray(r.scoreDetails) || !Array.isArray(r.risks) || !Array.isArray(r.sources)) return null;

  const soil = pickSoil(r.soil);
  const dataQuality = pickDataQuality(r.dataQuality);
  if (!soil || !dataQuality) return null;

  return {
    cropId: r.cropId as CropId,
    location: r.location,
    overallScore: r.overallScore,
    confidenceScore: r.confidenceScore,
    scoreDetails: r.scoreDetails.map(pickScoreDetail).filter((v): v is ScoreDetail => v !== null),
    excludedFields: asStringArray(r.excludedFields) as CropAnalysisResult["excludedFields"],
    risks: r.risks.map(pickRisk).filter((v): v is CropRiskItem => v !== null),
    fertilizer: pickFertilizer(r.fertilizer),
    soil,
    dataQuality,
    sources: asStringArray(r.sources),
    generatedAt: asStringOrNull(r.generatedAt) ?? new Date(0).toISOString(),
  };
}

function pickDiseaseItem(raw: unknown): DiseaseCardItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.id) || !isString(r.nameKor)) return null;
  return {
    id: r.id,
    cropName: asStringOrNull(r.cropName),
    nameKor: r.nameKor,
    nameEng: asStringOrNull(r.nameEng),
    thumbnailUrl: asStringOrNull(r.thumbnailUrl),
    detail: (r.detail as DiseaseCardItem["detail"]) ?? null,
  };
}

function pickInsectItem(raw: unknown): InsectCardItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.id) || !isString(r.nameKor)) return null;
  return {
    id: r.id,
    cropName: asStringOrNull(r.cropName),
    nameKor: r.nameKor,
    speciesName: asStringOrNull(r.speciesName),
    thumbnailUrl: asStringOrNull(r.thumbnailUrl),
    detail: (r.detail as InsectCardItem["detail"]) ?? null,
  };
}

/** 요청 바디의 pests 필드에서 허용된 필드만 뽑는다. null이면(아직 로딩 전/실패) 병해충 없이 진행한다. */
function pickPests(raw: unknown): CropPestsResponse | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.cropName) || !Array.isArray(r.diseases) || !Array.isArray(r.insects)) return null;

  return {
    cropName: r.cropName,
    diseases: r.diseases.map(pickDiseaseItem).filter((v): v is DiseaseCardItem => v !== null),
    insects: r.insects.map(pickInsectItem).filter((v): v is InsectCardItem => v !== null),
    source: r.source === "MOCK" ? "MOCK" : "NCPMS",
    dataStatus: {
      partialFailure: Boolean((r.dataStatus as Record<string, unknown> | undefined)?.partialFailure),
      diseaseSearchFailed: Boolean((r.dataStatus as Record<string, unknown> | undefined)?.diseaseSearchFailed),
      insectSearchFailed: Boolean((r.dataStatus as Record<string, unknown> | undefined)?.insectSearchFailed),
      isMock: Boolean((r.dataStatus as Record<string, unknown> | undefined)?.isMock),
    },
    fetchedAt: asStringOrNull(r.fetchedAt) ?? new Date(0).toISOString(),
  };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (rawBody.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { message: "요청 데이터가 너무 큽니다." },
      { status: 413 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const body = parsed as Record<string, unknown>;
  const analysis = pickAnalysis(body?.analysis);
  if (!analysis) {
    return NextResponse.json(
      { message: "분석 결과 데이터가 없거나 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }
  const pests = pickPests(body?.pests);

  try {
    const report = await generateFarmAnalysisReport(analysis, pests);
    return NextResponse.json({ report });
  } catch (error) {
    // generateFarmAnalysisReport는 내부적으로 fallback을 반환하므로 원래 여기까지 오지 않지만,
    // 예상 못한 예외로 분석 화면 전체가 깨지지 않도록 마지막 안전망을 둔다.
    console.error(
      "[analysis-report] 예상치 못한 오류, 규칙 기반 fallback 반환:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json({ report: buildFallbackReport(analysis, pests) });
  }
}
