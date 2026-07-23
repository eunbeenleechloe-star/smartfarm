import type { CropId, FertilizerPrescription, LocationInput } from "@/types/analysis";
import { mockFertilizer } from "@/mocks/fertilizer";
import {
  fetchPublicApiXml,
  firstEnv,
  isNoDataResult,
  normalizeServiceKey,
  parseFloatOrNull,
  parseXmlItems,
  parseXmlResultStatus,
  PublicApiError,
} from "./shared/publicApi";

/** 농촌진흥청 국립농업과학원_작물별 비료 표준사용량 처방 정보. */
const FRTLZR_STD_USE_URL =
  "https://apis.data.go.kr/1390802/SoilEnviron/FrtlzrStdUse/getSoilFrtlzrQyList";

/**
 * getSoilFrtlzrQyList의 fstd_Crop_Code(작물코드).
 * 공개 문서·Swagger에서 확인 가능한 값은 "00001"(벼)뿐이며, 사과/배/오이/감자/상추의 공식
 * 코드는 어디에서도 확인하지 못했다(작물코드 목록 정보 API가 JS 전용 Swagger + hwpx 스펙이라
 * 코드값을 확인할 수 없었음). CLAUDE.md 규칙 4("공식 출처가 없는 작물 기준값을 임의 생성하지
 * 않는다")에 따라 값을 추측하지 않고 비워둔다.
 * data.go.kr 활용신청 후 실제 콘솔/작물코드 API(15160295)로 코드가 확인되면 여기 채워 넣는 것
 * 만으로 해당 작물의 실제 연동이 켜진다. 값이 없는 작물은 항상 mock으로 대체된다(rule 9 표시).
 */
const VERIFIED_CROP_CODES: Partial<Record<CropId, string>> = {};

interface FertilizerRate {
  preFertN: number | null;
  preFertP: number | null;
  preFertK: number | null;
  postFertN: number | null;
  postFertP: number | null;
  postFertK: number | null;
}

async function fetchStandardFertilizerRate(
  serviceKey: string,
  cropCode: string,
): Promise<FertilizerRate | null> {
  const xml = await fetchPublicApiXml(FRTLZR_STD_USE_URL, {
    serviceKey,
    fstd_Crop_Code: cropCode,
  });

  const status = parseXmlResultStatus(xml);
  if (isNoDataResult(status)) return null;
  if (!status.ok) {
    throw new PublicApiError(
      `비료 표준사용량 처방 API 오류: ${status.code ?? "UNKNOWN"} ${status.message ?? ""}`,
    );
  }

  const item = parseXmlItems(xml)[0];
  if (!item) return null;

  return {
    preFertN: parseFloatOrNull(item.pre_Fert_N),
    preFertP: parseFloatOrNull(item.pre_Fert_P),
    preFertK: parseFloatOrNull(item.pre_Fert_K),
    postFertN: parseFloatOrNull(item.post_Fert_N),
    postFertP: parseFloatOrNull(item.post_Fert_P),
    postFertK: parseFloatOrNull(item.post_Fert_K),
  };
}

function sumOrNull(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

/** kg/10a(1,000㎡) 기준 공식값을 실제 재배면적(㎡)에 선형 환산한다. 원본 처방값 자체는 그대로 사용한다. */
function scaleFromPer10a(ratePer10a: number | null, areaM2: number): number | null {
  if (ratePer10a === null) return null;
  return (ratePer10a * areaM2) / 1000;
}

function mockFertilizerWithReason(
  crop: CropId,
  location: LocationInput,
  areaM2: number | undefined,
  reason: string,
): FertilizerPrescription | null {
  const prescription = mockFertilizer[crop];
  if (!prescription) return null;
  return {
    ...prescription,
    기준면적M2: areaM2 ?? prescription.기준면적M2,
    source: `${prescription.source} (${location.address}, ${reason})`,
  };
}

/**
 * 비료 처방량을 LLM으로 생성하지 마세요.
 * API 또는 공식 정적 fallback만 반환해야 합니다.
 */
export async function getFertilizer(
  crop: CropId,
  location: LocationInput,
  areaM2?: number,
): Promise<FertilizerPrescription | null> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const serviceKey = firstEnv("FERTILIZER_API_KEY");
  const cropCode = VERIFIED_CROP_CODES[crop];

  if (useMock) {
    return mockFertilizerWithReason(crop, location, areaM2, "mock 모드");
  }
  if (!serviceKey) {
    return mockFertilizerWithReason(crop, location, areaM2, "FERTILIZER_API_KEY 미설정");
  }
  if (!cropCode) {
    return mockFertilizerWithReason(
      crop,
      location,
      areaM2,
      "작물코드(fstd_Crop_Code) 공식 확인 전이라 실제 API 미연동",
    );
  }

  try {
    const rate = await fetchStandardFertilizerRate(normalizeServiceKey(serviceKey), cropCode);
    if (!rate) {
      return mockFertilizerWithReason(
        crop,
        location,
        areaM2,
        "비료 처방 조회 결과 없음(OK_NO_DATA_ERROR)",
      );
    }

    const referenceAreaM2 = areaM2 ?? 1000;

    return {
      nitrogenKg: scaleFromPer10a(sumOrNull(rate.preFertN, rate.postFertN), referenceAreaM2),
      phosphorusKg: scaleFromPer10a(sumOrNull(rate.preFertP, rate.postFertP), referenceAreaM2),
      potassiumKg: scaleFromPer10a(sumOrNull(rate.preFertK, rate.postFertK), referenceAreaM2),
      compostKg: null, // 이 API는 퇴비량을 제공하지 않는다(벼 전용 getSoilFrtlzrExamRiceInfo에만 존재).
      limeKg: null, // 석회는 OpenAPI 응답에 없는 필드다(흙토람 웹 화면 전용 계산값).
      기준면적M2: referenceAreaM2,
      source: `농촌진흥청 국립농업과학원_작물별 비료 표준사용량 처방 정보(getSoilFrtlzrQyList, fstd_Crop_Code=${cropCode})`,
      isFallback: false,
    };
  } catch (error) {
    return mockFertilizerWithReason(
      crop,
      location,
      areaM2,
      `실제 API 실패: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
