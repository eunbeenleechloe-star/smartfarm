import type { NormalizedDiseaseSearchItem } from "@/types/analysis";
import { getRequiredEnv } from "../env";
import { NCPMS_BASE_URL, throwIfNcpmsError } from "./shared";

/** NCPMS 병 검색 서비스(SVC01) 원본 응답 항목. */
interface NcpmsDiseaseSearchRawItem {
  cropName?: string;
  sickNameKor?: string;
  sickNameChn?: string;
  sickNameEng?: string;
  thumbImg?: string;
  oriImg?: string;
  sickKey?: string | number;
}

export interface SearchDiseasesParams {
  cropName?: string;
  sickNameKor?: string;
  displayCount?: number;
  startPoint?: number;
}

/**
 * 응답 envelope(service.list.item 등 정확한 중첩 구조)은 문서로 확인되지 않아
 * 가능한 형태를 순서대로 시도한다. item 필드명(cropName/sickNameKor 등) 자체는
 * 명세에 정확히 명시된 그대로 사용한다.
 */
function extractRawItems(data: unknown): NcpmsDiseaseSearchRawItem[] {
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
    if (Array.isArray(candidate)) return candidate as NcpmsDiseaseSearchRawItem[];
    if (candidate && typeof candidate === "object") return [candidate as NcpmsDiseaseSearchRawItem];
  }
  return [];
}

function normalizeSickKey(sickKey: string | number | undefined): string {
  if (sickKey === undefined || sickKey === null) return "";
  return String(sickKey);
}

function toNormalizedItem(raw: NcpmsDiseaseSearchRawItem): NormalizedDiseaseSearchItem {
  return {
    id: normalizeSickKey(raw.sickKey),
    cropName: raw.cropName ?? null,
    nameKor: raw.sickNameKor ?? "",
    nameChn: raw.sickNameChn ?? null,
    nameEng: raw.sickNameEng ?? null,
    thumbnailUrl: raw.thumbImg ?? null,
    originalImageUrl: raw.oriImg ?? null,
    source: "NCPMS",
  };
}

/**
 * NCPMS 병 검색 서비스(SVC01) 원본 응답을 NormalizedDiseaseSearchItem[]으로 정규화하는 순수 함수.
 * 네트워크 호출과 분리되어 있어 샘플 응답으로 단위 검증이 가능하다(runDiseaseSearchSelfChecks 참고).
 * 증상/발생환경/예방법/방제법 필드는 이 API에 없으므로 채우지 않는다.
 */
export function normalizeDiseaseSearchResponse(data: unknown): NormalizedDiseaseSearchItem[] {
  throwIfNcpmsError(data);
  return extractRawItems(data).map(toNormalizedItem);
}

/**
 * NCPMS 병 검색 서비스(SVC01) 호출.
 * cropName / sickNameKor 중 최소 하나는 필수다(NCPMS 명세).
 * 상세정보(증상/예방/방제)는 sickKey로 병 상세정보 API(diseaseDetail.ts)를 따로 호출해야 한다.
 */
export async function searchDiseases(
  params: SearchDiseasesParams,
): Promise<NormalizedDiseaseSearchItem[]> {
  if (!params.cropName && !params.sickNameKor) {
    throw new Error("cropName 또는 sickNameKor 중 최소 하나는 필요합니다.");
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
  url.searchParams.set("serviceCode", "SVC01");
  url.searchParams.set("serviceType", "AA003"); // JSON
  if (params.cropName) url.searchParams.set("cropName", params.cropName);
  if (params.sickNameKor) url.searchParams.set("sickNameKor", params.sickNameKor);
  url.searchParams.set("displayCount", String(displayCount));
  url.searchParams.set("startPoint", String(startPoint));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`NCPMS 병 검색 API 응답 오류: HTTP ${res.status}`);
  }

  const data = (await res.json()) as unknown;
  return normalizeDiseaseSearchResponse(data);
}

export interface DiseaseSearchSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * 실제 API 키 없이 normalizeDiseaseSearchResponse()의 매핑 정확성을 점검한다.
 * 샘플 값은 필드 매핑 검증용 테스트 픽스처이며 실제 NCPMS 데이터가 아니다.
 */
export function runDiseaseSearchSelfChecks(): DiseaseSearchSelfCheckResult[] {
  const results: DiseaseSearchSelfCheckResult[] = [];

  const sampleResponse = {
    service: {
      buildTime: "2026-07-23 10:00:00",
      totalCount: "2",
      startPoint: "1",
      displayCount: "10",
      list: {
        item: [
          {
            cropName: "사과",
            sickNameKor: "겹무늬썩음병",
            sickNameChn: "轮纹病",
            sickNameEng: "Ring rot",
            thumbImg: "https://ncpms.rda.go.kr/thumb/1.jpg",
            oriImg: "https://ncpms.rda.go.kr/ori/1.jpg",
            sickKey: 305,
          },
          {
            cropName: "배",
            sickNameKor: "붉은별무늬병",
            sickKey: "412",
          },
        ],
      },
    },
  };

  const normalized = normalizeDiseaseSearchResponse(sampleResponse);

  results.push({
    label: "1. 정상 응답 2건이 NormalizedDiseaseSearchItem[]으로 변환됨",
    passed: normalized.length === 2,
    message: `normalized.length=${normalized.length}`,
  });

  results.push({
    label: "2. 숫자형 sickKey(305)가 문자열 id로 안전하게 변환됨",
    passed: normalized[0]?.id === "305",
    message: `id=${JSON.stringify(normalized[0]?.id)}`,
  });

  results.push({
    label: "3. 문자형 sickKey('412')가 그대로 유지됨",
    passed: normalized[1]?.id === "412",
    message: `id=${JSON.stringify(normalized[1]?.id)}`,
  });

  results.push({
    label: "4. 응답에 없는 필드(nameChn/nameEng 등)는 null로 처리되고 임의 값으로 채우지 않음",
    passed: normalized[1]?.nameChn === null && normalized[1]?.nameEng === null,
    message: `item[1]=${JSON.stringify(normalized[1])}`,
  });

  results.push({
    label: "5. source는 항상 리터럴 'NCPMS'",
    passed: normalized.every((item) => item.source === "NCPMS"),
    message: `sources=${JSON.stringify(normalized.map((item) => item.source))}`,
  });

  const emptyResponse = { service: { totalCount: "0", list: { item: [] } } };
  const emptyResult = normalizeDiseaseSearchResponse(emptyResponse);

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
    normalizeDiseaseSearchResponse(errorResponse);
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
