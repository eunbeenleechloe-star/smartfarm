import { DATA_LEVEL_LABELS } from "@/components/dataLevelLabels";
import type { SoilData } from "@/types/analysis";

function formatPh(value: number | null): string {
  return value === null ? "데이터 없음" : `${value}`;
}

function formatEc(value: number | null): string {
  return value === null ? "데이터 없음" : `${value} dS/m`;
}

function formatDepth(value: number | null): string {
  return value === null ? "데이터 없음" : `${value}cm`;
}

function formatText(value: string | null): string {
  return value === null ? "데이터 없음" : value;
}

function formatObservedAt(value: string | null): string {
  if (value === null) return "확인 불가";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ko-KR");
}

/**
 * getSoil()의 원본 결과(SoilData)를 그대로 보여주는 카드.
 * pH·EC는 지역 내 최근 토양검정 표본 평균이고, 토성·배수·유효토심은 필지 PNU 코드가 없으면
 * null(데이터 없음)로 남는다는 점을 항상 함께 표시한다(cropScoring 등 점수 계산과는 무관).
 */
export default function SoilCard({ soil }: { soil: SoilData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-end">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            soil.isMock
              ? "bg-status-caution-bg text-status-caution"
              : "bg-status-good-bg text-status-good"
          }`}
        >
          {soil.isMock ? "mock 데이터" : "실측 데이터"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">pH</dt>
          <dd className="font-medium text-text">{formatPh(soil.ph)}</dd>
        </div>
        <div>
          <dt className="text-muted">EC</dt>
          <dd className="font-medium text-text">{formatEc(soil.ecDsM)}</dd>
        </div>
        <div>
          <dt className="text-muted">토성</dt>
          <dd className="font-medium text-text">{formatText(soil.texture)}</dd>
        </div>
        <div>
          <dt className="text-muted">배수 상태</dt>
          <dd className="font-medium text-text">{formatText(soil.drainage)}</dd>
        </div>
        <div>
          <dt className="text-muted">유효토심</dt>
          <dd className="font-medium text-text">{formatDepth(soil.effectiveDepthCm)}</dd>
        </div>
        <div>
          <dt className="text-muted">데이터 수준</dt>
          <dd className="font-medium text-text">{DATA_LEVEL_LABELS[soil.dataLevel]}</dd>
        </div>
        <div>
          <dt className="text-muted">기준일</dt>
          <dd className="font-medium text-text">{formatObservedAt(soil.observedAt)}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-muted">출처</dt>
          <dd className="text-text">{soil.source}</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted">
        pH와 EC는 지역 내 최근 토양검정 표본을 기반으로 하며, 토성·배수·유효토심은 정확한 필지
        PNU가 없는 경우 제공되지 않습니다.
      </p>
    </div>
  );
}
