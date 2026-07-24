/**
 * PNU(19자리 지번코드) 구성·검증 유틸.
 *
 * 구조(공식 명세, 행정표준코드관리시스템 PNU 규격):
 * 법정동코드(10) + 산/일반 구분(1, 일반=1·산=2) + 본번(4, zero-pad) + 부번(4, zero-pad, 없음=0000)
 *
 * 이 모듈은 형식만 검증한다 — 실제로 그 지번이 존재하는지는 확인하지 않는다(주소 API 없음).
 * 존재 여부는 호출부(soil.ts)가 SoilCharac 응답으로 간접 확인해야 한다(무데이터 ≠ 존재하지 않음).
 */

const LEGAL_DISTRICT_CODE_PATTERN = /^\d{10}$/;
const MIN_PARCEL_NUMBER = 1;
const MAX_PARCEL_NUMBER = 9999;
const MIN_SUB_NUMBER = 0;
const MAX_SUB_NUMBER = 9999;

export interface BuildPnuInput {
  /** 검증된 10자리 법정동코드(읍면동/리 단위까지 선택된 경우만 — 시도/시군구 단위 코드는 여기서 걸러지지 않으니 호출부가 보장해야 한다). */
  legalDistrictCode: string;
  /** true면 산 지번(2), false면 일반 지번(1). */
  mountain: boolean;
  /** 본번. 1~9999. */
  mainNumber: number;
  /** 부번. 0~9999. 없으면 0(0000으로 채움). */
  subNumber?: number | null;
}

/**
 * 지번 구성 요소로 19자리 PNU 문자열을 만든다.
 * 아래 중 하나라도 유효하지 않으면 null을 반환한다(추측으로 채우지 않음):
 * - legalDistrictCode가 정확히 10자리 숫자가 아님
 * - mainNumber가 1~9999 범위를 벗어남(정수 아님 포함)
 * - subNumber가 주어졌는데 0~9999 범위를 벗어남(정수 아님 포함)
 */
export function buildPnu(input: BuildPnuInput): string | null {
  const { legalDistrictCode, mountain, mainNumber, subNumber } = input;

  if (!LEGAL_DISTRICT_CODE_PATTERN.test(legalDistrictCode)) {
    return null;
  }

  if (!Number.isInteger(mainNumber) || mainNumber < MIN_PARCEL_NUMBER || mainNumber > MAX_PARCEL_NUMBER) {
    return null;
  }

  const resolvedSubNumber = subNumber ?? 0;
  if (
    !Number.isInteger(resolvedSubNumber) ||
    resolvedSubNumber < MIN_SUB_NUMBER ||
    resolvedSubNumber > MAX_SUB_NUMBER
  ) {
    return null;
  }

  const pnu =
    legalDistrictCode +
    (mountain ? "2" : "1") +
    String(mainNumber).padStart(4, "0") +
    String(resolvedSubNumber).padStart(4, "0");

  return /^\d{19}$/.test(pnu) ? pnu : null;
}

export interface PnuSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/** 실제 API 호출 없이 buildPnu()의 조합·zero padding·검증 규칙을 점검한다. */
export function runPnuSelfChecks(): PnuSelfCheckResult[] {
  const results: PnuSelfCheckResult[] = [];

  const general = buildPnu({ legalDistrictCode: "1111010100", mountain: false, mainNumber: 3, subNumber: null });
  results.push({
    label: "1. 일반 지번 PNU 생성(부번 없음 → 0000)",
    passed: general === "1111010100100030000",
    message: `result=${general}`,
  });

  const withSub = buildPnu({ legalDistrictCode: "1111010100", mountain: false, mainNumber: 3, subNumber: 4 });
  results.push({
    label: "2. 일반 지번 + 부번 PNU 생성",
    passed: withSub === "1111010100100030004",
    message: `result=${withSub}`,
  });

  const mountain = buildPnu({ legalDistrictCode: "1111010100", mountain: true, mainNumber: 1, subNumber: null });
  results.push({
    label: "3. 산 지번 PNU 생성(산/일반 구분=2)",
    passed: mountain === "1111010100200010000",
    message: `result=${mountain}`,
  });

  const zeroPad = buildPnu({ legalDistrictCode: "4579025000", mountain: false, mainNumber: 7, subNumber: 12 });
  results.push({
    label: "4. 본번/부번 zero padding(7→0007, 12→0012)",
    passed: zeroPad === "4579025000100070012",
    message: `result=${zeroPad}`,
  });

  results.push({
    label: "5. 생성된 PNU는 정확히 19자리 숫자",
    passed: general !== null && /^\d{19}$/.test(general),
    message: `length=${general?.length}`,
  });

  const badCode = buildPnu({ legalDistrictCode: "451234", mountain: false, mainNumber: 1, subNumber: null });
  results.push({
    label: "6. 법정동코드가 10자리가 아니면 null",
    passed: badCode === null,
    message: `result=${badCode}`,
  });

  const zeroMain = buildPnu({ legalDistrictCode: "1111010100", mountain: false, mainNumber: 0, subNumber: null });
  results.push({
    label: "7. 본번 0은 범위 밖(1~9999) → null",
    passed: zeroMain === null,
    message: `result=${zeroMain}`,
  });

  const bigMain = buildPnu({ legalDistrictCode: "1111010100", mountain: false, mainNumber: 10000, subNumber: null });
  results.push({
    label: "8. 본번 10000은 범위 밖(1~9999) → null",
    passed: bigMain === null,
    message: `result=${bigMain}`,
  });

  const negativeSub = buildPnu({ legalDistrictCode: "1111010100", mountain: false, mainNumber: 1, subNumber: -1 });
  results.push({
    label: "9. 부번 음수는 범위 밖(0~9999) → null",
    passed: negativeSub === null,
    message: `result=${negativeSub}`,
  });

  const bigSub = buildPnu({ legalDistrictCode: "1111010100", mountain: false, mainNumber: 1, subNumber: 10000 });
  results.push({
    label: "10. 부번 10000은 범위 밖(0~9999) → null",
    passed: bigSub === null,
    message: `result=${bigSub}`,
  });

  const nonInteger = buildPnu({ legalDistrictCode: "1111010100", mountain: false, mainNumber: 3.5, subNumber: null });
  results.push({
    label: "11. 본번이 정수가 아니면 null",
    passed: nonInteger === null,
    message: `result=${nonInteger}`,
  });

  return results;
}
