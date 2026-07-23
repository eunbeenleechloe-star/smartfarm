import type { NormalizedInsectSearchItem } from "@/types/analysis";
import { getRequiredEnv } from "../env";
import { NCPMS_BASE_URL, throwIfNcpmsError } from "./shared";

/** NCPMS 해충 검색 서비스(SVC03) 원본 응답 항목. 실호출로 확인됨: envelope은 SVC01과 동일하게 service.list가 배열로 온다. */
interface NcpmsInsectSearchRawItem {
  cropName?: string;
  insectKorName?: string;
  speciesName?: string;
  thumbImg?: string;
  oriImg?: string;
  insectKey?: string | number;
}

export interface SearchInsectsParams {
  cropName?: string;
  insectKorName?: string;
  displayCount?: number;
  startPoint?: number;
}

function extractRawItems(data: unknown): NcpmsInsectSearchRawItem[] {
  const root = data as Record<string, unknown> | null | undefined;
  const service = root?.service as Record<string, unknown> | undefined;
  const list = (service?.list ?? root?.list) as unknown;

  const candidates: unknown[] = [
    (list as Record<string, unknown> | undefined)?.item,
    list,
    service?.item,
    root?.item,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as NcpmsInsectSearchRawItem[];
    if (candidate && typeof candidate === "object") return [candidate as NcpmsInsectSearchRawItem];
  }
  return [];
}

function normalizeInsectKey(insectKey: string | number | undefined): string {
  if (insectKey === undefined || insectKey === null) return "";
  return String(insectKey);
}

function toNullableString(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNormalizedItem(raw: NcpmsInsectSearchRawItem): NormalizedInsectSearchItem {
  return {
    id: normalizeInsectKey(raw.insectKey),
    cropName: toNullableString(raw.cropName),
    nameKor: raw.insectKorName ?? "",
    speciesName: toNullableString(raw.speciesName),
    thumbnailUrl: toNullableString(raw.thumbImg),
    originalImageUrl: toNullableString(raw.oriImg),
    source: "NCPMS",
  };
}

/**
 * NCPMS 해충 검색 서비스(SVC03) 원본 응답을 NormalizedInsectSearchItem[]으로 정규화하는 순수 함수.
 * 네트워크 호출과 분리되어 있어 샘플 응답으로 단위 검증이 가능하다(runInsectSearchSelfChecks 참고).
 * 증상/방제법 필드는 이 API에 없으므로 채우지 않는다.
 */
export function normalizeInsectSearchResponse(data: unknown): NormalizedInsectSearchItem[] {
  throwIfNcpmsError(data);
  return extractRawItems(data).map(toNormalizedItem);
}

/**
 * NCPMS 해충 검색 서비스(SVC03) 호출.
 * cropName / insectKorName 중 최소 하나는 필수다(NCPMS 명세).
 * 상세정보는 insectKey로 해충 상세정보 API(insectDetail.ts)를 따로 호출해야 한다.
 */
export async function searchInsects(
  params: SearchInsectsParams,
): Promise<NormalizedInsectSearchItem[]> {
  if (!params.cropName && !params.insectKorName) {
    throw new Error("cropName 또는 insectKorName 중 최소 하나는 필요합니다.");
  }

  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  let apiKey: string | null = null;
  if (!useMock) {
    try {
      apiKey = getRequiredEnv("PEST_API_KEY");
    } catch {
      apiKey = null;
    }
  }

  if (!apiKey) {
    return [];
  }

  const displayCount = Math.min(Math.max(params.displayCount ?? 10, 1), 50);
  const startPoint = Math.min(Math.max(params.startPoint ?? 1, 1), 500);

  const url = new URL(NCPMS_BASE_URL);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("serviceCode", "SVC03");
  url.searchParams.set("serviceType", "AA003"); // JSON
  if (params.cropName) url.searchParams.set("cropName", params.cropName);
  if (params.insectKorName) url.searchParams.set("insectKorName", params.insectKorName);
  url.searchParams.set("displayCount", String(displayCount));
  url.searchParams.set("startPoint", String(startPoint));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`NCPMS 해충 검색 API 응답 오류: HTTP ${res.status}`);
  }

  const data = (await res.json()) as unknown;
  return normalizeInsectSearchResponse(data);
}

export interface InsectSearchSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * 실제 API 키 없이 normalizeInsectSearchResponse()의 매핑 정확성을 점검한다.
 * 샘플 값은 필드 매핑 검증용 테스트 픽스처이며(실제 호출로 확인한 응답 구조를 반영),
 * 실제 NCPMS 데이터가 아니다.
 */
export function runInsectSearchSelfChecks(): InsectSearchSelfCheckResult[] {
  const results: InsectSearchSelfCheckResult[] = [];

  const sampleResponse = {
    service: {
      buildTime: "23:35:14[994]",
      totalCount: "2",
      startPoint: 1,
      displayCount: "10",
      list: [
        {
          insectKorName: "가루깍지벌레",
          cropName: "사과",
          speciesName: "comstocki",
          thumbImg: "http://ncpms.rda.go.kr/thumb/1.jpg",
          oriImg: "http://ncpms.rda.go.kr/ori/1.jpg",
          insectKey: "H00000594",
        },
        {
          insectKorName: "갈색날개노린재",
          cropName: "사과",
          insectKey: 618,
        },
      ],
    },
  };

  const normalized = normalizeInsectSearchResponse(sampleResponse);

  results.push({
    label: "1. 정상 응답 2건이 NormalizedInsectSearchItem[]으로 변환됨",
    passed: normalized.length === 2,
    message: `normalized.length=${normalized.length}`,
  });

  results.push({
    label: "2. 문자형 insectKey('H00000594')가 그대로 유지됨",
    passed: normalized[0]?.id === "H00000594",
    message: `id=${JSON.stringify(normalized[0]?.id)}`,
  });

  results.push({
    label: "3. 숫자형 insectKey(618)가 문자열 id로 안전하게 변환됨",
    passed: normalized[1]?.id === "618",
    message: `id=${JSON.stringify(normalized[1]?.id)}`,
  });

  results.push({
    label: "4. 응답에 없는 필드(speciesName 등)는 null로 처리되고 임의 값으로 채우지 않음",
    passed: normalized[1]?.speciesName === null && normalized[1]?.thumbnailUrl === null,
    message: `item[1]=${JSON.stringify(normalized[1])}`,
  });

  results.push({
    label: "5. source는 항상 리터럴 'NCPMS'",
    passed: normalized.every((item) => item.source === "NCPMS"),
    message: `sources=${JSON.stringify(normalized.map((item) => item.source))}`,
  });

  const emptyResponse = { service: { totalCount: "0", list: [] } };
  const emptyResult = normalizeInsectSearchResponse(emptyResponse);

  results.push({
    label: "6. 검색 결과 없음 → 빈 배열 반환",
    passed: Array.isArray(emptyResult) && emptyResult.length === 0,
    message: `emptyResult=${JSON.stringify(emptyResult)}`,
  });

  const errorResponse = {
    service: { errorCode: "ERR_101", errorMsg: "인증키가 등록되지 않았습니다." },
  };

  let errorMessage = "";
  try {
    normalizeInsectSearchResponse(errorResponse);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  results.push({
    label: "7. ERR_101(인증키 누락) 응답 시 에러를 던짐",
    passed: errorMessage.includes("ERR_101"),
    message: errorMessage,
  });

  return results;
}
