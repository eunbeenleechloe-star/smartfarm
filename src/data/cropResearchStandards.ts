import type { CropId } from "@/types/analysis";

/**
 * 상세 조사 데이터 보관용 모듈.
 *
 * 이 파일은 작물별 공식 조사 수치(생육단계별 온도, 토양, 강수, 저온·고온 위험)를
 * 있는 그대로 보관하는 참고 자료이며, 적합도 점수 계산에는 아직 사용하지 않는다.
 * 실제 점수 계산은 `src/data/cropStandards.ts`의 `cropStandards`(CropStandard, 단일 NumericRange 구조)를
 * 그대로 사용하므로 이 파일과 혼동하지 않는다.
 *
 * 값이 확인되지 않은 항목은 null 또는 빈 배열로 남긴다.
 */

/**
 * [min, max] 범위 튜플.
 * 한쪽 경계가 확인되지 않으면 해당 자리를 null로 둔다 (예: [800, null]).
 * 범위 전체가 확인되지 않으면 필드 값 자체를 null로 둔다.
 */
export type NumberRange = [number | null, number | null];

export interface TemperatureStandard {
  optimalDay: NumberRange | null;
  optimalNight: NumberRange | null;
  optimalAverage: NumberRange | null;
  soilTemperature: NumberRange | null;
  growthStartTemperature: number | null;
}

export interface SoilStandard {
  preferredTextures: string[];
  ph: NumberRange | null;
  /** dS/m. 조사되지 않은 경우 null (예: 배, 감자). */
  ec: number | null;
  drainageImportant: boolean;
}

/**
 * 강수량은 적용 기간이 작물마다 달라 연간/생육기/월간 기준을 분리해서 저장한다.
 * 같은 작물이라도 기준 기간이 다른 값끼리 합산하거나 비교하지 않는다.
 */
export interface RainfallStandard {
  annual: NumberRange | null;
  growingSeason: NumberRange | null;
  monthly: NumberRange | null;
  conditionalNote: string | null;
}

export interface ColdRiskStandard {
  stage: string;
  /** ℃ */
  threshold: number;
  description: string;
}

export interface HeatRiskStandard {
  /** ℃ */
  threshold: number;
  description: string;
}

export interface CropResearchStandard {
  id: CropId;
  name: string;
  temperature: TemperatureStandard;
  soil: SoilStandard;
  rainfall: RainfallStandard;
  coldRisks: ColdRiskStandard[];
  heatRisks: HeatRiskStandard[];
  notes: string[];
  sources: string[];
}

export const cropResearchStandards: Record<CropId, CropResearchStandard> = {
  apple: {
    id: "apple",
    name: "사과",
    temperature: {
      optimalDay: null,
      optimalNight: null,
      optimalAverage: [15, 18],
      soilTemperature: null,
      growthStartTemperature: null,
    },
    soil: {
      preferredTextures: ["양토", "사양토"],
      ph: [6.0, 7.0],
      ec: 2.0,
      drainageImportant: true,
    },
    rainfall: {
      annual: null,
      growingSeason: null,
      monthly: null,
      conditionalNote: "4~9월 누적 강수량이 450mm 이하이면 관수가 필요함",
    },
    coldRisks: [
      {
        stage: "winterTree",
        threshold: -30,
        description: "겨울철 지상부 동해 한계는 약 -30~-35℃",
      },
      {
        stage: "winterRoot",
        threshold: -11,
        description: "지하부는 약 -11~-12℃에서도 동해를 입을 수 있음",
      },
      {
        stage: "flowering",
        threshold: -2,
        description: "개화기에는 -1~-2℃에서도 저온 피해 가능",
      },
      {
        stage: "fullBloom",
        threshold: -1,
        description: "만개기에는 -1~-2℃에서도 저온 피해 가능",
      },
    ],
    heatRisks: [
      {
        threshold: 32,
        description: "7~8월 32℃ 이상에서 일소 위험 증가",
      },
    ],
    notes: [
      "동해, 늦서리, 우박, 태풍, 일소에 주의",
      "배수 개선 중요",
      "개화기 저온과 겨울철 동해는 서로 다른 위험으로 처리",
      "4~9월 450mm는 적정 강수량이 아니라 관수 판단 기준",
    ],
    sources: [
      "농촌진흥청 『농업기술길잡이5-사과재배』",
      "농사로 농업기술포털 사과재배",
      "한국농촌경제연구원 『우리나라 토양양분 관리정책의 평가』 p.17",
    ],
  },
  lettuce: {
    id: "lettuce",
    name: "상추",
    temperature: {
      optimalDay: [15, 20],
      optimalNight: [10, 15],
      optimalAverage: null,
      soilTemperature: null,
      growthStartTemperature: null,
    },
    soil: {
      preferredTextures: ["사양토"],
      ph: [6.5, 7.0],
      ec: 2.0,
      drainageImportant: true,
    },
    rainfall: {
      annual: null,
      growingSeason: [150, 200],
      monthly: null,
      conditionalNote: "토양 종류와 계절에 따라 관수 주기가 달라짐",
    },
    coldRisks: [
      {
        stage: "germination",
        threshold: 5,
        description: "5℃ 이하에서는 발아가 거의 이루어지지 않음",
      },
    ],
    heatRisks: [
      {
        threshold: 30,
        description: "30℃ 이상에서 발아 저하 및 추대 촉진",
      },
    ],
    notes: [
      "호냉성 작물",
      "야간 10~15℃에서 잎 분화가 활발",
      "일반 잎상추 기준 pH 6.5~7.0 사용",
      "결구상추 pH 6.0~6.5는 참고 정보",
      "EC 1.5dS/m 이하는 권장 관리값으로 참고",
      "EC 2.0dS/m 이하는 생육 양호 상한으로 저장",
      "고 EC와 낮은 pH는 칼슘 흡수를 저해할 수 있음",
    ],
    sources: [
      "농촌진흥청 『농업기술길잡이-상추』 제2장 재배환경",
      "농사로 농업기술포털 상추재배",
    ],
  },
  pear: {
    id: "pear",
    name: "배",
    temperature: {
      optimalDay: null,
      optimalNight: null,
      optimalAverage: [18, 20],
      soilTemperature: null,
      growthStartTemperature: null,
    },
    soil: {
      preferredTextures: ["사질양토"],
      ph: [5.5, 6.5],
      ec: null,
      drainageImportant: true,
    },
    rainfall: {
      annual: [1200, 1500],
      growingSeason: [800, null],
      monthly: null,
      conditionalNote: "생육기 기준은 4~10월 누적 강수량 800mm 이상",
    },
    coldRisks: [
      {
        stage: "flowerBud",
        threshold: -3.5,
        description: "꽃봉오리가 화총 안에 있을 때 위험",
      },
      {
        stage: "pinkBud",
        threshold: -2.8,
        description: "꽃봉오리 끝이 엷은 분홍색일 때 위험",
      },
      {
        stage: "whiteBud",
        threshold: -2.2,
        description: "꽃봉오리가 백색일 때 위험",
      },
      {
        stage: "beforeBloom",
        threshold: -1.9,
        description: "개화 직전 위험",
      },
      {
        stage: "fullBloom",
        threshold: -1.7,
        description: "만개기 위험",
      },
    ],
    heatRisks: [],
    notes: [
      "18~20℃는 4~10월 생육기 평균기온 기준",
      "개화기가 서리에 가장 취약",
      "비옥도보다 배수성과 속흙의 물리성이 중요",
      "장마철 과습은 생리장해, 병해충, 당도 저하를 유발",
      "EC는 현재 자료에서 확인되지 않아 null",
    ],
    sources: [
      "농촌진흥청 『농업기술길잡이-배』 제4장 재배환경과 개원",
      "농촌진흥청 『농업기술길잡이-배』 제6장 이상기상에 대한 경감 대책",
    ],
  },
  potato: {
    id: "potato",
    name: "감자",
    temperature: {
      optimalDay: [23, 24],
      optimalNight: [10, 14],
      optimalAverage: [14, 23],
      soilTemperature: null,
      growthStartTemperature: 5,
    },
    soil: {
      preferredTextures: ["사양토", "양토"],
      ph: [5.0, 6.0],
      ec: null,
      drainageImportant: true,
    },
    rainfall: {
      annual: null,
      growingSeason: [300, 450],
      monthly: null,
      conditionalNote:
        "덩이줄기 비대기에는 충분한 수분, 성숙기에는 다소 건조한 환경이 유리",
    },
    coldRisks: [],
    heatRisks: [
      {
        threshold: 27,
        description: "덩이줄기 형성과 비대 저해 시작",
      },
      {
        threshold: 30,
        description: "덩이줄기 형성과 비대가 정지될 수 있음",
      },
    ],
    notes: [
      "전체 생육 적온은 14~23℃",
      "덩이줄기 비대 적온은 15~18℃",
      "잎·줄기 생육 적온은 약 21℃",
      "5℃는 최저 피해온도가 아니라 싹 생장 시작 온도",
      "침수와 과습에 매우 약함",
      "고온, 과습, 수분 변동은 생리장해 위험을 높임",
      "EC는 토양재배 기준이 확인되지 않아 null",
    ],
    sources: [
      "농촌진흥청 『농업기술길잡이-감자』 제4장 감자의 생장과 발육",
      "농촌진흥청 『농업기술길잡이-감자』 제7장 가꿈꼴별 재배 기술",
      "농촌진흥청 『농업기술길잡이-감자』 제10장 감자 병해충과 방제",
    ],
  },
  cucumber: {
    id: "cucumber",
    name: "오이",
    temperature: {
      optimalDay: [25, 28],
      optimalNight: [15, 18],
      optimalAverage: null,
      soilTemperature: [20, 23],
      growthStartTemperature: null,
    },
    soil: {
      preferredTextures: ["식양토"],
      ph: [5.5, 6.8],
      ec: 2.0,
      drainageImportant: true,
    },
    rainfall: {
      annual: null,
      growingSeason: null,
      monthly: [150, 200],
      conditionalNote: "월간 누적 강수량 기준",
    },
    coldRisks: [
      {
        stage: "growth",
        threshold: 10,
        description: "10℃ 이하에서 저온 피해 위험",
      },
    ],
    heatRisks: [],
    notes: [
      "발아 적온 22~25℃",
      "별도 자료에 생육 온도 20~22℃가 있으나, 프로토타입 점수에는 주간·야간 적온을 우선 사용",
      "가뭄에 약함",
      "장마철 다습과 통풍 불량 시 노균병·흰가루병 위험 증가",
      "월간 강수량 기준은 다른 작물의 생육기 누적값과 구분",
    ],
    sources: ["농사로 도시농업 텃밭 가꾸기 오이편"],
  },
};
