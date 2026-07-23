import { cropResearchStandards } from "@/data/cropResearchStandards";
import {
  analyzeCropRisks,
  type CropRiskResult,
  type ForecastDay,
} from "@/lib/cropRiskAnalyzer";
import {
  calculateCropScore,
  type EnvironmentData,
  type ScoreResult,
} from "@/lib/cropScoring";
import { mockFertilizer } from "@/mocks/fertilizer";
import { mockSoil } from "@/mocks/soil";
import { mockWeather } from "@/mocks/weather";
import type {
  CropId,
  DataLevel,
  FertilizerPrescription,
  LocationInput,
  SoilData,
  WeatherData,
} from "@/types/analysis";

/**
 * `cropScoring.ts`(적합도 점수)와 `cropRiskAnalyzer.ts`(단기 위험)를 하나의 결과로 묶어
 * 프론트가 바로 쓸 수 있는 최종 분석 결과를 만드는 통합 서비스.
 *
 * 기상/토양/비료 데이터는 이미 조회된 값을 입력으로 받는다. `getWeather`/`getSoil`/
 * `getFertilizer` 호출(외부 API 연동)은 이 모듈의 책임이 아니다.
 * 점수·위험 계산 로직 자체는 재구현하지 않고 두 모듈의 결과를 그대로 조합한다.
 */

export interface CropAnalysisInput {
  cropId: CropId;
  location: LocationInput;
  growthStage?: string;
  weather: WeatherData;
  soil: SoilData;
  fertilizer?: FertilizerPrescription | null;
}

export interface CropDataQuality {
  weatherIsMock: boolean;
  soilIsMock: boolean;
  soilDataLevel: DataLevel;
  fertilizerIsFallback: boolean | null;
}

export interface CropAnalysisResult {
  cropId: CropId;
  location: string;
  overallScore: number;
  confidenceScore: number;
  scoreDetails: ScoreResult["details"];
  excludedFields: ScoreResult["excludedFields"];
  risks: CropRiskResult["risks"];
  fertilizer: FertilizerPrescription | null;
  dataQuality: CropDataQuality;
  sources: string[];
  generatedAt: string;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

/** WeatherData/SoilData(공식 API 응답 정규화 타입)를 cropScoring의 EnvironmentData로 변환한다. */
function buildEnvironmentData(weather: WeatherData, soil: SoilData): EnvironmentData {
  const forecastAverages = weather.forecast
    .map((day) => day.averageTemperature)
    .filter(isNumber);
  const forecastMins = weather.forecast.map((day) => day.minTemperature).filter(isNumber);
  const forecastMaxs = weather.forecast.map((day) => day.maxTemperature).filter(isNumber);
  const forecastRainfall = weather.forecast.map((day) => day.rainfallMm).filter(isNumber);

  return {
    weather: {
      averageTemperature: weather.current?.averageTemperature ?? average(forecastAverages),
      minimumTemperature:
        weather.current?.minTemperature ??
        (forecastMins.length > 0 ? Math.min(...forecastMins) : null),
      maximumTemperature:
        weather.current?.maxTemperature ??
        (forecastMaxs.length > 0 ? Math.max(...forecastMaxs) : null),
      rainfall: sum(forecastRainfall),
    },
    soil: {
      ph: soil.ph,
      ec: soil.ecDsM,
      texture: soil.texture,
    },
  };
}

/** WeatherData.forecast(DailyWeather[])를 cropRiskAnalyzer의 ForecastDay[]로 변환한다. */
function buildForecastDays(weather: WeatherData): ForecastDay[] {
  return weather.forecast.map((day) => ({
    date: day.date,
    minTemperature: day.minTemperature,
    maxTemperature: day.maxTemperature,
    rainfallMm: day.rainfallMm,
    humidityPercent: day.humidityPercent,
    windSpeedMs: day.windSpeedMs,
  }));
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * 결측 필드 수(점수 계산에서 제외된 항목)와 데이터 출처 수준(mock 여부, 표본 데이터 여부)을
 * 이용해 confidenceScore(0~100)를 계산한다.
 * 실측값이 많고 실데이터(비-mock, parcel/district 수준)일수록 점수가 높다.
 */
function calculateConfidenceScore(
  cropScoreResult: ScoreResult,
  weather: WeatherData,
  soil: SoilData,
  fertilizer: FertilizerPrescription | null,
): number {
  const totalFields = cropScoreResult.details.length;
  const availableFields = totalFields - cropScoreResult.excludedFields.length;
  const baseConfidence = totalFields > 0 ? (availableFields / totalFields) * 100 : 0;

  const sourcePenalty =
    (weather.isMock ? 20 : 0) +
    (soil.isMock ? 20 : 0) +
    (soil.dataLevel === "sample" ? 10 : 0) +
    (fertilizer?.isFallback ? 10 : 0);

  return clampConfidence(baseConfidence - sourcePenalty);
}

function collectSources(
  cropId: CropId,
  weather: WeatherData,
  soil: SoilData,
  fertilizer: FertilizerPrescription | null,
): string[] {
  const standard = cropResearchStandards[cropId];
  const sources = [...standard.sources, weather.source, soil.source];
  if (fertilizer) sources.push(fertilizer.source);
  return Array.from(new Set(sources));
}

/**
 * 작물 기준(cropResearchStandards) + 실측 기상/토양 데이터를 적합도 점수(calculateCropScore)와
 * 단기 위험(analyzeCropRisks)에 각각 넘긴 뒤, 프론트가 바로 쓸 수 있는 형태로 합친다.
 */
export function analyzeCrop(input: CropAnalysisInput): CropAnalysisResult {
  const { cropId, location, growthStage, weather, soil } = input;
  const fertilizer = input.fertilizer ?? null;

  const cropScoreResult = calculateCropScore({
    environment: buildEnvironmentData(weather, soil),
    cropId,
    growthStage,
  });

  const cropRiskResult = analyzeCropRisks({
    cropId,
    growthStage,
    forecast: buildForecastDays(weather),
    soil: {
      drainage: soil.drainage,
      texture: soil.texture,
    },
  });

  const confidenceScore = calculateConfidenceScore(cropScoreResult, weather, soil, fertilizer);

  return {
    cropId,
    location: location.address,
    overallScore: cropScoreResult.overallScore,
    confidenceScore,
    scoreDetails: cropScoreResult.details,
    excludedFields: cropScoreResult.excludedFields,
    risks: cropRiskResult.risks,
    fertilizer,
    dataQuality: {
      weatherIsMock: weather.isMock,
      soilIsMock: soil.isMock,
      soilDataLevel: soil.dataLevel,
      fertilizerIsFallback: fertilizer?.isFallback ?? null,
    },
    sources: collectSources(cropId, weather, soil, fertilizer),
    generatedAt: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------------- */
/* mock 통합 self-check                                                    */
/* ---------------------------------------------------------------------- */

export interface CropAnalysisSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * mocks/{weather,soil,fertilizer}로 analyzeCrop 전체 흐름(기준 → 점수 → 위험 → 통합)을
 * 별도 테스트 러너 없이 점검한다. `runCropAnalysisSelfChecks()`를 호출해 확인한다.
 */
export function runCropAnalysisSelfChecks(): CropAnalysisSelfCheckResult[] {
  const results: CropAnalysisSelfCheckResult[] = [];

  const potatoResult = analyzeCrop({
    cropId: "potato",
    location: { address: "테스트 지역" },
    growthStage: "growth",
    weather: mockWeather,
    soil: mockSoil,
    fertilizer: mockFertilizer.potato ?? null,
  });

  results.push({
    label: "1. mock 데이터로 전체 흐름 실행 시 예외 없이 결과 반환",
    passed: typeof potatoResult.overallScore === "number" && potatoResult.scoreDetails.length === 5,
    message: `overallScore=${potatoResult.overallScore}, scoreDetails=${potatoResult.scoreDetails.length}개`,
  });

  results.push({
    label: "2. 감자는 EC 가중치 0 → excludedFields에 ec 포함",
    passed: potatoResult.excludedFields.includes("ec"),
    message: `excludedFields=${JSON.stringify(potatoResult.excludedFields)}`,
  });

  results.push({
    label: "3. mock 기상·토양·비료 사용 여부가 dataQuality에 표시됨",
    passed:
      potatoResult.dataQuality.weatherIsMock === true &&
      potatoResult.dataQuality.soilIsMock === true &&
      potatoResult.dataQuality.fertilizerIsFallback === true,
    message: `dataQuality=${JSON.stringify(potatoResult.dataQuality)}`,
  });

  results.push({
    label: "4. mock/표본 데이터라 confidenceScore가 100 미만으로 감점됨",
    passed: potatoResult.confidenceScore < 100,
    message: `confidenceScore=${potatoResult.confidenceScore}`,
  });

  results.push({
    label: "5. 강우 예보(3일차 55mm)가 위험 목록에 반영됨",
    passed: potatoResult.risks.some((risk) => risk.type === "heavyRain"),
    message: `risks=${JSON.stringify(potatoResult.risks.map((r) => r.type))}`,
  });

  const appleResult = analyzeCrop({
    cropId: "apple",
    location: { address: "테스트 지역2" },
    weather: mockWeather,
    soil: mockSoil,
  });

  results.push({
    label: "6. 비료 정보 없는 작물(fertilizer 미전달) → null로 처리, 예외 없음",
    passed: appleResult.fertilizer === null && appleResult.dataQuality.fertilizerIsFallback === null,
    message: `fertilizer=${JSON.stringify(appleResult.fertilizer)}`,
  });

  results.push({
    label: "7. sources에 작물 공식 출처 + 기상/토양 출처가 중복 없이 포함됨",
    passed:
      appleResult.sources.length > 0 &&
      new Set(appleResult.sources).size === appleResult.sources.length,
    message: `sources=${JSON.stringify(appleResult.sources)}`,
  });

  return results;
}
