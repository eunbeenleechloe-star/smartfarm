import type { LocationInput, SoilData } from "@/types/analysis";
import { mockSoil } from "@/mocks/soil";
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
import { resolveProvinceBjdCodes } from "./shared/regionCode";

/**
 * 농촌진흥청 국립농업과학원_토양검정 화학성 상세정보
 * - pH·EC 실측값 조회
 * - BJD_Code를 이용한 지역 조회
 *
 * 농경지화학성 통계정보(V2)는 공식 기술명세서를 확보하지 못해
 * 현재 연동하지 않는다.
 */
const SOIL_EXAM_LIST_URL =
  "https://apis.data.go.kr/1390802/SoilEnviron/SoilExam/getSoilExamList";

/**
 * 농촌진흥청 국립농업과학원_토양도 기반 토양특성 상세정보(V2)
 * - 토성
 * - 배수등급
 * - 유효토심
 *
 * 조회 시 PNU_Code가 필요하다.
 */
const SOIL_CHARAC_URL =
  "https://apis.data.go.kr/1390802/SoilEnviron/SoilCharac/V2/getSoilCharacter";

interface SoilExamItem {
  pnuCode: string | undefined;
  examDay: string | undefined;
  ph: number | null;
  ec: number | null;
}

/**
 * 지역 법정동코드를 기준으로 토양검정 화학성 정보를 조회한다.
 */
async function fetchSoilExamList(
  serviceKey: string,
  bjdCode: string,
): Promise<SoilExamItem[]> {
  const xml = await fetchPublicApiXml(SOIL_EXAM_LIST_URL, {
    serviceKey,
    BJD_Code: bjdCode,
    Page_No: 1,
    Page_Size: 100,
  });

  const status = parseXmlResultStatus(xml);

  if (isNoDataResult(status)) {
    return [];
  }

  if (!status.ok) {
    throw new PublicApiError(
      `토양검정 화학성 API 오류: ${
        status.code ?? "UNKNOWN"
      } ${status.message ?? ""}`,
    );
  }

  return parseXmlItems(xml).map((item) => ({
    pnuCode: item.PNU_Code,
    examDay: item.Exam_Day,
    ph: parseFloatOrNull(item.ACID),
    ec: parseFloatOrNull(item.SELC),
  }));
}

/**
 * 배수등급 코드.
 * 99 또는 미확인 값은 null로 유지한다.
 */
const DRAINAGE_LABEL: Record<string, string> = {
  "01": "매우양호",
  "02": "양호",
  "03": "약간양호",
  "04": "약간불량",
  "05": "불량",
  "06": "매우불량",
};

/**
 * 표토 토성 코드.
 * 99 또는 미확인 값은 null로 유지한다.
 */
const TEXTURE_LABEL: Record<string, string> = {
  "01": "양질조사토",
  "02": "양질세사토",
  "03": "양질사토",
  "04": "세사양토",
  "05": "사양토",
  "06": "양토",
  "07": "미사질양토",
  "08": "미사질식양토",
  "09": "식양토",
};

/**
 * 유효토심 코드의 구간 하한값.
 *
 * 예:
 * 01 → 0~25cm
 * 02 → 25~50cm
 * 03 → 50~100cm
 * 04 → 100cm 이상
 *
 * 공식 코드 정의의 하한값을 대표값으로 사용한다.
 */
const EFFECTIVE_DEPTH_MIN_CM: Record<string, number> = {
  "01": 0,
  "02": 25,
  "03": 50,
  "04": 100,
};

interface SoilCharacResult {
  texture: string | null;
  drainage: string | null;
  effectiveDepthCm: number | null;
}

/**
 * PNU 코드를 기준으로 토양 물리 특성을 조회한다.
 */
async function fetchSoilCharacByPnu(
  serviceKey: string,
  pnuCode: string,
): Promise<SoilCharacResult> {
  const xml = await fetchPublicApiXml(SOIL_CHARAC_URL, {
    serviceKey,
    PNU_Code: pnuCode,
  });

  const status = parseXmlResultStatus(xml);

  if (isNoDataResult(status)) {
    return {
      texture: null,
      drainage: null,
      effectiveDepthCm: null,
    };
  }

  if (!status.ok) {
    throw new PublicApiError(
      `토양도 기반 토양특성 API 오류: ${
        status.code ?? "UNKNOWN"
      } ${status.message ?? ""}`,
    );
  }

  const item = parseXmlItems(xml)[0];

  if (!item) {
    return {
      texture: null,
      drainage: null,
      effectiveDepthCm: null,
    };
  }

  return {
    texture:
      TEXTURE_LABEL[item.Surtture_Code ?? ""] ?? null,
    drainage:
      DRAINAGE_LABEL[item.Soildra_Code ?? ""] ?? null,
    effectiveDepthCm:
      EFFECTIVE_DEPTH_MIN_CM[item.Vldsoildep_Code ?? ""] ??
      null,
  };
}

/**
 * 숫자 배열의 평균값을 계산한다.
 * 값이 없으면 null을 반환한다.
 */
function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

/**
 * 실제 API를 사용할 수 없을 때 mock 토양 데이터와 이유를 함께 반환한다.
 */
function mockSoilWithReason(
  location: LocationInput,
  reason: string,
): SoilData {
  return {
    ...mockSoil,
    source: `${mockSoil.source} (${location.address}, ${reason})`,
  };
}

/**
 * 지역 토양 정보를 조회한다.
 *
 * 반환 데이터:
 * - pH
 * - EC
 * - 토성
 * - 배수등급
 * - 유효토심
 *
 * pH·EC는 해당 지역 토양검정 표본의 평균값이며,
 * 토성·배수·유효토심은 조회된 표본 중 대표 PNU를 이용한 참고값이다.
 *
 * 값이 없으면 임의로 생성하지 않고 null을 유지한다.
 */
export async function getSoil(
  location: LocationInput,
): Promise<SoilData> {
  const useMock =
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  const serviceKey = firstEnv(
    "SOIL_API_KEY",
    "SOIL_CHEMISTRY_API_KEY",
    "SOIL_MAP_DETAIL_API_KEY",
  );

  if (useMock) {
    return mockSoilWithReason(location, "mock 모드");
  }

  if (!serviceKey) {
    return mockSoilWithReason(
      location,
      "토양 API 인증키 미설정",
    );
  }

  const bjdCodes = resolveProvinceBjdCodes(location);

  if (!bjdCodes) {
    return mockSoilWithReason(
      location,
      "법정동코드 확인 불가",
    );
  }

  const normalizedKey = normalizeServiceKey(serviceKey);

  try {
    let items: SoilExamItem[] = [];

    for (const bjdCode of bjdCodes) {
      items = await fetchSoilExamList(
        normalizedKey,
        bjdCode,
      );

      if (items.length > 0) {
        break;
      }
    }

    if (items.length === 0) {
      return mockSoilWithReason(
        location,
        "토양검정 화학성 조회 결과 없음",
      );
    }

    const phValues = items
      .map((item) => item.ph)
      .filter(
        (value): value is number => value !== null,
      );

    const ecValues = items
      .map((item) => item.ec)
      .filter(
        (value): value is number => value !== null,
      );

    const latestExamDay = items
      .map((item) => item.examDay)
      .filter(
        (value): value is string => Boolean(value),
      )
      .sort()
      .at(-1);

    let characteristics: SoilCharacResult = {
      texture: null,
      drainage: null,
      effectiveDepthCm: null,
    };

    /**
     * 조회된 표본 중 PNU가 존재하는 첫 항목을
     * 해당 지역의 대표 필지로 사용한다.
     *
     * 사용자가 지정한 정확한 필지가 아니므로
     * source에 대표 필지 기준임을 명시한다.
     */
    const representativePnu = items.find(
      (item) => Boolean(item.pnuCode),
    )?.pnuCode;

    if (representativePnu) {
      try {
        characteristics =
          await fetchSoilCharacByPnu(
            normalizedKey,
            representativePnu,
          );
      } catch {
        /**
         * 물리적 토양정보 조회에 실패해도
         * 이미 조회한 pH·EC 정보는 유지한다.
         */
        characteristics = {
          texture: null,
          drainage: null,
          effectiveDepthCm: null,
        };
      }
    }

    const observedAt =
      latestExamDay &&
      /^\d{8}$/.test(latestExamDay)
        ? `${latestExamDay.slice(
            0,
            4,
          )}-${latestExamDay.slice(
            4,
            6,
          )}-${latestExamDay.slice(6, 8)}`
        : null;

    return {
      ph: average(phValues),
      ecDsM: average(ecValues),
      texture: characteristics.texture,
      drainage: characteristics.drainage,
      effectiveDepthCm:
        characteristics.effectiveDepthCm,

      /**
       * 특정 필지의 직접 측정값이 아니라
       * 지역 표본을 활용한 결과이므로 city로 표시한다.
       */
      dataLevel: "city",

      source:
        `농촌진흥청 국립농업과학원 토양검정 화학성 상세정보` +
        ` (pH·EC, 표본 ${items.length}개 평균)` +
        (representativePnu
          ? " + 토양도 기반 토양특성 상세정보(대표 필지 기준)"
          : "") +
        ` - ${location.address}`,

      observedAt,
      isMock: false,
    };
  } catch (error) {
    return mockSoilWithReason(
      location,
      `실제 API 실패: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`,
    );
  }
}