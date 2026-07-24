import { cropResearchStandards } from "@/data/cropResearchStandards";
import type { CropId } from "@/types/analysis";

const CROP_IDS: CropId[] = ["apple", "pear", "cucumber", "potato", "lettuce"];

/** 크롭별 옵션 카드 이미지. 이미지가 없는 작물은 기존 텍스트 pill 스타일을 그대로 쓴다. */
const CROP_IMAGES: Partial<Record<CropId, string>> = {};

export default function CropSelector({
  value,
  onChange,
}: {
  value: CropId | null;
  onChange: (crop: CropId) => void;
}) {
  return (
    <div role="group" aria-label="작물 선택">
      <div className="mb-2 text-sm font-medium text-text">작물</div>
      <div className="flex flex-wrap items-start gap-2">
        {CROP_IDS.map((cropId) => {
          const selected = value === cropId;
          const imageSrc = CROP_IMAGES[cropId];

          if (imageSrc) {
            return (
              <button
                key={cropId}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(cropId)}
                className={`flex w-24 flex-col items-center gap-2 rounded-xl border p-2 transition-colors ${
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card text-text hover:border-primary"
                }`}
              >
                <img
                  src={imageSrc}
                  alt={`${cropResearchStandards[cropId].name} 옵션 이미지`}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <span className="text-sm font-medium">
                  {selected ? "✓ " : ""}
                  {cropResearchStandards[cropId].name}
                </span>
              </button>
            );
          }

          return (
            <button
              key={cropId}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(cropId)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-text hover:border-primary"
              }`}
            >
              {selected ? "✓ " : ""}
              {cropResearchStandards[cropId].name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
