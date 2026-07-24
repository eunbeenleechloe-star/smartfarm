"use client";

import { useEffect, useId, useRef, useState } from "react";

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
export default function LocationInput({
  value,
  onChange,
  selectedCode = null,
  onSelectCode,
}: {
  value: string;
  onChange: (address: string) => void;
  selectedCode?: string | null;
  onSelectCode?: (selection: LegalDistrictSelection | null) => void;
}) {
  const [candidates, setCandidates] = useState<LegalDistrictOption[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();
  const searchEnabled = onSelectCode !== undefined;

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
        지역
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
        placeholder="예: 전북특별자치도 고창군 고창읍"
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />

      {searchEnabled &&
        (selectedCode ? (
          <p className="mt-1 text-xs text-status-good">✓ 선택됨: {value}</p>
        ) : (
          <p className="mt-1 text-xs text-muted">
            공식 법정동 후보를 선택해주세요. 선택한 지역의 최근 토양검정 표본을 조회합니다.
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
            <p className="px-4 py-3 text-sm text-muted">검색 가능한 공식 법정동이 없습니다.</p>
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
    </div>
  );
}
