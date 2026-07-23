import StatusBadge, { severityLabel, severityToTone } from "@/components/StatusBadge";
import type { CropRiskItem } from "@/lib/cropRiskAnalyzer";

export default function RiskCard({ risk }: { risk: CropRiskItem }) {
  const hasNumbers = risk.actualValue !== undefined && risk.actualValue !== null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-text">{risk.title}</h3>
        <StatusBadge tone={severityToTone(risk.severity)} label={`단기 위험: ${severityLabel(risk.severity)}`} />
      </div>

      {risk.date && <div className="mt-1 text-xs text-muted">발생 시점: {risk.date}</div>}

      <p className="mt-3 text-sm text-text">{risk.evidence}</p>

      {hasNumbers && (
        <dl className="mt-3 flex gap-6 text-sm">
          <div>
            <dt className="text-muted">근거값</dt>
            <dd className="font-semibold text-text">{risk.actualValue}</dd>
          </div>
          {risk.threshold !== undefined && risk.threshold !== null && (
            <div>
              <dt className="text-muted">기준값</dt>
              <dd className="font-semibold text-text">{risk.threshold}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-4 rounded-lg bg-status-info-bg px-4 py-3 text-sm text-text">
        <span className="font-medium text-status-info">지금 해야 할 행동: </span>
        {risk.action}
      </div>

      {risk.source && <div className="mt-2 text-xs text-muted">근거 출처: {risk.source}</div>}
    </div>
  );
}
