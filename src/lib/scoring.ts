/**
 * 여러 항목의 점수를 가중 평균한다. 결측(score === null) 또는 가중치 0인 항목은
 * 분자·분모 모두에서 제외되어(0점 처리 아님), 남은 가중치로 재정규화된다.
 *
 * `src/lib/cropScoring.ts`(calculateCropScore)와 `src/services/analyze.ts`
 * (weatherScore/soilScore 계산)에서 공통으로 재사용한다.
 */
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
