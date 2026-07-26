import type {
  DailyWeather,
  LocationInput,
  WeatherData,
} from "@/types/analysis";
import { mockWeather } from "@/mocks/weather";
import {
  fetchPublicApiXml,
  firstEnv,
  kstParts,
  maskedKeyPreview,
  normalizeServiceKey,
  pad2,
  parseFloatOrNull,
  parseXmlItems,
  parseXmlResultStatus,
  PublicApiError,
} from "./shared/publicApi";
import { resolveKmaGrid } from "./shared/kmaGrid";

/**
 * 기상청 단기예보 조회서비스
 * VilageFcstInfoService_2.0/getVilageFcst
 *
 * 환경변수:
 * - KMA_API_KEY
 * - WEATHER_API_KEY
 *
 * 두 환경변수 중 먼저 설정된 값을 사용한다.
 */
const KMA_BASE_URL =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";

/**
 * 단기예보 발표 시각.
 *
 * 하루 8회 발표되며, 일반적으로 발표 약 10분 후부터
 * 정상 조회할 수 있다.
 */
const BASE_TIMES = [
  "0200",
  "0500",
  "0800",
  "1100",
  "1400",
  "1700",
  "2000",
  "2300",
] as const;

/**
 * 현재 한국 시각을 기준으로 조회 가능한 가장 최근
 * base_date와 base_time을 구한다.
 *
 * 발표 직후 데이터가 아직 준비되지 않은 상황을 피하기 위해
 * 발표 시각에서 10분의 여유 시간을 둔다.
 */
function resolveBaseDateTime(
  now: Date,
): {
  baseDate: string;
  baseTime: string;
} {
  const {
    year,
    month,
    day,
    hour,
    minute,
  } = kstParts(now);

  const bufferedMinutes =
    hour * 60 + minute - 10;

  const slotMinutes = BASE_TIMES.map(
    (time) =>
      Number(time.slice(0, 2)) * 60 +
      Number(time.slice(2)),
  );

  let selectedIndex = -1;

  for (
    let index = slotMinutes.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (bufferedMinutes >= slotMinutes[index]) {
      selectedIndex = index;
      break;
    }
  }

  const baseDateUtc = new Date(
    Date.UTC(year, month - 1, day),
  );

  /**
   * 00:00~02:09 사이처럼 당일 조회 가능한 발표가 없으면
   * 전날 23시 발표 자료를 사용한다.
   */
  if (selectedIndex === -1) {
    selectedIndex = BASE_TIMES.length - 1;
    baseDateUtc.setUTCDate(
      baseDateUtc.getUTCDate() - 1,
    );
  }

  return {
    baseDate:
      `${baseDateUtc.getUTCFullYear()}` +
      `${pad2(baseDateUtc.getUTCMonth() + 1)}` +
      `${pad2(baseDateUtc.getUTCDate())}`,
    baseTime: BASE_TIMES[selectedIndex],
  };
}

/**
 * 기상청 단기예보 원본 항목 중
 * 이 서비스에서 사용하는 필드만 정의한다.
 */
interface FcstItem {
  category: string;
  fcstDate: string;
  fcstValue: string;
}

/**
 * 강수량 PCP 값은 숫자가 아니라 다음과 같은 문자열로 올 수 있다.
 *
 * - 강수없음
 * - 1.0mm 미만
 * - 30.0~50.0mm
 * - 50.0mm 이상
 *
 * 범위형 값은 공식 응답 문자열에 포함된 첫 숫자,
 * 즉 하한값을 대표값으로 사용한다.
 */
function parseCategoricalMm(
  raw: string | undefined,
): number | null {
  if (raw === undefined) {
    return null;
  }

  if (raw.includes("없음")) {
    return 0;
  }

  const match = raw.match(/[\d.]+/);

  if (!match) {
    return null;
  }

  const value = Number(match[0]);

  return Number.isFinite(value)
    ? value
    : null;
}

/**
 * YYYYMMDD 문자열을 YYYY-MM-DD 형식으로 변환한다.
 */
function formatIsoDate(
  yyyymmdd: string,
): string {
  if (!/^\d{8}$/.test(yyyymmdd)) {
    return yyyymmdd;
  }

  return (
    `${yyyymmdd.slice(0, 4)}-` +
    `${yyyymmdd.slice(4, 6)}-` +
    `${yyyymmdd.slice(6, 8)}`
  );
}

/**
 * 배열을 지정된 키를 기준으로 그룹화한다.
 */
function groupBy<T, K>(
  items: T[],
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const result = new Map<K, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    const group = result.get(key) ?? [];

    group.push(item);
    result.set(key, group);
  }

  return result;
}

/**
 * 숫자 배열의 평균을 구한다.
 * 값이 없으면 null을 반환한다.
 */
function average(
  values: number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce(
    (sum, value) => sum + value,
    0,
  );

  return total / values.length;
}

/**
 * 숫자 배열의 합계를 구한다.
 * 값이 없으면 null을 반환한다.
 */
function sum(
  values: number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce(
    (total, value) => total + value,
    0,
  );
}

/**
 * 예보 항목의 fcstValue를 숫자 배열로 변환한다.
 * 숫자로 해석할 수 없는 값은 제외한다.
 */
function numericValues(
  items: FcstItem[] | undefined,
): number[] {
  return (items ?? [])
    .map((item) =>
      parseFloatOrNull(item.fcstValue),
    )
    .filter(
      (value): value is number =>
        value !== null,
    );
}

/**
 * 특정 날짜의 기상청 예보 항목을
 * 프로젝트 공통 DailyWeather 타입으로 변환한다.
 */
function buildDailyWeather(
  fcstDate: string,
  items: FcstItem[],
): DailyWeather {
  const byCategory = groupBy(
    items,
    (item) => item.category,
  );

  const temperatureValues =
    numericValues(byCategory.get("TMP"));

  const minimumTemperature =
    parseFloatOrNull(
      byCategory.get("TMN")?.[0]?.fcstValue,
    );

  const maximumTemperature =
    parseFloatOrNull(
      byCategory.get("TMX")?.[0]?.fcstValue,
    );

  const rainfallValues = (
    byCategory.get("PCP") ?? []
  )
    .map((item) =>
      parseCategoricalMm(item.fcstValue),
    )
    .filter(
      (value): value is number =>
        value !== null,
    );

  return {
    date: formatIsoDate(fcstDate),

    minTemperature:
      minimumTemperature ??
      (temperatureValues.length > 0
        ? Math.min(...temperatureValues)
        : null),

    maxTemperature:
      maximumTemperature ??
      (temperatureValues.length > 0
        ? Math.max(...temperatureValues)
        : null),

    averageTemperature:
      average(temperatureValues),

    rainfallMm:
      sum(rainfallValues),

    humidityPercent:
      average(
        numericValues(
          byCategory.get("REH"),
        ),
      ),

    windSpeedMs:
      average(
        numericValues(
          byCategory.get("WSD"),
        ),
      ),
  };
}

/**
 * 기상청 단기예보 API를 호출해 원본 예보 항목을 가져온다.
 */
async function fetchVilageFcst(
  serviceKey: string,
  nx: number,
  ny: number,
): Promise<FcstItem[]> {
  const {
    baseDate,
    baseTime,
  } = resolveBaseDateTime(new Date());

  const xml = await fetchPublicApiXml(
    KMA_BASE_URL,
    {
      serviceKey,
      pageNo: 1,
      numOfRows: 1000,
      dataType: "XML",
      base_date: baseDate,
      base_time: baseTime,
      nx,
      ny,
    },
  );

  const status =
    parseXmlResultStatus(xml);

  if (!status.ok) {
    throw new PublicApiError(
      `기상청 단기예보 API 오류: ${
        status.code ?? "UNKNOWN"
      } ${status.message ?? ""}`,
    );
  }

  const items = parseXmlItems(xml);

  if (items.length === 0) {
    throw new PublicApiError(
      "기상청 단기예보 응답에 예보 항목이 없습니다.",
    );
  }

  return items
    .map((item) => ({
      category:
        item.category ?? "",
      fcstDate:
        item.fcstDate ?? "",
      fcstValue:
        item.fcstValue ?? "",
    }))
    .filter(
      (item) =>
        item.category.length > 0 &&
        item.fcstDate.length > 0,
    );
}

/**
 * 실제 API를 사용할 수 없을 때
 * mock 데이터와 fallback 이유를 반환한다.
 */
function mockWeatherWithReason(
  location: LocationInput,
  reason: string,
): WeatherData {
  return {
    ...mockWeather,
    source:
      `${mockWeather.source} ` +
      `(${location.address}, ${reason})`,
  };
}

/**
 * 지역의 단기 기상예보를 조회한다.
 *
 * 처리 흐름:
 * 1. 환경변수에서 기상청 API 키 조회
 * 2. 위치를 기상청 nx/ny 격자로 변환
 * 3. 단기예보 API 호출
 * 4. 날짜별 기온·강수량·습도·풍속 정규화
 * 5. 첫 날짜는 current, 이후 날짜는 forecast로 반환
 *
 * API 호출이 불가능하거나 실패하면
 * mock 데이터와 실패 이유를 반환한다.
 */
export async function getWeather(
  location: LocationInput,
): Promise<WeatherData> {
  const useMock =
    process.env.NEXT_PUBLIC_USE_MOCK_DATA ===
    "true";

  const serviceKey = firstEnv(
    "KMA_API_KEY",
    "WEATHER_API_KEY",
  );

  if (useMock) {
    return mockWeatherWithReason(
      location,
      "mock 모드",
    );
  }

  if (!serviceKey) {
    return mockWeatherWithReason(
      location,
      "KMA_API_KEY 또는 WEATHER_API_KEY 미설정",
    );
  }

  /**
   * 기존 shared/kmaGrid 모듈을 사용해 다음 입력을 처리한다.
   *
   * - 이미 입력된 nx/ny
   * - 위도/경도
   * - 프로젝트에 등록된 지역 매핑
   */
  const grid = resolveKmaGrid(location);

  if (!grid) {
    return mockWeatherWithReason(
      location,
      "격자좌표 또는 위경도 확인 불가",
    );
  }

  try {
    const normalizedKey =
      normalizeServiceKey(serviceKey);

    console.log(
      `[weather] KMA_API_KEY/WEATHER_API_KEY 로드됨: ${maskedKeyPreview(normalizedKey)}`,
    );

    const items =
      await fetchVilageFcst(
        normalizedKey,
        grid.nx,
        grid.ny,
      );

    const byDate = groupBy(
      items,
      (item) => item.fcstDate,
    );

    const dates = Array
      .from(byDate.keys())
      .sort();

    const dailyWeather = dates.map(
      (date) =>
        buildDailyWeather(
          date,
          byDate.get(date) ?? [],
        ),
    );

    const [current, ...forecast] =
      dailyWeather;

    return {
      current: current ?? null,
      forecast,
      source:
        `기상청 단기예보 조회서비스` +
        `(getVilageFcst, nx=${grid.nx}, ny=${grid.ny}, ${grid.label})` +
        ` - ${location.address}`,
      observedAt:
        new Date().toISOString(),
      isMock: false,
    };
  } catch (error) {
    return mockWeatherWithReason(
      location,
      `실제 API 실패: ${
        error instanceof Error
          ? error.message
          : "Unknown error"
      }`,
    );
  }
}
