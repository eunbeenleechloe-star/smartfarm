import { cropStandards } from "@/data/cropStandards";
import { calculateScoreDetails, weightedAverage } from "@/lib/scoring";
import { detectRisks } from "@/lib/risk";
import { getFertilizer } from "@/services/fertilizer";
import { getSoil } from "@/services/soil";
import { getWeather } from "@/services/weather";
import type { AnalysisInput, AnalysisResult } from "@/types/analysis";

export async function analyzeFarm(
  input: AnalysisInput,
): Promise<AnalysisResult> {
  const [weather, soil, fertilizer] = await Promise.all([
    getWeather(input.location),
    getSoil(input.location),
    getFertilizer(input.crop, input.location, input.areaM2),
  ]);

  const standard = cropStandards[input.crop];
  const scoreDetails = calculateScoreDetails({
    standard,
    weather,
    soil,
  });

  const weatherVariables = new Set(["temperature", "rainfall"]);
  const soilVariables = new Set(["soilPh", "soilEc"]);

  const weatherScore = weightedAverage(
    scoreDetails
      .filter((item) => weatherVariables.has(item.variable))
      .map(({ score, weight }) => ({ score, weight })),
  );

  const soilScore = weightedAverage(
    scoreDetails
      .filter((item) => soilVariables.has(item.variable))
      .map(({ score, weight }) => ({ score, weight })),
  );

  const overallScore = weightedAverage(
    scoreDetails.map(({ score, weight }) => ({ score, weight })),
  );

  const availableCount = scoreDetails.filter(
    (item) => item.score !== null,
  ).length;

  const baseConfidence =
    (availableCount / Math.max(scoreDetails.length, 1)) * 100;
  const sourcePenalty =
    (weather.isMock ? 20 : 0) +
    (soil.isMock ? 20 : 0) +
    (soil.dataLevel === "sample" ? 10 : 0);

  const confidenceScore = Math.max(
    0,
    Math.round(baseConfidence - sourcePenalty),
  );

  const risks = detectRisks(standard, weather);

  return {
    location: input.location.address,
    crop: input.crop,
    overallScore,
    weatherScore,
    soilScore,
    confidenceScore,
    scoreDetails,
    risks,
    weather,
    soil,
    fertilizer,
    generatedGuide: null,
    sources: [
      ...standard.sources,
      weather.source,
      soil.source,
      ...(fertilizer ? [fertilizer.source] : []),
    ],
    generatedAt: new Date().toISOString(),
  };
}
