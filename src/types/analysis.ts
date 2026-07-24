export type CropId =
  | "apple"
  | "pear"
  | "cucumber"
  | "potato"
  | "lettuce";

export type DataLevel =
  | "parcel"
  | "district"
  | "city"
  | "sample";

/**
 * 필지(지번) 입력. "정밀 분석"에서만 선택적으로 채워진다.
 * PNU는 여기서 만들지 않는다 — 서버(soil.ts)가 legalDistrictCode(=LocationInput.stdgCode)와
 * 이 값들로 매 요청마다 다시 구성한다(클라이언트가 계산한 PNU를 신뢰하지 않음).
 */
export interface ParcelInput {
  /** true면 산 지번, false면 일반 지번. */
  mountain: boolean;
  /** 본번. 1~9999. */
  mainNumber: number;
  /** 부번. 0~9999. 없으면 생략(0000으로 처리). */
  subNumber?: number | null;
}

export interface LocationInput {
  address: string;
  latitude?: number;
  longitude?: number;
  nx?: number;
  ny?: number;
  /** 전국 법정동 검색(legalDistrictSearch)에서 선택된 10자리 법정동코드. SoilExam V2 STDG_CD로 쓰인다. */
  stdgCode?: string;
  /** nx/ny가 어느 정밀도로 확보됐는지(검색 시점에 함께 계산됨). nx/ny가 없으면 의미 없음. */
  weatherGridPrecision?: "town" | "city" | "province";
  /** 선택적 필지 지번. 있으면 getSoil()이 SoilCharac(V3)로 토성·배수·유효토심을 추가 조회한다("정밀 분석"). */
  parcel?: ParcelInput | null;
}

/** UI 표시용 구분 — 실제 조회 흐름은 LocationInput.parcel 유무만으로 결정된다. */
export type AnalysisMode = "simple" | "parcel";

export interface DailyWeather {
  date: string;
  minTemperature: number | null;
  maxTemperature: number | null;
  averageTemperature: number | null;
  rainfallMm: number | null;
  humidityPercent: number | null;
  windSpeedMs: number | null;
}

export interface WeatherData {
  current: DailyWeather | null;
  forecast: DailyWeather[];
  source: string;
  observedAt: string;
  isMock: boolean;
}

export type SoilDataStatus = "ok" | "no-data" | "mock";

/**
 * 필지(지번) 단위 토양특성(SoilCharac V3) 조회 상태.
 * "ok": PNU로 조회해 토성/배수/유효토심 중 하나 이상 확보. "no-data": 정상 응답이지만 그 필지에
 * 등록된 값이 없음(존재하지 않는 필지라는 뜻은 아님). "not-requested": 지번을 입력하지 않음(기본,
 * "간편 분석"). "invalid-pnu": 입력값 자체가 PNU 형식 요건을 만족하지 않아 API를 호출하지 않음.
 * "error": API 호출은 했지만 실패(네트워크/인증/그 외 오류 코드).
 */
export type SoilParcelStatus = "ok" | "no-data" | "not-requested" | "invalid-pnu" | "error";

export interface SoilParcelData {
  status: SoilParcelStatus;
  /** 필지 단위 토양특성 출처. status가 ok가 아니면 null. */
  source: string | null;
}

export interface SoilData {
  ph: number | null;
  ecDsM: number | null;
  /** "정밀 분석"에서 지번 조회가 성공한 경우에만 값이 채워진다(그 외에는 항상 null). */
  texture: string | null;
  /** 위 texture와 동일한 조건(parcel.status==="ok")에서만 값이 채워진다. */
  drainage: string | null;
  /** 위 texture와 동일한 조건(parcel.status==="ok")에서만 값이 채워진다. */
  effectiveDepthCm: number | null;
  dataLevel: DataLevel;
  source: string;
  observedAt: string | null;
  isMock: boolean;
  /**
   * "ok": 실제 API가 표본을 반환함. "no-data": 실제 API가 정상 응답했지만 해당 지역 표본이
   * 없음(Result_Code=301, mock 아님). "mock": API 실패/미설정/개발 모드로 대체 데이터 사용.
   * 기존 코드와의 호환을 위해 optional로 둔다 — 없으면 isMock으로만 판단한다.
   * pH·EC(지역 화학성)에 대한 상태이며, texture/drainage/effectiveDepthCm(필지 특성)의 상태는
   * 별도인 parcel 필드를 본다 — 두 조회는 서로 독립적으로 실패/성공할 수 있다.
   */
  dataStatus?: SoilDataStatus;
  /**
   * 필지(지번) 단위 토양특성 조회 결과. getSoil()이 항상 채운다(지번 미입력이면
   * status="not-requested"). 기존 코드와의 호환을 위해 optional로 둔다.
   */
  parcel?: SoilParcelData;
}

export interface FertilizerPrescription {
  nitrogenKg: number | null;
  phosphorusKg: number | null;
  potassiumKg: number | null;
  compostKg: number | null;
  limeKg: number | null;
  기준면적M2: number | null;
  source: string;
  isFallback: boolean;
}

export interface NumericRange {
  optimalMin: number | null;
  optimalMax: number | null;
  acceptableMin: number | null;
  acceptableMax: number | null;
  unit: string;
  weight: number;
}

export interface CropStandard {
  id: CropId;
  name: string;
  temperature: NumericRange;
  soilPh: NumericRange;
  soilEc: NumericRange;
  rainfall: NumericRange;
  preferredTextures: string[];
  coldDangerThreshold: number | null;
  heatDangerThreshold: number | null;
  notes: string[];
  sources: string[];
}

export type ScoreStatus =
  | "optimal"
  | "caution"
  | "danger"
  | "missing";

export interface ScoreDetail {
  variable: string;
  label: string;
  score: number | null;
  weight: number;
  actualValue: number | string | null;
  optimalRange: string;
  status: ScoreStatus;
  reason: string;
}

export type RiskSeverity = "info" | "warning" | "danger";

export interface RiskItem {
  id: string;
  title: string;
  severity: RiskSeverity;
  evidence: string;
  action: string;
}

export interface AnalysisInput {
  location: LocationInput;
  crop: CropId;
  growthStage?: string;
  areaM2?: number;
}

export interface AnalysisResult {
  location: string;
  crop: CropId;
  overallScore: number | null;
  weatherScore: number | null;
  soilScore: number | null;
  confidenceScore: number;
  scoreDetails: ScoreDetail[];
  risks: RiskItem[];
  weather: WeatherData;
  soil: SoilData;
  fertilizer: FertilizerPrescription | null;
  generatedGuide: string | null;
  sources: string[];
  generatedAt: string;
}

export type PestRiskLevel = "low" | "medium" | "high";

export interface PestItem {
  diseaseName: string | null;
  pestName: string | null;
  riskLevel: PestRiskLevel | null;
  prevention: string | null;
  response: string | null;
}

export interface NormalizedPestData {
  crop: CropId;
  items: PestItem[];
  source: string;
  observedAt: string;
  isMock: boolean;
}

/** NCPMS 병 검색 서비스(SVC01) 정규화 결과. 증상/예방법/방제법은 이 API에 없으므로 포함하지 않는다. */
export interface NormalizedDiseaseSearchItem {
  id: string;
  cropName: string | null;
  nameKor: string;
  nameChn: string | null;
  nameEng: string | null;
  thumbnailUrl: string | null;
  originalImageUrl: string | null;
  source: "NCPMS";
}

/** NCPMS 병 상세정보 서비스(SVC05) 정규화 결과. */
export interface NormalizedDiseaseDetail {
  id: string;

  cropName: string | null;

  nameKor: string;
  nameChn: string | null;
  nameEng: string | null;

  infectionRoute: string | null;
  developmentCondition: string | null;
  symptoms: string | null;

  preventionMethod: string | null;
  biologicalControlMethod: string | null;
  chemicalControlMethod: string | null;

  pathogenNames: string[];
  pathogenFeatures: string[];

  pathogenImages: {
    url: string;
    title: string | null;
  }[];

  diseaseImages: {
    url: string;
    title: string | null;
    relatedField: string | null;
  }[];

  etc: string | null;

  source: "NCPMS";
}

/** NCPMS 해충 검색 서비스(SVC03) 정규화 결과. 증상/방제법은 이 API에 없으므로 포함하지 않는다. */
export interface NormalizedInsectSearchItem {
  id: string;
  cropName: string | null;
  nameKor: string;
  speciesName: string | null;
  thumbnailUrl: string | null;
  originalImageUrl: string | null;
  source: "NCPMS";
}

/** NCPMS 해충 상세정보 서비스(SVC07) 정규화 결과. */
export interface NormalizedInsectDetail {
  id: string;

  cropName: string | null;

  orderName: string | null;
  genusName: string | null;
  familyName: string | null;

  speciesName: string | null;
  speciesNameKor: string;

  subspeciesName: string | null;
  subgenusName: string | null;

  author: string | null;
  authorYear: string | null;

  distributionInfo: string | null;
  morphologyInfo: string | null;
  quarantineInfo: string | null;
  ecologyInfo: string | null;
  damageInfo: string | null;

  preventionMethod: string | null;
  biologicalControlMethod: string | null;
  chemicalControlMethod: string | null;

  speciesPhotos: {
    url: string;
    title: string | null;
  }[];

  pestImages: {
    url: string;
    title: string | null;
    relatedField: string | null;
  }[];

  naturalEnemies: {
    id: string | null;
    nameKor: string | null;
    speciesName: string | null;
    orderName: string | null;
    familyName: string | null;
    imageUrl: string | null;
  }[];

  detailLink: string | null;

  source: "NCPMS";
}
