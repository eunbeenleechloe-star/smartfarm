"use client";

import { useEffect, useState } from "react";
import PestCard from "@/components/pests/PestCard";
import PestDetailModal from "@/components/pests/PestDetailModal";
import type { CropId } from "@/types/analysis";
import type { CropPestsErrorResponse, CropPestsResponse, DiseaseCardItem, InsectCardItem } from "@/types/cropPests";

type SectionStatus = "loading" | "success" | "error";
type PestTab = "disease" | "insect";

interface SelectedItem {
  kind: PestTab;
  item: DiseaseCardItem | InsectCardItem;
}

async function fetchCropPests(cropId: CropId): Promise<CropPestsResponse> {
  const res = await fetch(`/api/crop-pests?cropId=${encodeURIComponent(cropId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as CropPestsErrorResponse).message ?? "병해충 정보를 불러오지 못했습니다.");
  }
  return data as CropPestsResponse;
}

/**
 * `onResult`는 선택 사항이다 — /api/crop-pests를 다시 호출하지 않고, 이 컴포넌트가 이미
 * 받아온 결과(성공 시 CropPestsResponse, 실패 시 null)를 부모(AnalyzeClient)에게 그대로
 * 전달하기만 한다. AI 리포트가 병해충 정보를 함께 쓸 수 있게 하기 위함이며, 이 컴포넌트
 * 자체의 fetch/렌더링 로직은 바뀌지 않는다.
 */
export default function CropPestsSection({
  cropId,
  onResult,
}: {
  cropId: CropId;
  onResult?: (result: CropPestsResponse | null) => void;
}) {
  const [status, setStatus] = useState<SectionStatus>("loading");
  const [data, setData] = useState<CropPestsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PestTab>("disease");
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setSelected(null);
    setActiveTab("disease");
    onResult?.(null);

    fetchCropPests(cropId)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("success");
        onResult?.(result);
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "병해충 정보를 불러오지 못했습니다.");
        setStatus("error");
        onResult?.(null);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropId]);

  const activeItems: (DiseaseCardItem | InsectCardItem)[] =
    activeTab === "disease" ? data?.diseases ?? [] : data?.insects ?? [];

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text">이 작물의 주요 병해충 정보</h2>
        <p className="mt-1 text-sm text-muted">
          NCPMS에서 제공하는 작물별 병·해충 증상과 방제정보입니다.
        </p>
      </div>

      {status === "loading" && (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted">
          병해충 정보를 불러오는 중입니다.
        </p>
      )}

      {status === "error" && (
        <p className="rounded-xl border border-status-danger bg-status-danger-bg p-6 text-sm text-status-danger">
          {errorMessage ?? "병해충 정보를 불러오지 못했습니다."}
        </p>
      )}

      {status === "success" && data && (
        <div>
          {data.dataStatus.partialFailure && (
            <p className="mb-3 rounded-lg bg-status-caution-bg px-4 py-2 text-sm text-status-caution">
              일부 병해충 정보를 불러오지 못했습니다.
            </p>
          )}
          {data.dataStatus.isMock && (
            <p className="mb-3 inline-block rounded-full bg-status-missing-bg px-2 py-0.5 text-xs text-status-missing">
              mock 데이터
            </p>
          )}

          <div className="mb-4 flex gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("disease")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "disease"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-text"
              }`}
            >
              주요 병 ({data.diseases.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("insect")}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "insect"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-text"
              }`}
            >
              주요 해충 ({data.insects.length})
            </button>
          </div>

          {activeItems.length === 0 ? (
            <p className="text-sm text-muted">이 작물에 대한 병해충 정보가 없습니다.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeItems.map((item) => (
                <PestCard
                  key={item.id}
                  thumbnailUrl={item.thumbnailUrl}
                  nameKor={item.nameKor}
                  subtitle={"nameEng" in item ? item.nameEng : item.speciesName}
                  cropName={item.cropName}
                  onDetail={() => setSelected({ kind: activeTab, item })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <PestDetailModal
          kind={selected.kind}
          fallbackTitle={selected.item.nameKor}
          detail={selected.item.detail}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
