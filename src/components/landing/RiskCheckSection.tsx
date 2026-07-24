"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CropSelector from "@/components/CropSelector";
import LocationInput from "@/components/LocationInput";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { addHistoryEntry } from "@/lib/history";
import type { CropId } from "@/types/analysis";

/**
 * 랜딩 페이지의 입력 진입점. 여기서는 더미 결과를 만들지 않고, 입력값을 그대로
 * /analyze로 넘겨 실제 /api/analyze 분석 결과를 보여준다.
 */
export default function RiskCheckSection() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [cropId, setCropId] = useState<CropId | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function handleSubmit() {
    if (!address.trim() || !cropId) {
      setValidationMessage("지역과 작물을 모두 선택해주세요.");
      return;
    }
    setValidationMessage(null);
    addHistoryEntry({ cropId, address: address.trim() });
    const params = new URLSearchParams({ address: address.trim(), crop: cropId });
    router.push(`/analyze?${params.toString()}`);
  }

  return (
    <section id="input" className="bg-background px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-text">내 땅에 이 작물, 괜찮을까요?</h2>
          <p className="mt-2 text-muted">
            지역과 작물을 선택하면 실제 분석 결과 화면으로 이동합니다.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <LocationInput value={address} onChange={setAddress} />
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full rounded-xl bg-primary px-6 py-3 text-base font-semibold text-white hover:opacity-90"
              >
                위험요소 확인하기
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-[240px] flex-1">
              <CropSelector value={cropId} onChange={setCropId} />
            </div>
            <img
              src="/images/farmer-crop.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none hidden w-24 select-none sm:block"
            />
          </div>

          {validationMessage && <p className="mt-4 text-sm text-status-danger">{validationMessage}</p>}
        </ScrollReveal>
      </div>
    </section>
  );
}
