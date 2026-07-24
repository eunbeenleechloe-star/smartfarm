import StatusBadge, { severityLabel, severityToTone, type BadgeTone } from "@/components/StatusBadge";
import type { CropRiskItem } from "@/lib/cropRiskAnalyzer";

/**
 * 이 서비스의 핵심 차별점("현재값이 아니라 예보 추이를 위험 신호로 보여주는 것")을
 * 결과 화면 상단에서 바로 눈에 띄게 만드는 콜아웃.
 *
 * 새로운 위험을 계산하지 않는다 — cropRiskAnalyzer.ts(analyzeCropRisks)가 이미 만든
 * risks 중 가장 심각한 항목 하나를 그대로 보여줄 뿐이다(중복 계산 없음, 표시 전용).
 * risks[].evidence는 연속일수(예: "3일 연속 예상 최저기온이...")를 이미 문장으로
 * 포함하고 있으므로, 그 문구를 다시 파싱해 새 문구를 만들지 않고 그대로 노출한다.
 */
const TONE_BORDER: Record<BadgeTone, string> = {
  danger: "border-status-danger bg-status-danger-bg",
  caution: "border-status-caution bg-status-caution-bg",
  info: "border-status-info bg-status-info-bg",
  good: "border-status-good bg-status-good-bg",
  neutral: "border-border bg-card",
};

export default function ForecastRiskAlert({ risks }: { risks: CropRiskItem[] }) {
  if (risks.length === 0) return null;

  // 호출부(AnalyzeClient)가 이미 severity 기준으로 정렬한 배열을 넘긴다 — 여기서는 첫 번째만 쓴다.
  const topRisk = risks[0];
  const tone = severityToTone(topRisk.severity);
  const remaining = risks.length - 1;

  return (
    <section className={`rounded-2xl border p-6 ${TONE_BORDER[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text">예보 기반 주의</h2>
        <StatusBadge tone={tone} label={severityLabel(topRisk.severity)} />
      </div>

      <p className="mt-3 text-base font-semibold text-text">{topRisk.title}</p>
      <p className="mt-1 text-sm text-text">{topRisk.evidence}</p>

      <p className="mt-3 text-sm text-text">
        <span className="font-medium">지금 해야 할 행동: </span>
        {topRisk.action}
      </p>

      {remaining > 0 && (
        <p className="mt-3 text-xs text-muted">
          이 외 {remaining}건의 위험은 아래 &ldquo;주요 위험&rdquo;에서 확인할 수 있어요.
        </p>
      )}
    </section>
  );
}
