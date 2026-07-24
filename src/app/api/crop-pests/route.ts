import { NextResponse } from "next/server";
import { NCPMS_CROP_NAME_MAP, isCropId } from "@/services/ncpms/cropNameMap";
import { searchDiseases, getDiseaseDetail, searchInsects, getInsectDetail } from "@/services/ncpms";
import { buildMockCropPestsResponse } from "@/mocks/pests";
import type {
  CropPestsResponse,
  CropPestsErrorResponse,
  DiseaseCardItem,
  InsectCardItem,
} from "@/types/cropPests";
import type { NormalizedDiseaseSearchItem, NormalizedInsectSearchItem } from "@/types/analysis";

/**
 * 분석 결과 화면에 "이 작물의 주요 병해충 정보"를 채우기 위한 전용 API 라우트.
 * NCPMS 호출은 반드시 이 서버 라우트 안에서만 이루어지며, apiKey는 클라이언트로 전달되지 않는다.
 * 이 라우트는 병해충 데이터를 위험도/발생 확률로 가공하지 않는다 — 원본 정보(증상/방제법 등)만 전달한다.
 */

const MAX_SEARCH_RESULTS = 5;
const MAX_DETAIL_COUNT = 3;

function resolveCropName(searchParams: URLSearchParams): string | null {
  const cropId = searchParams.get("cropId");
  if (cropId && isCropId(cropId)) {
    return NCPMS_CROP_NAME_MAP[cropId];
  }

  const cropName = searchParams.get("cropName")?.trim();
  return cropName ? cropName : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function buildDiseaseCards(items: NormalizedDiseaseSearchItem[]): Promise<DiseaseCardItem[]> {
  return Promise.all(
    items.slice(0, MAX_DETAIL_COUNT).map(async (item) => ({
      id: item.id,
      cropName: item.cropName,
      nameKor: item.nameKor,
      nameEng: item.nameEng,
      thumbnailUrl: item.thumbnailUrl,
      detail: await getDiseaseDetail(item.id).catch((error) => {
        console.error("[crop-pests] 병 상세 조회 실패:", errorMessage(error));
        return null;
      }),
    })),
  );
}

async function buildInsectCards(items: NormalizedInsectSearchItem[]): Promise<InsectCardItem[]> {
  return Promise.all(
    items.slice(0, MAX_DETAIL_COUNT).map(async (item) => ({
      id: item.id,
      cropName: item.cropName,
      nameKor: item.nameKor,
      speciesName: item.speciesName,
      thumbnailUrl: item.thumbnailUrl,
      detail: await getInsectDetail(item.id).catch((error) => {
        console.error("[crop-pests] 해충 상세 조회 실패:", errorMessage(error));
        return null;
      }),
    })),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cropName = resolveCropName(searchParams);

  if (!cropName) {
    const body: CropPestsErrorResponse = { message: "cropId 또는 cropName이 필요합니다." };
    return NextResponse.json(body, { status: 400 });
  }

  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") {
    return NextResponse.json(buildMockCropPestsResponse(cropName));
  }

  try {
    const [diseaseSearchOutcome, insectSearchOutcome] = await Promise.allSettled([
      searchDiseases({ cropName, displayCount: MAX_SEARCH_RESULTS }),
      searchInsects({ cropName, displayCount: MAX_SEARCH_RESULTS }),
    ]);

    const diseaseSearchFailed = diseaseSearchOutcome.status === "rejected";
    const insectSearchFailed = insectSearchOutcome.status === "rejected";

    if (diseaseSearchFailed) {
      console.error("[crop-pests] 병 검색 실패:", errorMessage(diseaseSearchOutcome.reason));
    }
    if (insectSearchFailed) {
      console.error("[crop-pests] 해충 검색 실패:", errorMessage(insectSearchOutcome.reason));
    }

    const diseases = diseaseSearchFailed
      ? []
      : await buildDiseaseCards(diseaseSearchOutcome.value);
    const insects = insectSearchFailed ? [] : await buildInsectCards(insectSearchOutcome.value);

    const response: CropPestsResponse = {
      cropName,
      diseases,
      insects,
      source: "NCPMS",
      dataStatus: {
        partialFailure: diseaseSearchFailed || insectSearchFailed,
        diseaseSearchFailed,
        insectSearchFailed,
        isMock: false,
      },
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[crop-pests] 병해충 정보 조회 중 오류:", errorMessage(error));
    const body: CropPestsErrorResponse = {
      message: "병해충 정보를 불러오는 중 오류가 발생했습니다.",
    };
    return NextResponse.json(body, { status: 500 });
  }
}
