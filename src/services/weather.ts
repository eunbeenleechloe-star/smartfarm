import type { DailyWeather, LocationInput, WeatherData } from "@/types/analysis";
import { mockWeather } from "@/mocks/weather";
import {
  fetchPublicApiXml,
  firstEnv,
  kstParts,
  normalizeServiceKey,
  pad2,
  parseFloatOrNull,
  parseXmlItems,
  parseXmlResultStatus,
  PublicApiError,
} from "./shared/publicApi";
import { resolveKmaGrid } from "./shared/kmaGrid";

/**
 * 기상청 단기예보 조회서비스(VilageFcstInfoService_2.0/getVilageFcst).
 * data.go.kr 경유 URL. serviceKey는 KMA_API_KEY 또는 WEATHER_API_KEY(.env)에서 읽는다.
 */
const KMA_BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

/** 발표 시각(1일 8회). 각 시각의 자료는 발표 10분 후부터 조회 가능하다. */
const BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"];

/** base_date/base_time을 계산한다. 발표 10분 전이면 이전 발표 시각으로, 자정 이전이면 전날 23시 발표로 넘어간다. */
function resolveBaseDateTime(now: Date): { baseDate: string; baseTime: string } {
  const { year, month, day, hour, minute } = kstParts(now);
  const bufferedMinutes = hour * 60 + minute - 10;
  const slotMinutes = BASE_TIMES.map(
    (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(2)),
  );

  let index = -1;
  for (let i = slotMinutes.length - 1; i >= 0; i--) {
    if (bufferedMinutes >= slotMinutes[i]) {
      index = i;
      break;
    }
  }

  const baseDateUtc = new Date(Date.UTC(year, month - 1, day));
  if (index === -1) {
    index = BASE_TIMES.length - 1;
    baseDateUtc.setUTCDate(baseDateUtc.getUTCDate() - 1);
  }

  return {
    baseDate: `${baseDateUtc.getUTCFullYear()}${pad2(baseDateUtc.getUTCMonth() + 1)}${pad2(
      baseDateUtc.getUTCDate(),
    )}`,
    baseTime: BASE_TIMES[index],
  };
}

interface FcstItem {
  category: string;
  fcstDate: string;
  fcstValue: string;
}

/** PCP/SNO는 "강수없음"/"1.0mm 미만"/"30.0~50.0mm"/"50.0mm 이상" 같은 범주형 문자열로 온다. 하한값을 대표값으로 쓴다. */
function parseCategoricalMm(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  if (raw.includes("없음")) return 0;
  const match = raw.match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

function formatIsoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function sum(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
}

function numericValues(items: FcstItem[] | undefined): number[] {
  return (items ?? [])
    .map((item) => parseFloatOrNull(item.fcstValue))
    .filter((value): value is number => value !== null);
}

function buildDailyWeather(fcstDate: string, items: FcstItem[]): DailyWeather {
  const byCategory = groupBy(items, (item) => item.category);
  const tmpValues = numericValues(byCategory.get("TMP"));
  const tmn = parseFloatOrNull(byCategory.get("TMN")?.[0]?.fcstValue);
  const tmx = parseFloatOrNull(byCategory.get("TMX")?.[0]?.fcstValue);
  const pcpValues = (byCategory.get("PCP") ?? [])
    .map((item) => parseCategoricalMm(item.fcstValue))
    .filter((value): value is number => value !== null);

  return {
    date: formatIsoDate(fcstDate),
    minTemperature: tmn ?? (tmpValues.length > 0 ? Math.min(...tmpValues) : null),
    maxTemperature: tmx ?? (tmpValues.length > 0 ? Math.max(...tmpValues) : null),
    averageTemperature: average(tmpValues),
    rainfallMm: sum(pcpValues),
    humidityPercent: average(numericValues(byCategory.get("REH"))),
    windSpeedMs: average(numericValues(byCategory.get("WSD"))),
  };
}

async function fetchVilageFcst(serviceKey: string, nx: number, ny: number): Promise<FcstItem[]> {
  const { baseDate, baseTime } = resolveBaseDateTime(new Date());
  const xml = await fetchPublicApiXml(KMA_BASE_URL, {
    serviceKey,
    pageNo: 1,
    numOfRows: 1000,
    dataType: "XML",
    base_date: baseDate,
    base_time: baseTime,
    nx,
    ny,
  });

  const status = parseXmlResultStatus(xml);
  if (!status.ok) {
    throw new PublicApiError(
      `기상청 단기예보 API 오류: ${status.code ?? "UNKNOWN"} ${status.message ?? ""}`,
    );
  }

  const items = parseXmlItems(xml);
  if (items.length === 0) {
    throw new PublicApiError("기상청 단기예보 응답에 예보 항목이 없습니다.");
  }

  return items.map((item) => ({
    category: item.category,
    fcstDate: item.fcstDate,
    fcstValue: item.fcstValue,
  }));
}

function mockWeatherWithReason(location: LocationInput, reason: string): WeatherData {
  return {
    ...mockWeather,
    source: `${mockWeather.source} (${location.address}, ${reason})`,
  };
}

/**
 * API 담당자는 이 함수 내부만 구현하면 됩니다.
 * 반환 타입은 절대 변경하지 마세요.
 */
export async function getWeather(location: LocationInput): Promise<WeatherData> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const serviceKey = firstEnv("KMA_API_KEY", "WEATHER_API_KEY");

  if (useMock) {
    return mockWeatherWithReason(location, "mock 모드");
  }
  if (!serviceKey) {
    return mockWeatherWithReason(location, "KMA_API_KEY 미설정");
  }

  const grid = resolveKmaGrid(location);
  if (!grid) {
    return mockWeatherWithReason(location, "격자좌표(nx/ny, 위경도) 확인 불가");
  }

  try {
    const items = await fetchVilageFcst(normalizeServiceKey(serviceKey), grid.nx, grid.ny);
    const byDate = groupBy(items, (item) => item.fcstDate);
    const dates = Array.from(byDate.keys()).sort();
    const dailyByDate = dates.map((date) => buildDailyWeather(date, byDate.get(date)!));
    const [current, ...forecast] = dailyByDate;

    return {
      current: current ?? null,
      forecast,
      source: `기상청 단기예보 조회서비스(getVilageFcst, nx=${grid.nx}, ny=${grid.ny}) - ${location.address}`,
      observedAt: new Date().toISOString(),
      isMock: false,
    };
  } catch (error) {
    return mockWeatherWithReason(
      location,
      `실제 API 실패: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
