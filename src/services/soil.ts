import type { LocationInput, SoilData, SoilParcelStatus } from "@/types/analysis";
import { mockSoil } from "@/mocks/soil";
import {
  fetchPublicApiXml,
  firstEnv,
  isNoDataResult,
  maskedKeyPreview,
  normalizeServiceKey,
  parseFloatOrNull,
  parseXmlItems,
  parseXmlResultStatus,
  PublicApiError,
} from "./shared/publicApi";
import { buildPnu } from "./shared/pnu";
import { resolveVerifiedStdgCode } from "./shared/regionCode";

const STDG_CODE_PATTERN = /^\d{10}$/;

/**
 * 조회에 사용할 10자리 STDG_CD를 결정한다.
 * 1) location.stdgCode(전국 법정동 검색에서 선택된 값)를 최우선 사용 — 정확히 10자리인지 검증한다.
 * 2) 없으면 SOIL_REGION_MAPPINGS(이전 수동 매핑, 호환용 fallback)를 시도한다.
 * 3) 둘 다 없으면 null — 이 경우 외부 API를 호출하지 않는다(시도 단위 코드로 대체하지 않음).
 *
 * 법정동 검색(legalDistrictSearch)은 시도/시군구 단위 후보를 애초에 제외하므로, 여기서 나오는
 * 코드는 항상 읍면동/리 단위다 — SoilCharac(필지 조회)용 PNU를 구성할 legalDistrictCode로도
 * 그대로 쓸 수 있다.
 */
function resolveStdgCode(location: LocationInput): string | null {
  if (location.stdgCode && STDG_CODE_PATTERN.test(location.stdgCode)) {
    return location.stdgCode;
  }
  return resolveVerifiedStdgCode(location);
}

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
 * "정밀 분석"(location.parcel)에서만 호출한다. 실호출로 확인한 실제 응답 필드명(2026-07):
 * 요청 파라미터는 여전히 PNU_CD, 응답 필드는 `Surtture_Cd`/`Soildra_Cd`/`Vldsoildep_Cd`다
 * (공식 기술명세서의 `_Code` 표기와 달리 실제 응답은 `_Cd`로 끝난다 — 실호출 없이 명세서만
 * 보고 필드명을 정하지 않는다). 필지에 등록된 값이 없어도 Result_Code=200(정상)이며 각 필드가
 * 빈 문자열로 오므로, 이 경우도 무데이터로 처리한다(호출부가 값 유무로 판단).
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
 * 검증된 19자리 PNU_CD로 필지 단위 토양 물리 특성(토성/배수/유효토심)을 조회한다.
 * 추측 PNU로 호출해서는 안 된다 — 호출부(resolveParcelCharacteristics)가 buildPnu()로
 * 형식을 검증한 값만 넘긴다.
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
    texture: TEXTURE_LABEL[item.Surtture_Cd ?? ""] ?? null,
    drainage: DRAINAGE_LABEL[item.Soildra_Cd ?? ""] ?? null,
    effectiveDepthCm: EFFECTIVE_DEPTH_MIN_CM[item.Vldsoildep_Cd ?? ""] ?? null,
  };
}

/** getSoil()이 실제로 쓰는 외부 호출 묶음. 자체 검증(self-check)에서 스텁으로 교체한다. */
export interface SoilServiceDeps {
  fetchSoilExamList: typeof fetchSoilExamList;
  fetchSoilCharacByPnu: typeof fetchSoilCharacByPnu;
}

const defaultDeps: SoilServiceDeps = { fetchSoilExamList, fetchSoilCharacByPnu };

/** 숫자 배열의 평균값을 계산한다. 값이 없으면 null을 반환한다. */
function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

/** chemistry(지역 화학성) 조회 결과. texture/drainage/effectiveDepthCm은 항상 null이다
 * (그 세 값은 parcel 조회 전용 — getSoil()이 필요할 때만 parcel 결과로 덮어쓴다). */
type ChemistryResolution = Omit<SoilData, "parcel">;

/**
 * 실제 API를 사용할 수 없을 때 mock 화학성 데이터와 이유를 함께 반환한다.
 */
function mockChemistryWithReason(
  location: LocationInput,
  reason: string,
): ChemistryResolution {
  return {
    ...mockSoil,
    source: `${mockSoil.source} (${location.address}, ${reason})`,
    dataStatus: "mock",
  };
}

/**
 * 실제 API가 정상 응답했지만(Result_Code=301) 해당 지역에 최근 표본이 없을 때 반환한다.
 * mock이 아니다 — pH/EC를 null로 유지하고(0이나 mock 값으로 대체하지 않음), scoring에서는
 * 결측으로 자동 제외된다(cropScoring의 null 처리 그대로 적용).
 */
function noDataChemistry(location: LocationInput, stdgCode: string): ChemistryResolution {
  return {
    ph: null,
    ecDsM: null,
    texture: null,
    drainage: null,
    effectiveDepthCm: null,
    dataLevel: "district",
    source:
      `농촌진흥청 국립농업과학원 토양검정 화학성 상세정보` +
      ` - 최근 3년 내 해당 지역(STDG_CD=${stdgCode}) 표본 없음` +
      ` - ${location.address}`,
    observedAt: null,
    isMock: false,
    dataStatus: "no-data",
  };
}

/**
 * 지역 토양 화학성(pH·EC)을 조회한다. "간편 분석"/"정밀 분석" 공통이며, 필지(parcel) 조회와
 * 완전히 독립적이다 — 이 함수의 성공/실패는 parcel 쪽 결과에 영향을 주지 않는다.
 *
 * 값이 없으면 임의로 생성하지 않고 null을 유지한다.
 */
async function resolveChemistry(
  location: LocationInput,
  deps: SoilServiceDeps,
): Promise<ChemistryResolution> {
  const serviceKey = firstEnv(
    "SOIL_API_KEY",
    "SOIL_CHEMISTRY_API_KEY",
    "SOIL_MAP_DETAIL_API_KEY",
  );

  if (!serviceKey) {
    return mockChemistryWithReason(location, "토양 API 인증키 미설정");
  }

  const stdgCode = resolveStdgCode(location);

  if (!stdgCode) {
    return mockChemistryWithReason(location, "읍면동 법정동코드 확인 불가");
  }

  const normalizedKey = normalizeServiceKey(serviceKey);
  console.log(
    `[soil] SOIL_API_KEY/SOIL_CHEMISTRY_API_KEY/SOIL_MAP_DETAIL_API_KEY 로드됨(화학성): ${maskedKeyPreview(normalizedKey)}`,
  );

  try {
    const items = await deps.fetchSoilExamList(normalizedKey, stdgCode);

    if (items.length === 0) {
      // 실제 API가 정상 응답했지만 표본이 없는 경우다(Result_Code=301) — mock이 아니다.
      return noDataChemistry(location, stdgCode);
    }

    const phValues = items.map((item) => item.ph).filter((value): value is number => value !== null);
    const ecValues = items.map((item) => item.ec).filter((value): value is number => value !== null);

    const latestExamDay = items
      .map((item) => item.examDay)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    const observedAt =
      latestExamDay && /^\d{8}$/.test(latestExamDay)
        ? `${latestExamDay.slice(0, 4)}-${latestExamDay.slice(4, 6)}-${latestExamDay.slice(6, 8)}`
        : null;

    return {
      ph: average(phValues),
      ecDsM: average(ecValues),
      texture: null,
      drainage: null,
      effectiveDepthCm: null,

      /**
       * 특정 필지의 직접 측정값이 아니라
       * 지역 표본을 활용한 결과이므로 city로 표시한다.
       */
      dataLevel: "city",

      source:
        `농촌진흥청 국립농업과학원 토양검정 화학성 상세정보` +
        ` (pH·EC만 실측, 표본 ${items.length}개 평균)` +
        ` - ${location.address}`,

      observedAt,
      isMock: false,
      dataStatus: "ok",
    };
  } catch (error) {
    return mockChemistryWithReason(
      location,
      `실제 API 실패: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

interface ParcelResolution {
  status: SoilParcelStatus;
  source: string | null;
  texture: string | null;
  drainage: string | null;
  effectiveDepthCm: number | null;
}

function emptyParcelResolution(status: SoilParcelStatus): ParcelResolution {
  return { status, source: null, texture: null, drainage: null, effectiveDepthCm: null };
}

/**
 * 필지(지번) 단위 토양특성(토성/배수/유효토심)을 조회한다. "정밀 분석"(location.parcel이 있을 때)
 * 에서만 동작하며, 지역 화학성(resolveChemistry) 성공/실패와 무관하게 독립적으로 처리한다 —
 * 한쪽 실패가 다른 쪽 성공 데이터를 지우지 않는다.
 *
 * 단순 문자열 조합만으로 그 지번이 실제 존재한다고 확정하지 않는다: 형식상 유효한 PNU를
 * 구성해 조회한 뒤, 응답에 값이 있으면 "ok", 정상 응답인데 값이 없으면 "no-data"로 구분한다
 * (존재하지 않는 필지라고 단정하지 않는다).
 */
async function resolveParcel(
  location: LocationInput,
  deps: SoilServiceDeps,
): Promise<ParcelResolution> {
  if (!location.parcel) {
    return emptyParcelResolution("not-requested");
  }

  const legalDistrictCode = resolveStdgCode(location);
  if (!legalDistrictCode) {
    return emptyParcelResolution("invalid-pnu");
  }

  const pnu = buildPnu({
    legalDistrictCode,
    mountain: location.parcel.mountain,
    mainNumber: location.parcel.mainNumber,
    subNumber: location.parcel.subNumber ?? null,
  });

  if (!pnu) {
    return emptyParcelResolution("invalid-pnu");
  }

  const characteristicsKey = firstEnv(
    "SOIL_MAP_DETAIL_API_KEY",
    "SOIL_API_KEY",
    "SOIL_CHEMISTRY_API_KEY",
  );

  if (!characteristicsKey) {
    return emptyParcelResolution("error");
  }

  const normalizedKey = normalizeServiceKey(characteristicsKey);
  console.log(
    `[soil] SOIL_MAP_DETAIL_API_KEY/SOIL_API_KEY/SOIL_CHEMISTRY_API_KEY 로드됨(필지): ${maskedKeyPreview(normalizedKey)}`,
  );

  try {
    const charac = await deps.fetchSoilCharacByPnu(normalizedKey, pnu);
    const hasAnyValue =
      charac.texture !== null || charac.drainage !== null || charac.effectiveDepthCm !== null;

    if (!hasAnyValue) {
      return emptyParcelResolution("no-data");
    }

    return {
      status: "ok",
      source:
        `농촌진흥청 국립농업과학원 토양도 기반 토양특성 상세정보` +
        ` (필지 단위 조회) - ${location.address}`,
      texture: charac.texture,
      drainage: charac.drainage,
      effectiveDepthCm: charac.effectiveDepthCm,
    };
  } catch {
    return emptyParcelResolution("error");
  }
}

/**
 * 지역 토양 정보를 조회한다.
 *
 * 반환 데이터:
 * - pH, EC: 토양검정 화학성 API(getSoilExamList)의 실측 표본 평균값. resolveChemistry() 담당.
 * - 토성, 배수등급, 유효토심: location.parcel(지번)이 있을 때만 검증된 19자리 PNU로 조회한다
 *   (resolveParcel()). 지번이 없으면("간편 분석") 항상 null이다 — 주소를 PNU로 추측·변환하지
 *   않는다.
 *
 * 값이 없으면 임의로 생성하지 않고 null을 유지한다.
 *
 * 화학성과 필지특성은 서로 독립적으로 조회된다 — 한쪽이 실패/무데이터여도 다른 쪽 성공 결과를
 * 버리지 않는다(예: 지역 표본이 없어도 필지 토성은 조회될 수 있고, 반대로 필지 정보가 없거나
 * 형식이 잘못돼도 지역 pH·EC는 그대로 유지된다).
 *
 * mock과 "정상 무데이터"는 다르다: 실제 API가 정상 응답했지만 해당 지역 표본이 없으면
 * (Result_Code=301) dataStatus="no-data"를 반환한다(isMock=false). mock은 mock 모드/키
 * 미설정/법정동코드 확인 불가/API 실패(네트워크·인증·파싱 오류)일 때만 쓴다.
 */
export async function getSoil(
  location: LocationInput,
  deps: SoilServiceDeps = defaultDeps,
): Promise<SoilData> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  if (useMock) {
    return {
      ...mockChemistryWithReason(location, "mock 모드"),
      parcel: { status: "not-requested", source: null },
    };
  }

  const [chemistry, parcel] = await Promise.all([
    resolveChemistry(location, deps),
    resolveParcel(location, deps),
  ]);

  const parcelRequested = location.parcel != null;

  return {
    ...chemistry,
    texture: parcelRequested ? parcel.texture : chemistry.texture,
    drainage: parcelRequested ? parcel.drainage : chemistry.drainage,
    effectiveDepthCm: parcelRequested ? parcel.effectiveDepthCm : chemistry.effectiveDepthCm,
    parcel: { status: parcel.status, source: parcel.source },
  };
}

export interface SoilSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * 실제 네트워크 호출 없이 getSoil()의 분기·병합 규칙을 점검한다.
 * fetchSoilExamList/fetchSoilCharacByPnu를 스텁으로 교체해 검증하며, 스텁 응답은 분기 검증용
 * 픽스처이지 실제 API 데이터가 아니다.
 */
/** 부동소수점 평균값 비교용(예: (7.3+7.1)/2는 7.199999999999999로 나올 수 있다). */
function isCloseTo(actual: number | null, expected: number): boolean {
  return actual !== null && Math.abs(actual - expected) < 1e-9;
}

export async function runSoilSelfChecks(): Promise<SoilSelfCheckResult[]> {
  const results: SoilSelfCheckResult[] = [];

  const location = {
    address: "서울특별시 종로구 청운동",
    stdgCode: "1111010100",
  };

  const okExamDeps: SoilServiceDeps = {
    fetchSoilExamList: async () => [
      { examDay: "20260427", ph: 7.3, ec: 0.4 },
      { examDay: "20260427", ph: 7.1, ec: 0.4 },
    ],
    fetchSoilCharacByPnu: async () => ({ texture: "양토", drainage: "양호", effectiveDepthCm: 25 }),
  };

  // 1. 지번 미입력("간편 분석") → parcel.status는 not-requested, texture/drainage/depth는 null
  const simple = await getSoil(location, okExamDeps);
  results.push({
    label: "1. 지번 미입력 시 간편 분석 유지(parcel=not-requested, texture 등 null)",
    passed:
      simple.dataStatus === "ok" &&
      isCloseTo(simple.ph, 7.2) &&
      simple.parcel?.status === "not-requested" &&
      simple.texture === null &&
      simple.drainage === null &&
      simple.effectiveDepthCm === null,
    message: `dataStatus=${simple.dataStatus}, ph=${simple.ph}, parcel=${JSON.stringify(simple.parcel)}, texture=${simple.texture}`,
  });

  // 2. SoilExam 성공 + SoilCharac 성공 → 지역 pH/EC와 필지 토성/배수/유효토심이 모두 채워짐
  const withParcel: LocationInput = {
    ...location,
    parcel: { mountain: false, mainNumber: 3, subNumber: null },
  };
  const both = await getSoil(withParcel, okExamDeps);
  results.push({
    label: "2. SoilExam 성공 + SoilCharac 성공 → pH/EC + 토성/배수/유효토심 모두 채워짐",
    passed:
      isCloseTo(both.ph, 7.2) &&
      both.parcel?.status === "ok" &&
      both.texture === "양토" &&
      both.drainage === "양호" &&
      both.effectiveDepthCm === 25 &&
      both.parcel?.source !== null,
    message: `ph=${both.ph}, parcel=${JSON.stringify(both.parcel)}, texture=${both.texture}`,
  });

  // 3. SoilExam 성공 + SoilCharac 무데이터(빈 값) → pH/EC 유지, 필지 3개만 null
  const charNoDataDeps: SoilServiceDeps = {
    fetchSoilExamList: okExamDeps.fetchSoilExamList,
    fetchSoilCharacByPnu: async () => ({ texture: null, drainage: null, effectiveDepthCm: null }),
  };
  const charNoData = await getSoil(withParcel, charNoDataDeps);
  results.push({
    label: "3. SoilCharac 무데이터 → pH/EC는 유지, 필지 3개만 null(전체 mock 아님)",
    passed:
      charNoData.dataStatus === "ok" &&
      isCloseTo(charNoData.ph, 7.2) &&
      charNoData.isMock === false &&
      charNoData.parcel?.status === "no-data" &&
      charNoData.texture === null,
    message: `dataStatus=${charNoData.dataStatus}, ph=${charNoData.ph}, parcel=${JSON.stringify(charNoData.parcel)}`,
  });

  // 4. SoilExam 무데이터 + SoilCharac 성공 → pH/EC는 null, 필지 특성은 별도로 채워짐
  const examNoDataDeps: SoilServiceDeps = {
    fetchSoilExamList: async () => [],
    fetchSoilCharacByPnu: okExamDeps.fetchSoilCharacByPnu,
  };
  const examNoData = await getSoil(withParcel, examNoDataDeps);
  results.push({
    label: "4. SoilExam 무데이터 + SoilCharac 성공 → pH/EC는 null, 필지 특성은 채워짐",
    passed:
      examNoData.dataStatus === "no-data" &&
      examNoData.ph === null &&
      examNoData.isMock === false &&
      examNoData.parcel?.status === "ok" &&
      examNoData.texture === "양토",
    message: `dataStatus=${examNoData.dataStatus}, ph=${examNoData.ph}, parcel=${JSON.stringify(examNoData.parcel)}, texture=${examNoData.texture}`,
  });

  // 5. SoilCharac API 오류(throw) → pH/EC는 그대로 유지, parcel.status=error
  const charErrorDeps: SoilServiceDeps = {
    fetchSoilExamList: okExamDeps.fetchSoilExamList,
    fetchSoilCharacByPnu: async () => {
      throw new Error("network fail");
    },
  };
  const charError = await getSoil(withParcel, charErrorDeps);
  results.push({
    label: "5. SoilCharac 오류 시 pH/EC 유지 + parcel.status=error(전체 mock 아님)",
    passed:
      charError.dataStatus === "ok" &&
      isCloseTo(charError.ph, 7.2) &&
      charError.isMock === false &&
      charError.parcel?.status === "error" &&
      charError.texture === null,
    message: `dataStatus=${charError.dataStatus}, ph=${charError.ph}, parcel=${JSON.stringify(charError.parcel)}`,
  });

  // 6. 잘못된 본번(범위 오류) → API 호출 없이 parcel.status=invalid-pnu, 기존 pH/EC는 유지
  let characCalled = false;
  const trackingDeps: SoilServiceDeps = {
    fetchSoilExamList: okExamDeps.fetchSoilExamList,
    fetchSoilCharacByPnu: async (...args) => {
      characCalled = true;
      return okExamDeps.fetchSoilCharacByPnu(...args);
    },
  };
  const invalidMain: LocationInput = {
    ...location,
    parcel: { mountain: false, mainNumber: 0, subNumber: null },
  };
  const invalid = await getSoil(invalidMain, trackingDeps);
  results.push({
    label: "6. 본번 범위 오류(0) → SoilCharac 호출 안 함, parcel.status=invalid-pnu, 간편 분석 유지",
    passed:
      !characCalled &&
      invalid.dataStatus === "ok" &&
      isCloseTo(invalid.ph, 7.2) &&
      invalid.parcel?.status === "invalid-pnu" &&
      invalid.texture === null,
    message: `characCalled=${characCalled}, dataStatus=${invalid.dataStatus}, parcel=${JSON.stringify(invalid.parcel)}`,
  });

  // 7. 법정동코드가 10자리가 아님(미확인 지역) → parcel.status=invalid-pnu
  const unresolvedLocation: LocationInput = {
    address: "존재하지않는가상의동네",
    parcel: { mountain: false, mainNumber: 1, subNumber: null },
  };
  const unresolved = await getSoil(unresolvedLocation, okExamDeps);
  results.push({
    label: "7. 법정동코드 확인 불가 + 지번 입력 → parcel.status=invalid-pnu(추측 PNU로 호출 안 함)",
    passed: unresolved.parcel?.status === "invalid-pnu",
    message: `parcel=${JSON.stringify(unresolved.parcel)}`,
  });

  return results;
}
