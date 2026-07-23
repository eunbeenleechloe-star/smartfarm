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
