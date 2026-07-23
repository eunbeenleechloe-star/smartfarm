import type { LocationInput, SoilData } from "@/types/analysis";
import { mockSoil } from "@/mocks/soil";
import { getRequiredEnv } from "./env";

/**
 * API 담당자는 이 함수 내부만 구현하면 됩니다.
 * pH/EC/토성 값이 없으면 null을 유지하세요.
 */
export async function getSoil(
  location: LocationInput,
): Promise<SoilData> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  let hasApiKey = false;
  if (!useMock) {
    try {
      getRequiredEnv("SOIL_API_KEY");
      hasApiKey = true;
    } catch {
      hasApiKey = false;
    }
  }

  if (!hasApiKey) {
    return {
      ...mockSoil,
      source: `${mockSoil.source} (${location.address})`,
    };
  }

  throw new Error(
    "토양 API 연동이 아직 구현되지 않았습니다. mock 모드를 사용하세요.",
  );
}
