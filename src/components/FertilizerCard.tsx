import type { FertilizerPrescription } from "@/types/analysis";

function formatKg(value: number | null): string {
  return value === null ? "데이터 없음" : `${value}kg`;
}

export default function FertilizerCard({
  fertilizer,
}: {
  fertilizer: FertilizerPrescription | null;
}) {
  if (!fertilizer) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted">
        이 작물은 비료사용처방 정보가 아직 확인되지 않았습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text">토양 관리 참고</h3>
        {fertilizer.isFallback && (
          <span className="rounded-full bg-status-missing-bg px-2 py-0.5 text-xs font-medium text-status-missing">
            대체(fallback) 값
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">질소</dt>
          <dd className="font-medium text-text">{formatKg(fertilizer.nitrogenKg)}</dd>
        </div>
        <div>
          <dt className="text-muted">인산</dt>
          <dd className="font-medium text-text">{formatKg(fertilizer.phosphorusKg)}</dd>
        </div>
        <div>
          <dt className="text-muted">칼리</dt>
          <dd className="font-medium text-text">{formatKg(fertilizer.potassiumKg)}</dd>
        </div>
        <div>
          <dt className="text-muted">퇴비</dt>
          <dd className="font-medium text-text">{formatKg(fertilizer.compostKg)}</dd>
        </div>
        <div>
          <dt className="text-muted">석회</dt>
          <dd className="font-medium text-text">{formatKg(fertilizer.limeKg)}</dd>
        </div>
        <div>
          <dt className="text-muted">기준 면적</dt>
          <dd className="font-medium text-text">
            {fertilizer.기준면적M2 === null ? "데이터 없음" : `${fertilizer.기준면적M2}㎡`}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted">
        실제 살포량은 토양검정 결과와 재배면적에 따라 달라질 수 있습니다.
      </p>
      <p className="mt-1 text-xs text-muted">출처: {fertilizer.source}</p>
    </div>
  );
}
