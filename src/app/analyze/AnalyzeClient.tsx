"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ActionCard from "@/components/ActionCard";
import AnalyzeButton from "@/components/AnalyzeButton";
import ConfidenceCard from "@/components/ConfidenceCard";
import CropSelector from "@/components/CropSelector";
import FertilizerCard from "@/components/FertilizerCard";
import GrowthStageSelect from "@/components/GrowthStageSelect";
import LoadingSteps from "@/components/LoadingSteps";
import LocationInput from "@/components/LocationInput";
import MetricCard from "@/components/MetricCard";
import RiskCard from "@/components/RiskCard";
import ScoreGauge from "@/components/ScoreGauge";
import SourceList from "@/components/SourceList";
import StatusBadge, { severityLabel, severityToTone } from "@/components/StatusBadge";
import { cropResearchStandards } from "@/data/cropResearchStandards";
import { getHighestSeverity, type CropRiskItem } from "@/lib/cropRiskAnalyzer";
import type { CropAnalysisResult } from "@/services/cropAnalysis";
import type { AnalysisInput, CropId, RiskSeverity } from "@/types/analysis";

type RequestStatus = "idle" | "loading" | "error" | "success";

const VALID_CROP_IDS: CropId[] = ["apple", "pear", "cucumber", "potato", "lettuce"];

function isCropId(value: string | null): value is CropId {
  return value !== null && (VALID_CROP_IDS as string[]).includes(value);
}

/** 위험 카드/행동 가이드 노출 순서만 정하는 표시용 정렬 기준. 점수·위험 자체를 재계산하지 않는다. */
const SEVERITY_ORDER: Record<RiskSeverity, number> = { danger: 2, warning: 1, info: 0 };

function sortBySeverity(risks: CropRiskItem[]): CropRiskItem[] {
  return [...risks].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
}

function buildSummarySentence(cropName: string, topRisk: CropRiskItem | undefined): string {
  if (!topRisk) {
    return `${cropName} 재배 환경에서 현재 특별한 단기 위험은 발견되지 않았습니다.`;
  }
  return `${cropName} 재배 환경은 대체로 적합하지만, ${topRisk.title}에 주의해야 합니다.`;
}

async function requestAnalysis(input: AnalysisInput): Promise<CropAnalysisResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "분석 중 오류가 발생했습니다.");
  }
  return data as CropAnalysisResult;
}

export default function AnalyzeClient() {
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);

  const [address, setAddress] = useState("");
  const [cropId, setCropId] = useState<CropId | null>(null);
  const [growthStage, setGrowthStage] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CropAnalysisResult | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleAnalyze(overrides?: { address?: string; cropId?: CropId | null }) {
    const targetAddress = overrides?.address ?? address;
    const targetCropId = overrides?.cropId ?? cropId;

    if (!targetAddress.trim() || !targetCropId) {
      setValidationMessage("지역과 작물을 모두 선택해주세요.");
      return;
    }
    setValidationMessage(null);
    setStatus("loading");
    setErrorMessage(null);

    try {
      const data = await requestAnalysis({
        location: { address: targetAddress.trim() },
        crop: targetCropId,
        growthStage: growthStage || undefined,
        areaM2: areaM2 ? Number(areaM2) : undefined,
      });
      setResult(data);
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.");
      setStatus("error");
    }
  }

  // 랜딩 페이지의 위치/작물 입력에서 넘어온 경우 값을 채워 넣고 바로 실제 분석을 실행한다
  // (더미 결과가 아니라 /api/analyze를 그대로 호출한다).
  useEffect(() => {
    if (prefillApplied.current) return;
    prefillApplied.current = true;

    const queryAddress = searchParams.get("address");
    const queryCrop = searchParams.get("crop");

    if (queryAddress) setAddress(queryAddress);
    if (isCropId(queryCrop)) setCropId(queryCrop);

    if (queryAddress && isCropId(queryCrop)) {
      void handleAnalyze({ address: queryAddress, cropId: queryCrop });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sortedRisks = result ? sortBySeverity(result.risks) : [];
  const topRisks = sortedRisks.slice(0, 3);
  const topActions = Array.from(new Set(sortedRisks.map((risk) => risk.action))).slice(0, 3);
  const highestSeverity = result ? getHighestSeverity(result.risks) : "none";
  const cropName = result ? cropResearchStandards[result.cropId].name : "";

  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-32 pb-10 sm:px-6">
      <header className="mb-8">
        <Link href="/" className="text-sm text-muted hover:text-primary">
          ← 홈으로
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-primary">Farm AI 재배 환경 분석</h1>
        <p className="mt-2 text-text">
          지역별 토양과 기상예보를 분석해 재배 적합도와 위험요인을 알려드립니다.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <LocationInput value={address} onChange={setAddress} />
          <GrowthStageSelect cropId={cropId} value={growthStage} onChange={setGrowthStage} />
        </div>

        <div className="mt-6">
          <CropSelector value={cropId} onChange={setCropId} />
        </div>

        <div className="mt-6 max-w-xs">
          <label htmlFor="area-m2" className="mb-2 block text-sm font-medium text-text">
            재배 면적 (㎡, 선택)
          </label>
          <input
            id="area-m2"
            type="number"
            min={0}
            value={areaM2}
            onChange={(event) => setAreaM2(event.target.value)}
            placeholder="예: 1000"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {validationMessage && <p className="mt-4 text-sm text-status-danger">{validationMessage}</p>}

        <div className="mt-6 max-w-xs">
          <AnalyzeButton onClick={() => handleAnalyze()} loading={status === "loading"} />
        </div>
      </section>

      {status === "loading" && (
        <section className="mt-8">
          <LoadingSteps />
        </section>
      )}

      {status === "error" && errorMessage && (
        <section className="mt-8 rounded-xl border border-status-danger bg-status-danger-bg p-4 text-sm text-status-danger">
          {errorMessage}
        </section>
      )}

      {status === "success" && result && (
        <div className="mt-10 space-y-10">
          {/* 1. 결과 요약 */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <p className="text-lg font-medium text-text">{buildSummarySentence(cropName, topRisks[0])}</p>
            <div className="mt-4 flex flex-wrap items-end gap-8">
              <ScoreGauge label="환경 적합도" score={result.overallScore} />
              <StatusBadge
                tone={highestSeverity === "none" ? "good" : severityToTone(highestSeverity)}
                label={`단기 위험: ${highestSeverity === "none" ? "없음" : severityLabel(highestSeverity)}`}
              />
            </div>
            <p className="mt-3 text-sm text-muted">
              {result.location} · {cropName}
              {growthStage ? ` · ${growthStage}` : ""}
            </p>
          </section>

          {/* 2. 주요 위험 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-text">주요 위험</h2>
            {topRisks.length === 0 ? (
              <p className="text-sm text-muted">현재 특별한 단기 위험은 발견되지 않았습니다.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topRisks.map((risk) => (
                  <RiskCard key={risk.id} risk={risk} />
                ))}
              </div>
            )}
          </section>

          {/* 3. 지금 해야 할 행동 */}
          {topActions.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-text">지금 해야 할 행동</h2>
              <div className="space-y-3">
                {topActions.map((action, index) => (
                  <ActionCard key={action} order={index + 1} action={action} />
                ))}
              </div>
            </section>
          )}

          {/* 4. 세부 적합도 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-text">항목별 적합도</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.scoreDetails.map((detail) => (
                <MetricCard key={detail.field} detail={detail} />
              ))}
            </div>
          </section>

          {/* 5. 비료사용처방 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-text">비료사용처방</h2>
            <FertilizerCard fertilizer={result.fertilizer} />
          </section>

          {/* 6. 신뢰도 + 데이터 출처 */}
          <section className="grid gap-4 sm:grid-cols-2">
            <ConfidenceCard
              confidenceScore={result.confidenceScore}
              excludedFieldsCount={result.excludedFields.length}
              dataQuality={result.dataQuality}
            />
            <SourceList
              sources={result.sources}
              generatedAt={result.generatedAt}
              dataQuality={result.dataQuality}
            />
          </section>
        </div>
      )}
    </main>
  );
}
