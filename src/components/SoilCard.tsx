import { DATA_LEVEL_LABELS } from "@/components/dataLevelLabels";
import type { SoilData, SoilDataStatus } from "@/types/analysis";

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

/** dataStatus가 없는(구버전) SoilData도 isMock만으로 안전하게 상태를 추론한다. */
function resolveStatus(soil: SoilData): SoilDataStatus {
  return soil.dataStatus ?? (soil.isMock ? "mock" : "ok");
}

const STATUS_BADGE: Record<SoilDataStatus, { label: string; className: string }> = {
  ok: { label: "지역 토양검정 데이터", className: "bg-status-good-bg text-status-good" },
  "no-data": { label: "최근 표본 없음", className: "bg-status-missing-bg text-status-missing" },
  mock: { label: "대체 데이터", className: "bg-status-caution-bg text-status-caution" },
};

const STATUS_NOTICE: Record<SoilDataStatus, string> = {
  ok: "pH와 EC는 지역 내 최근 토양검정 표본을 기반으로 하며, 토성·배수·유효토심은 정확한 필지 PNU가 없는 경우 제공되지 않습니다.",
  "no-data":
    "최근 3년 내 이 지역의 토양검정 표본이 확인되지 않았습니다. 실제 재배 전 필지 토양검정을 권장합니다.",
  mock: "실제 API를 사용할 수 없어(장애 또는 개발 모드) 대체 데이터를 보여주고 있습니다. 실제 재배 판단에 사용하지 마세요.",
};

/**
 * getSoil()의 원본 결과(SoilData)를 그대로 보여주는 카드.
 * 세 가지 상태(실제 데이터 / 정상 무데이터 / mock 대체)를 배지·문구로 명확히 구분한다
 * (cropScoring 등 점수 계산과는 무관 — 이 컴포넌트는 표시 전용).
 */
export default function SoilCard({ soil }: { soil: SoilData }) {
  const status = resolveStatus(soil);
  const badge = STATUS_BADGE[status];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-end">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
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

      <p className="mt-4 text-xs text-muted">{STATUS_NOTICE[status]}</p>
    </div>
  );
}
