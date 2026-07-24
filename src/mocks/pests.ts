import type { CropPestsResponse, DiseaseCardItem, InsectCardItem } from "@/types/cropPests";

/**
 * NEXT_PUBLIC_USE_MOCK_DATA=true일 때 사용하는 최소 mock 병해충 데이터.
 * 실제 NCPMS 조회 없이 화면 동작을 확인하기 위한 데모용 값이며 실제 병해충 정보가 아니다.
 * source(개별 detail의 "NCPMS" 리터럴)는 공통 타입(NormalizedDiseaseDetail/NormalizedInsectDetail)의
 * 고정 필드라 그대로 두고, mock 여부는 응답 최상위 source="MOCK" / dataStatus.isMock으로만 판단한다.
 */
function buildMockDisease(cropName: string): DiseaseCardItem {
  return {
    id: "MOCK-D001",
    cropName,
    nameKor: `${cropName} 예시 병(mock)`,
    nameEng: "Sample disease (mock)",
    thumbnailUrl: null,
    detail: {
      id: "MOCK-D001",
      cropName,
      nameKor: `${cropName} 예시 병(mock)`,
      nameChn: null,
      nameEng: "Sample disease (mock)",
      infectionRoute: "빗물과 바람에 의해 포자가 퍼집니다.(mock 데이터)",
      developmentCondition: "저온다습한 환경에서 발생이 늘어납니다.(mock 데이터)",
      symptoms: "잎과 줄기에 반점이 생깁니다.<br/>증상이 진행되면 잎이 마릅니다.(mock 데이터)",
      preventionMethod: "병든 부위를 제거하고 통풍을 관리합니다.(mock 데이터)",
      biologicalControlMethod: "천적 곤충을 활용한 방제를 검토합니다.(mock 데이터)",
      chemicalControlMethod: "등록 약제를 안전사용기준에 맞게 사용합니다.(mock 데이터)",
      pathogenNames: ["Mock pathogen"],
      pathogenFeatures: [],
      pathogenImages: [],
      diseaseImages: [],
      etc: null,
      source: "NCPMS",
    },
  };
}

function buildMockInsect(cropName: string): InsectCardItem {
  return {
    id: "MOCK-H001",
    cropName,
    nameKor: `${cropName} 예시 해충(mock)`,
    speciesName: "Sample insect (mock)",
    thumbnailUrl: null,
    detail: {
      id: "MOCK-H001",
      cropName,
      orderName: null,
      genusName: null,
      familyName: null,
      speciesName: "Sample insect (mock)",
      speciesNameKor: `${cropName} 예시 해충(mock)`,
      subspeciesName: null,
      subgenusName: null,
      author: null,
      authorYear: null,
      distributionInfo: null,
      morphologyInfo: null,
      quarantineInfo: null,
      ecologyInfo: "연 2~3회 발생합니다.(mock 데이터)",
      damageInfo: "잎과 줄기를 흡즙하여 생육을 저해합니다.(mock 데이터)",
      preventionMethod: "발생 초기에 물리적으로 제거합니다.(mock 데이터)",
      biologicalControlMethod: "천적을 이용한 방제를 검토합니다.(mock 데이터)",
      chemicalControlMethod: "등록 약제를 안전사용기준에 맞게 사용합니다.(mock 데이터)",
      speciesPhotos: [],
      pestImages: [],
      naturalEnemies: [],
      detailLink: null,
      source: "NCPMS",
    },
  };
}

export function buildMockCropPestsResponse(cropName: string): CropPestsResponse {
  return {
    cropName,
    diseases: [buildMockDisease(cropName)],
    insects: [buildMockInsect(cropName)],
    source: "MOCK",
    dataStatus: {
      partialFailure: false,
      diseaseSearchFailed: false,
      insectSearchFailed: false,
      isMock: true,
    },
    fetchedAt: new Date().toISOString(),
  };
}
