import type { NormalizedDiseaseDetail, NormalizedInsectDetail } from "@/types/analysis";

/**
 * `/api/crop-pests`가 반환하는 병/해충 카드 1건.
 * 요약 필드(name/thumbnailUrl 등)는 NCPMS 검색 서비스(SVC01/SVC03) 결과를 그대로 재사용하고,
 * detail은 상위 3건만 상세정보 서비스(SVC05/SVC07)로 채운다. 상세 조회가 실패하면 null이다.
 * 이 타입은 "현재 발생 확률"이나 위험도를 담지 않는다 — cropRiskAnalyzer의 위험 판단과는 무관하다.
 */
export interface DiseaseCardItem {
  id: string;
  cropName: string | null;
  nameKor: string;
  nameEng: string | null;
  thumbnailUrl: string | null;
  detail: NormalizedDiseaseDetail | null;
}

export interface InsectCardItem {
  id: string;
  cropName: string | null;
  nameKor: string;
  speciesName: string | null;
  thumbnailUrl: string | null;
  detail: NormalizedInsectDetail | null;
}

export interface CropPestsDataStatus {
  /** 병 검색 또는 해충 검색 중 하나라도 실패했을 때 true. */
  partialFailure: boolean;
  diseaseSearchFailed: boolean;
  insectSearchFailed: boolean;
  /** NEXT_PUBLIC_USE_MOCK_DATA=true로 인한 mock 응답이면 true. */
  isMock: boolean;
}

export interface CropPestsResponse {
  cropName: string;
  diseases: DiseaseCardItem[];
  insects: InsectCardItem[];
  source: "NCPMS" | "MOCK";
  dataStatus: CropPestsDataStatus;
  fetchedAt: string;
}

export interface CropPestsErrorResponse {
  message: string;
}
