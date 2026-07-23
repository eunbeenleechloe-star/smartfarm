import { DATA_LEVEL_LABELS } from "@/components/dataLevelLabels";
import type { CropDataQuality } from "@/services/cropAnalysis";

export default function ConfidenceCard({
  confidenceScore,
  excludedFieldsCount,
  dataQuality,
}: {
  confidenceScore: number;
  excludedFieldsCount: number;
  dataQuality: CropDataQuality;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium text-muted">분석 신뢰도</h3>
      <div className="mt-1 text-3xl font-bold text-primary">{confidenceScore}%</div>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        <li>평가에서 제외된 항목: {excludedFieldsCount}개</li>
        <li>토양 데이터 기준: {DATA_LEVEL_LABELS[dataQuality.soilDataLevel]}</li>
        <li>기상 데이터: {dataQuality.weatherIsMock ? "mock 데이터 사용" : "실측 데이터"}</li>
        <li>토양 데이터: {dataQuality.soilIsMock ? "mock 데이터 사용" : "실측 데이터"}</li>
      </ul>
    </div>
  );
}
