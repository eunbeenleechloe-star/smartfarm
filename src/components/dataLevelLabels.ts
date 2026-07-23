import type { DataLevel } from "@/types/analysis";

export const DATA_LEVEL_LABELS: Record<DataLevel, string> = {
  parcel: "필지 데이터",
  district: "읍면동 평균",
  city: "시군 평균",
  sample: "샘플 데이터",
};
