import { DATA_LEVEL_LABELS } from "@/components/dataLevelLabels";
import type { DataLevel, SoilData, SoilDataStatus, SoilParcelStatus } from "@/types/analysis";

/**
 * 토양 카드는 일반 사용자 화면이므로 dataLevel="district"만 표현을 다르게 보여준다
 * (ConfidenceCard/SourceList 등 다른 화면은 공유 라벨(dataLevelLabels.ts)을 그대로 사용).
 */
const SOIL_CARD_DATA_LEVEL_LABELS: Record<DataLevel, string> = {
  ...DATA_LEVEL_LABELS,
  district: "선택한 지역 기준",
};

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
function resolveChemistryStatus(soil: SoilData): SoilDataStatus {
  return soil.dataStatus ?? (soil.isMock ? "mock" : "ok");
}

/** parcel이 없는(구버전) SoilData는 지번을 요청한 적이 없는 것으로 본다. */
function resolveParcelStatus(soil: SoilData): SoilParcelStatus {
  return soil.parcel?.status ?? "not-requested";
}

const CHEMISTRY_STATUS_BADGE: Record<SoilDataStatus, { label: string; className: string }> = {
  ok: { label: "최근 토양검정 자료", className: "bg-status-good-bg text-status-good" },
  "no-data": { label: "확인 가능한 토양 자료 없음", className: "bg-status-missing-bg text-status-missing" },
  mock: { label: "예시 데이터", className: "bg-status-caution-bg text-status-caution" },
};

const CHEMISTRY_STATUS_NOTICE: Record<SoilDataStatus, string> = {
  ok: "이 지역에서 최근에 검사된 토양 자료를 바탕으로 한 평균값이에요.\n실제 농지의 상태와는 차이가 있을 수 있어요.",
  "no-data":
    "이 지역은 최근 토양검정 자료가 확인되지 않았어요.\n재배를 시작하기 전에 가까운 농업기술센터에서 토양검정을 받아보는 것을 권장해요.",
  mock: "현재 토양 정보를 불러오지 못해 예시 데이터를 보여드리고 있어요.\n실제 재배 판단에는 사용하지 마세요.",
};

/**
 * invalid-pnu(사용자 입력 문제)와 error(조회 자체의 일시적 실패)는 원인이 다르므로
 * 배지·문구를 분리한다 — 사용자에게 "당신의 지번 입력이 틀렸다"고 잘못 단정하지 않기 위함이다.
 */
const PARCEL_STATUS_BADGE: Record<SoilParcelStatus, { label: string; className: string }> = {
  ok: { label: "입력한 농지 기준 토양특성", className: "bg-status-good-bg text-status-good" },
  "no-data": { label: "확인 가능한 자료 없음", className: "bg-status-missing-bg text-status-missing" },
  "not-requested": { label: "지번 미입력", className: "bg-status-missing-bg text-status-missing" },
  "invalid-pnu": { label: "지번 확인 필요", className: "bg-status-caution-bg text-status-caution" },
  error: { label: "일시적 조회 오류", className: "bg-status-caution-bg text-status-caution" },
};

const PARCEL_STATUS_NOTICE: Record<SoilParcelStatus, string> = {
  ok: "입력한 농지 기준 토양특성이에요.",
  "no-data": "이 농지에서 확인 가능한 토양특성 자료가 없어요.",
  "not-requested": "지번을 입력하면 필지별 토양특성을 추가로 확인할 수 있어요.",
  "invalid-pnu": "지번 정보를 다시 확인해주세요.",
  error: "농지별 토양정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
};

/**
 * getSoil()의 원본 결과(SoilData)를 그대로 보여주는 카드. 두 영역으로 나눈다:
 * A. 지역 토양검정 정보(pH·EC, 항상 조회) — chemistry 상태(dataStatus)로 배지·문구를 구분한다.
 * B. 농지별 토양특성(토성·배수·유효토심, 지번을 입력했을 때만) — parcel 상태로 구분한다.
 * 지번 미입력은 오류가 아니므로("not-requested") 다른 무데이터/오류 배지와 같은 중립색을 쓴다.
 * (cropScoring 등 점수 계산과는 무관 — 이 컴포넌트는 표시 전용).
 */
export default function SoilCard({ soil }: { soil: SoilData }) {
  const chemistryStatus = resolveChemistryStatus(soil);
  const chemistryBadge = CHEMISTRY_STATUS_BADGE[chemistryStatus];

  const parcelStatus = resolveParcelStatus(soil);
  const parcelBadge = PARCEL_STATUS_BADGE[parcelStatus];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* A. 지역 토양검정 정보 */}
      <div className="flex items-center justify-end">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chemistryBadge.className}`}>
          {chemistryBadge.label}
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
          <dt className="text-muted">자료 범위</dt>
          <dd className="font-medium text-text">{SOIL_CARD_DATA_LEVEL_LABELS[soil.dataLevel]}</dd>
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

      <p className="mt-4 whitespace-pre-line text-xs text-muted">{CHEMISTRY_STATUS_NOTICE[chemistryStatus]}</p>

      <div className="my-5 border-t border-border" />

      {/* B. 농지별 토양특성(정밀 분석) */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text">농지별 토양특성</h4>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${parcelBadge.className}`}>
          {parcelBadge.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
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
        {soil.parcel?.source && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-muted">출처</dt>
            <dd className="text-text">{soil.parcel.source}</dd>
          </div>
        )}
      </dl>

      <p className="mt-4 text-xs text-muted">{PARCEL_STATUS_NOTICE[parcelStatus]}</p>
    </div>
  );
}
