import { DATA_LEVEL_LABELS } from "@/components/dataLevelLabels";
import type { CropDataQuality } from "@/services/cropAnalysis";

function formatObservedAt(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return generatedAt;
  return date.toLocaleString("ko-KR");
}

export default function SourceList({
  sources,
  generatedAt,
  dataQuality,
}: {
  sources: string[];
  generatedAt: string;
  dataQuality: CropDataQuality;
}) {
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
    </div>
  );
}
