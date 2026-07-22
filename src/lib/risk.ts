import type {
  CropStandard,
  RiskItem,
  WeatherData,
} from "@/types/analysis";

export function detectRisks(
  standard: CropStandard,
  weather: WeatherData,
): RiskItem[] {
  const risks: RiskItem[] = [];

  const coldDays =
    standard.coldDangerThreshold === null
      ? []
      : weather.forecast.filter(
          (day) =>
            day.minTemperature !== null &&
            day.minTemperature <= standard.coldDangerThreshold!,
        );

  if (coldDays.length >= 1) {
    risks.push({
      id: "cold-risk",
      title: "저온 위험",
      severity: coldDays.length >= 2 ? "danger" : "warning",
      evidence: `${coldDays.length}일의 최저기온이 위험 기준 이하입니다.`,
      action: "보온·피복·방상시설의 작동 상태를 미리 확인하세요.",
    });
  }

  const heatDays =
    standard.heatDangerThreshold === null
      ? []
      : weather.forecast.filter(
          (day) =>
            day.maxTemperature !== null &&
            day.maxTemperature >= standard.heatDangerThreshold!,
        );

  if (heatDays.length >= 1) {
    risks.push({
      id: "heat-risk",
      title: "고온 위험",
      severity: heatDays.length >= 2 ? "danger" : "warning",
      evidence: `${heatDays.length}일의 최고기온이 위험 기준 이상입니다.`,
      action: "관수 시기와 차광·환기 상태를 확인하세요.",
    });
  }

  const heavyRainDays = weather.forecast.filter(
    (day) => day.rainfallMm !== null && day.rainfallMm >= 50,
  );

  if (heavyRainDays.length >= 1) {
    risks.push({
      id: "heavy-rain",
      title: "집중강우·배수 위험",
      severity: "danger",
      evidence: "하루 50mm 이상의 강수가 예보된 날이 있습니다.",
      action: "배수로가 막히지 않았는지 미리 확인하세요.",
    });
  }

  return risks;
}
