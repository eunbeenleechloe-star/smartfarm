import type {
  CropId,
  FertilizerPrescription,
} from "@/types/analysis";

export const mockFertilizer: Partial<
  Record<CropId, FertilizerPrescription>
> = {
  potato: {
    nitrogenKg: 10,
    phosphorusKg: 8.8,
    potassiumKg: 13,
    compostKg: 2000,
    limeKg: null,
    기준면적M2: 1000,
    source: "농업기술길잡이 감자 표준 시비 예시",
    isFallback: true,
  },
};
