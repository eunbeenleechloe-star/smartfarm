import type { LocationInput, WeatherData } from "@/types/analysis";
import { mockWeather } from "@/mocks/weather";

/**
 * API 담당자는 이 함수 내부만 구현하면 됩니다.
 * 반환 타입은 절대 변경하지 마세요.
 */
export async function getWeather(
  location: LocationInput,
): Promise<WeatherData> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  if (useMock || !process.env.KMA_API_KEY) {
    return {
      ...mockWeather,
      source: `${mockWeather.source} (${location.address})`,
    };
  }

  throw new Error(
    "기상청 API 연동이 아직 구현되지 않았습니다. mock 모드를 사용하세요.",
  );
}
