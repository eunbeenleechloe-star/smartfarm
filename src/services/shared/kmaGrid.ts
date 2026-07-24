import type { LocationInput } from "@/types/analysis";
import { resolveWeatherGridMatch } from "./weatherGrid";

/**
 * 위경도 → 기상청 단기예보 격자(nx, ny) 변환(Lambert Conformal Conic).
 * 기상청이 공개한 변환식/상수(dfs_xy_conv)를 그대로 따른다.
 * 참고: 기상청 API허브 "단기예보 조회서비스_오픈API활용가이드".
 */
const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = (30.0 * Math.PI) / 180.0;
const SLAT2 = (60.0 * Math.PI) / 180.0;
const OLON = (126.0 * Math.PI) / 180.0;
const OLAT = (38.0 * Math.PI) / 180.0;
const XO = 43;
const YO = 136;

export function latLonToKmaGrid(lat: number, lon: number): { nx: number; ny: number } {
  const re = RE / GRID;
  const sn =
    Math.log(Math.cos(SLAT1) / Math.cos(SLAT2)) /
    Math.log(Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) / Math.tan(Math.PI * 0.25 + SLAT1 * 0.5));
  const sf =
    (Math.pow(Math.tan(Math.PI * 0.25 + SLAT1 * 0.5), sn) * Math.cos(SLAT1)) / sn;
  const ro = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + OLAT * 0.5), sn);

  const ra = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + ((lat * Math.PI) / 180.0) * 0.5), sn);
  let theta = (lon * Math.PI) / 180.0 - OLON;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

/**
 * 17개 광역시도 청 소재지 기준 격자좌표(공식 KMA 참고표, 2024-01-01 배포본 기준).
 * 주소 문자열이 정확한 위경도를 제공하지 않을 때의 대략적인 대체값이며, 시군구 단위 정밀도는 아니다.
 * "경기도 광주시"처럼 다른 지역명이 포함된 주소를 올바르게 매칭하도록 더 구체적인 지역을 먼저 검사한다.
 */
export const KMA_REGION_GRID: { names: string[]; nx: number; ny: number }[] = [
  { names: ["서울"], nx: 60, ny: 127 },
  { names: ["부산"], nx: 98, ny: 76 },
  { names: ["대구"], nx: 89, ny: 90 },
  { names: ["인천"], nx: 55, ny: 124 },
  { names: ["경기"], nx: 60, ny: 120 },
  { names: ["광주"], nx: 58, ny: 74 },
  { names: ["대전"], nx: 67, ny: 100 },
  { names: ["울산"], nx: 102, ny: 84 },
  { names: ["세종"], nx: 66, ny: 103 },
  { names: ["강원"], nx: 73, ny: 134 },
  { names: ["충북", "충청북도"], nx: 69, ny: 107 },
  { names: ["충남", "충청남도"], nx: 68, ny: 100 },
  { names: ["전북", "전라북도"], nx: 63, ny: 89 },
  { names: ["전남", "전라남도"], nx: 51, ny: 67 },
  { names: ["경북", "경상북도"], nx: 87, ny: 106 },
  { names: ["경남", "경상남도"], nx: 91, ny: 77 },
  { names: ["제주"], nx: 52, ny: 38 },
];

export interface KmaGridResolution {
  nx: number;
  ny: number;
  /** 이 좌표가 어느 정밀도에서 확보됐는지. source 문구 등 표시용. */
  precision: "town" | "city" | "province";
  /** "강릉시 강동면 기준 격자" 같은 사람이 읽는 설명. */
  label: string;
}

/**
 * 위치 정보로부터 기상청 격자좌표를 구한다.
 * 우선순위:
 * 1) 명시적 nx/ny(전국 법정동 검색에서 선택된 값 — 있으면 그대로 사용)
 * 2) 검증된 시군구/읍면동 격자 매핑(weatherGrid.ts, 주소 문자열로 매칭)
 * 3) 위경도 변환(DFS 공식)
 * 4) 기존 17개 시도 대표 격자(주소 문자열의 시도명 매칭)
 * 모두 실패하면 null — 임의 좌표를 만들지 않는다.
 */
export function resolveKmaGrid(location: LocationInput): KmaGridResolution | null {
  if (location.nx !== undefined && location.ny !== undefined) {
    const precision = location.weatherGridPrecision ?? "town";
    return {
      nx: location.nx,
      ny: location.ny,
      precision,
      label: "선택된 지역 기준 격자",
    };
  }

  const gridMatch = resolveWeatherGridMatch(location.address);
  if (gridMatch) {
    return {
      nx: gridMatch.nx,
      ny: gridMatch.ny,
      precision: gridMatch.precision,
      label: `${gridMatch.matchedName} 기준 ${gridMatch.precision === "town" ? "읍면동" : "시군구"} 격자`,
    };
  }

  if (location.latitude !== undefined && location.longitude !== undefined) {
    const { nx, ny } = latLonToKmaGrid(location.latitude, location.longitude);
    return { nx, ny, precision: "town", label: "위경도 기반 격자" };
  }

  const region = KMA_REGION_GRID.find((candidate) =>
    candidate.names.some((name) => location.address.includes(name)),
  );
  if (!region) return null;

  return {
    nx: region.nx,
    ny: region.ny,
    precision: "province",
    label: `${region.names[0]} 대표 격자(정확한 읍면동 격자 없음)`,
  };
}
