import { cropResearchStandards } from "@/data/cropResearchStandards";
import { getStageLabel } from "@/lib/cropRiskAnalyzer";
import type { CropId } from "@/types/analysis";

/**
 * 저온 위험 판정은 growthStage가 작물의 coldRisks[].stage와 정확히 일치할 때만 동작한다
 * (cropRiskAnalyzer.ts findColdThreshold). 목록은 그 stage 값을 그대로 사용해 존재하지
 * 않는 생육단계를 임의로 만들지 않는다.
 */
export default function GrowthStageSelect({
  cropId,
  value,
  onChange,
}: {
  cropId: CropId | null;
  value: string;
  onChange: (stage: string) => void;
}) {
  const stages = cropId ? cropResearchStandards[cropId].coldRisks.map((risk) => risk.stage) : [];

  return (
    <div>
      <label htmlFor="growth-stage" className="mb-2 block text-sm font-medium text-text">
        생육단계 (선택)
      </label>
      <select
        id="growth-stage"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={stages.length === 0}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-text focus:border-primary focus:outline-none disabled:text-muted"
      >
        <option value="">선택 안 함</option>
        {stages.map((stage) => (
          <option key={stage} value={stage}>
            {getStageLabel(stage)}
          </option>
        ))}
      </select>
    </div>
  );
}
