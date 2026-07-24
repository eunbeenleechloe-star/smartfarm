"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buildPnu } from "@/services/shared/pnu";
import type { ParcelInput } from "@/types/analysis";

const SEARCH_DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 2;

export interface LegalDistrictOption {
  code: string;
  displayName: string;
  province: string;
  city: string | null;
  town: string | null;
  village: string | null;
  nx: number | null;
  ny: number | null;
  weatherGridPrecision: "town" | "city" | "province" | null;
}

export interface LegalDistrictSelection {
  code: string;
  displayName: string;
  nx: number | null;
  ny: number | null;
  weatherGridPrecision: "town" | "city" | "province" | null;
}

type SearchStatus = "idle" | "loading" | "error" | "success";

interface RegionSearchResponse {
  items: LegalDistrictOption[];
}

async function fetchLegalDistricts(query: string): Promise<LegalDistrictOption[]> {
  const res = await fetch(`/api/regions/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error("검색 중 오류가 발생했습니다.");
  }
  const data = (await res.json()) as RegionSearchResponse;
  return data.items;
}

/**
 * `onSelectCode`를 넘기지 않으면(예: 랜딩 페이지의 간단한 진입점) 전국 법정동 검색 없이
 * 기존과 동일한 단순 텍스트 입력으로 동작한다. `/analyze` 화면처럼 STDG_CD가 실제로 필요한
 * 곳에서만 `selectedCode`/`onSelectCode`를 넘겨 콤보박스 모드로 사용한다.
 */
/**
 * `onParcelChange`를 넘기면(예: `/analyze`) 지역 선택 후 "농지 지번 추가하기" 옵션을 보여준다
 * ("정밀 분석"). 넘기지 않으면 이 옵션 자체가 렌더링되지 않는다(기존 화면 변화 없음).
 */
export default function LocationInput({
  value,
  onChange,
  selectedCode = null,
  onSelectCode,
  onParcelChange,
}: {
  value: string;
  onChange: (address: string) => void;
  selectedCode?: string | null;
  onSelectCode?: (selection: LegalDistrictSelection | null) => void;
  onParcelChange?: (parcel: ParcelInput | null) => void;
}) {
  const [candidates, setCandidates] = useState<LegalDistrictOption[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();
  const searchEnabled = onSelectCode !== undefined;
  const parcelEnabled = onParcelChange !== undefined;

  const [preciseOpen, setPreciseOpen] = useState(false);
  const [mountain, setMountain] = useState(false);
  const [mainNumberText, setMainNumberText] = useState("");
  const [subNumberText, setSubNumberText] = useState("");

  useEffect(() => {
    if (!searchEnabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    // 방금 후보를 선택한 직후(selectedCode가 있음)에는 다시 검색하지 않는다.
    if (selectedCode) {
      setCandidates([]);
      setStatus("idle");
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const trimmed = value.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setCandidates([]);
      setStatus("idle");
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setOpen(true);
    setActiveIndex(-1);

    timerRef.current = setTimeout(() => {
      fetchLegalDistricts(trimmed)
        .then((results) => {
          if (cancelled) return;
          setCandidates(results);
          setStatus("success");
        })
        .catch(() => {
          if (cancelled) return;
          setCandidates([]);
          setStatus("error");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectedCode, searchEnabled]);

  // 지역 선택이 바뀌거나 해제되면 이전 지번 입력은 더 이상 유효하지 않으므로 초기화한다.
  useEffect(() => {
    if (!parcelEnabled) return;
    setPreciseOpen(false);
    setMountain(false);
    setMainNumberText("");
    setSubNumberText("");
    onParcelChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, parcelEnabled]);

  const mainNumber = mainNumberText.trim() === "" ? null : Number(mainNumberText);
  const subNumber = subNumberText.trim() === "" ? null : Number(subNumberText);
  const hasMainNumberInput = mainNumberText.trim() !== "";
  const parcelPnu =
    parcelEnabled && preciseOpen && selectedCode && hasMainNumberInput && mainNumber !== null
      ? buildPnu({ legalDistrictCode: selectedCode, mountain, mainNumber, subNumber })
      : null;
  const parcelInputInvalid = parcelEnabled && preciseOpen && hasMainNumberInput && parcelPnu === null;

  useEffect(() => {
    if (!parcelEnabled) return;
    if (!preciseOpen || mainNumber === null) {
      onParcelChange?.(null);
      return;
    }
    onParcelChange?.(parcelPnu ? { mountain, mainNumber, subNumber } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelEnabled, preciseOpen, mountain, mainNumber, subNumber, parcelPnu]);

  function selectCandidate(candidate: LegalDistrictOption) {
    onChange(candidate.displayName);
    onSelectCode?.({
      code: candidate.code,
      displayName: candidate.displayName,
      nx: candidate.nx,
      ny: candidate.ny,
      weatherGridPrecision: candidate.weatherGridPrecision,
    });
    setOpen(false);
    setActiveIndex(-1);
    setCandidates([]);
    setStatus("idle");
  }

  function handleTextChange(next: string) {
    onChange(next);
    if (selectedCode) onSelectCode?.(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchEnabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open && candidates.length > 0) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, candidates.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (open && activeIndex >= 0 && candidates[activeIndex]) {
        event.preventDefault();
        selectCandidate(candidates[activeIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showEmptyMessage = searchEnabled && status === "success" && candidates.length === 0;
  const activeOptionId =
    activeIndex >= 0 && candidates[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="relative">
      <label htmlFor="location-address" className="mb-2 block text-sm font-medium text-text">
        분석할 지역
      </label>
      <input
        id="location-address"
        type="text"
        autoComplete="off"
        role={searchEnabled ? "combobox" : undefined}
        aria-expanded={searchEnabled ? open : undefined}
        aria-controls={searchEnabled ? listboxId : undefined}
        aria-autocomplete={searchEnabled ? "list" : undefined}
        aria-activedescendant={activeOptionId}
        value={value}
        onChange={(event) => handleTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (searchEnabled && candidates.length > 0) setOpen(true);
        }}
        placeholder="예: 고창군 고창읍, 강릉시 강동면"
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />

      {searchEnabled &&
        (selectedCode ? (
          <p className="mt-1 text-xs text-status-good">지역이 선택되었어요.</p>
        ) : value.trim().length >= MIN_QUERY_LENGTH ? (
          <p className="mt-1 text-xs text-muted">검색 결과에서 지역을 선택해주세요.</p>
        ) : (
          <p className="mt-1 text-xs text-muted">
            지역명을 입력한 뒤 검색 결과에서 선택하면 해당 지역의 날씨와 토양 정보를 확인할 수
            있어요.
          </p>
        ))}

      {searchEnabled && open && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg">
          {status === "loading" && (
            <p className="px-4 py-3 text-sm text-muted">지역을 검색하는 중입니다.</p>
          )}
          {status === "error" && (
            <p className="px-4 py-3 text-sm text-status-danger">검색 중 오류가 발생했습니다.</p>
          )}
          {showEmptyMessage && (
            <p className="px-4 py-3 text-sm text-muted">
              검색 결과가 없어요. 지역명을 조금 더 자세히 입력해 주세요.
            </p>
          )}
          {status === "success" && candidates.length > 0 && (
            <ul id={listboxId} role="listbox" className="max-h-60 overflow-y-auto py-1">
              {candidates.map((candidate, index) => (
                <li key={candidate.code} id={`${listboxId}-option-${index}`} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCandidate(candidate)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`block w-full px-4 py-2 text-left text-sm ${
                      index === activeIndex ? "bg-background" : ""
                    } text-text hover:bg-background`}
                  >
                    <span className="block font-medium">{candidate.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {parcelEnabled && selectedCode && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          {!preciseOpen ? (
            <button
              type="button"
              onClick={() => setPreciseOpen(true)}
              className="text-sm font-medium text-primary hover:underline"
            >
              농지 지번 추가하기
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text">농지 지번 추가하기</p>
                <button
                  type="button"
                  onClick={() => setPreciseOpen(false)}
                  className="text-xs text-muted hover:text-text"
                >
                  접기
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">
                지번을 입력하면 토성, 배수 상태, 유효토심을 추가로 확인할 수 있어요.
              </p>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="parcel-mountain" className="mb-1 block text-xs text-muted">
                    산 여부
                  </label>
                  <select
                    id="parcel-mountain"
                    value={mountain ? "mountain" : "general"}
                    onChange={(event) => setMountain(event.target.value === "mountain")}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                  >
                    <option value="general">일반</option>
                    <option value="mountain">산</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="parcel-main-number" className="mb-1 block text-xs text-muted">
                    본번
                  </label>
                  <input
                    id="parcel-main-number"
                    type="number"
                    min={1}
                    max={9999}
                    value={mainNumberText}
                    onChange={(event) => setMainNumberText(event.target.value)}
                    placeholder="예: 123"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="parcel-sub-number" className="mb-1 block text-xs text-muted">
                    부번(선택)
                  </label>
                  <input
                    id="parcel-sub-number"
                    type="number"
                    min={0}
                    max={9999}
                    value={subNumberText}
                    onChange={(event) => setSubNumberText(event.target.value)}
                    placeholder="예: 4"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {parcelInputInvalid ? (
                <p className="mt-2 text-xs text-status-danger">지번 정보를 다시 확인해주세요.</p>
              ) : hasMainNumberInput ? (
                <p className="mt-2 text-xs text-status-good">지번이 입력됐어요.</p>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  지번을 입력하면 필지별 토양특성을 추가로 확인할 수 있어요.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
