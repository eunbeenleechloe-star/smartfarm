import weatherGridData from "@/data/weatherGrid.json";

/**
 * scripts/buildWeatherGridIndex.ts가 기상청 공식 참고자료(예보지점의 X-Y좌표)에서
 * 전처리한 시도/시군구/읍면동 단위 격자 1건.
 */
export interface WeatherGridMapping {
  province: string;
  city: string | null;
  town: string | null;
  nx: number;
  ny: number;
  precision: "town" | "city" | "province";
  source: string;
}

const GRID_ITEMS = weatherGridData as WeatherGridMapping[];

interface ParsedAddress {
  province: string;
  city: string | null;
  town: string | null;
}

/**
 * "강원특별자치도 강릉시 강동면 모전리" 같은 주소를 province/city/town으로 나눈다.
 * 리(마을) 단위는 기상 격자에 없으므로 버리고, 세종특별자치시처럼 시군구가 없는 경우
 * city는 null로 남긴다(매칭 시 province로 대체해서 찾는다).
 */
function parseAddress(address: string): ParsedAddress {
  const parts = address.trim().split(/\s+/).filter(Boolean);
  const province = parts[0] ?? "";
  const rest = parts.slice(1);

  const withoutVillage = rest.length > 0 && rest.at(-1)!.endsWith("리") ? rest.slice(0, -1) : rest;

  let town: string | null = null;
  let cityParts = withoutVillage;
  const last = withoutVillage.at(-1);
  if (last && (last.endsWith("읍") || last.endsWith("면") || last.endsWith("동"))) {
    town = last;
    cityParts = withoutVillage.slice(0, -1);
  }

  const city = cityParts.length > 0 ? cityParts.join(" ") : null;
  return { province, city, town };
}

export interface WeatherGridMatch {
  nx: number;
  ny: number;
  precision: "town" | "city";
  matchedName: string;
  source: string;
}

/** 세종특별자치시처럼 province와 city가 같은 문자열이면 한 번만 표시한다. */
function buildMatchedName(...parts: (string | null)[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    if (!part || seen.has(part)) continue;
    seen.add(part);
    unique.push(part);
  }
  return unique.join(" ");
}

/**
 * 주소 문자열에서 검증된 시군구/읍면동 단위 기상 격자를 찾는다.
 * 읍면동 단위를 먼저 시도하고, 없으면 시군구 단위를 시도한다. 둘 다 없으면 null을
 * 반환하며(임의 좌표를 만들지 않음), 이 경우 호출부가 기존 시도 대표 격자로 대체한다.
 */
export function resolveWeatherGridMatch(address: string): WeatherGridMatch | null {
  const parsed = parseAddress(address);
  if (!parsed.province) return null;

  // 세종특별자치시처럼 시군구 단위가 없는 주소는 시도명을 시군구 자리에도 대입해 찾는다
  // (원본 자료도 세종을 이렇게 중복 표기한다).
  const effectiveCity = parsed.city ?? parsed.province;

  if (parsed.town) {
    const townMatch = GRID_ITEMS.find(
      (item) =>
        item.precision === "town" &&
        item.province === parsed.province &&
        item.city === effectiveCity &&
        item.town === parsed.town,
    );
    if (townMatch) {
      return {
        nx: townMatch.nx,
        ny: townMatch.ny,
        precision: "town",
        matchedName: buildMatchedName(townMatch.province, townMatch.city, townMatch.town),
        source: townMatch.source,
      };
    }
  }

  const cityMatch = GRID_ITEMS.find(
    (item) => item.precision === "city" && item.province === parsed.province && item.city === effectiveCity,
  );
  if (cityMatch) {
    return {
      nx: cityMatch.nx,
      ny: cityMatch.ny,
      precision: "city",
      matchedName: buildMatchedName(cityMatch.province, cityMatch.city),
      source: cityMatch.source,
    };
  }

  return null;
}

export interface WeatherGridSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/** 실제 네트워크 호출 없이 전처리 결과와 매칭 우선순위를 점검한다. */
export function runWeatherGridSelfChecks(): WeatherGridSelfCheckResult[] {
  const results: WeatherGridSelfCheckResult[] = [];

  results.push({
    label: "1. 격자 데이터가 전처리되어 로드됨(0건 아님)",
    passed: GRID_ITEMS.length > 1000,
    message: `총 항목 수=${GRID_ITEMS.length}`,
  });

  const gangdong = resolveWeatherGridMatch("강원특별자치도 강릉시 강동면 모전리");
  results.push({
    label: "2. 강동면(읍면동 단위) → nx=94, ny=131",
    passed: gangdong?.precision === "town" && gangdong.nx === 94 && gangdong.ny === 131,
    message: `result=${JSON.stringify(gangdong)}`,
  });

  const gochang = resolveWeatherGridMatch("전라북도 고창군 고창읍");
  results.push({
    label: "3. 고창읍(읍면동 단위) → nx=56, ny=80",
    passed: gochang?.precision === "town" && gochang.nx === 56 && gochang.ny === 80,
    message: `result=${JSON.stringify(gochang)}`,
  });

  const yeoksam = resolveWeatherGridMatch("서울특별시 강남구 역삼1동");
  results.push({
    label: "4. 역삼1동(읍면동 단위) → nx=61, ny=125",
    passed: yeoksam?.precision === "town" && yeoksam.nx === 61 && yeoksam.ny === 125,
    message: `result=${JSON.stringify(yeoksam)}`,
  });

  const bangokFallback = resolveWeatherGridMatch("세종특별자치시 반곡동");
  results.push({
    label: "5. 반곡동(원본 자료에 없음) → 시군구(세종시 전체) 단위로 대체, nx=66, ny=103",
    passed: bangokFallback?.precision === "city" && bangokFallback.nx === 66 && bangokFallback.ny === 103,
    message: `result=${JSON.stringify(bangokFallback)}`,
  });

  const noMatch = resolveWeatherGridMatch("존재하지 않는 가상의 지역 이름");
  results.push({
    label: "6. 매칭되는 지역이 없으면 null(임의 좌표를 만들지 않음)",
    passed: noMatch === null,
    message: `result=${JSON.stringify(noMatch)}`,
  });

  const gangnamCity = resolveWeatherGridMatch("서울특별시 강남구");
  results.push({
    label: "7. 읍면동 없이 시군구까지만 있어도 시군구 단위로 매칭",
    passed: gangnamCity !== null && gangnamCity.precision === "city",
    message: `result=${JSON.stringify(gangnamCity)}`,
  });

  results.push({
    label: "8. 모든 항목의 nx/ny가 유효한 격자 범위(1~149, 1~253) 안에 있음",
    passed: GRID_ITEMS.every((item) => item.nx >= 1 && item.nx <= 149 && item.ny >= 1 && item.ny <= 253),
    message: "격자 범위: nx 1~149, ny 1~253(기상청 5km 격자 전체 크기 기준)",
  });

  return results;
}
