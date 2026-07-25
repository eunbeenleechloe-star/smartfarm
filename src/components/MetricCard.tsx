import type { ScoreDetail } from "@/lib/cropScoring";

const FIELD_LABELS: Record<string, string> = {
  temperature: "기온",
  ph: "토양 pH",
  ec: "EC",
  texture: "토성",
  rainfall: "강수량",
};

const FIELD_UNITS: Record<string, string> = {
  temperature: "℃",
  ph: "",
  ec: "dS/m",
  texture: "",
  rainfall: "mm",
};

/** 초보 농업인을 위한 용어 설명(DESIGN.md 2장). 계산 결과가 아니라 고정 안내 문구다. */
const FIELD_GLOSSARY: Record<string, string> = {
  temperature: "재배지의 기온입니다.",
  ph: "토양이 산성인지 알칼리성인지 나타내는 수치입니다.",
  ec: "토양에 녹아 있는 비료·염류의 정도입니다.",
  texture: "흙의 입자 구성과 물 빠짐 특성입니다.",
  rainfall: "재배지에 내리는 비의 양입니다.",
};

function formatValue(value: number | string | null, unit: string): string {
  if (value === null) return "데이터 없음";
  return unit ? `${value}${unit}` : String(value);
}

function formatTarget(target: string | string[] | null, unit: string): string {
  if (target === null) return "확인되지 않음";
  if (Array.isArray(target)) return target.join(" / ");
  return unit ? `${target}${unit}` : target;
}

const RAINFALL_FOOTNOTE =
  "※ 강수량은 연간·생육기 표준 대비 참고 지표이며, 단기예보 강수량과 적용 기간이 다를 수 있습니다.";

export default function MetricCard({ detail }: { detail: ScoreDetail }) {
  const label = FIELD_LABELS[detail.field] ?? detail.field;
  const unit = FIELD_UNITS[detail.field] ?? "";
  const excluded = detail.score === null;

  // 이 작물은 강수량 기준값이 없어 평가에서 제외된 경우다(cropScoring.ts가 결정).
  // 해당 작물에서는 강수량이 실제로 쓰이지 않으므로 카드 자체를 표시하지 않는다.
  if (detail.field === "rainfall" && excluded) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text">{label}</h4>
        {excluded ? (
          <span className="rounded-full bg-status-missing-bg px-2 py-0.5 text-xs font-medium text-status-missing">
            평가 제외
          </span>
        ) : (
          <span className="text-lg font-bold text-primary">{detail.score}점</span>
        )}
      </div>

      <p className="mt-1 text-xs text-muted">{FIELD_GLOSSARY[detail.field]}</p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted">실제값</dt>
          <dd className="text-text">{formatValue(detail.actual, unit)}</dd>
        </div>
        <div>
          <dt className="text-muted">적정범위</dt>
          <dd className="text-text">{formatTarget(detail.target, unit)}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-muted">{detail.reason}</p>

      {detail.field === "rainfall" && !excluded && (
        <p className="mt-2 text-xs text-muted">{RAINFALL_FOOTNOTE}</p>
      )}
    </div>
  );
}
