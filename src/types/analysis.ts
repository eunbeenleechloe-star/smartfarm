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

export interface LocationInput {
  address: string;
  latitude?: number;
  longitude?: number;
  nx?: number;
  ny?: number;
}

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

export interface SoilData {
  ph: number | null;
  ecDsM: number | null;
  texture: string | null;
  drainage: string | null;
  effectiveDepthCm: number | null;
  dataLevel: DataLevel;
  source: string;
  observedAt: string | null;
  isMock: boolean;
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
