import type { FarmAnalysisReport } from "@/types/farmReport";

export type FarmReportStatus = "idle" | "loading" | "success" | "error";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-background ${className}`} />;
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-text">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "AI 맞춤 재배 리포트" 섹션. report는 LLM 결과이거나 규칙 기반 fallback(isFallback=true)일
 * 수 있는데, 둘 다 이미 계산된 analysis/pests 값을 설명만 한 것이지 새로 계산한 값이 아니다.
 * 리포트 생성이 늦거나 실패해도 이 섹션만 영향을 받고, 위쪽의 기존 분석 결과 화면은 그대로다.
 */
export default function FarmReportSection({
  status,
  report,
  onRegenerate,
}: {
  status: FarmReportStatus;
  report: FarmAnalysisReport | null;
  onRegenerate: () => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text">AI 맞춤 재배 리포트</h2>
          <p className="mt-1 text-sm text-muted">
            공공데이터와 적합도 분석 결과를 초보자 눈높이로 설명합니다.
          </p>
        </div>
        {status !== "loading" && (
          <button
            type="button"
            onClick={onRegenerate}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-background"
          >
            다시 생성
          </button>
        )}
      </div>

      {status === "loading" && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <SkeletonBlock className="h-5 w-2/3" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-status-danger bg-status-danger-bg p-5 text-sm text-status-danger">
          AI 리포트를 불러오지 못했습니다. 다시 생성 버튼을 눌러주세요.
        </div>
      )}

      {status === "success" && report && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-medium text-text">{report.summary}</p>
            {report.isFallback && (
              <span className="shrink-0 rounded-full bg-status-caution-bg px-2 py-0.5 text-xs font-medium text-status-caution">
                자동 요약(AI 설명 대체)
              </span>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <ReportList title="좋은 조건" items={report.strengths} />
            <ReportList title="주의할 점" items={report.cautions} />
            <ReportList title="지금 할 일" items={report.immediateActions} />
          </div>

          {report.missingDataNotice && (
            <p className="mt-4 rounded-lg bg-status-missing-bg px-4 py-2 text-xs text-status-missing">
              {report.missingDataNotice}
            </p>
          )}

          <p className="mt-3 text-xs text-muted">{report.dataBasisNotice}</p>
          <p className="mt-1 text-xs text-muted">{report.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
