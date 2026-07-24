import legalDistrictsData from "@/data/legalDistricts.json";

/**
 * scripts/buildLegalDistrictIndex.ts가 행정안전부 "법정동코드 전체자료"에서 전처리한
 * 전국 읍·면·동/리 검색 후보 1건. API 키 없이 서버 메모리에서 바로 검색한다.
 */
export interface LegalDistrictSearchItem {
  code: string;
  displayName: string;
  province: string;
  city: string | null;
  town: string | null;
  village: string | null;
  normalizedName: string;
  aliases: string[];
}

const ITEMS = legalDistrictsData as LegalDistrictSearchItem[];

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * displayName을 "시도 시군구 읍면동 리" 순서로 나눈 뒤, 앞부분(시도 등)을 뗀 꼬리 부분들을
 * 즉석에서 만든다("전라북도 고창군 고창읍" → "고창군 고창읍", "고창읍"). 빌드 시점에 저장하지
 * 않고 검색할 때마다 계산해 결과 JSON 용량을 줄인다.
 */
function tailPhrases(displayName: string): string[] {
  const parts = displayName.split(/\s+/).filter(Boolean);
  const phrases: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    phrases.push(parts.slice(i).join(" "));
  }
  return phrases;
}

type MatchTier = 0 | 1 | 2 | 3;

/**
 * 우선순위: 0=정확 일치 > 1=전체 이름 prefix 일치 > 2=별칭 일치(prefix) > 3=부분 일치.
 * 일치하지 않으면 null.
 */
function matchTier(item: LegalDistrictSearchItem, normalizedQuery: string): MatchTier | null {
  const normName = item.normalizedName;
  const aliasPool = [...item.aliases, ...tailPhrases(item.displayName)].map(stripSpaces);

  if (normName === normalizedQuery || aliasPool.includes(normalizedQuery)) return 0;
  if (normName.startsWith(normalizedQuery)) return 1;
  if (aliasPool.some((alias) => alias.startsWith(normalizedQuery))) return 2;
  if (normName.includes(normalizedQuery) || aliasPool.some((alias) => alias.includes(normalizedQuery))) return 3;
  return null;
}

/**
 * 전국 법정동 후보를 검색한다. 검색어가 2글자 미만이거나 비어 있으면 빈 배열을 반환하고
 * (전체 목록을 응답하지 않음), 공백 차이는 무시하며, 최대 10건까지만 반환한다.
 */
export function searchLegalDistricts(query: string): LegalDistrictSearchItem[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const normalizedQuery = stripSpaces(trimmed);
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return [];

  const matches: { item: LegalDistrictSearchItem; tier: MatchTier }[] = [];
  for (const item of ITEMS) {
    const tier = matchTier(item, normalizedQuery);
    if (tier !== null) matches.push({ item, tier });
  }

  matches.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.item.displayName.length !== b.item.displayName.length) {
      return a.item.displayName.length - b.item.displayName.length;
    }
    return a.item.displayName.localeCompare(b.item.displayName, "ko");
  });

  return matches.slice(0, MAX_RESULTS).map((m) => m.item);
}

export interface LegalDistrictSearchSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/** 실제 서버 없이 전처리 결과와 검색 규칙을 점검한다. */
export function runLegalDistrictSearchSelfChecks(): LegalDistrictSearchSelfCheckResult[] {
  const results: LegalDistrictSearchSelfCheckResult[] = [];

  results.push({
    label: "1. 전국 법정동 데이터가 전처리되어 로드됨(0건 아님)",
    passed: ITEMS.length > 1000,
    message: `총 후보 수=${ITEMS.length}`,
  });

  results.push({
    label: "2. 모든 코드가 정확히 10자리 숫자",
    passed: ITEMS.every((item) => /^\d{10}$/.test(item.code)),
    message: `샘플 코드=${ITEMS.slice(0, 3).map((i) => i.code).join(", ")}`,
  });

  results.push({
    label: "3. 광역(시도/시군구) 단위 코드는 후보에서 제외됨(예: 전라북도 자체, 고창군 자체)",
    passed:
      !ITEMS.some((item) => item.code === "4500000000") &&
      !ITEMS.some((item) => item.code === "4579000000"),
    message: "4500000000(전라북도), 4579000000(고창군) 모두 없어야 함",
  });

  results.push({
    label: "4. 폐지 지역 제외(부산직할시 등 구 명칭이 후보에 없음)",
    passed: !ITEMS.some((item) => item.displayName === "부산직할시"),
    message: "부산직할시(폐지) 항목이 없어야 함",
  });

  const exact = searchLegalDistricts("전라북도 고창군 고창읍");
  results.push({
    label: "5. 정확 검색('전라북도 고창군 고창읍') → 1순위로 4579025000",
    passed: exact[0]?.code === "4579025000",
    message: `results[0]=${JSON.stringify(exact[0])}`,
  });

  const partial = searchLegalDistricts("고창읍");
  results.push({
    label: "6. 부분 검색('고창읍') → 4579025000 포함",
    passed: partial.some((item) => item.code === "4579025000"),
    message: `results=${JSON.stringify(partial.map((i) => i.code))}`,
  });

  const legacyAlias = searchLegalDistricts("강원도 강릉시 강동면 모전리");
  results.push({
    label: "7. 개편 전 명칭 별칭 검색('강원도 강릉시 강동면 모전리') → 5115034022(신코드)",
    passed: legacyAlias[0]?.code === "5115034022",
    message: `results[0]=${JSON.stringify(legacyAlias[0])}`,
  });

  const renamedAlias = searchLegalDistricts("전북특별자치도 고창군 고창읍");
  results.push({
    label: "8. 개편 후 약칭 검색('전북특별자치도 고창군 고창읍') → 4579025000",
    passed: renamedAlias[0]?.code === "4579025000",
    message: `results[0]=${JSON.stringify(renamedAlias[0])}`,
  });

  const spaced = searchLegalDistricts("전라북도   고창군   고창읍");
  results.push({
    label: "9. 연속 공백 무시('전라북도   고창군   고창읍') → 4579025000",
    passed: spaced[0]?.code === "4579025000",
    message: `results[0]=${JSON.stringify(spaced[0])}`,
  });

  const broad = searchLegalDistricts("동");
  results.push({
    label: "10. 최대 결과 수 제한(넓은 검색어라도 10건 이하)",
    passed: broad.length <= 10,
    message: `results.length=${broad.length}`,
  });

  results.push({
    label: "11. 빈 검색어 → []",
    passed: searchLegalDistricts("").length === 0,
    message: `results=${JSON.stringify(searchLegalDistricts(""))}`,
  });

  results.push({
    label: "12. 최소 2글자 미만 검색어('고') → []",
    passed: searchLegalDistricts("고").length === 0,
    message: `results=${JSON.stringify(searchLegalDistricts("고"))}`,
  });

  results.push({
    label: "13. 존재하지 않는 지역명 → []",
    passed: searchLegalDistricts("존재하지않는가상의동네이름").length === 0,
    message: `results=${JSON.stringify(searchLegalDistricts("존재하지않는가상의동네이름"))}`,
  });

  return results;
}
