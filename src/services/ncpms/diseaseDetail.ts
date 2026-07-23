import type { NormalizedDiseaseDetail } from "@/types/analysis";
import { getRequiredEnv } from "../env";
import { NCPMS_BASE_URL, throwIfNcpmsError } from "./shared";

/**
 * NCPMS 병 상세정보 서비스(SVC05) 병원체 1건.
 * 실제 호출 결과 virusName은 고정폭 컬럼 패딩으로 앞뒤 공백이 섞여 온다(예: " Cucumber mosaic virus   ").
 */
interface NcpmsVirusListItem {
  virusName?: string;
  sfeNm?: string;
}

/**
 * NCPMS 병 상세정보 서비스(SVC05) 이미지 1건(병원체 이미지/병 피해 이미지 공용).
 * 문서에는 virusImgList/imageList가 "image N개, imageTitle N개"의 병렬 배열처럼 적혀 있었지만,
 * 실제 호출 결과는 이미지 1건당 {image, imageTitle, iemSpchcknNm?} 객체로 온다(항목별 키 유무도 다름).
 */
interface NcpmsImageListItem {
  image?: string;
  imageTitle?: string;
  iemSpchcknNm?: string;
}

/** NCPMS 병 상세정보 서비스(SVC05) 원본 응답. */
interface NcpmsDiseaseDetailRaw {
  buildTime?: string;
  cropName?: string;
  sickNameKor?: string;
  sickNameChn?: string;
  sickNameEng?: string;
  infectionRoute?: string;
  developmentCondition?: string;
  symptoms?: string;
  preventionMethod?: string;
  biologyPrvnbeMth?: string;
  chemicalPrvnbeMth?: string;
  etc?: string;
  virusList?: NcpmsVirusListItem | NcpmsVirusListItem[];
  virusImgList?: NcpmsImageListItem | NcpmsImageListItem[];
  imageList?: NcpmsImageListItem | NcpmsImageListItem[];
}

/** 실제 응답에서 단일 객체로 올 수도 있어(문서에도 명시) 항상 배열로 통일한다. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toNullableString(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPathogenNames(virusList: NcpmsDiseaseDetailRaw["virusList"]): string[] {
  return toArray(virusList)
    .map((item) => toNullableString(item?.virusName))
    .filter((v): v is string => v !== null);
}

function toPathogenFeatures(virusList: NcpmsDiseaseDetailRaw["virusList"]): string[] {
  return toArray(virusList)
    .map((item) => toNullableString(item?.sfeNm))
    .filter((v): v is string => v !== null);
}

/** 병원체 이미지 목록. 이미지 URL이 없는 항목은 버린다(제목만 있고 이미지가 없는 항목은 의미가 없음). */
function toPathogenImages(
  virusImgList: NcpmsDiseaseDetailRaw["virusImgList"],
): NormalizedDiseaseDetail["pathogenImages"] {
  return toArray(virusImgList)
    .map((item) => ({
      url: toNullableString(item?.image),
      title: toNullableString(item?.imageTitle),
    }))
    .filter((entry): entry is { url: string; title: string | null } => entry.url !== null);
}

/** 병 피해 이미지 목록. 항목마다 title/relatedField 유무가 달라도(관찰된 실제 응답 기준) 안전하게 처리한다. */
function toDiseaseImages(
  imageList: NcpmsDiseaseDetailRaw["imageList"],
): NormalizedDiseaseDetail["diseaseImages"] {
  return toArray(imageList)
    .map((item) => ({
      url: toNullableString(item?.image),
      title: toNullableString(item?.imageTitle),
      relatedField: toNullableString(item?.iemSpchcknNm),
    }))
    .filter(
      (entry): entry is { url: string; title: string | null; relatedField: string | null } =>
        entry.url !== null,
    );
}

/**
 * 응답 envelope은 실제 호출로 확인됨: service 바로 아래에 공통/상세/병원체/이미지 필드가
 * 모두 평탄하게 온다(예: {"service":{"cropName":"배","sickNameKor":"...","virusList":[...]}}).
 * service.item으로 한 번 더 감싸져 오는 경우까지 방어적으로 대비한다.
 * 공통 필드(cropName/sickNameKor/sickNameChn/sickNameEng)가 하나도 없으면 데이터 없음으로 본다.
 */
function extractDetailRecord(data: unknown): NcpmsDiseaseDetailRaw | null {
  const root = data as Record<string, unknown> | null | undefined;
  const service = root?.service as Record<string, unknown> | undefined;
  if (!service) return null;

  const record = (
    service.item && typeof service.item === "object" && !Array.isArray(service.item)
      ? service.item
      : service
  ) as NcpmsDiseaseDetailRaw;

  const hasContent = Boolean(
    record.cropName || record.sickNameKor || record.sickNameChn || record.sickNameEng,
  );
  return hasContent ? record : null;
}

function toNormalizedDetail(
  raw: NcpmsDiseaseDetailRaw,
  sickKey: string,
): NormalizedDiseaseDetail {
  return {
    id: sickKey,
    cropName: toNullableString(raw.cropName),
    nameKor: raw.sickNameKor ?? "",
    nameChn: toNullableString(raw.sickNameChn),
    nameEng: toNullableString(raw.sickNameEng),
    infectionRoute: toNullableString(raw.infectionRoute),
    developmentCondition: toNullableString(raw.developmentCondition),
    symptoms: toNullableString(raw.symptoms),
    preventionMethod: toNullableString(raw.preventionMethod),
    biologicalControlMethod: toNullableString(raw.biologyPrvnbeMth),
    chemicalControlMethod: toNullableString(raw.chemicalPrvnbeMth),
    pathogenNames: toPathogenNames(raw.virusList),
    pathogenFeatures: toPathogenFeatures(raw.virusList),
    pathogenImages: toPathogenImages(raw.virusImgList),
    diseaseImages: toDiseaseImages(raw.imageList),
    etc: toNullableString(raw.etc),
    source: "NCPMS",
  };
}

/**
 * NCPMS 병 상세정보 서비스(SVC05) 원본 응답을 NormalizedDiseaseDetail로 정규화하는 순수 함수.
 * 네트워크 호출과 분리되어 있어 샘플 응답으로 단위 검증이 가능하다(runDiseaseDetailSelfChecks 참고).
 * 명세에 없는 필드(위험도 등)는 채우지 않는다. 데이터가 없으면 null을 반환한다.
 */
export function normalizeDiseaseDetailResponse(
  data: unknown,
  sickKey: string,
): NormalizedDiseaseDetail | null {
  throwIfNcpmsError(data);

  const raw = extractDetailRecord(data);
  if (!raw) return null;

  return toNormalizedDetail(raw, sickKey);
}

/**
 * NCPMS 병 상세정보 서비스(SVC05) 호출.
 * 문서에는 sickKey가 Integer로 되어 있으나 SVC01 실제 응답에서 "D00000318" 같은 문자열이
 * 확인되었으므로 항상 string으로 다룬다.
 */
export async function getDiseaseDetail(
  sickKey: string,
): Promise<NormalizedDiseaseDetail | null> {
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
    return null;
  }

  const url = new URL(NCPMS_BASE_URL);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("serviceCode", "SVC05");
  url.searchParams.set("sickKey", sickKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`NCPMS 병 상세정보 API 응답 오류: HTTP ${res.status}`);
  }

  // Content-Type이 application/xml로 잘못 표시돼도 body는 JSON이라 res.json()이 그대로 동작한다(SVC01과 동일).
  const data = (await res.json()) as unknown;
  return normalizeDiseaseDetailResponse(data, sickKey);
}

export interface DiseaseDetailSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * 실제 API 키 없이 normalizeDiseaseDetailResponse()의 매핑 정확성을 점검한다.
 * 샘플 값은 필드 매핑 검증용 테스트 픽스처이며(실제 호출로 확인한 응답 구조를 반영),
 * 실제 NCPMS 데이터가 아니다.
 */
export function runDiseaseDetailSelfChecks(): DiseaseDetailSelfCheckResult[] {
  const results: DiseaseDetailSelfCheckResult[] = [];

  const fullResponse = {
    service: {
      buildTime: "2026-07-23 10:00:00",
      cropName: "배",
      sickNameKor: "검은별무늬병",
      sickNameChn: "黑星病",
      sickNameEng: "Scab",
      infectionRoute: "빗물, 바람에 의한 포자 전파",
      developmentCondition: "봄철 저온다습",
      symptoms: "잎과 과실에 검은 별 모양 병반 형성",
      preventionMethod: "전정 후 병든 가지 제거",
      biologyPrvnbeMth: "저항성 품종 재배",
      chemicalPrvnbeMth: "적용 약제 살포",
      etc: "",
      virusList: [
        { virusName: " Venturia nashicola   ", sfeNm: "자낭균" },
        { virusName: "Venturia pyrina", sfeNm: "" },
      ],
      virusImgList: [
        { image: "https://ncpms.rda.go.kr/virus/1.jpg", imageTitle: "병원체 현미경 사진" },
        { image: "https://ncpms.rda.go.kr/virus/2.jpg" },
      ],
      imageList: [
        { image: "https://ncpms.rda.go.kr/disease/1.jpg", imageTitle: "잎 병반", iemSpchcknNm: "잎" },
        { image: "https://ncpms.rda.go.kr/disease/2.jpg" },
      ],
    },
  };

  const detail = normalizeDiseaseDetailResponse(fullResponse, "D00000662");

  results.push({
    label: "1. 정상 상세 응답이 NormalizedDiseaseDetail로 매핑됨",
    passed: detail !== null && detail.nameKor === "검은별무늬병",
    message: JSON.stringify(detail),
  });

  results.push({
    label: "2. sickKey가 그대로 문자열 id로 유지됨(요청 시 넘긴 값 그대로)",
    passed: detail?.id === "D00000662",
    message: `id=${JSON.stringify(detail?.id)}`,
  });

  const missingFieldsResponse = {
    service: { cropName: "배", sickNameKor: "검은별무늬병" },
  };
  const missingDetail = normalizeDiseaseDetailResponse(missingFieldsResponse, "D00000662");

  results.push({
    label: "3. 누락된 문자열 필드는 null로 처리됨(임의 값 채우지 않음)",
    passed:
      missingDetail?.symptoms === null &&
      missingDetail?.preventionMethod === null &&
      missingDetail?.etc === null,
    message: JSON.stringify(missingDetail),
  });

  const singleVirusResponse = {
    service: {
      cropName: "배",
      sickNameKor: "검은별무늬병",
      virusList: { virusName: "Venturia nashicola", sfeNm: "자낭균" },
    },
  };
  const singleVirusDetail = normalizeDiseaseDetailResponse(singleVirusResponse, "x");

  results.push({
    label: "4. 단일 객체 virusList(배열 아님)가 string[]로 변환됨",
    passed:
      singleVirusDetail?.pathogenNames.length === 1 &&
      singleVirusDetail?.pathogenNames[0] === "Venturia nashicola",
    message: JSON.stringify(singleVirusDetail?.pathogenNames),
  });

  results.push({
    label: "5. 다중 virusList 배열(2건)이 그대로 처리되고 앞뒤 공백이 제거됨",
    passed:
      detail?.pathogenNames.length === 2 &&
      detail.pathogenNames[0] === "Venturia nashicola" &&
      detail.pathogenNames[1] === "Venturia pyrina",
    message: JSON.stringify(detail?.pathogenNames),
  });

  results.push({
    label: "6. pathogen image 2건 중 title 없는 항목은 null (인덱스 zip이 아니라 항목별 매핑)",
    passed:
      detail?.pathogenImages.length === 2 &&
      detail.pathogenImages[0]?.title === "병원체 현미경 사진" &&
      detail.pathogenImages[1]?.title === null,
    message: JSON.stringify(detail?.pathogenImages),
  });

  results.push({
    label: "7. disease image 2건 중 title/relatedField 없는 항목은 null, 있는 항목은 유지",
    passed:
      detail?.diseaseImages.length === 2 &&
      detail.diseaseImages[0]?.title === "잎 병반" &&
      detail.diseaseImages[0]?.relatedField === "잎" &&
      detail.diseaseImages[1]?.title === null &&
      detail.diseaseImages[1]?.relatedField === null,
    message: JSON.stringify(detail?.diseaseImages),
  });

  const noImageResponse = {
    service: { cropName: "배", sickNameKor: "검은별무늬병" },
  };
  const noImageDetail = normalizeDiseaseDetailResponse(noImageResponse, "x");

  results.push({
    label: "8. 이미지 목록이 없으면 빈 배열로 처리됨",
    passed:
      Array.isArray(noImageDetail?.pathogenImages) &&
      noImageDetail?.pathogenImages.length === 0 &&
      Array.isArray(noImageDetail?.diseaseImages) &&
      noImageDetail?.diseaseImages.length === 0,
    message: JSON.stringify({
      pathogenImages: noImageDetail?.pathogenImages,
      diseaseImages: noImageDetail?.diseaseImages,
    }),
  });

  const errorResponse = {
    service: { errorCode: "ERR_101", errorMsg: "인증키가 등록되지 않았습니다." },
  };

  let errorMessage = "";
  try {
    normalizeDiseaseDetailResponse(errorResponse, "x");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  results.push({
    label: "9. ERR_101(인증키 누락) 응답 시 에러를 던짐",
    passed: errorMessage.includes("ERR_101"),
    message: errorMessage,
  });

  const emptyResponse = { service: {} };
  const emptyDetail = normalizeDiseaseDetailResponse(emptyResponse, "x");

  results.push({
    label: "10. 빈 응답(공통 필드 없음) → null 반환",
    passed: emptyDetail === null,
    message: JSON.stringify(emptyDetail),
  });

  results.push({
    label: "11. source는 항상 리터럴 'NCPMS'",
    passed: detail?.source === "NCPMS",
    message: `source=${JSON.stringify(detail?.source)}`,
  });

  return results;
}
