import type { DailyWeather, LocationInput, WeatherData } from "@/types/analysis";
import { mockWeather } from "@/mocks/weather";
import { getRequiredEnv } from "./env";

const KMA_BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

// 기상청 단기예보 발표시각(KST): 02,05,08,11,14,17,20,23시. 실제 조회는 발표 후 약 10분부터 가능하다.
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];

interface KmaForecastItem {
  baseDate: string;
  baseTime: string;
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
  nx: number;
  ny: number;
}

interface KmaResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      items?: { item: KmaForecastItem[] };
    };
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** 현재(KST) 기준으로 가장 최근에 발표되어 조회 가능한 base_date/base_time을 계산한다. */
function getLatestBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = kst.getUTCHours();
  const minute = kst.getUTCMinutes();

  const base = new Date(kst);
  let candidateHour = [...BASE_HOURS]
    .reverse()
    .find((h) => hour > h || (hour === h && minute >= 10));

  if (candidateHour === undefined) {
    // 00:00~02:09 사이는 전날 23시 발표를 사용한다.
    base.setUTCDate(base.getUTCDate() - 1);
    candidateHour = 23;
  }
  base.setUTCHours(candidateHour, 0, 0, 0);

  const baseDate = `${base.getUTCFullYear()}${pad2(base.getUTCMonth() + 1)}${pad2(base.getUTCDate())}`;
  const baseTime = `${pad2(candidateHour)}00`;
  return { baseDate, baseTime };
}

/**
 * 위경도 -> 기상청 예보 격자(nx, ny) 변환.
 * 기상청이 배포하는 Lambert Conformal Conic 격자변환 공식을 그대로 사용한다.
 */
function convertToGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = (30.0 * Math.PI) / 180;
  const SLAT2 = (60.0 * Math.PI) / 180;
  const OLON = (126.0 * Math.PI) / 180;
  const OLAT = (38.0 * Math.PI) / 180;
  const XO = 43;
  const YO = 136;

  const re = RE / GRID;
  const sn =
    Math.log(Math.cos(SLAT1) / Math.cos(SLAT2)) /
    Math.log(Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) / Math.tan(Math.PI * 0.25 + SLAT1 * 0.5));
  const sf = (Math.tan(Math.PI * 0.25 + SLAT1 * 0.5) ** sn * Math.cos(SLAT1)) / sn;
  const ro = (re * sf) / Math.tan(Math.PI * 0.25 + OLAT * 0.5) ** sn;

  const radLat = (lat * Math.PI) / 180;
  const radLon = (lon * Math.PI) / 180;

  const ra = (re * sf) / Math.tan(Math.PI * 0.25 + radLat * 0.5) ** sn;
  let theta = radLon - OLON;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}

function resolveGrid(location: LocationInput): { nx: number; ny: number } | null {
  if (location.nx !== undefined && location.ny !== undefined) {
    return { nx: location.nx, ny: location.ny };
  }
  if (location.latitude !== undefined && location.longitude !== undefined) {
    return convertToGrid(location.latitude, location.longitude);
  }
  return null;
}

function parseNumeric(value: string): number | null {
  if (value.includes("없음")) return 0;
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isNaN(num) ? null : num;
}

function categoryValues(items: KmaForecastItem[], category: string): number[] {
  return items
    .filter((item) => item.category === category)
    .map((item) => parseNumeric(item.fcstValue))
    .filter((value): value is number => value !== null);
}

function toDateString(fcstDate: string): string {
  return `${fcstDate.slice(0, 4)}-${fcstDate.slice(4, 6)}-${fcstDate.slice(6, 8)}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10;
}

function buildDailyWeather(date: string, items: KmaForecastItem[]): DailyWeather {
  const tmp = categoryValues(items, "TMP");
  const tmn = categoryValues(items, "TMN");
  const tmx = categoryValues(items, "TMX");
  const pcp = categoryValues(items, "PCP");
  const reh = categoryValues(items, "REH");
  const wsd = categoryValues(items, "WSD");

  return {
    date,
    minTemperature: tmn[0] ?? (tmp.length > 0 ? Math.min(...tmp) : null),
    maxTemperature: tmx[0] ?? (tmp.length > 0 ? Math.max(...tmp) : null),
    averageTemperature: average(tmp),
    rainfallMm: sum(pcp),
    humidityPercent: average(reh),
    windSpeedMs: average(wsd),
  };
}

/**
 * 기상청 원본 응답(KmaForecastItem[])을 공통 정규화 타입(WeatherData)으로 변환한다.
 * 날짜별: 평균/최저/최고기온, 강수량(mm), 습도(%), 풍속(m/s).
 * 최초 날짜를 current, 이후 날짜들을 forecast로 나눈다.
 */
export function normalizeKmaForecast(
  items: KmaForecastItem[],
  meta: { source: string; observedAt: string },
): WeatherData {
  const byDate = new Map<string, KmaForecastItem[]>();
  for (const item of items) {
    const date = toDateString(item.fcstDate);
    const bucket = byDate.get(date);
    if (bucket) {
      bucket.push(item);
    } else {
      byDate.set(date, [item]);
    }
  }

  const days = Array.from(byDate.keys())
    .sort()
    .map((date) => buildDailyWeather(date, byDate.get(date) ?? []));

  const [current, ...forecast] = days;

  return {
    current: current ?? null,
    forecast,
    source: meta.source,
    observedAt: meta.observedAt,
    isMock: false,
  };
}

async function fetchKmaForecast(
  nx: number,
  ny: number,
  serviceKey: string,
): Promise<KmaForecastItem[]> {
  const { baseDate, baseTime } = getLatestBaseDateTime(new Date());

  const params = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });

  const res = await fetch(`${KMA_BASE_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`기상청 API 응답 오류: HTTP ${res.status}`);
  }

  const data = (await res.json()) as KmaResponse;
  const resultCode = data.response?.header?.resultCode;
  if (resultCode !== "00") {
    throw new Error(`기상청 API 오류: ${data.response?.header?.resultMsg ?? resultCode}`);
  }

  const items = data.response.body?.items?.item;
  if (!items || items.length === 0) {
    throw new Error("기상청 API 응답에 예보 데이터가 없습니다.");
  }
  return items;
}

/**
 * API 담당자는 이 함수 내부만 구현하면 됩니다.
 * 반환 타입은 절대 변경하지 마세요.
 */
export async function getWeather(
  location: LocationInput,
): Promise<WeatherData> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  let apiKey: string | null = null;
  if (!useMock) {
    try {
      apiKey = getRequiredEnv("KMA_API_KEY");
    } catch {
      apiKey = null;
    }
  }

  if (!apiKey) {
    return {
      ...mockWeather,
      source: `${mockWeather.source} (${location.address})`,
    };
  }

  const grid = resolveGrid(location);
  if (!grid) {
    throw new Error(
      "기상청 API 조회를 위해 location.nx/ny 또는 location.latitude/longitude가 필요합니다.",
    );
  }

  try {
    const items = await fetchKmaForecast(grid.nx, grid.ny, apiKey);
    return normalizeKmaForecast(items, {
      source: `기상청 단기예보 조회서비스 (${location.address})`,
      observedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[getWeather] 기상청 API 호출 실패, mock으로 대체:", error);
    return {
      ...mockWeather,
      source: `${mockWeather.source} (mock fallback: 기상청 API 오류 — ${location.address})`,
    };
  }
}
