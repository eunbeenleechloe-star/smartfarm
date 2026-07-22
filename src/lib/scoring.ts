import type {
  CropStandard,
  NumericRange,
  ScoreDetail,
  ScoreStatus,
  SoilData,
  WeatherData,
} from "@/types/analysis";

export function calculateRangeScore(
  value: number | null,
  range: NumericRange,
): number | null {
  if (
    value === null ||
    range.optimalMin === null ||
    range.optimalMax === null
  ) {
    return null;
  }

  const { optimalMin, optimalMax, acceptableMin, acceptableMax } = range;

  if (value >= optimalMin && value <= optimalMax) {
    return 100;
  }

  if (
    acceptableMin !== null &&
    value >= acceptableMin &&
    value < optimalMin
  ) {
    const width = optimalMin - acceptableMin;
    if (width <= 0) return 60;
    return clamp(60 + ((value - acceptableMin) / width) * 40);
  }

  if (
    acceptableMax !== null &&
    value > optimalMax &&
    value <= acceptableMax
  ) {
    const width = acceptableMax - optimalMax;
    if (width <= 0) return 60;
    return clamp(60 + ((acceptableMax - value) / width) * 40);
  }

  if (acceptableMin !== null && value < acceptableMin) {
    const scale = Math.max(optimalMin - acceptableMin, 0.01);
    const deviation = (acceptableMin - value) / scale;
    return clamp(60 * (1 - deviation));
  }

  if (acceptableMax !== null && value > acceptableMax) {
    const scale = Math.max(acceptableMax - optimalMax, 0.01);
    const deviation = (value - acceptableMax) / scale;
    return clamp(60 * (1 - deviation));
  }

  return 30;
}

export function weightedAverage(
  items: Array<{ score: number | null; weight: number }>,
): number | null {
  const valid = items.filter(
    (item): item is { score: number; weight: number } =>
      item.score !== null && item.weight > 0,
  );

  if (valid.length === 0) return null;

  const weightSum = valid.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum === 0) return null;

  const weightedSum = valid.reduce(
    (sum, item) => sum + item.score * item.weight,
    0,
  );

  return Math.round(weightedSum / weightSum);
}

export function calculateScoreDetails(params: {
  standard: CropStandard;
  weather: WeatherData;
  soil: SoilData;
}): ScoreDetail[] {
  const { standard, weather, soil } = params;
  const avgTemperature =
    weather.current?.averageTemperature ??
    average(
      weather.forecast
        .map((day) => day.averageTemperature)
        .filter((value): value is number => value !== null),
    );

  const rainfall = sum(
    weather.forecast
      .map((day) => day.rainfallMm)
      .filter((value): value is number => value !== null),
  );

  return [
    detail(
      "temperature",
      "기온",
      avgTemperature,
      standard.temperature,
    ),
    detail("soilPh", "토양 pH", soil.ph, standard.soilPh),
    detail("soilEc", "토양 EC", soil.ecDsM, standard.soilEc),
    detail("rainfall", "강수량", rainfall, standard.rainfall),
  ];
}

function detail(
  variable: string,
  label: string,
  value: number | null,
  range: NumericRange,
): ScoreDetail {
  const score = calculateRangeScore(value, range);
  return {
    variable,
    label,
    score,
    weight: range.weight,
    actualValue: value,
    optimalRange: formatRange(range),
    status: statusFromScore(score),
    reason:
      score === null
        ? "기준값 또는 실제 데이터가 없어 평가에서 제외했습니다."
        : score === 100
          ? "적정 범위에 들어옵니다."
          : "적정 범위에서 벗어난 정도에 따라 감점했습니다.",
  };
}

function statusFromScore(score: number | null): ScoreStatus {
  if (score === null) return "missing";
  if (score >= 85) return "optimal";
  if (score >= 60) return "caution";
  return "danger";
}

function formatRange(range: NumericRange): string {
  if (range.optimalMin === null || range.optimalMax === null) {
    return "공식 기준 미확인";
  }
  return `${range.optimalMin}~${range.optimalMax}${range.unit}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
