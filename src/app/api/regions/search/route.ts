import { NextResponse } from "next/server";
import { searchLegalDistricts } from "@/services/shared/legalDistrictSearch";
import { resolveWeatherGridMatch } from "@/services/shared/weatherGrid";

/**
 * 전국 법정동(읍·면·동/리) 검색 API. 행정안전부 공식 법정동코드 전체자료를 전처리한
 * 로컬 인덱스(src/data/legalDistricts.json)에서 검색하므로 외부 API 키가 필요 없다.
 * 각 후보에는 기상청 공식 참고자료로 확인된 시군구/읍면동 격자(nx/ny)도 함께 반환한다
 * (없으면 null — 임의 좌표를 만들지 않고, 분석 시점에 기존 시도 대표 격자로 대체된다).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  const items = searchLegalDistricts(query).map((item) => {
    const grid = resolveWeatherGridMatch(item.displayName);
    return {
      code: item.code,
      displayName: item.displayName,
      province: item.province,
      city: item.city,
      town: item.town,
      village: item.village,
      nx: grid?.nx ?? null,
      ny: grid?.ny ?? null,
      weatherGridPrecision: grid?.precision ?? null,
    };
  });

  return NextResponse.json({ items });
}
