import fs from "node:fs";
import path from "node:path";

/**
 * 기상청 단기예보 조회서비스 공식 참고자료 "예보지점의 X-Y좌표"(시도/시군구/읍면동별 격자
 * nx/ny, 위경도)를 전처리해 src/data/weatherGrid.json을 생성한다.
 *
 * 출처: 기상청 API 활용가이드 첨부 "예보지점의 X-Y좌표" 엑셀(관리 열 "1단계/2단계/3단계"
 * = 시도/시군구/읍면동, "격자 X"/"격자 Y" = nx/ny). scripts/weatherGridSource.txt는 이
 * 엑셀을 그대로 옮긴 탭 구분 텍스트다(2026-07 확보).
 *
 * 실행: npx tsx scripts/buildWeatherGridIndex.ts
 */

interface WeatherGridMapping {
  province: string;
  city: string | null;
  town: string | null;
  nx: number;
  ny: number;
  precision: "town" | "city" | "province";
  source: string;
}

const SOURCE_PATH = path.join(__dirname, "weatherGridSource.txt");
const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "weatherGrid.json");
const SOURCE_LABEL = "기상청 단기예보 조회서비스 공식 참고자료(예보지점의 X-Y좌표)";

/**
 * legalDistrictSearch와 동일한 시도명 교체(강원도→강원특별자치도)를 적용한다.
 * 두 데이터셋의 province 문자열이 같아야 주소로 서로 매칭할 수 있다.
 * 전라북도는 legalDistricts.json도 원본 명칭(45 코드)을 그대로 쓰므로 여기서도 바꾸지 않는다.
 */
const PROVINCE_NAME_REFORM: Record<string, string> = {
  "강원도": "강원특별자치도",
};

function main() {
  const raw = fs.readFileSync(SOURCE_PATH, "utf8");
  const lines = raw.split(/\r?\n/);

  const items: WeatherGridMapping[] = [];
  let skippedMalformed = 0;

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [provinceRaw, cityRaw, townRaw, nxRaw, nyRaw] = line.split("\t");

    if (!provinceRaw || !nxRaw || !nyRaw) {
      skippedMalformed += 1;
      continue;
    }
    const nx = Number(nxRaw);
    const ny = Number(nyRaw);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) {
      skippedMalformed += 1;
      continue;
    }

    const province = PROVINCE_NAME_REFORM[provinceRaw] ?? provinceRaw;
    const city = cityRaw ? cityRaw.trim() : "";
    const town = townRaw ? townRaw.trim() : "";

    const precision: WeatherGridMapping["precision"] = town ? "town" : city ? "city" : "province";

    items.push({
      province,
      city: city || null,
      town: town || null,
      nx,
      ny,
      precision,
      source: SOURCE_LABEL,
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(items), "utf8");

  const byPrecision = {
    town: items.filter((i) => i.precision === "town").length,
    city: items.filter((i) => i.precision === "city").length,
    province: items.filter((i) => i.precision === "province").length,
  };

  console.log(`총 원본 줄 수: ${lines.length - 1}`);
  console.log(`제외(형식 오류): ${skippedMalformed}`);
  console.log(`최종 격자 항목 수: ${items.length}`, JSON.stringify(byPrecision));
  console.log(`출력 파일: ${OUTPUT_PATH}`);
}

main();
