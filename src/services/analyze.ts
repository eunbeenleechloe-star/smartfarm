import { analyzeCrop, type CropAnalysisResult } from "@/services/cropAnalysis";
import { getFertilizer } from "@/services/fertilizer";
import { getSoil } from "@/services/soil";
import { getWeather } from "@/services/weather";
import type { AnalysisInput } from "@/types/analysis";

/**
 * 지역·작물 분석의 진입점.
 *
 * 기상/토양/비료 데이터를 조회한 뒤 `cropAnalysis.ts`(analyzeCrop)에 그대로 넘긴다.
 * 점수·위험 계산과 최종 결과 조합은 `cropAnalysis.ts`가 단일 기준으로 담당하며,
 * 이 함수는 데이터 조회와 위임만 한다(계산 로직 없음).
 *
 * 예전에는 이 파일이 cropScoring/cropRiskAnalyzer 결과를 레거시 AnalysisResult
 * 형태(weatherScore/soilScore/scoreDetails 변환 등)로 직접 조합했으나, 그 로직은
 * cropAnalysis.ts로 이전되어 여기서는 더 이상 재구현하지 않는다.
 */
export async function analyzeFarm(
  input: AnalysisInput,
): Promise<CropAnalysisResult> {
  const [weather, soil, fertilizer] = await Promise.all([
    getWeather(input.location),
    getSoil(input.location),
    getFertilizer(input.crop, input.location, input.areaM2),
  ]);

  return analyzeCrop({
    cropId: input.crop,
    location: input.location,
    growthStage: input.growthStage,
    weather,
    soil,
    fertilizer,
  });
}
