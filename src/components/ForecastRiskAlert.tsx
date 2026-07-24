import StatusBadge, { severityLabel, severityToTone, type BadgeTone } from "@/components/StatusBadge";
import type { CropRiskItem, CropRiskType } from "@/lib/cropRiskAnalyzer";
import type { RiskSeverity } from "@/types/analysis";

/**
 * 이 서비스의 핵심 차별점("현재값이 아니라 예보 추이를 위험 신호로 보여주는 것")을
 * 결과 화면 상단에서 바로 눈에 띄게 만드는 콜아웃.
 *
 * 새로운 위험을 계산하지 않는다 — cropRiskAnalyzer.ts(analyzeCropRisks)가 이미 만든
 * risks를 표시 목적으로만 "위험 유형(type)별 한 장"으로 묶어 보여준다(중복 계산 없음).
 * 같은 유형이 연속되지 않은 날짜마다 개별 항목으로 오는 경우(예: 고온 위험이 7/25, 7/28에
 * 각각 있음) 카드가 중복처럼 보이는 문제를 표시 단계에서만 해결한다.
 */
const TONE_BORDER: Record<BadgeTone, string> = {
  danger: "border-status-danger bg-status-danger-bg",
  caution: "border-status-caution bg-status-caution-bg",
  info: "border-status-info bg-status-info-bg",
  good: "border-status-good bg-status-good-bg",
  neutral: "border-border bg-card",
};

const SEVERITY_RANK: Record<RiskSeverity, number> = { info: 0, warning: 1, danger: 2 };

function maxSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/** 위험 유형별로 헤드라인에 쓸 라벨·단위·"더 나쁜 방향"을 정의한다. 새 임계값을 만들지 않는다 — 표시 문구만 다룬다. */
interface HeadlineSpec {
  label: string;
  unit: string;
  worse: "higher" | "lower";
}

const HEADLINE_SPEC: Record<CropRiskType, HeadlineSpec> = {
  cold: { label: "예상 최저기온", unit: "℃", worse: "lower" },
  heat: { label: "예상 최고기온", unit: "℃", worse: "higher" },
  heavyRain: { label: "예상 강수량", unit: "mm", worse: "higher" },
  waterlogging: { label: "예상 강수량", unit: "mm", worse: "higher" },
  highHumidity: { label: "근거값", unit: "", worse: "higher" },
};

/** "2026-07-25" → "7/25". 형식이 다르면 원본 문자열을 그대로 둔다(추측 변환 금지). */
function formatShortDate(date: string | undefined): string {
  if (!date) return "";
  const match = date.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${Number(match[1])}/${Number(match[2])}`;
}

interface RiskGroup {
  type: CropRiskType;
  severity: RiskSeverity;
  items: CropRiskItem[];
}

function groupRisksByType(risks: CropRiskItem[]): RiskGroup[] {
  const byType = new Map<CropRiskType, CropRiskItem[]>();
  for (const risk of risks) {
    const list = byType.get(risk.type) ?? [];
    list.push(risk);
    byType.set(risk.type, list);
  }

  const groups: RiskGroup[] = Array.from(byType.entries()).map(([type, items]) => ({
    type,
    severity: items.reduce<RiskSeverity>((worst, item) => maxSeverity(worst, item.severity), "info"),
    items,
  }));

  groups.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  return groups;
}

/** 그룹 안에서 근거값이 가장 나쁜(위험한) 항목을 헤드라인 대표로 고른다. */
function pickWorstInGroup(items: CropRiskItem[]): CropRiskItem {
  const spec = HEADLINE_SPEC[items[0].type];
  return items.reduce((worst, item) => {
    if (item.actualValue === null || item.actualValue === undefined) return worst;
    if (worst.actualValue === null || worst.actualValue === undefined) return item;
    const itemIsWorse =
      spec.worse === "higher" ? item.actualValue > worst.actualValue : item.actualValue < worst.actualValue;
    return itemIsWorse ? item : worst;
  }, items[0]);
}

function RiskGroupCard({ group }: { group: RiskGroup }) {
  const tone = severityToTone(group.severity);
  // 같은 type + 같은 작물/생육단계면 title·action·source는 항상 동일하므로 대표 1건만 쓴다(중복 제거).
  const representative = group.items[0];
  const isSingle = group.items.length === 1;

  return (
    <div className={`rounded-2xl border p-6 ${TONE_BORDER[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text">{representative.title}</h3>
        <StatusBadge tone={tone} label={severityLabel(group.severity)} />
      </div>

      {isSingle ? (
        <p className="mt-2 text-sm text-text">{representative.evidence}</p>
      ) : (
        (() => {
          const worst = pickWorstInGroup(group.items);
          const spec = HEADLINE_SPEC[group.type];
          const exceededDates = group.items.map((item) => formatShortDate(item.date)).filter(Boolean);

          return (
            <>
              <p className="mt-2 text-sm font-medium text-text">
                {worst.actualValue !== null && worst.actualValue !== undefined
                  ? `${spec.label} ${worst.actualValue}${spec.unit} (${formatShortDate(worst.date)})`
                  : worst.evidence}
              </p>
              {exceededDates.length >= 2 && (
                <p className="mt-1 text-xs text-muted">기준 초과일: {exceededDates.join(", ")}</p>
              )}
            </>
          );
        })()
      )}

      <p className="mt-3 text-sm text-text">
        <span className="font-medium">지금 해야 할 행동: </span>
        {representative.action}
      </p>

      {representative.source && (
        <p className="mt-2 text-xs text-muted">근거 출처: {representative.source}</p>
      )}
    </div>
  );
}

export default function ForecastRiskAlert({ risks }: { risks: CropRiskItem[] }) {
  if (risks.length === 0) return null;

  const groups = groupRisksByType(risks);

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-text">예보 기반 주의</h2>
      <div className="space-y-4">
        {groups.map((group) => (
          <RiskGroupCard key={group.type} group={group} />
        ))}
      </div>
    </section>
  );
}
