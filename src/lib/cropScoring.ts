import { cropStandards } from "@/data/cropStandards";
import {
  cropResearchStandards,
  type CropResearchStandard,
  type NumberRange,
} from "@/data/cropResearchStandards";
import type { CropId } from "@/types/analysis";

/**
 * 환경 적합도 점수 계산 모듈.
 *
 * 데이터 출처:
 * - 기온·pH·EC 상한·선호 토성: `cropResearchStandards` (생육단계별 상세 조사 자료)
 * - 강수량: `cropStandards` (기존 flat 기준, 연간/생육기 중 팀이 이미 선택해 둔 단일 값)
 *
 * `analyze.ts`가 overallScore/weatherScore/soilScore/scoreDetails의 원천으로 사용 중이다.
 * 예전 `src/lib/scoring.ts`의 calculateScoreDetails와 `src/lib/risk.ts`(detectRisks)는
 * 이 모듈로 대체되어 삭제되었다. `weightedAverage`만 scoring.ts에 남아 공용으로 쓰인다.
 */

export interface EnvironmentData {
  weather: {
    averageTemperature?: number | null;
    minimumTemperature?: number | null;
    maximumTemperature?: number | null;
    rainfall?: number | null;
  };
  soil: {
    ph?: number | null;
    ec?: number | null;
    texture?: string | null;
  };
}

export interface ScoreDetail {
  field: string;
  score: number | null;
  actual: number | string | null;
  target: string | string[] | null;
  reason: string;
}

export interface ScoreResult {
  overallScore: number;
  /** 작물에 설정된 원래 가중치 합계 (cropScoringWeights[cropId] 기준). */
  configuredWeight: number;
  /** 결측/제외 후 실제로 종합점수 계산에 사용된 가중치 합계. */
  availableWeight: number;
  /** 결측값, 기준 부재, 또는 가중치 0으로 평가에서 제외된 필드 목록. */
  excludedFields: FieldName[];
  scores: {
    temperature?: number;
    ph?: number;
    ec?: number;
    texture?: number;
    rainfall?: number;
  };
  details: ScoreDetail[];
}

type RangeFieldName = "temperature" | "ph" | "rainfall" | "ec";
type FieldName = RangeFieldName | "texture";

export interface CropScoringWeights {
  temperature: number;
  ph: number;
  texture: number;
  rainfall: number;
  ec: number;
}

/**
 * 작물별 민감도 가중치.
 * 모든 작물이 같은 가중치를 쓰던 이전 방식(고정 WEIGHTS)을 대체한다.
 * EC 가중치가 0인 작물(배, 감자)은 EC 기준값 존재 여부와 무관하게 항상 평가에서 제외된다.
 */
export const cropScoringWeights: Record<CropId, CropScoringWeights> = {
  apple: { temperature: 35, ph: 15, texture: 25, rainfall: 15, ec: 10 },
  pear: { temperature: 40, ph: 15, texture: 30, rainfall: 15, ec: 0 },
  potato: { temperature: 30, ph: 15, texture: 30, rainfall: 25, ec: 0 },
  cucumber: { temperature: 30, ph: 10, texture: 20, rainfall: 30, ec: 10 },
  lettuce: { temperature: 35, ph: 20, texture: 10, rainfall: 15, ec: 20 },
};

function sumWeights(weights: CropScoringWeights): number {
  return weights.temperature + weights.ph + weights.texture + weights.rainfall + weights.ec;
}

interface NumberSpan {
  min: number | null;
  max: number | null;
}

interface FieldResult {
  field: FieldName;
  weight: number;
  detail: ScoreDetail;
}

/**
 * 실측값과 적정 범위를 비교해 0~100점을 연속적으로 계산하는 공통 함수.
 *
 * - 적정 범위 안: 100점
 * - 범위를 벗어나면 벗어난 거리(range 폭 대비 비율)에 비례해 부드럽게 감점한다.
 *   계단식 구간 분기 대신 연속 함수(조화 감쇠)를 사용해 경계값 근처에서 점수가 급격히
 *   튀지 않도록 한다.
 * - 실측값 또는 적정 범위 중 하나라도 없으면 평가하지 않고 null을 반환한다(0점 아님).
 */
export function calculateRangeScore(
  actual: number | null,
  optimalMin: number | null,
  optimalMax: number | null,
): number | null {
  if (actual === null || optimalMin === null || optimalMax === null) {
    return null;
  }

  if (actual >= optimalMin && actual <= optimalMax) {
    return 100;
  }

  const width = Math.max(optimalMax - optimalMin, MIN_RANGE_SPAN);
  const distance = actual < optimalMin ? optimalMin - actual : actual - optimalMax;
  const ratio = distance / width;
  const score = 100 / (1 + RANGE_DECAY_FACTOR * ratio);

  return clampScore(score);
}

/** 범위 폭이 0에 가까울 때 0으로 나누는 것을 막기 위한 최소 폭. 작물 기준값이 아니다. */
const MIN_RANGE_SPAN = 0.01;

/** 범위를 벗어난 거리 1배(range 폭 기준)당 감쇠되는 정도를 조절하는 계수. 추후 보정 필요. */
const RANGE_DECAY_FACTOR = 1;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function splitRange(range: NumberRange | null): NumberSpan {
  if (range === null) {
    return { min: null, max: null };
  }
  return { min: range[0], max: range[1] };
}

/**
 * 기온 목표 범위 선택 우선순위: 생육기 평균 → 주간 → 야간.
 * 상추·오이처럼 optimalAverage가 조사되지 않은 작물은 주간 적온을 우선 사용한다
 * (cropResearchStandards의 오이 notes에 명시된 것과 동일한 원칙).
 */
function resolveTemperatureRange(standard: CropResearchStandard): NumberRange | null {
  const { optimalAverage, optimalDay, optimalNight } = standard.temperature;
  return optimalAverage ?? optimalDay ?? optimalNight ?? null;
}

/**
 * EC는 조사 자료에 "이 값 이하면 양호"인 상한값 하나만 존재한다(예: 2.0dS/m).
 * 하한을 0으로 두고 상한만 상한으로 삼아 calculateRangeScore에 그대로 넘긴다.
 * 상한 자체가 null인 작물(배, 감자)은 범위 전체를 null로 두어 자동 제외한다.
 */
function resolveEcRange(ecCeiling: number | null): NumberSpan {
  if (ecCeiling === null) {
    return { min: null, max: null };
  }
  return { min: 0, max: ecCeiling };
}

function formatRangeTarget(range: NumberSpan): string | null {
  if (range.min === null || range.max === null) {
    return null;
  }
  return `${range.min}~${range.max}`;
}

function rangeReason(
  actual: number | null,
  range: NumberSpan,
  score: number | null,
): string {
  if (score === null) {
    if (actual === null && (range.min === null || range.max === null)) {
      return "실측값과 작물 기준이 모두 없어 평가에서 제외했습니다.";
    }
    if (actual === null) {
      return "실측값이 없어 평가에서 제외했습니다.";
    }
    return "이 작물의 기준값이 확인되지 않아 평가에서 제외했습니다.";
  }
  if (score === 100) {
    return "적정 범위 안에 있습니다.";
  }
  return "적정 범위에서 벗어난 정도에 따라 점수가 감소했습니다.";
}

function makeRangeResult(
  field: RangeFieldName,
  weight: number,
  actual: number | null,
  range: NumberSpan,
): FieldResult {
  if (weight <= 0) {
    return {
      field,
      weight,
      detail: {
        field,
        score: null,
        actual,
        target: formatRangeTarget(range),
        reason: "이 작물에서는 민감도가 낮아(가중치 0) 이 항목을 평가에서 제외합니다.",
      },
    };
  }

  const score = calculateRangeScore(actual, range.min, range.max);
  return {
    field,
    weight,
    detail: {
      field,
      score,
      actual,
      target: formatRangeTarget(range),
      reason: rangeReason(actual, range, score),
    },
  };
}

/** 토성은 문자열 일치 여부만 본다: 선호 토성 목록에 있으면 100점, 없으면 0점. */
function calculateTextureScore(
  actual: string | null,
  preferredTextures: string[],
): number | null {
  if (actual === null || preferredTextures.length === 0) {
    return null;
  }
  return preferredTextures.includes(actual) ? 100 : 0;
}

function textureReason(
  actual: string | null,
  preferredTextures: string[],
  score: number | null,
): string {
  if (score === null) {
    if (actual === null && preferredTextures.length === 0) {
      return "실측 토성과 작물의 선호 토성 정보가 모두 없어 평가에서 제외했습니다.";
    }
    if (actual === null) {
      return "실측 토성 정보가 없어 평가에서 제외했습니다.";
    }
    return "이 작물의 선호 토성 정보가 확인되지 않아 평가에서 제외했습니다.";
  }
  return score === 100
    ? "실측 토성이 선호 토성과 일치합니다."
    : "실측 토성이 선호 토성과 일치하지 않습니다.";
}

function makeTextureResult(
  weight: number,
  actual: string | null,
  preferredTextures: string[],
): FieldResult {
  if (weight <= 0) {
    return {
      field: "texture",
      weight,
      detail: {
        field: "texture",
        score: null,
        actual,
        target: preferredTextures.length > 0 ? preferredTextures : null,
        reason: "이 작물에서는 민감도가 낮아(가중치 0) 이 항목을 평가에서 제외합니다.",
      },
    };
  }

  const score = calculateTextureScore(actual, preferredTextures);
  return {
    field: "texture",
    weight,
    detail: {
      field: "texture",
      score,
      actual,
      target: preferredTextures.length > 0 ? preferredTextures : null,
      reason: textureReason(actual, preferredTextures, score),
    },
  };
}

/**
 * 지역·작물의 환경 적합도 점수를 계산한다.
 *
 * 결측값(실측 없음) 또는 미확인 작물 기준(null)은 0점이 아니라 평가에서 제외되며,
 * 제외된 항목의 가중치는 availableWeight와 overallScore 계산에서 함께 빠진다.
 *
 * growthStage는 현재 계산에 사용하지 않는다. 생육단계별 세분화된 기준(예: 사과·배의
 * 개화기 저온 위험)은 `cropRiskAnalyzer.ts` 영역이며, 이 함수의 향후 확장 대상이다.
 *
 * @example
 * ```ts
 * const result = calculateCropScore(mockPearScoreInput);
 * ```
 */
export function calculateCropScore(input: {
  environment: EnvironmentData;
  cropId: CropId;
  growthStage?: string;
}): ScoreResult {
  const { environment, cropId } = input;
  const legacyStandard = cropStandards[cropId];
  const researchStandard = cropResearchStandards[cropId];
  const weights = cropScoringWeights[cropId];

  const fieldResults: FieldResult[] = [
    makeRangeResult(
      "temperature",
      weights.temperature,
      environment.weather.averageTemperature ?? null,
      splitRange(resolveTemperatureRange(researchStandard)),
    ),
    makeRangeResult(
      "ph",
      weights.ph,
      environment.soil.ph ?? null,
      splitRange(researchStandard.soil.ph),
    ),
    makeTextureResult(
      weights.texture,
      environment.soil.texture ?? null,
      researchStandard.soil.preferredTextures,
    ),
    // 강수량만 cropResearchStandards가 아니라 cropStandards(기존 flat 구조)에서 읽는다.
    // cropResearchStandards.rainfall은 annual/growingSeason/monthly로 적용 기간이 나뉘어
    // 있는데, EnvironmentData.weather.rainfall은 어떤 기간의 합산값인지 정의돼 있지 않아
    // 세 값 중 무엇과 비교해야 할지 지금은 알 수 없다. cropStandards.rainfall은 팀이 이미
    // 작물별로 단일 기준(예: 배는 연간, 감자는 생육기)을 골라 둔 값이라 우선 이것을 쓴다.
    // TODO: EnvironmentData에 기간(period) 정보를 추가한 뒤 cropResearchStandards의
    // annual/growingSeason/monthly 중 맞는 값을 선택하도록 통일한다. 입력 스키마 변경이
    // 필요해 이번 작업 범위에서는 보류.
    makeRangeResult("rainfall", weights.rainfall, environment.weather.rainfall ?? null, {
      min: legacyStandard.rainfall.optimalMin,
      max: legacyStandard.rainfall.optimalMax,
    }),
    makeRangeResult(
      "ec",
      weights.ec,
      environment.soil.ec ?? null,
      resolveEcRange(researchStandard.soil.ec),
    ),
  ];

  const scores: ScoreResult["scores"] = {};
  const excludedFields: FieldName[] = [];
  let weightedSum = 0;
  let availableWeight = 0;

  for (const { field, weight, detail } of fieldResults) {
    if (detail.score === null) {
      excludedFields.push(field);
      continue;
    }
    scores[field] = detail.score;
    weightedSum += detail.score * weight;
    availableWeight += weight;
  }

  const overallScore = availableWeight > 0 ? clampScore(weightedSum / availableWeight) : 0;

  return {
    overallScore,
    configuredWeight: sumWeights(weights),
    availableWeight,
    excludedFields,
    scores,
    details: fieldResults.map((result) => result.detail),
  };
}

/**
 * 수동 테스트용 mock 예시.
 * `calculateCropScore(mockPearScoreInput)`로 호출하면
 * 완전 일치(토성), 부분 이탈(기온·강수량·pH), 기준 없음(EC) 케이스를 한 번에 확인할 수 있다.
 */
export const mockPearScoreInput: {
  environment: EnvironmentData;
  cropId: CropId;
  growthStage?: string;
} = {
  environment: {
    weather: {
      averageTemperature: 17,
      minimumTemperature: 8,
      maximumTemperature: 24,
      rainfall: 1100,
    },
    soil: {
      ph: 6.8,
      ec: null,
      texture: "사질양토",
    },
  },
  cropId: "pear",
  growthStage: "개화기",
};

/**
 * 작물별 자체 검증(self-check) 케이스.
 * 별도 테스트 러너 없이도 `runCropScoringSelfChecks()`를 호출해 핵심 규칙을 확인할 수 있다.
 * 5개 작물 각각 최소 1개 케이스를 포함한다.
 */
export interface CropScoringSelfCheckCase {
  label: string;
  cropId: CropId;
  environment: EnvironmentData;
}

export const cropScoringSelfCheckCases: CropScoringSelfCheckCase[] = [
  {
    label: "apple-basic",
    cropId: "apple",
    environment: {
      weather: { averageTemperature: 16, minimumTemperature: 5, maximumTemperature: 25, rainfall: 400 },
      soil: { ph: 6.5, ec: 1.2, texture: "양토" },
    },
  },
  {
    label: "apple-missing-temperature",
    cropId: "apple",
    environment: {
      weather: { averageTemperature: null, minimumTemperature: null, maximumTemperature: null, rainfall: 400 },
      soil: { ph: 5.8, ec: 2.3, texture: "양토" },
    },
  },
  {
    label: "pear-ec-excluded",
    cropId: "pear",
    environment: {
      weather: { averageTemperature: 19, minimumTemperature: 6, maximumTemperature: 26, rainfall: 1300 },
      soil: { ph: 6.0, ec: 1.5, texture: "사질양토" },
    },
  },
  {
    label: "potato-ec-excluded",
    cropId: "potato",
    environment: {
      weather: { averageTemperature: 18, minimumTemperature: 9, maximumTemperature: 24, rainfall: 350 },
      soil: { ph: 5.5, ec: 1.0, texture: "양토" },
    },
  },
  {
    label: "cucumber-basic",
    cropId: "cucumber",
    environment: {
      weather: { averageTemperature: 26, minimumTemperature: 16, maximumTemperature: 30, rainfall: 180 },
      soil: { ph: 6.0, ec: 1.8, texture: "식양토" },
    },
  },
  {
    label: "lettuce-ec-included",
    cropId: "lettuce",
    environment: {
      weather: { averageTemperature: 17, minimumTemperature: 8, maximumTemperature: 22, rainfall: 170 },
      soil: { ph: 6.7, ec: 1.2, texture: "사양토" },
    },
  },
];

export interface CropScoringSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * cropScoringSelfCheckCases와 추가 케이스를 실행해 아래 규칙을 확인한다.
 * - 배·감자는 EC 가중치가 0이라 EC 기준값과 무관하게 항상 제외된다.
 * - 상추는 EC 가중치가 0보다 크고 기준값도 있어 EC가 평가에 포함된다.
 * - 일부 필드가 결측이어도 종합점수가 0점이 되지 않는다(남은 가중치로 재정규화).
 * - 같은 환경값이라도 작물별 가중치가 다르면 종합점수가 달라진다.
 */
export function runCropScoringSelfChecks(): CropScoringSelfCheckResult[] {
  const results: CropScoringSelfCheckResult[] = [];

  const run = (label: string) => {
    const testCase = cropScoringSelfCheckCases.find((c) => c.label === label);
    if (!testCase) {
      throw new Error(`self-check case not found: ${label}`);
    }
    return calculateCropScore({
      environment: testCase.environment,
      cropId: testCase.cropId,
    });
  };

  const pear = run("pear-ec-excluded");
  results.push({
    label: "배 EC 제외 (가중치 0)",
    passed: pear.excludedFields.includes("ec") && pear.scores.ec === undefined,
    message: `excludedFields=${JSON.stringify(pear.excludedFields)}, scores=${JSON.stringify(pear.scores)}`,
  });

  const potato = run("potato-ec-excluded");
  results.push({
    label: "감자 EC 제외 (가중치 0)",
    passed: potato.excludedFields.includes("ec") && potato.scores.ec === undefined,
    message: `excludedFields=${JSON.stringify(potato.excludedFields)}, scores=${JSON.stringify(potato.scores)}`,
  });

  const lettuce = run("lettuce-ec-included");
  results.push({
    label: "상추 EC 포함 (가중치 20, 기준값 있음)",
    passed: !lettuce.excludedFields.includes("ec") && lettuce.scores.ec !== undefined,
    message: `excludedFields=${JSON.stringify(lettuce.excludedFields)}, scores.ec=${lettuce.scores.ec}`,
  });

  const missingTemp = run("apple-missing-temperature");
  results.push({
    label: "결측값이 종합점수를 0점으로 만들지 않음",
    passed: missingTemp.excludedFields.includes("temperature") && missingTemp.overallScore > 0,
    message: `overallScore=${missingTemp.overallScore}, excludedFields=${JSON.stringify(missingTemp.excludedFields)}`,
  });

  const sameEnv: EnvironmentData = {
    weather: { averageTemperature: 20, minimumTemperature: 12, maximumTemperature: 26, rainfall: 300 },
    soil: { ph: 6.2, ec: 1.5, texture: "양토" },
  };
  const appleResult = calculateCropScore({ environment: sameEnv, cropId: "apple" });
  const cucumberResult = calculateCropScore({ environment: sameEnv, cropId: "cucumber" });
  results.push({
    label: "동일 환경값 + 작물별 가중치 차이 → 종합점수 달라짐",
    passed: appleResult.overallScore !== cucumberResult.overallScore,
    message: `apple=${appleResult.overallScore}, cucumber=${cucumberResult.overallScore}`,
  });

  return results;
}
