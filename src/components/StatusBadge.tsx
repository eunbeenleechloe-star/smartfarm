import type { RiskSeverity } from "@/types/analysis";

export type BadgeTone = "good" | "caution" | "danger" | "info" | "neutral";

const TONE_STYLES: Record<BadgeTone, string> = {
  good: "bg-status-good-bg text-status-good",
  caution: "bg-status-caution-bg text-status-caution",
  danger: "bg-status-danger-bg text-status-danger",
  info: "bg-status-info-bg text-status-info",
  neutral: "bg-status-missing-bg text-status-missing",
};

const TONE_ICON: Record<BadgeTone, string> = {
  good: "✓",
  caution: "▲",
  danger: "⚠",
  info: "ℹ",
  neutral: "–",
};

/** 이미 계산된 RiskSeverity를 배지 톤으로 매핑한다. 새로운 위험 판정을 만들지 않는다. */
export function severityToTone(severity: RiskSeverity): BadgeTone {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "caution";
  return "info";
}

export function severityLabel(severity: RiskSeverity): string {
  if (severity === "danger") return "위험";
  if (severity === "warning") return "주의";
  return "정보";
}

export default function StatusBadge({
  tone,
  label,
}: {
  tone: BadgeTone;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${TONE_STYLES[tone]}`}
    >
      <span aria-hidden="true">{TONE_ICON[tone]}</span>
      {label}
    </span>
  );
}
