import fs from "node:fs";
import path from "node:path";

/**
 * 행정안전부 "법정동코드 전체자료"(scripts/legalDistrictSource.txt)를 전처리해
 * 검색에 필요한 최소 필드만 가진 src/data/legalDistricts.json을 생성한다.
 *
 * 실행: npx tsx scripts/buildLegalDistrictIndex.ts
 *
 * 원본은 법정동코드(10자리)/법정동명/폐지여부 3열 탭 구분 텍스트다(공식 배포 형식).
 * 원본 파일 자체는 클라이언트에 번들되지 않고, 이 스크립트가 만든 결과 JSON만
 * 서버 전용 검색 서비스(src/services/shared/legalDistrictSearch.ts)에서 사용한다.
 */

interface LegalDistrictSearchItem {
  code: string;
  displayName: string;
  province: string;
  city: string | null;
  town: string | null;
  village: string | null;
  normalizedName: string;
  aliases: string[];
}

const SOURCE_PATH = path.join(__dirname, "legalDistrictSource.txt");
const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "legalDistricts.json");

/**
 * 시도 개편/약칭 별칭. 원본 자료가 개편 이전 명칭(강원도/전라북도 등)만 갖고 있어도
 * 검색은 새 명칭·약칭으로도 되도록 지원한다. 법정동코드 자체는 원본 값을 그대로 쓴다
 * (코드를 임의로 만들지 않음) — 단, 아래 PROVINCE_CODE_REFORM에 해당하는 강원특별자치도는
 * 예외다(이유는 그 주석 참고).
 */
const PROVINCE_RENAME_ALIASES: Record<string, string[]> = {
  "강원도": ["강원특별자치도", "강원"],
  "전라북도": ["전북특별자치도", "전북"],
  "전라남도": ["전남"],
  "충청북도": ["충북"],
  "충청남도": ["충남"],
  "경상북도": ["경북"],
  "경상남도": ["경남"],
  "제주특별자치도": ["제주"],
  "서울특별시": ["서울"],
  "부산광역시": ["부산"],
  "대구광역시": ["대구"],
  "인천광역시": ["인천"],
  "광주광역시": ["광주"],
  "대전광역시": ["대전"],
  "울산광역시": ["울산"],
  "세종특별자치시": ["세종"],
  "경기도": ["경기"],
};

/**
 * 예외: 시도 코드 접두어 자체를 교체한다(원본 값을 그대로 쓴다는 원칙의 유일한 예외).
 *
 * 이유: 원본 "법정동코드 전체자료"는 강원특별자치도 개편(2023-06-11) 이전 스냅샷이라
 * 51(신) 코드가 아예 없고 42(구)만 있다. 그런데 SoilExam V2 실호출로 직접 확인한 결과
 * (2026-07), 공식 기술명세서 샘플인 STDG_CD=5115034022(신코드)는 Result_Code=200 +
 * 실제 표본 97건을 반환하지만, 완전히 동일한 필지의 구코드 4215034022는 Result_Code=301
 * (데이터 없음)이었다 — 즉 SoilExam V2는 강원 지역에 대해 신코드로만 실데이터를 찾는다.
 * 전라북도(45→52, 2024-01-18 개편)는 반대로 구코드(45)가 이미 이 프로젝트에서 실호출로
 * 동작 확인됐으므로(고창읍) 원칙대로 원본 값을 그대로 둔다 — 여기 추가하지 않는다.
 * 새로 시도를 추가할 때는 실제로 이런 증거가 있을 때만 등록한다.
 */
const PROVINCE_CODE_REFORM: Record<string, string> = {
  "42": "51",
};

/** PROVINCE_CODE_REFORM과 짝을 이루는 표시명 치환(구코드 접두어에 대응하는 구 시도명 → 신 시도명). */
const PROVINCE_NAME_REFORM: Record<string, string> = {
  "강원도": "강원특별자치도",
};

function stripSpaces(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * 코드의 시군구(3자리)/읍면동(3자리)/리(2자리) 구간이 전부 0이면
 * 시도 또는 시군구 단위의 광역 코드로 본다(SoilExam V2 조회 단위로 쓸 수 없음).
 */
function isBroadRegionCode(code: string): boolean {
  const sigungu = code.slice(2, 5);
  const eupMyeonDong = code.slice(5, 8);
  const ri = code.slice(8, 10);

  const isProvinceLevel = sigungu === "000" && eupMyeonDong === "000" && ri === "00";
  const isCountyLevel = !isProvinceLevel && eupMyeonDong === "000" && ri === "00";

  return isProvinceLevel || isCountyLevel;
}

/**
 * "전라북도 고창군 고창읍" 형태의 법정동명을 province/city/town/village로 분해한다.
 * 세종특별자치시처럼 시군구 단위가 없는 경우 city는 null이 된다(위치가 아니라 접미사로 판단).
 */
function parseName(name: string): {
  province: string;
  city: string | null;
  town: string | null;
  village: string | null;
} {
  const parts = name.split(/\s+/).filter(Boolean);
  const province = parts[0] ?? name;
  const rest = parts.slice(1);

  let village: string | null = null;
  let afterVillage = rest;
  const last = rest.at(-1);
  if (last && last.endsWith("리")) {
    village = last;
    afterVillage = rest.slice(0, -1);
  }

  let town: string | null = null;
  let cityParts = afterVillage;
  const lastOfRest = afterVillage.at(-1);
  if (lastOfRest && (lastOfRest.endsWith("읍") || lastOfRest.endsWith("면") || lastOfRest.endsWith("동"))) {
    town = lastOfRest;
    cityParts = afterVillage.slice(0, -1);
  }

  const city = cityParts.length > 0 ? cityParts.join(" ") : null;

  return { province, city, town, village };
}

/** displayName의 시도 부분을 별칭으로 바꿔치기한 변형들을 만든다(개편/약칭 지원). */
function buildProvinceAliasVariants(province: string, restJoined: string): string[] {
  const renameVariants = PROVINCE_RENAME_ALIASES[province] ?? [];
  return renameVariants.map((variant) => (restJoined ? `${variant} ${restJoined}` : variant));
}

/**
 * 원본 행 1건을 검색 항목으로 만든다.
 *
 * "고창군 고창읍", "고창읍"처럼 시도명을 뗀 부분 일치는 저장하지 않고 검색 시점에
 * displayName을 분해해 즉석으로 비교한다(legalDistrictSearch.ts) — 매 항목마다 미리
 * 저장해 두면 파일 용량이 불필요하게 커진다. 여기 aliases에는 시도 개편/약칭처럼
 * 원본 텍스트만으로는 재현할 수 없는 별칭만 저장한다.
 */
function buildItem(code: string, name: string): LegalDistrictSearchItem {
  const { province, city, town, village } = parseName(name);
  const rest = name.split(/\s+/).filter(Boolean).slice(1);

  const reformedPrefix = PROVINCE_CODE_REFORM[code.slice(0, 2)];
  const effectiveCode = reformedPrefix ? reformedPrefix + code.slice(2) : code;
  const effectiveProvince = PROVINCE_NAME_REFORM[province] ?? province;
  const effectiveDisplayName = [effectiveProvince, ...rest].join(" ");

  const provinceAliasVariants = buildProvinceAliasVariants(province, rest.join(" "));
  // 시도명 자체가 교체된 경우(강원도→강원특별자치도) 개편 전 원본 표시명도 별칭으로 남긴다.
  const legacyNameAlias = effectiveProvince !== province ? [name] : [];

  const aliases = Array.from(new Set([...provinceAliasVariants, ...legacyNameAlias]));

  return {
    code: effectiveCode,
    displayName: effectiveDisplayName,
    province: effectiveProvince,
    city,
    town,
    village,
    normalizedName: stripSpaces(effectiveDisplayName),
    aliases,
  };
}

function main() {
  const raw = fs.readFileSync(SOURCE_PATH, "utf8");
  const lines = raw.split(/\r?\n/);

  const items: LegalDistrictSearchItem[] = [];
  let skippedBroad = 0;
  let skippedAbolished = 0;
  let skippedMalformed = 0;

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [code, name, status] = line.split("\t");

    if (!code || !name || !status) {
      skippedMalformed += 1;
      continue;
    }
    if (!/^\d{10}$/.test(code)) {
      skippedMalformed += 1;
      continue;
    }
    if (status.trim() !== "존재") {
      skippedAbolished += 1;
      continue;
    }
    if (isBroadRegionCode(code)) {
      skippedBroad += 1;
      continue;
    }

    items.push(buildItem(code, name.trim()));
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(items), "utf8");

  console.log(`총 원본 줄 수: ${lines.length - 1}`);
  console.log(`제외(폐지): ${skippedAbolished}`);
  console.log(`제외(광역 코드): ${skippedBroad}`);
  console.log(`제외(형식 오류): ${skippedMalformed}`);
  console.log(`최종 검색 후보 수: ${items.length}`);
  console.log(`출력 파일: ${OUTPUT_PATH}`);
}

main();
