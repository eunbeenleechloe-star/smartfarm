import type { WeatherData } from "@/types/analysis";

export const mockWeather: WeatherData = {
  current: {
    date: "2026-04-01",
    minTemperature: 3,
    maxTemperature: 18,
    averageTemperature: 10.5,
    rainfallMm: 5,
    humidityPercent: 72,
    windSpeedMs: 2.4,
  },
  forecast: [
    {
      date: "2026-04-02",
      minTemperature: -2,
      maxTemperature: 17,
      averageTemperature: 7.5,
      rainfallMm: 0,
      humidityPercent: 68,
      windSpeedMs: 1.8,
    },
    {
      date: "2026-04-03",
      minTemperature: -1.8,
      maxTemperature: 18,
      averageTemperature: 8.1,
      rainfallMm: 2,
      humidityPercent: 74,
      windSpeedMs: 2.1,
    },
    {
      date: "2026-04-04",
      minTemperature: 4,
      maxTemperature: 20,
      averageTemperature: 12,
      rainfallMm: 55,
      humidityPercent: 88,
      windSpeedMs: 3.3,
    },
  ],
  source: "데모용 기상 샘플",
  observedAt: "2026-04-01T09:00:00+09:00",
  isMock: true,
};
