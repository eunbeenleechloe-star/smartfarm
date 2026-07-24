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
import { resolveVerifiedStdgCode } from "./shared/regionCode";

/**
 * 농촌진흥청 국립농업과학원_토양검정 화학성 상세정보
 * - pH·EC 실측값 조회
 * - STDG_CD(법정동코드)를 이용한 지역 조회
 *
 * 농경지화학성 통계정보(V2)는 공식 기술명세서를 확보하지 못해
 * 현재 연동하지 않는다.
 * data.go.kr 데이터셋(15073569, V1)이 삭제되고 V2(15144647)로 이전되면서
 * 경로에 /V2/ 세그먼트가 추가됐다. 이 변경 전 경로는 게이트웨이가 "API not found"(404)로
 * 응답한다(승인/인증키 문제가 아니라 URL 자체가 없는 경로였음 — 2026-07 실호출로 확인).
 * 요청 파라미터명은 V1 시절의 BJD_Code가 아니라 STDG_CD다(공식 기술명세서 ver1.0으로 확인,
 * 2026-07 — BJD_Code로 보내면 Result_Code=204 PARAM_ESSENTIAL_ERROR가 난다).
 */
const SOIL_EXAM_LIST_URL =
  "https://apis.data.go.kr/1390802/SoilEnviron/SoilExam/V2/getSoilExamList";

/**
 * 농촌진흥청 국립농업과학원_토양도 기반 토양특성 상세정보
 * - 토성
 * - 배수등급
 * - 유효토심
 *
 * 조회 시 PNU_CD(19자리 지번코드)가 필요하다.
 * data.go.kr에서 V3(15144225)로 이전됐다 — V2 경로는 삭제되어 404가 난다(2026-07 실호출로 확인).
 *
 * 현재 이 앱에는 이 호출이 없다: getSoilExamList 실응답에는 PNU_Nm(주소 문자열)만 있고
 * PNU_Code(코드)는 제공되지 않아(2026-07 실호출로 확인), 검증된 19자리 PNU_CD를 얻을 경로가
 * 없다. 주소→PNU 변환(지오코딩)은 이 프로토타입 범위에 포함하지 않으므로, 검증된 PNU_CD가
 * 생기기 전까지 아래 fetchSoilCharacByPnu()는 어디서도 호출하지 않는다(추측 PNU로 호출 금지).
 */
const SOIL_CHARAC_URL =
  "https://apis.data.go.kr/1390802/SoilEnviron/SoilCharac/V3/getSoilCharacter";

interface SoilExamItem {
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
    STDG_CD: bjdCode,
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
    examDay: item.Exam_Day,
    ph: parseFloatOrNull(item.ACID),
    ec: parseFloatOrNull(item.ELCD),
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
 * 검증된 19자리 PNU_CD가 명시적으로 주어질 때만 호출해야 한다(추측 PNU 금지).
 * 현재 getSoil()에는 이 함수를 호출하는 코드가 없다 — 위 SOIL_CHARAC_URL 주석 참고.
 */
async function fetchSoilCharacByPnu(
  serviceKey: string,
  pnuCode: string,
): Promise<SoilCharacResult> {
  const xml = await fetchPublicApiXml(SOIL_CHARAC_URL, {
    serviceKey,
    PNU_CD: pnuCode,
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
 * - pH, EC: 토양검정 화학성 API(getSoilExamList)의 실측 표본 평균값.
 * - 토성, 배수등급, 유효토심: 검증된 19자리 필지 PNU 코드가 있어야 조회 가능한데,
 *   이 API 응답에는 PNU 코드가 없어(PNU_Nm 주소 문자열만 제공) 현재 항상 null이다.
 *   주소를 PNU로 추측·변환하지 않는다.
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

  const stdgCode = resolveVerifiedStdgCode(location);

  if (!stdgCode) {
    return mockSoilWithReason(
      location,
      "읍면동 법정동코드 확인 불가",
    );
  }

  const normalizedKey = normalizeServiceKey(serviceKey);

  try {
    const items = await fetchSoilExamList(
      normalizedKey,
      stdgCode,
    );

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

    /**
     * 토성/배수/유효토심은 검증된 19자리 PNU_CD가 있어야 조회할 수 있는데,
     * getSoilExamList 응답에는 PNU 코드가 없어(PNU_Nm 주소 문자열만 제공) 확보할 방법이
     * 없다. 주소를 PNU로 추측·변환하지 않으므로 항상 null이다(0이나 mock 값으로 대체 금지).
     */
    const characteristics: SoilCharacResult = {
      texture: null,
      drainage: null,
      effectiveDepthCm: null,
    };

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
        ` (pH·EC만 실측, 표본 ${items.length}개 평균` +
        ` — 토성·배수·유효토심은 필지 PNU 코드 미확보로 제공되지 않음)` +
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