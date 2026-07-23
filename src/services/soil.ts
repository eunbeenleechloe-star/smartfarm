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
 * 농촌진흥청 국립농업과학원_토양검정 화학성 상세정보(pH·EC 실측값, BJD_Code로 지역 조회).
 * 농경지화학성 통계정보(V2)는 공식 기술명세서를 확보하지 못해 연동하지 않는다(CLAUDE.md 규칙 4).
 */
const SOIL_EXAM_LIST_URL = "https://apis.data.go.kr/1390802/SoilEnviron/SoilExam/getSoilExamList";
/** 농촌진흥청 국립농업과학원_토양도 기반 토양특성 상세정보(V2). PNU_Code 필요. */
const SOIL_CHARAC_URL =
  "https://apis.data.go.kr/1390802/SoilEnviron/SoilCharac/V2/getSoilCharacter";

interface SoilExamItem {
  pnuCode: string | undefined;
  examDay: string | undefined;
  ph: number | null;
  ec: number | null;
}

async function fetchSoilExamList(serviceKey: string, bjdCode: string): Promise<SoilExamItem[]> {
  const xml = await fetchPublicApiXml(SOIL_EXAM_LIST_URL, {
    serviceKey,
    BJD_Code: bjdCode,
    Page_No: 1,
    Page_Size: 100,
  });

  const status = parseXmlResultStatus(xml);
  if (isNoDataResult(status)) return [];
  if (!status.ok) {
    throw new PublicApiError(
      `토양검정 화학성 API 오류: ${status.code ?? "UNKNOWN"} ${status.message ?? ""}`,
    );
  }

  return parseXmlItems(xml).map((item) => ({
    pnuCode: item.PNU_Code,
    examDay: item.Exam_Day,
    ph: parseFloatOrNull(item.ACID),
    ec: parseFloatOrNull(item.SELC),
  }));
}

/** 배수등급 코드(01~06). 99/미확인은 null로 유지한다. */
const DRAINAGE_LABEL: Record<string, string> = {
  "01": "매우양호",
  "02": "양호",
  "03": "약간양호",
  "04": "약간불량",
  "05": "불량",
  "06": "매우불량",
};

/** 표토토성 코드(01~09). 99/미확인은 null로 유지한다. */
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

/** 유효토심 코드는 "0-25cm"류의 구간이라 하한값만 대표값으로 쓴다(임의 추정 아님, 공식 코드 정의의 하한). */
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

async function fetchSoilCharacByPnu(
  serviceKey: string,
  pnuCode: string,
): Promise<SoilCharacResult> {
  const xml = await fetchPublicApiXml(SOIL_CHARAC_URL, { serviceKey, PNU_Code: pnuCode });

  const status = parseXmlResultStatus(xml);
  if (isNoDataResult(status) || !status.ok) {
    if (!status.ok && !isNoDataResult(status)) {
      throw new PublicApiError(
        `토양도 기반 토양특성 API 오류: ${status.code ?? "UNKNOWN"} ${status.message ?? ""}`,
      );
    }
    return { texture: null, drainage: null, effectiveDepthCm: null };
  }

  const item = parseXmlItems(xml)[0];
  if (!item) return { texture: null, drainage: null, effectiveDepthCm: null };

  return {
    texture: TEXTURE_LABEL[item.Surtture_Code ?? ""] ?? null,
    drainage: DRAINAGE_LABEL[item.Soildra_Code ?? ""] ?? null,
    effectiveDepthCm: EFFECTIVE_DEPTH_MIN_CM[item.Vldsoildep_Code ?? ""] ?? null,
  };
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function mockSoilWithReason(location: LocationInput, reason: string): SoilData {
  return {
    ...mockSoil,
    source: `${mockSoil.source} (${location.address}, ${reason})`,
  };
}

/**
 * API 담당자는 이 함수 내부만 구현하면 됩니다.
 * pH/EC/토성 값이 없으면 null을 유지하세요.
 */
export async function getSoil(location: LocationInput): Promise<SoilData> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const serviceKey = firstEnv(
    "SOIL_API_KEY",
    "SOIL_CHEMISTRY_API_KEY",
    "SOIL_MAP_DETAIL_API_KEY",
  );

  if (useMock) {
    return mockSoilWithReason(location, "mock 모드");
  }
  if (!serviceKey) {
    return mockSoilWithReason(location, "SOIL_API_KEY 미설정");
  }

  const bjdCodes = resolveProvinceBjdCodes(location);
  if (!bjdCodes) {
    return mockSoilWithReason(location, "법정동코드(시도) 확인 불가");
  }

  const key = normalizeServiceKey(serviceKey);

  try {
    let items: SoilExamItem[] = [];
    for (const bjdCode of bjdCodes) {
      items = await fetchSoilExamList(key, bjdCode);
      if (items.length > 0) break;
    }
    if (items.length === 0) {
      return mockSoilWithReason(location, "토양검정 화학성 조회 결과 없음(OK_NO_DATA_ERROR)");
    }

    const phValues = items.map((item) => item.ph).filter((v): v is number => v !== null);
    const ecValues = items.map((item) => item.ec).filter((v): v is number => v !== null);
    const latestExamDay = items
      .map((item) => item.examDay)
      .filter((v): v is string => !!v)
      .sort()
      .at(-1);

    // 토양도 기반 토양특성(V2)은 PNU_Code가 필요하다. 조회된 표본 중 하나의 PNU를
    // 해당 지역의 대표 필지로 사용한다(사용자가 지정한 정확한 필지가 아님을 source에 명시).
    let characteristics: SoilCharacResult = {
      texture: null,
      drainage: null,
      effectiveDepthCm: null,
    };
    const representativePnu = items.find((item) => item.pnuCode)?.pnuCode;
    if (representativePnu) {
      try {
        characteristics = await fetchSoilCharacByPnu(key, representativePnu);
      } catch {
        // 토성/배수/유효토심 조회 실패는 pH/EC 실측값까지 mock으로 되돌리지 않고 null로만 남긴다.
      }
    }

    return {
      ph: average(phValues),
      ecDsM: average(ecValues),
      texture: characteristics.texture,
      drainage: characteristics.drainage,
      effectiveDepthCm: characteristics.effectiveDepthCm,
      dataLevel: "city",
      source:
        `농촌진흥청 국립농업과학원_토양검정 화학성 상세정보(pH·EC, 표본 ${items.length}개 평균)` +
        (representativePnu
          ? " + 토양도 기반 토양특성 상세정보(대표 필지 기준 토성/배수등급/유효토심)"
          : "") +
        ` - ${location.address}`,
      observedAt: latestExamDay
        ? `${latestExamDay.slice(0, 4)}-${latestExamDay.slice(4, 6)}-${latestExamDay.slice(6, 8)}`
        : null,
      isMock: false,
    };
  } catch (error) {
    return mockSoilWithReason(
      location,
      `실제 API 실패: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
