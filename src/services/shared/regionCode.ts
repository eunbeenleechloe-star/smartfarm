import type { LocationInput } from "@/types/analysis";

/**
 * 법정동코드(행정표준코드관리시스템, code.go.kr) 시도 단위 앞 2자리.
 * 농촌진흥청 토양 API(SoilExam/SoilCharac)의 BJD_Code(10자리) 조회를 위해
 * 시도 단위까지만 채우고 나머지 8자리는 0으로 둔다(시군구 이하 정밀도는 지원하지 않음).
 *
 * 주의: 강원특별자치도(2023-06-11), 전북특별자치도(2024-01-18) 개편 이후에도
 * 기존에 생성된 법정동 레코드는 구코드(42/45)를 유지하는 경우가 있어 신주소 코드(51/52) 대신
 * 구코드를 우선 사용한다. 실제 응답이 비어 있으면 신코드로 재시도한다.
 */
export const PROVINCE_BJD_PREFIX: { names: string[]; code: string; altCode?: string }[] = [
  { names: ["서울"], code: "11" },
  { names: ["부산"], code: "26" },
  { names: ["대구"], code: "27" },
  { names: ["인천"], code: "28" },
  { names: ["경기"], code: "41" },
  { names: ["광주"], code: "29" },
  { names: ["대전"], code: "30" },
  { names: ["울산"], code: "31" },
  { names: ["세종"], code: "36" },
  { names: ["강원"], code: "42", altCode: "51" },
  { names: ["충북", "충청북도"], code: "43" },
  { names: ["충남", "충청남도"], code: "44" },
  { names: ["전북", "전라북도"], code: "45", altCode: "52" },
  { names: ["전남", "전라남도"], code: "46" },
  { names: ["경북", "경상북도"], code: "47" },
  { names: ["경남", "경상남도"], code: "48" },
  { names: ["제주"], code: "50" },
];

/**
 * 주소 문자열에서 시도명을 찾아 10자리 법정동코드(시군구 이하는 0으로 채움)를 반환한다.
 * 시군구 단위 정밀도가 필요하면(현재는 주소→PNU/BJD 지오코딩 API가 연동되어 있지 않음)
 * 이 값보다 더 구체적인 코드를 구할 별도 지오코딩 연동이 필요하다.
 */
export function resolveProvinceBjdCodes(location: LocationInput): string[] | null {
  const region = PROVINCE_BJD_PREFIX.find((candidate) =>
    candidate.names.some((name) => location.address.includes(name)),
  );
  if (!region) return null;

  const codes = [`${region.code}00000000`];
  if (region.altCode) codes.push(`${region.altCode}00000000`);
  return codes;
}

/** 토양검정 화학성 API(getSoilExamList)용 읍면동 단위 10자리 STDG_CD 매핑 1건. */
export interface SoilRegionMapping {
  displayName: string;
  aliases: string[];
  stdgCode: string;
}

/**
 * 프로토타입이 대표로 지원하는 지역의 검증된 읍면동 단위 법정동코드(STDG_CD, 10자리).
 *
 * 출처: 행정안전부 "법정동코드 전체자료"(공식 법정동코드 전체 목록, code.go.kr 배포본을
 * 그대로 옮긴 탭 구분 텍스트 — 법정동코드/법정동명/폐지여부 3열)에서
 * "전라북도 고창군 고창읍" 행을 확인함(2026-07). 해당 자료에는 "전라북도 고창군 고창읍" 하위
 * 법정리가 18개(읍내리~성두리, 25021~25038) 등록되어 있어 고창읍 자체의 코드(끝 3자리 000)인
 * 4579025000이 읍·면 단위 코드임을 교차 확인했다.
 * 전북특별자치도(2024-01-18 개편) 이후에도 이 법정동 레코드는 구코드(45)를 유지한다
 * (resolveProvinceBjdCodes의 강원/전북 구코드 우선 원칙과 동일한 근거).
 *
 * 여기 없는 지역은 전국 주소 검색으로 확장하지 않고 null을 반환한다 —
 * 확인되지 않은 코드를 임의로 만들어 채우지 않는다.
 */
export const SOIL_REGION_MAPPINGS: SoilRegionMapping[] = [
  {
    displayName: "전북특별자치도 고창군 고창읍",
    aliases: ["전라북도 고창군 고창읍", "전북 고창군 고창읍", "고창군 고창읍", "고창읍"],
    stdgCode: "4579025000",
  },
];

/** 앞뒤 공백을 제거하고 연속 공백을 한 칸으로 줄인다(주소 매칭 전 정규화). */
function normalizeAddressForMatch(address: string): string {
  return address.trim().replace(/\s+/g, " ");
}

/**
 * 주소 문자열이 SOIL_REGION_MAPPINGS에 등록된 지역(표시명 또는 별칭)과 일치하면
 * 검증된 10자리 STDG_CD를 반환한다. 등록되지 않은 지역은 null이며, 이 경우 호출부(soil.ts)는
 * 시도 단위 코드 등으로 대체하지 않고 API 호출 자체를 하지 않아야 한다.
 */
export function resolveVerifiedStdgCode(location: LocationInput): string | null {
  const address = normalizeAddressForMatch(location.address);

  for (const mapping of SOIL_REGION_MAPPINGS) {
    const candidates = [mapping.displayName, ...mapping.aliases];
    if (candidates.some((candidate) => address.includes(normalizeAddressForMatch(candidate)))) {
      return mapping.stdgCode;
    }
  }

  return null;
}

export interface RegionCodeSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/** SOIL_REGION_MAPPINGS/resolveVerifiedStdgCode()의 매칭 규칙을 실제 네트워크 호출 없이 점검한다. */
export function runRegionCodeSelfChecks(): RegionCodeSelfCheckResult[] {
  const results: RegionCodeSelfCheckResult[] = [];

  results.push({
    label: "1. 전체 주소 정확 일치(전북특별자치도 고창군 고창읍) → 4579025000",
    passed: resolveVerifiedStdgCode({ address: "전북특별자치도 고창군 고창읍" }) === "4579025000",
    message: `result=${JSON.stringify(resolveVerifiedStdgCode({ address: "전북특별자치도 고창군 고창읍" }))}`,
  });

  const aliasCases = ["전라북도 고창군 고창읍", "전북 고창군 고창읍", "고창군 고창읍", "고창읍"];
  for (const [index, alias] of aliasCases.entries()) {
    results.push({
      label: `2-${index + 1}. 별칭 일치("${alias}") → 4579025000`,
      passed: resolveVerifiedStdgCode({ address: alias }) === "4579025000",
      message: `result=${JSON.stringify(resolveVerifiedStdgCode({ address: alias }))}`,
    });
  }

  results.push({
    label: "3. 앞뒤 공백이 있어도 일치( '  고창읍  ' )",
    passed: resolveVerifiedStdgCode({ address: "  고창읍  " }) === "4579025000",
    message: `result=${JSON.stringify(resolveVerifiedStdgCode({ address: "  고창읍  " }))}`,
  });

  results.push({
    label: "4. 연속 공백이 있어도 일치('전북   고창군   고창읍')",
    passed: resolveVerifiedStdgCode({ address: "전북   고창군   고창읍" }) === "4579025000",
    message: `result=${JSON.stringify(resolveVerifiedStdgCode({ address: "전북   고창군   고창읍" }))}`,
  });

  results.push({
    label: "5. 미지원 지역(서울특별시 강남구) → null",
    passed: resolveVerifiedStdgCode({ address: "서울특별시 강남구" }) === null,
    message: `result=${JSON.stringify(resolveVerifiedStdgCode({ address: "서울특별시 강남구" }))}`,
  });

  results.push({
    label: "6. 등록된 모든 STDG_CD가 정확히 10자리 숫자",
    passed: SOIL_REGION_MAPPINGS.every((mapping) => /^\d{10}$/.test(mapping.stdgCode)),
    message: JSON.stringify(SOIL_REGION_MAPPINGS.map((m) => m.stdgCode)),
  });

  return results;
}
