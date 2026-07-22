import type { CropId, CropStandard } from "@/types/analysis";

/**
 * 공식 출처가 확인된 값만 입력하세요.
 * 미확인 값은 null로 유지합니다.
 * 아래 배/감자 값은 팀 조사 초안을 반영한 예시이며,
 * 최종 제출 전 출처·단위·생육단계를 다시 검수해야 합니다.
 */
export const cropStandards: Record<CropId, CropStandard> = {
  apple: {
    id: "apple",
    name: "사과",
    temperature: range(null, null, null, null, "°C", 0.3),
    soilPh: range(null, null, null, null, "pH", 0.25),
    soilEc: range(null, null, null, null, "dS/m", 0.1),
    rainfall: range(null, null, null, null, "mm", 0.2),
    preferredTextures: [],
    coldDangerThreshold: null,
    heatDangerThreshold: null,
    notes: ["공식 기준 조사 후 입력"],
    sources: [],
  },
  pear: {
    id: "pear",
    name: "배",
    temperature: range(18, 20, 14, 23, "°C", 0.3),
    soilPh: range(5.5, 6.5, 5.0, 7.0, "pH", 0.25),
    soilEc: range(null, null, null, null, "dS/m", 0.05),
    rainfall: range(1200, 1500, 800, 1800, "mm/년", 0.15),
    preferredTextures: ["사질양토"],
    coldDangerThreshold: -1.7,
    heatDangerThreshold: null,
    notes: [
      "개화기 대표 위험 기준",
      "배수성이 좋은 토양이 중요",
      "강수량 기준은 연간값이므로 단기예보 점수에는 직접 사용하지 않음",
    ],
    sources: [
      "농촌진흥청 농업기술길잡이-배 제4장",
      "농촌진흥청 농업기술길잡이-배 제6장",
    ],
  },
  cucumber: {
    id: "cucumber",
    name: "오이",
    temperature: range(null, null, null, null, "°C", 0.3),
    soilPh: range(null, null, null, null, "pH", 0.2),
    soilEc: range(null, null, null, null, "dS/m", 0.2),
    rainfall: range(null, null, null, null, "mm", 0.15),
    preferredTextures: [],
    coldDangerThreshold: null,
    heatDangerThreshold: null,
    notes: ["공식 기준 조사 후 입력"],
    sources: [],
  },
  potato: {
    id: "potato",
    name: "감자",
    temperature: range(14, 23, 5, 30, "°C", 0.3),
    soilPh: range(5.0, 6.0, 4.5, 6.5, "pH", 0.2),
    soilEc: range(null, null, null, null, "dS/m", 0.05),
    rainfall: range(300, 450, 200, 600, "mm/생육기", 0.2),
    preferredTextures: ["사양토", "양토"],
    coldDangerThreshold: null,
    heatDangerThreshold: 27,
    notes: [
      "5℃는 생장 시작 온도이며 냉해 한계가 아님",
      "27~30℃ 이상에서 덩이줄기 형성·비대 저해",
      "침수와 과습에 매우 민감",
    ],
    sources: ["농촌진흥청 농업기술길잡이-감자 제4장"],
  },
  lettuce: {
    id: "lettuce",
    name: "상추",
    temperature: range(null, null, null, null, "°C", 0.3),
    soilPh: range(null, null, null, null, "pH", 0.2),
    soilEc: range(null, null, null, null, "dS/m", 0.2),
    rainfall: range(null, null, null, null, "mm", 0.15),
    preferredTextures: [],
    coldDangerThreshold: null,
    heatDangerThreshold: null,
    notes: ["공식 기준 조사 후 입력"],
    sources: [],
  },
};

function range(
  optimalMin: number | null,
  optimalMax: number | null,
  acceptableMin: number | null,
  acceptableMax: number | null,
  unit: string,
  weight: number,
) {
  return {
    optimalMin,
    optimalMax,
    acceptableMin,
    acceptableMax,
    unit,
    weight,
  };
}
