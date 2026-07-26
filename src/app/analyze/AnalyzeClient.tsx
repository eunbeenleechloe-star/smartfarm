"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ActionCard from "@/components/ActionCard";
import AnalyzeButton from "@/components/AnalyzeButton";
import ConfidenceCard from "@/components/ConfidenceCard";
import CropSelector from "@/components/CropSelector";
import FertilizerCard from "@/components/FertilizerCard";
import ForecastRiskAlert from "@/components/ForecastRiskAlert";
import GrowthStageSelect from "@/components/GrowthStageSelect";
import LoadingSteps from "@/components/LoadingSteps";
import LocationInput, { type LegalDistrictSelection } from "@/components/LocationInput";
import MetricCard from "@/components/MetricCard";
import CropPestsSection from "@/components/pests/CropPestsSection";
import FarmReportSection, { type FarmReportStatus } from "@/components/FarmReportSection";
import RiskCard from "@/components/RiskCard";
import ScoreGauge from "@/components/ScoreGauge";
import SoilCard from "@/components/SoilCard";
import SourceList from "@/components/SourceList";
import StatusBadge, { severityLabel, severityToTone } from "@/components/StatusBadge";
import { cropResearchStandards } from "@/data/cropResearchStandards";
import { getHighestSeverity, type CropRiskItem } from "@/lib/cropRiskAnalyzer";
import type { CropAnalysisResult } from "@/services/cropAnalysis";
import type {
  AnalysisInput,
  CropId,
  LocationInput as LocationInputData,
  ParcelInput,
  RiskSeverity,
} from "@/types/analysis";
import type { CropPestsResponse } from "@/types/cropPests";
import type { FarmAnalysisReport } from "@/types/farmReport";

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

const ANALYZE_REQUEST_TIMEOUT_MS = 15000;

async function requestAnalysis(input: AnalysisInput): Promise<CropAnalysisResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYZE_REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`분석 응답이 ${ANALYZE_REQUEST_TIMEOUT_MS / 1000}초 안에 오지 않았습니다. 다시 시도해주세요.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? `분석 중 오류가 발생했습니다. (HTTP ${res.status})`);
  }
  return data as CropAnalysisResult;
}

async function requestFarmReport(
  analysis: CropAnalysisResult,
  pests: CropPestsResponse | null,
): Promise<FarmAnalysisReport> {
  const res = await fetch("/api/analysis-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, pests }),
  });

  if (!res.ok) {
    throw new Error("AI 리포트를 불러오지 못했습니다.");
  }
  const data = await res.json();
  return data.report as FarmAnalysisReport;
}

export default function AnalyzeClient() {
  const searchParams = useSearchParams();
  const prefillApplied = useRef(false);

  const [address, setAddress] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<LegalDistrictSelection | null>(null);
  const [parcel, setParcel] = useState<ParcelInput | null>(null);
  const [cropId, setCropId] = useState<CropId | null>(null);
  const [growthStage, setGrowthStage] = useState("");
  const [areaM2, setAreaM2] = useState("");
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CropAnalysisResult | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pestsData, setPestsData] = useState<CropPestsResponse | null>(null);
  const [reportStatus, setReportStatus] = useState<FarmReportStatus>("idle");
  const [report, setReport] = useState<FarmAnalysisReport | null>(null);

  // overrides.address가 있으면 랜딩 페이지 딥링크(prefill) 경로다 — 법정동 후보 선택 없이
  // 기존 방식대로 주소 문자열만으로 분석한다(기존 UX 유지). 그 외(수동 폼 제출)는 반드시
  // 전국 법정동 검색에서 선택된 stdgCode를 사용한다(버튼 자체도 미선택 시 비활성화됨).
  async function handleAnalyze(overrides?: { address?: string; cropId?: CropId | null }) {
    const isPrefill = overrides?.address !== undefined;
    const targetCropId = overrides?.cropId ?? cropId;

    let location: LocationInputData;

    if (isPrefill) {
      const targetAddress = overrides?.address ?? "";
      if (!targetAddress.trim() || !targetCropId) {
        setValidationMessage("지역과 작물을 모두 선택해주세요.");
        return;
      }
      location = { address: targetAddress.trim() };
    } else {
      if (!selectedRegion || !address.trim() || !targetCropId) {
        setValidationMessage("지역과 작물을 모두 선택해주세요.");
        return;
      }
      location = {
        address: address.trim(),
        stdgCode: selectedRegion.code,
        ...(selectedRegion.nx !== null && selectedRegion.ny !== null
          ? { nx: selectedRegion.nx, ny: selectedRegion.ny }
          : {}),
        ...(selectedRegion.weatherGridPrecision
          ? { weatherGridPrecision: selectedRegion.weatherGridPrecision }
          : {}),
        ...(parcel ? { parcel } : {}),
      };
    }

    setValidationMessage(null);
    setStatus("loading");
    setErrorMessage(null);
    setPestsData(null);
    setReport(null);
    setReportStatus("idle");

    try {
      const data = await requestAnalysis({
        location,
        crop: targetCropId,
        growthStage: growthStage || undefined,
        areaM2: areaM2 ? Number(areaM2) : undefined,
      });
      setResult(data);
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.");
      setStatus("error");
    } finally {
      // try/catch가 상태를 못 바꾸는 예기치 못한 경로에 대비한 안전장치 —
      // 로딩 스피너가 절대 "loading"에 멈춰 있지 않도록 보장한다.
      setStatus((prev) => (prev === "loading" ? "error" : prev));
    }
  }

  // 병해충 데이터는 CropPestsSection이 이미 받아온 결과를 그대로 전달받을 뿐, 여기서
  // /api/crop-pests를 다시 호출하지 않는다(NCPMS 중복 호출 방지).
  async function generateReport(analysisOverride?: CropAnalysisResult) {
    const targetAnalysis = analysisOverride ?? result;
    if (!targetAnalysis) return;

    setReportStatus("loading");
    try {
      const generated = await requestFarmReport(targetAnalysis, pestsData);
      setReport(generated);
      setReportStatus("success");
    } catch {
      setReportStatus("error");
    }
  }

  // 분석이 성공하면(기존 결과 화면은 그대로 유지한 채) 별도로 AI 리포트를 비동기 생성한다.
  // 이 시점에 병해충이 아직 로딩 중이면 pests=null로 생성되고, 이후 "다시 생성"으로 보완할 수 있다.
  useEffect(() => {
    if (!result) return;
    void generateReport(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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
          <div>
            <LocationInput
              value={address}
              onChange={setAddress}
              selectedCode={selectedRegion?.code ?? null}
              onSelectCode={(selection) => setSelectedRegion(selection)}
              onParcelChange={setParcel}
            />

            <p className="mt-3 text-sm text-muted">
              {parcel
                ? "지번을 입력했으니 토성, 배수 상태, 유효토심까지 함께 확인해요."
                : "지역의 최근 날씨와 토양검정 자료를 바탕으로 분석해요."}
            </p>
          </div>
          <div className="space-y-6">
            <GrowthStageSelect cropId={cropId} value={growthStage} onChange={setGrowthStage} />

            <div className="max-w-xs">
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

            <div className="max-w-xs">
              <AnalyzeButton
                onClick={() => handleAnalyze()}
                loading={status === "loading"}
                disabled={!selectedRegion || !cropId}
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <CropSelector value={cropId} onChange={setCropId} />
        </div>

        {validationMessage && <p className="mt-4 text-sm text-status-danger">{validationMessage}</p>}
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

          {/* 1-0. 예보 기반 주의(핵심 차별점 강조) — sortedRisks는 이미 severity 기준 정렬됨 */}
          <ForecastRiskAlert risks={sortedRisks} />

          {/* 1-1. AI 맞춤 재배 리포트 */}
          <FarmReportSection
            status={reportStatus}
            report={report}
            onRegenerate={() => void generateReport()}
          />

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

          {/* 4-1. 토양 정보 */}
          <section>
            <h2 className="mb-4 text-xl font-semibold text-text">토양 정보</h2>
            <SoilCard soil={result.soil} />
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
              cropId={result.cropId}
              sources={result.sources}
              generatedAt={result.generatedAt}
              dataQuality={result.dataQuality}
            />
          </section>

          {/* 7. 병해충 정보 */}
          <CropPestsSection cropId={result.cropId} onResult={setPestsData} />
        </div>
      )}
    </main>
  );
}
