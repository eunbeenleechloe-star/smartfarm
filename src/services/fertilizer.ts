import type {
  CropId,
  FertilizerPrescription,
  LocationInput,
} from "@/types/analysis";
import { mockFertilizer } from "@/mocks/fertilizer";

/**
 * 비료 처방량을 LLM으로 생성하지 마세요.
 * API 또는 공식 정적 fallback만 반환해야 합니다.
 */
export async function getFertilizer(
  crop: CropId,
  location: LocationInput,
  areaM2?: number,
): Promise<FertilizerPrescription | null> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  if (useMock || !process.env.FERTILIZER_API_KEY) {
    const prescription = mockFertilizer[crop];
    if (!prescription) return null;
    return {
      ...prescription,
      기준면적M2: areaM2 ?? prescription.기준면적M2,
      source: `${prescription.source} (${location.address})`,
    };
  }

  throw new Error(
    "비료사용처방 API 연동이 아직 구현되지 않았습니다.",
  );
}
