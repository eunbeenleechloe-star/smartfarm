import {
  cropResearchStandards,
  type ColdRiskStandard,
  type CropResearchStandard,
  type HeatRiskStandard,
} from "@/data/cropResearchStandards";
import type { CropId, RiskSeverity } from "@/types/analysis";

/**
 * 단기예보 기반 위험 탐지 모듈.
 *
 * `src/lib/cropScoring.ts`(환경 적합도 점수)와는 별개로, "앞으로 며칠간 무엇을 조심해야
 * 하는가"를 판단한다. `analyze.ts`가 risks 필드의 원천으로 사용 중이다. 예전
 * `src/lib/risk.ts`(detectRisks)는 이 모듈로 대체되어 삭제되었다.
 *
 * 근거 데이터:
 * - 생육단계별 저온 위험, 작물별 고온 위험: `cropResearchStandards`의 coldRisks/heatRisks
 *   (공식 조사 자료). 이 모듈은 여기 없는 온도 기준을 임의로 만들지 않는다.
 * - 집중강우(30/50mm, 3일 누적 80mm) 기준: 공식 작물 기준이 아니라 이 프로토타입의
 *   서비스 설계값이다. 코드 내 상수 선언부에 명시했다.
 * - 배수 불량 + 강우 결합 과습 위험의 severity 상향(감자·배)도 팀 설계 규칙이며,
 *   공식 수치가 아니다.
 */

export interface ForecastDay {
  date: string;
  minTemperature: number | null;
  maxTemperature: number | null;
  rainfallMm: number | null;
  humidityPercent?: number | null;
  windSpeedMs?: number | null;
}

export interface CropRiskInput {
  cropId: CropId;
  growthStage?: string;
  forecast: ForecastDay[];
  soil?: {
    drainage?: string | null;
    texture?: string | null;
  };
}

export type CropRiskType =
  | "cold"
  | "heat"
  | "heavyRain"
  | "waterlogging"
  | "highHumidity";

export interface CropRiskItem {
  id: string;
  type: CropRiskType;
  title: string;
  severity: RiskSeverity;
  date?: string;
  evidence: string;
  threshold?: number | null;
  actualValue?: number | null;
  action: string;
  source?: string;
}

export interface CropRiskResult {
  risks: CropRiskItem[];
  highestSeverity: "none" | RiskSeverity;
}

/**
 * 집중강우 판정 기준. 작물 공식 생육 기준이 아니라 프로토타입 기상 위험 탐지를 위한
 * 서비스 설계값이다.
 */
const HEAVY_RAIN_WARNING_MM = 30;
const HEAVY_RAIN_DANGER_MM = 50;
const ROLLING_RAIN_DANGER_MM = 80;
const ROLLING_RAIN_WINDOW_DAYS = 3;

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  info: 0,
  warning: 1,
  danger: 2,
};

function maxSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** 생육단계 키(coldRisks[].stage)를 화면에 보여주기 좋은 한국어로 바꾼다. 새 수치는 아니다. */
export const STAGE_LABELS: Record<string, string> = {
  winterTree: "겨울철 지상부",
  winterRoot: "겨울철 지하부",
  flowering: "개화기",
  fullBloom: "만개기",
  flowerBud: "꽃봉오리기",
  pinkBud: "분홍 봉오리기",
  whiteBud: "백색 봉오리기",
  beforeBloom: "개화 직전",
  germination: "발아기",
  growth: "생육기",
};

export function getStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

const COLD_RISK_ACTIONS: Record<CropId, string> = {
  apple: "방상팬, 미세살수 또는 보온 준비 상태를 점검하세요.",
  pear: "방상팬, 미세살수 또는 보온 준비 상태를 점검하세요.",
  cucumber: "보온 상태를 점검하고 야간 저온 노출을 줄이세요.",
  lettuce: "발아기 저온에 노출되지 않도록 보온 상태를 점검하세요.",
  potato: "보온 상태를 점검하세요.",
};

const HEAT_RISK_ACTIONS: Record<CropId, string> = {
  apple: "직사광 노출 부위에 대한 차광 조치를 점검하세요.",
  pear: "차광과 통풍 상태를 점검하세요.",
  cucumber: "차광과 환기, 관수 상태를 점검하세요.",
  potato: "관수와 배수 상태를 점검하고 고온 스트레스에 주의하세요.",
  lettuce: "차광과 환기 상태를 점검하고 추대 위험에 주의하세요.",
};

const HEAVY_RAIN_ACTIONS: Record<CropId, string> = {
  potato: "배수로가 막히지 않았는지 확인하고 물 고임을 예방하세요.",
  apple: "배수로 상태를 확인하고 집중호우에 대비하세요.",
  pear: "배수로 상태를 확인하고 집중호우에 대비하세요.",
  cucumber: "배수 상태를 확인하고 집중호우에 대비하세요.",
  lettuce: "배수 상태를 확인하고 집중호우에 대비하세요.",
};

const WATERLOGGING_ACTIONS: Record<CropId, string> = {
  potato: "배수로 정비와 물 빠짐 상태를 우선 점검하세요.",
  pear: "배수로 정비와 물 빠짐 상태를 우선 점검하세요.",
  apple: "배수로 정비와 물 빠짐 상태를 점검하세요.",
  cucumber: "배수로 정비와 물 빠짐 상태를 점검하세요.",
  lettuce: "배수로 정비와 물 빠짐 상태를 점검하세요.",
};

/**
 * growthStage와 정확히 일치하는 coldRisks 항목만 사용한다.
 * growthStage가 없거나 일치하는 stage가 없으면 null을 반환해 저온 평가를 건너뛴다.
 * 다른 생육단계 기준을 임의로 대신 적용하지 않는다.
 */
function findColdThreshold(
  standard: CropResearchStandard,
  growthStage: string | undefined,
): ColdRiskStandard | null {
  if (!growthStage) return null;
  return standard.coldRisks.find((risk) => risk.stage === growthStage) ?? null;
}

/** 작물의 고온 위험 기준을 임계값 오름차순으로 반환한다. */
function findHeatThresholds(standard: CropResearchStandard): HeatRiskStandard[] {
  return [...standard.heatRisks].sort((a, b) => a.threshold - b.threshold);
}

/**
 * 하루 최고기온이 몇 단계의 고온 기준을 넘었는지로 severity를 정한다.
 * 가장 높은(마지막) 기준까지 넘으면 danger, 일부 낮은 기준만 넘으면 warning.
 * 기준이 하나뿐인 작물은 그 기준을 넘는 순간 danger가 된다.
 */
function evaluateHeatSeverityForDay(
  maxTemperature: number | null,
  thresholds: HeatRiskStandard[],
): { severity: RiskSeverity; matched: HeatRiskStandard } | null {
  if (maxTemperature === null || thresholds.length === 0) return null;
  const exceeded = thresholds.filter((t) => maxTemperature >= t.threshold);
  if (exceeded.length === 0) return null;
  const highestExceeded = exceeded[exceeded.length - 1];
  const severity: RiskSeverity =
    exceeded.length === thresholds.length ? "danger" : "warning";
  return { severity, matched: highestExceeded };
}

/**
 * 각 날짜에 대해 windowDays(기본 3일) 트레일링 누적 강수량을 계산한다.
 * 창(window) 안에 값이 하나도 없으면 null, 일부만 결측이면 결측일을 0mm로 간주해 합산한다
 * (실제보다 누적 위험이 과소평가될 수 있음 — 한계로 보고).
 */
function calculateRollingRainfall(
  forecast: ForecastDay[],
  windowDays: number,
): Array<number | null> {
  return forecast.map((_, index) => {
    const start = Math.max(0, index - windowDays + 1);
    const window = forecast.slice(start, index + 1);
    const hasAnyValue = window.some((day) => day.rainfallMm !== null);
    if (!hasAnyValue) return null;
    return window.reduce((sum, day) => sum + (day.rainfallMm ?? 0), 0);
  });
}

function computeRainSeverity(
  dailyRainfallMm: number | null,
  rolling3DayMm: number | null,
): RiskSeverity | null {
  if (dailyRainfallMm === null) return null;
  if (dailyRainfallMm >= HEAVY_RAIN_DANGER_MM) return "danger";
  if (rolling3DayMm !== null && rolling3DayMm >= ROLLING_RAIN_DANGER_MM) return "danger";
  if (dailyRainfallMm >= HEAVY_RAIN_WARNING_MM) return "warning";
  return null;
}

/** "불량", "매우 불량" 등 '불량'을 포함하는 표현을 넓게 배수 불량으로 인식한다. */
function isPoorDrainage(drainage: string | null | undefined): boolean {
  return typeof drainage === "string" && drainage.includes("불량");
}

/**
 * 감자·배는 조사 자료에서 배수 민감성(과습 시 생리장해)이 강조되어 같은 조건에서
 * severity를 한 단계 높인다. 공식 수치가 아니라 팀이 정한 설계 규칙이다.
 */
function shouldBoostDrainageSeverity(cropId: CropId): boolean {
  return cropId === "potato" || cropId === "pear";
}

function boostSeverity(severity: RiskSeverity): RiskSeverity {
  return severity === "warning" ? "danger" : severity;
}

interface RunIndexed {
  index: number;
}

/**
 * 연속된 날짜(index가 1씩 증가) 구간을 하나로 묶어 요약 위험 항목 하나를 만든다.
 * 단일 날짜 위험이 지나치게 많이 나오는 것을 막기 위한 공통 병합 로직.
 */
function mergeConsecutiveRisks<T extends RunIndexed>(
  flags: T[],
  build: (run: T[]) => CropRiskItem,
): CropRiskItem[] {
  if (flags.length === 0) return [];

  const sorted = [...flags].sort((a, b) => a.index - b.index);
  const runs: T[][] = [];
  let current: T[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = current[current.length - 1];
    if (sorted[i].index === prev.index + 1) {
      current.push(sorted[i]);
    } else {
      runs.push(current);
      current = [sorted[i]];
    }
  }
  runs.push(current);

  return runs.map(build);
}

function pickWorstBySeverity<T extends { severity: RiskSeverity }>(run: T[]): T {
  return run.reduce((worst, item) =>
    SEVERITY_RANK[item.severity] > SEVERITY_RANK[worst.severity] ? item : worst,
  );
}

interface ColdDayFlag extends RunIndexed {
  date: string;
  actualValue: number;
}

function buildColdRisks(input: CropRiskInput, standard: CropResearchStandard): CropRiskItem[] {
  const coldStandard = findColdThreshold(standard, input.growthStage);
  if (coldStandard === null) return [];

  const flags: ColdDayFlag[] = [];
  input.forecast.forEach((day, index) => {
    if (day.minTemperature !== null && day.minTemperature <= coldStandard.threshold) {
      flags.push({ date: day.date, index, actualValue: day.minTemperature });
    }
  });

  return mergeConsecutiveRisks(flags, (run) => {
    const consecutive = run.length >= 2;
    const worst = run.reduce((coldest, day) =>
      day.actualValue < coldest.actualValue ? day : coldest,
    );
    const severity: RiskSeverity = consecutive ? "danger" : "warning";
    const stageLabel = getStageLabel(coldStandard.stage);

    return {
      id: `cold-${run[0].date}`,
      type: "cold",
      title: `${stageLabel} 저온 위험`,
      severity,
      date: run[0].date,
      evidence: consecutive
        ? `${run.length}일 연속 예상 최저기온이 ${stageLabel} 저온 위험 기준 ${coldStandard.threshold}℃ 이하입니다(최저 ${worst.actualValue}℃, ${worst.date}). ${coldStandard.description}`
        : `예상 최저기온 ${worst.actualValue}℃가 ${stageLabel} 저온 위험 기준 ${coldStandard.threshold}℃ 이하입니다. ${coldStandard.description}`,
      threshold: coldStandard.threshold,
      actualValue: worst.actualValue,
      action: COLD_RISK_ACTIONS[input.cropId],
      source: standard.sources.join(", "),
    };
  });
}

interface HeatDayFlag extends RunIndexed {
  date: string;
  actualValue: number;
  severity: RiskSeverity;
  matched: HeatRiskStandard;
}

function buildHeatRisks(input: CropRiskInput, standard: CropResearchStandard): CropRiskItem[] {
  const thresholds = findHeatThresholds(standard);
  if (thresholds.length === 0) return [];

  const flags: HeatDayFlag[] = [];
  input.forecast.forEach((day, index) => {
    const evaluated = evaluateHeatSeverityForDay(day.maxTemperature, thresholds);
    if (evaluated !== null && day.maxTemperature !== null) {
      flags.push({
        date: day.date,
        index,
        actualValue: day.maxTemperature,
        severity: evaluated.severity,
        matched: evaluated.matched,
      });
    }
  });

  return mergeConsecutiveRisks(flags, (run) => {
    const consecutive = run.length >= 2;
    const worst = pickWorstBySeverity(run);
    const severity: RiskSeverity = consecutive ? maxSeverity(worst.severity, "danger") : worst.severity;

    return {
      id: `heat-${run[0].date}`,
      type: "heat",
      title: "고온 위험",
      severity,
      date: run[0].date,
      evidence: consecutive
        ? `${run.length}일 연속 예상 최고기온이 위험 기준 ${worst.matched.threshold}℃ 이상입니다(최고 ${worst.actualValue}℃, ${worst.date}). ${worst.matched.description}`
        : `예상 최고기온 ${worst.actualValue}℃가 위험 기준 ${worst.matched.threshold}℃ 이상입니다. ${worst.matched.description}`,
      threshold: worst.matched.threshold,
      actualValue: worst.actualValue,
      action: HEAT_RISK_ACTIONS[input.cropId],
      source: standard.sources.join(", "),
    };
  });
}

interface RainDayFlag extends RunIndexed {
  date: string;
  actualValue: number;
  severity: RiskSeverity;
}

function buildHeavyRainRisks(input: CropRiskInput): CropRiskItem[] {
  const rolling = calculateRollingRainfall(input.forecast, ROLLING_RAIN_WINDOW_DAYS);

  const flags: RainDayFlag[] = [];
  input.forecast.forEach((day, index) => {
    const severity = computeRainSeverity(day.rainfallMm, rolling[index]);
    if (severity !== null && day.rainfallMm !== null) {
      flags.push({ date: day.date, index, actualValue: day.rainfallMm, severity });
    }
  });

  return mergeConsecutiveRisks(flags, (run) => {
    const consecutive = run.length >= 2;
    const worst = pickWorstBySeverity(run);

    return {
      id: `heavyRain-${run[0].date}`,
      type: "heavyRain",
      title: "집중강우 위험",
      severity: worst.severity,
      date: run[0].date,
      evidence: consecutive
        ? `${run.length}일 연속 강우가 예상됩니다(최대 일 강수량 ${worst.actualValue}mm, ${worst.date}). 프로토타입 서비스 설계 기준(일 ${HEAVY_RAIN_WARNING_MM}mm 이상 주의, ${HEAVY_RAIN_DANGER_MM}mm 이상 위험, ${ROLLING_RAIN_WINDOW_DAYS}일 누적 ${ROLLING_RAIN_DANGER_MM}mm 이상 위험)에 따른 판단입니다.`
        : `예상 강수량 ${worst.actualValue}mm(${worst.date}). 프로토타입 서비스 설계 기준(일 ${HEAVY_RAIN_WARNING_MM}mm 이상 주의, ${HEAVY_RAIN_DANGER_MM}mm 이상 위험, ${ROLLING_RAIN_WINDOW_DAYS}일 누적 ${ROLLING_RAIN_DANGER_MM}mm 이상 위험)에 따른 판단입니다.`,
      threshold: HEAVY_RAIN_WARNING_MM,
      actualValue: worst.actualValue,
      action: HEAVY_RAIN_ACTIONS[input.cropId],
      source: "프로토타입 서비스 설계값 (공식 작물 기준 아님)",
    };
  });
}

function buildWaterloggingRisks(input: CropRiskInput): CropRiskItem[] {
  if (!isPoorDrainage(input.soil?.drainage)) return [];

  const rolling = calculateRollingRainfall(input.forecast, ROLLING_RAIN_WINDOW_DAYS);
  const boost = shouldBoostDrainageSeverity(input.cropId);

  const flags: RainDayFlag[] = [];
  input.forecast.forEach((day, index) => {
    const rainSeverity = computeRainSeverity(day.rainfallMm, rolling[index]);
    if (rainSeverity !== null && day.rainfallMm !== null) {
      const severity = boost ? boostSeverity(rainSeverity) : rainSeverity;
      flags.push({ date: day.date, index, actualValue: day.rainfallMm, severity });
    }
  });

  return mergeConsecutiveRisks(flags, (run) => {
    const consecutive = run.length >= 2;
    const worst = pickWorstBySeverity(run);

    return {
      id: `waterlogging-${run[0].date}`,
      type: "waterlogging",
      title: "배수 불량 과습 위험",
      severity: worst.severity,
      date: run[0].date,
      evidence: `배수가 불량한 상태에서 ${consecutive ? `${run.length}일 연속 ` : ""}강우(최대 ${worst.actualValue}mm, ${worst.date})가 예상되어 과습 위험이 있습니다.${boost ? " 이 작물은 배수 민감성이 높아 위험 단계를 한 단계 높였습니다(팀 설계 규칙)." : ""}`,
      threshold: null,
      actualValue: worst.actualValue,
      action: WATERLOGGING_ACTIONS[input.cropId],
      source: "프로토타입 서비스 설계값 (공식 작물 기준 아님, 배수 민감 작물 severity 상향은 팀 설계 규칙)",
    };
  });
}

export function getHighestSeverity(risks: CropRiskItem[]): "none" | RiskSeverity {
  if (risks.length === 0) return "none";
  return risks.reduce<RiskSeverity>((worst, risk) => maxSeverity(worst, risk.severity), "info");
}

/**
 * 단기예보와 토양 배수 정보를 바탕으로 작물의 앞으로 며칠간 위험을 탐지한다.
 * 적합도 점수 계산과 독립적으로 동작하며, `analyze.ts`가 risks 필드의 원천으로 사용 중이다.
 */
export function analyzeCropRisks(input: CropRiskInput): CropRiskResult {
  const standard = cropResearchStandards[input.cropId];

  const risks: CropRiskItem[] = [
    ...buildColdRisks(input, standard),
    ...buildHeatRisks(input, standard),
    ...buildHeavyRainRisks(input),
    ...buildWaterloggingRisks(input),
  ];

  return {
    risks,
    highestSeverity: getHighestSeverity(risks),
  };
}

/**
 * 수동 검증용 케이스 모음과 자체 점검(self-check) 유틸리티.
 * 별도 테스트 러너 없이도 `runCropRiskSelfChecks()`를 호출해 핵심 규칙을 확인할 수 있다.
 */
export interface CropRiskSelfCheckCase {
  label: string;
  input: CropRiskInput;
}

export const cropRiskSelfCheckCases: CropRiskSelfCheckCase[] = [
  {
    label: "pear-fullBloom-cold",
    input: {
      cropId: "pear",
      growthStage: "fullBloom",
      forecast: [{ date: "2026-04-05", minTemperature: -2, maxTemperature: 10, rainfallMm: 0 }],
    },
  },
  {
    label: "pear-no-growthStage",
    input: {
      cropId: "pear",
      forecast: [{ date: "2026-04-05", minTemperature: -2, maxTemperature: 10, rainfallMm: 0 }],
    },
  },
  {
    label: "potato-heat-28",
    input: {
      cropId: "potato",
      forecast: [{ date: "2026-07-20", minTemperature: 20, maxTemperature: 28, rainfallMm: 0 }],
    },
  },
  {
    label: "potato-heat-31",
    input: {
      cropId: "potato",
      forecast: [{ date: "2026-07-20", minTemperature: 22, maxTemperature: 31, rainfallMm: 0 }],
    },
  },
  {
    label: "lettuce-heat-31",
    input: {
      cropId: "lettuce",
      forecast: [{ date: "2026-06-10", minTemperature: 20, maxTemperature: 31, rainfallMm: 0 }],
    },
  },
  {
    label: "cucumber-cold-9",
    input: {
      cropId: "cucumber",
      growthStage: "growth",
      forecast: [{ date: "2026-05-01", minTemperature: 9, maxTemperature: 20, rainfallMm: 0 }],
    },
  },
  {
    label: "heavy-rain-55mm",
    input: {
      cropId: "apple",
      forecast: [{ date: "2026-07-01", minTemperature: 20, maxTemperature: 28, rainfallMm: 55 }],
    },
  },
  {
    label: "waterlogging-cucumber-not-boosted",
    input: {
      cropId: "cucumber",
      forecast: [{ date: "2026-07-01", minTemperature: 20, maxTemperature: 28, rainfallMm: 40 }],
      soil: { drainage: "불량" },
    },
  },
  {
    label: "waterlogging-potato-boosted",
    input: {
      cropId: "potato",
      forecast: [{ date: "2026-07-01", minTemperature: 20, maxTemperature: 28, rainfallMm: 40 }],
      soil: { drainage: "매우 불량" },
    },
  },
  {
    label: "missing-values-no-crash",
    input: {
      cropId: "apple",
      growthStage: "fullBloom",
      forecast: [
        { date: "2026-04-01", minTemperature: null, maxTemperature: null, rainfallMm: null },
        { date: "2026-04-02", minTemperature: -1.5, maxTemperature: null, rainfallMm: 10 },
        { date: "2026-04-03", minTemperature: null, maxTemperature: 33, rainfallMm: null },
      ],
    },
  },
  {
    label: "potato-heat-2day-consecutive",
    input: {
      cropId: "potato",
      forecast: [
        { date: "2026-07-20", minTemperature: 20, maxTemperature: 28, rainfallMm: 0 },
        { date: "2026-07-21", minTemperature: 20, maxTemperature: 29, rainfallMm: 0 },
      ],
    },
  },
];

export interface CropRiskSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * cropRiskSelfCheckCases를 실행해 아래 규칙을 확인한다.
 * - growthStage 일치 시에만 저온 위험을 평가하고, 없으면 임의로 다른 stage를 쓰지 않는다.
 * - 고온 위험은 넘은 기준 단계 수에 따라 warning/danger가 갈린다.
 * - 집중강우 55mm는 곧바로 danger.
 * - 배수 불량 + 강우는 과습 위험을 만들고, 감자·배는 severity가 한 단계 높다.
 * - 결측값이 섞여 있어도 예외 없이 동작한다.
 * - 2일 연속 위험은 하나의 요약 항목으로 합쳐진다.
 */
export function runCropRiskSelfChecks(): CropRiskSelfCheckResult[] {
  const results: CropRiskSelfCheckResult[] = [];

  const run = (label: string): CropRiskResult => {
    const testCase = cropRiskSelfCheckCases.find((c) => c.label === label);
    if (!testCase) throw new Error(`self-check case not found: ${label}`);
    return analyzeCropRisks(testCase.input);
  };

  const pearCold = run("pear-fullBloom-cold");
  const pearColdItem = pearCold.risks.find((r) => r.type === "cold");
  results.push({
    label: "1. 배 fullBloom + -2℃ → 저온 위험",
    passed: pearColdItem !== undefined && pearColdItem.threshold === -1.7,
    message: `risks=${JSON.stringify(pearCold.risks.map((r) => r.type))}`,
  });

  const pearNoStage = run("pear-no-growthStage");
  results.push({
    label: "2. 배 growthStage 없음 → 만개기 기준 임의 적용 안 함",
    passed: pearNoStage.risks.every((r) => r.type !== "cold"),
    message: `risks=${JSON.stringify(pearNoStage.risks.map((r) => r.type))}`,
  });

  const potatoHeat28 = run("potato-heat-28");
  const potatoHeat28Item = potatoHeat28.risks.find((r) => r.type === "heat");
  results.push({
    label: "3. 감자 최고 28℃ → 고온 위험",
    passed: potatoHeat28Item !== undefined && potatoHeat28Item.severity === "warning",
    message: `severity=${potatoHeat28Item?.severity}`,
  });

  const potatoHeat31 = run("potato-heat-31");
  const potatoHeat31Item = potatoHeat31.risks.find((r) => r.type === "heat");
  results.push({
    label: "4. 감자 최고 30℃ 이상 → 더 높은 위험",
    passed:
      potatoHeat31Item !== undefined &&
      potatoHeat31Item.severity === "danger" &&
      SEVERITY_RANK[potatoHeat31Item.severity] > SEVERITY_RANK[potatoHeat28Item?.severity ?? "info"],
    message: `severity=${potatoHeat31Item?.severity}`,
  });

  const lettuceHeat = run("lettuce-heat-31");
  const lettuceHeatItem = lettuceHeat.risks.find((r) => r.type === "heat");
  results.push({
    label: "5. 상추 30℃ 이상 → 고온·추대 위험",
    passed: lettuceHeatItem !== undefined,
    message: `risks=${JSON.stringify(lettuceHeat.risks.map((r) => r.type))}`,
  });

  const cucumberCold = run("cucumber-cold-9");
  const cucumberColdItem = cucumberCold.risks.find((r) => r.type === "cold");
  results.push({
    label: "6. 오이 최저 9℃ → 저온 위험",
    passed: cucumberColdItem !== undefined,
    message: `risks=${JSON.stringify(cucumberCold.risks.map((r) => r.type))}`,
  });

  const heavyRain = run("heavy-rain-55mm");
  const heavyRainItem = heavyRain.risks.find((r) => r.type === "heavyRain");
  results.push({
    label: "7. 하루 55mm → 집중강우 danger",
    passed: heavyRainItem !== undefined && heavyRainItem.severity === "danger",
    message: `severity=${heavyRainItem?.severity}`,
  });

  const waterloggingNotBoosted = run("waterlogging-cucumber-not-boosted");
  const waterloggingBoosted = run("waterlogging-potato-boosted");
  const notBoostedItem = waterloggingNotBoosted.risks.find((r) => r.type === "waterlogging");
  const boostedItem = waterloggingBoosted.risks.find((r) => r.type === "waterlogging");
  results.push({
    label: "8. 배수 불량 + 집중강우 → 과습 위험 (감자·배 severity 상향)",
    passed:
      notBoostedItem !== undefined &&
      boostedItem !== undefined &&
      notBoostedItem.severity === "warning" &&
      boostedItem.severity === "danger",
    message: `not-boosted=${notBoostedItem?.severity}, boosted=${boostedItem?.severity}`,
  });

  let missingValuesPassed = true;
  let missingValuesMessage = "ok";
  try {
    const result = run("missing-values-no-crash");
    missingValuesMessage = `risks=${JSON.stringify(result.risks.map((r) => r.type))}, highestSeverity=${result.highestSeverity}`;
  } catch (error) {
    missingValuesPassed = false;
    missingValuesMessage = error instanceof Error ? error.message : String(error);
  }
  results.push({
    label: "9. 결측 기온·강수량이 있어도 함수가 깨지지 않음",
    passed: missingValuesPassed,
    message: missingValuesMessage,
  });

  const consecutiveHeat = run("potato-heat-2day-consecutive");
  const heatItems = consecutiveHeat.risks.filter((r) => r.type === "heat");
  results.push({
    label: "10. 2일 연속 위험은 하나의 요약 항목으로 반환",
    passed: heatItems.length === 1 && heatItems[0].severity === "danger",
    message: `heatItems=${heatItems.length}, severity=${heatItems[0]?.severity}, evidence=${heatItems[0]?.evidence}`,
  });

  return results;
}
