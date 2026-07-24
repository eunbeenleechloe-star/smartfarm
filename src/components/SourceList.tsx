import { DATA_LEVEL_LABELS } from "@/components/dataLevelLabels";
import { cropStandardSources } from "@/data/cropStandardSources";
import type { CropDataQuality } from "@/services/cropAnalysis";
import type { CropId } from "@/types/analysis";

const SCORED_FIELD_LABELS: Record<string, string> = {
  temperature: "기온",
  ph: "pH",
  ec: "EC",
  texture: "토성",
  rainfall: "강수량",
};

function formatObservedAt(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return generatedAt;
  return date.toLocaleString("ko-KR");
}

export default function SourceList({
  cropId,
  sources,
  generatedAt,
  dataQuality,
}: {
  cropId: CropId;
  sources: string[];
  generatedAt: string;
  dataQuality: CropDataQuality;
}) {
  const standardSources = cropStandardSources[cropId];
  const usesMockData =
    dataQuality.weatherIsMock || dataQuality.soilIsMock || dataQuality.fertilizerIsFallback === true;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text">데이터 출처</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            usesMockData ? "bg-status-caution-bg text-status-caution" : "bg-status-good-bg text-status-good"
          }`}
        >
          {usesMockData ? "mock 데이터 포함" : "실측 데이터"}
        </span>
      </div>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text">
        {sources.map((source) => (
          <li key={source}>{source}</li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt>조회 시각</dt>
          <dd>{formatObservedAt(generatedAt)}</dd>
        </div>
        <div>
          <dt>토양 데이터 공간 단위</dt>
          <dd>{DATA_LEVEL_LABELS[dataQuality.soilDataLevel]}</dd>
        </div>
        <div>
          <dt>기상 데이터</dt>
          <dd>{dataQuality.weatherIsMock ? "mock" : "실측"}</dd>
        </div>
        <div>
          <dt>비료 처방</dt>
          <dd>
            {dataQuality.fertilizerIsFallback === null
              ? "정보 없음"
              : dataQuality.fertilizerIsFallback
                ? "대체(fallback) 값"
                : "실측/공식 값"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-text">작물 기준값 출처</h4>
        <ul className="mt-2 space-y-2 text-xs">
          {standardSources.map((entry) => (
            <li key={entry.field} className="flex items-start justify-between gap-3">
              <div>
                <span className="font-medium text-text">
                  {SCORED_FIELD_LABELS[entry.field] ?? entry.field}
                </span>
                <span className="ml-2 text-muted">
                  {entry.verified ? entry.sourceName : (entry.note ?? "출처 검증 중")}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  entry.verified
                    ? "bg-status-good-bg text-status-good"
                    : "bg-status-caution-bg text-status-caution"
                }`}
              >
                {entry.verified ? "출처 확인됨" : "출처 검증 중"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
