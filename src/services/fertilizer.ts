import type {
  CropId,
  FertilizerPrescription,
  LocationInput,
} from "@/types/analysis";
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
 *
 * 공식 확인된 코드만 입력한다.
 * 값이 없는 작물은 실제 API를 호출하지 않고 mock fallback을 사용한다.
 *
 * 아래 5개는 "작물별 비료 표준사용량 처방 정보" 공식 기술명세서의 비료표준작물코드표에서
 * 확인한 값이다(프로토타입 기본값 — 재배조건이 여러 개인 작물은 그중 하나를 대표로 선택함).
 * - apple: 09001 (사과 비옥지 1~4년)
 * - pear: 09011 (배 비옥지 1~4년)
 * - potato: 03001 (감자 준고냉지 및 고냉지)
 * - cucumber: 04009 (오이 노지재배)
 * - lettuce: 07001 (상추 노지재배)
 *
 * TODO: 현재는 CropId가 5개로 고정돼 있어 이 표를 상수로 직접 관리한다. 향후 지원 작물이
 * 늘어나 고정 목록을 벗어나면, 그때 별도의 작물코드 조회 API(예: 국립종자원_작물코드)를
 * 연동해 이 상수 표를 대체하는 것을 검토한다. 지금은 5개뿐이라 조회 API를 추가하지 않는다.
 */
const VERIFIED_CROP_CODES: Partial<Record<CropId, string>> = {
  apple: "09001",
  pear: "09011",
  potato: "03001",
  cucumber: "04009",
  lettuce: "07001",
};

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

  if (isNoDataResult(status)) {
    return null;
  }

  if (!status.ok) {
    throw new PublicApiError(
      `비료 표준사용량 처방 API 오류: ${
        status.code ?? "UNKNOWN"
      } ${status.message ?? ""}`,
    );
  }

  const item = parseXmlItems(xml)[0];

  if (!item) {
    return null;
  }

  return {
    preFertN: parseFloatOrNull(item.pre_Fert_N),
    preFertP: parseFloatOrNull(item.pre_Fert_P),
    preFertK: parseFloatOrNull(item.pre_Fert_K),
    postFertN: parseFloatOrNull(item.post_Fert_N),
    postFertP: parseFloatOrNull(item.post_Fert_P),
    postFertK: parseFloatOrNull(item.post_Fert_K),
  };
}

function sumOrNull(
  a: number | null,
  b: number | null,
): number | null {
  if (a === null && b === null) {
    return null;
  }

  return (a ?? 0) + (b ?? 0);
}

/**
 * kg/10a(1,000㎡) 기준 값을 실제 재배면적에 선형 환산한다.
 */
function scaleFromPer10a(
  ratePer10a: number | null,
  areaM2: number,
): number | null {
  if (ratePer10a === null) {
    return null;
  }

  return (ratePer10a * areaM2) / 1000;
}

function mockFertilizerWithReason(
  crop: CropId,
  location: LocationInput,
  areaM2: number | undefined,
  reason: string,
): FertilizerPrescription | null {
  const prescription = mockFertilizer[crop];

  if (!prescription) {
    return null;
  }

  return {
    ...prescription,
    기준면적M2: areaM2 ?? prescription.기준면적M2,
    source: `${prescription.source} (${location.address}, ${reason})`,
  };
}

/**
 * 비료 처방량을 LLM으로 생성하지 않는다.
 * 실제 공공 API 또는 공식 정적 fallback만 반환한다.
 */
export async function getFertilizer(
  crop: CropId,
  location: LocationInput,
  areaM2?: number,
): Promise<FertilizerPrescription | null> {
  const useMock =
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  const serviceKey = firstEnv("FERTILIZER_API_KEY");
  const cropCode = VERIFIED_CROP_CODES[crop];

  if (useMock) {
    return mockFertilizerWithReason(
      crop,
      location,
      areaM2,
      "mock 모드",
    );
  }

  if (!serviceKey) {
    return mockFertilizerWithReason(
      crop,
      location,
      areaM2,
      "FERTILIZER_API_KEY 미설정",
    );
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
    const rate = await fetchStandardFertilizerRate(
      normalizeServiceKey(serviceKey),
      cropCode,
    );

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
      nitrogenKg: scaleFromPer10a(
        sumOrNull(rate.preFertN, rate.postFertN),
        referenceAreaM2,
      ),
      phosphorusKg: scaleFromPer10a(
        sumOrNull(rate.preFertP, rate.postFertP),
        referenceAreaM2,
      ),
      potassiumKg: scaleFromPer10a(
        sumOrNull(rate.preFertK, rate.postFertK),
        referenceAreaM2,
      ),
      compostKg: null,
      limeKg: null,
      기준면적M2: referenceAreaM2,
      source:
        `농촌진흥청 국립농업과학원_작물별 비료 표준사용량 처방 정보` +
        `(getSoilFrtlzrQyList, fstd_Crop_Code=${cropCode})`,
      isFallback: false,
    };
  } catch (error) {
    return mockFertilizerWithReason(
      crop,
      location,
      areaM2,
      `실제 API 실패: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`,
    );
  }
}