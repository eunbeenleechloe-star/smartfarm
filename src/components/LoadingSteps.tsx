"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "기상청 예보를 확인하고 있어요.",
  "토양 pH와 EC를 불러오고 있어요.",
  "선택한 작물 기준과 비교하고 있어요.",
  "향후 위험요인을 분석하고 있어요.",
];

const STEP_INTERVAL_MS = 900;

export default function LoadingSteps() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((index) => (index + 1 < STEPS.length ? index + 1 : index));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-border bg-card p-6">
      <ul className="space-y-2">
        {STEPS.map((step, index) => (
          <li
            key={step}
            className={`text-sm ${
              index === stepIndex
                ? "font-semibold text-primary"
                : index < stepIndex
                  ? "text-muted line-through"
                  : "text-muted"
            }`}
          >
            {index < stepIndex ? "✓ " : index === stepIndex ? "… " : "· "}
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}
