import type { NormalizedInsectDetail } from "@/types/analysis";
import { getRequiredEnv } from "../env";
import { NCPMS_BASE_URL, throwIfNcpmsError } from "./shared";

/**
 * NCPMS 해충 상세정보 서비스(SVC07) 곤충 사진 1건.
 * 실호출로 확인됨: 문서의 spcsPhotoData/image, spcsPhotoData/imageTitle과 달리
 * 실제 키는 image/priyClNm(발육단계: 성충·알·유충 등)/photoSj(사진 제목)이고, imageTitle 키는 없다.
 */
interface NcpmsSpcsPhotoItem {
  image?: string;
  photoSj?: string;
  priyClNm?: string;
}

/**
 * NCPMS 해충 상세정보 서비스(SVC07) 해충 피해 이미지 1건.
 * 실호출로 확인됨: image/imageTitle은 문서대로지만, "관련분야" 필드명은 병 상세(SVC05)의
 * iemSpchcknNm이 아니라 iemSpchcknCodeNm이다("Code"가 하나 더 있음). iemSpchcknCode(분류코드)는
 * 명세에 없는 필드라 매핑하지 않는다.
 */
interface NcpmsInsectImageItem {
  image?: string;
  imageTitle?: string;
  iemSpchcknCodeNm?: string;
}

/**
 * NCPMS 해충 상세정보 서비스(SVC07) 천적곤충 1건.
 * 실호출로 확인됨: 배열 이름은 enemyInsectList이고, 문서의 top-level insectKey는 상세 대상
 * 해충의 키가 아니라 이 배열 안 각 항목의 "천적곤충 자신의" 조회키다(예: "E00000020").
 * pageIndex/pageUnit/pageSize는 페이지네이션 메타데이터로 명세에 없어 매핑하지 않는다.
 */
interface NcpmsEnemyInsectItem {
  insectKey?: string | number;
  enemyInsectSpeciesKor?: string;
  enemyInsectSpecies?: string;
  enemyInsectOrder?: string;
  enemyInsectFamily?: string;
  enemyImage?: string;
}

/** NCPMS 해충 상세정보 서비스(SVC07) 원본 응답. */
interface NcpmsInsectDetailRaw {
  buildTime?: string;
  cropName?: string;
  insectOrder?: string;
  insectGenus?: string;
  insectFamily?: string;
  insectSpecies?: string;
  insectSpeciesKor?: string;
  insectSubspecies?: string;
  insectSubgenus?: string;
  insectAuthor?: string;
  authYear?: string;
  distrbInfo?: string;
  stleInfo?: string;
  qrantInfo?: string;
  ecologyInfo?: string;
  damageInfo?: string;
  preventMethod?: string;
  biologyPrvnbeMth?: string;
  chemicalPrvnbeMth?: string;
  insectLink?: string;
  spcsPhotoData?: NcpmsSpcsPhotoItem | NcpmsSpcsPhotoItem[];
  imageList?: NcpmsInsectImageItem | NcpmsInsectImageItem[];
  enemyInsectList?: NcpmsEnemyInsectItem | NcpmsEnemyInsectItem[];
}

/** 실제 응답에서 단일 객체로 올 수도 있어 항상 배열로 통일한다. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toNullableString(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeInsectKey(insectKey: string | number | undefined | null): string | null {
  if (insectKey === undefined || insectKey === null) return null;
  const key = String(insectKey).trim();
  return key.length > 0 ? key : null;
}

/** url이 없는 사진은 버린다(제목만 있고 이미지가 없는 항목은 의미가 없음). */
function toSpeciesPhotos(
  spcsPhotoData: NcpmsInsectDetailRaw["spcsPhotoData"],
): NormalizedInsectDetail["speciesPhotos"] {
  return toArray(spcsPhotoData)
    .map((item) => ({
      url: toNullableString(item?.image),
      title: toNullableString(item?.photoSj),
    }))
    .filter((entry): entry is { url: string; title: string | null } => entry.url !== null);
}

function toPestImages(
  imageList: NcpmsInsectDetailRaw["imageList"],
): NormalizedInsectDetail["pestImages"] {
  return toArray(imageList)
    .map((item) => ({
      url: toNullableString(item?.image),
      title: toNullableString(item?.imageTitle),
      relatedField: toNullableString(item?.iemSpchcknCodeNm),
    }))
    .filter(
      (entry): entry is { url: string; title: string | null; relatedField: string | null } =>
        entry.url !== null,
    );
}

function toNaturalEnemies(
  enemyInsectList: NcpmsInsectDetailRaw["enemyInsectList"],
): NormalizedInsectDetail["naturalEnemies"] {
  return toArray(enemyInsectList).map((item) => ({
    id: normalizeInsectKey(item?.insectKey),
    nameKor: toNullableString(item?.enemyInsectSpeciesKor),
    speciesName: toNullableString(item?.enemyInsectSpecies),
    orderName: toNullableString(item?.enemyInsectOrder),
    familyName: toNullableString(item?.enemyInsectFamily),
    imageUrl: toNullableString(item?.enemyImage),
  }));
}

/**
 * 응답 envelope은 실제 호출로 확인됨: service 바로 아래에 기본분류/상세/사진/천적곤충 필드가
 * 모두 평탄하게 온다(SVC05와 동일한 패턴). service.item으로 한 번 더 감싸져 오는 경우까지
 * 방어적으로 대비한다. 기본 분류 필드가 하나도 없으면 데이터 없음으로 본다.
 */
function extractDetailRecord(data: unknown): NcpmsInsectDetailRaw | null {
  const root = data as Record<string, unknown> | null | undefined;
  const service = root?.service as Record<string, unknown> | undefined;
  if (!service) return null;

  const record = (
    service.item && typeof service.item === "object" && !Array.isArray(service.item)
      ? service.item
      : service
  ) as NcpmsInsectDetailRaw;

  const hasContent = Boolean(
    record.cropName || record.insectSpeciesKor || record.insectSpecies || record.insectOrder,
  );
  return hasContent ? record : null;
}

function toNormalizedDetail(
  raw: NcpmsInsectDetailRaw,
  insectKey: string,
): NormalizedInsectDetail {
  return {
    id: insectKey,
    cropName: toNullableString(raw.cropName),
    orderName: toNullableString(raw.insectOrder),
    genusName: toNullableString(raw.insectGenus),
    familyName: toNullableString(raw.insectFamily),
    speciesName: toNullableString(raw.insectSpecies),
    speciesNameKor: raw.insectSpeciesKor ?? "",
    subspeciesName: toNullableString(raw.insectSubspecies),
    subgenusName: toNullableString(raw.insectSubgenus),
    author: toNullableString(raw.insectAuthor),
    authorYear: toNullableString(raw.authYear),
    distributionInfo: toNullableString(raw.distrbInfo),
    morphologyInfo: toNullableString(raw.stleInfo),
    quarantineInfo: toNullableString(raw.qrantInfo),
    ecologyInfo: toNullableString(raw.ecologyInfo),
    damageInfo: toNullableString(raw.damageInfo),
    preventionMethod: toNullableString(raw.preventMethod),
    biologicalControlMethod: toNullableString(raw.biologyPrvnbeMth),
    chemicalControlMethod: toNullableString(raw.chemicalPrvnbeMth),
    speciesPhotos: toSpeciesPhotos(raw.spcsPhotoData),
    pestImages: toPestImages(raw.imageList),
    naturalEnemies: toNaturalEnemies(raw.enemyInsectList),
    detailLink: toNullableString(raw.insectLink),
    source: "NCPMS",
  };
}

/**
 * NCPMS 해충 상세정보 서비스(SVC07) 원본 응답을 NormalizedInsectDetail로 정규화하는 순수 함수.
 * 네트워크 호출과 분리되어 있어 샘플 응답으로 단위 검증이 가능하다(runInsectDetailSelfChecks 참고).
 * 명세에 없는 필드(iemSpchcknCode, spcsCode, pageIndex 등)는 채우지 않는다.
 * 데이터가 없으면 null을 반환한다.
 */
export function normalizeInsectDetailResponse(
  data: unknown,
  insectKey: string,
): NormalizedInsectDetail | null {
  throwIfNcpmsError(data);

  const raw = extractDetailRecord(data);
  if (!raw) return null;

  return toNormalizedDetail(raw, insectKey);
}

/**
 * NCPMS 해충 상세정보 서비스(SVC07) 호출.
 * 문서에는 insectKey가 Integer로 되어 있으나 SVC03 실제 응답에서 "H00000594" 같은 문자열이
 * 확인되었으므로 항상 string으로 다룬다.
 */
export async function getInsectDetail(
  insectKey: string,
): Promise<NormalizedInsectDetail | null> {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  let apiKey: string | null = null;
  if (!useMock) {
    try {
      apiKey = getRequiredEnv("PEST_API_KEY");
    } catch {
      apiKey = null;
    }
  }

  if (!apiKey) {
    return null;
  }

  const url = new URL(NCPMS_BASE_URL);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("serviceCode", "SVC07");
  url.searchParams.set("insectKey", insectKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`NCPMS 해충 상세정보 API 응답 오류: HTTP ${res.status}`);
  }

  // Content-Type이 application/xml로 잘못 표시돼도 body는 JSON이라 res.json()이 그대로 동작한다(SVC05와 동일).
  const data = (await res.json()) as unknown;
  return normalizeInsectDetailResponse(data, insectKey);
}

export interface InsectDetailSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * 실제 API 키 없이 normalizeInsectDetailResponse()의 매핑 정확성을 점검한다.
 * 샘플 값은 필드 매핑 검증용 테스트 픽스처이며(실제 호출로 확인한 응답 구조를 반영),
 * 실제 NCPMS 데이터가 아니다.
 */
export function runInsectDetailSelfChecks(): InsectDetailSelfCheckResult[] {
  const results: InsectDetailSelfCheckResult[] = [];

  const fullResponse = {
    service: {
      qrantInfo: "미국의 규제 대상 검역 해충",
      insectAuthor: "(Kuwana)",
      damageInfo: "암컷성충은 몸길이가 4㎜내외의 타원형으로 전체가 흰가루로 덮혀 있다.<br/>기주범위가 넓다.",
      spcsPhotoData: [
        { image: "https://ncpms.rda.go.kr/spcs/1.jpg", priyClNm: "성충", photoSj: "가루깍지벌레" },
        { image: "https://ncpms.rda.go.kr/spcs/2.jpg", priyClNm: "알" },
      ],
      preventMethod: "겨울을 보낸 알은 주지 등의 껍질 밑에 많으므로 이곳의 껍질을 긁어모아 불태운다.",
      enemyInsectList: [
        {
          enemyImage: "https://ncpms.rda.go.kr/enemy/1.jpg",
          insectKey: "E00000020",
          enemyInsectOrder: "딱정벌레목",
          enemyInsectSpeciesKor: "깍지무당벌레",
          enemyInsectFamily: "무당벌레과",
          enemyInsectSpecies: "montrouzieri",
        },
      ],
      stleInfo: "몸은 타원형이며 황갈색 또는 암갈색인데 그 위는 흰색의 밀랍으로 덮여 있다.",
      chemicalPrvnbeMth: "",
      insectGenus: "Pseudococcus",
      authYear: "1902",
      cropName: "사과",
      distrbInfo: "",
      insectSpeciesKor: "가루깍지벌레",
      insectFamily: "가루깍지벌레과",
      ecologyInfo: "연 3회 발생하며 백색 납질물로 덮인 알 덩어리로 겨울을 지난다.",
      insectOrder: "매미목",
      insectSpecies: "comstocki",
      imageList: [
        {
          image: "https://ncpms.rda.go.kr/hlsct/1.jpg",
          imageTitle: "가루깍지벌레 피해 과실(열매)",
        },
        {
          image: "https://ncpms.rda.go.kr/hlsct/2.jpg",
          iemSpchcknCode: "28602",
          imageTitle: "가루깍지벌레_9(가지)",
          iemSpchcknCodeNm: "피해정보",
        },
      ],
      biologyPrvnbeMth: "",
    },
  };

  const detail = normalizeInsectDetailResponse(fullResponse, "H00000594");

  results.push({
    label: "1. 정상 상세 응답이 NormalizedInsectDetail로 매핑됨",
    passed: detail !== null && detail.speciesNameKor === "가루깍지벌레",
    message: JSON.stringify(detail),
  });

  results.push({
    label: "2. insectKey가 그대로 문자열 id로 유지됨(요청 시 넘긴 값 그대로)",
    passed: detail?.id === "H00000594",
    message: `id=${JSON.stringify(detail?.id)}`,
  });

  const singlePhotoResponse = {
    service: {
      cropName: "사과",
      insectSpeciesKor: "가루깍지벌레",
      spcsPhotoData: { image: "https://ncpms.rda.go.kr/spcs/1.jpg", photoSj: "성충" },
    },
  };
  const singlePhotoDetail = normalizeInsectDetailResponse(singlePhotoResponse, "x");

  results.push({
    label: "3. 단일 객체 spcsPhotoData(배열 아님)가 배열로 변환됨",
    passed:
      singlePhotoDetail?.speciesPhotos.length === 1 &&
      singlePhotoDetail?.speciesPhotos[0]?.url === "https://ncpms.rda.go.kr/spcs/1.jpg",
    message: JSON.stringify(singlePhotoDetail?.speciesPhotos),
  });

  const singleImageResponse = {
    service: {
      cropName: "사과",
      insectSpeciesKor: "가루깍지벌레",
      imageList: { image: "https://ncpms.rda.go.kr/hlsct/1.jpg", imageTitle: "피해" },
    },
  };
  const singleImageDetail = normalizeInsectDetailResponse(singleImageResponse, "x");

  results.push({
    label: "4. 단일 객체 imageList(배열 아님)가 배열로 변환됨",
    passed:
      singleImageDetail?.pestImages.length === 1 &&
      singleImageDetail?.pestImages[0]?.title === "피해",
    message: JSON.stringify(singleImageDetail?.pestImages),
  });

  results.push({
    label: "5. spcsPhotoData 2건 중 photoSj(title) 없는 항목은 null (imageTitle 키가 없어도 안전)",
    passed:
      detail?.speciesPhotos.length === 2 &&
      detail.speciesPhotos[0]?.title === "가루깍지벌레" &&
      detail.speciesPhotos[1]?.title === null,
    message: JSON.stringify(detail?.speciesPhotos),
  });

  results.push({
    label: "6. imageList 2건 중 iemSpchcknCodeNm(relatedField) 있는/없는 항목이 각각 반영됨",
    passed:
      detail?.pestImages.length === 2 &&
      detail.pestImages[0]?.relatedField === null &&
      detail.pestImages[1]?.relatedField === "피해정보",
    message: JSON.stringify(detail?.pestImages),
  });

  const noUrlImageResponse = {
    service: {
      cropName: "사과",
      insectSpeciesKor: "가루깍지벌레",
      imageList: [{ imageTitle: "url 없는 항목" }, { image: "https://ncpms.rda.go.kr/hlsct/2.jpg" }],
    },
  };
  const noUrlImageDetail = normalizeInsectDetailResponse(noUrlImageResponse, "x");

  results.push({
    label: "7. 이미지 URL이 없는 항목은 제외됨",
    passed: noUrlImageDetail?.pestImages.length === 1,
    message: JSON.stringify(noUrlImageDetail?.pestImages),
  });

  results.push({
    label: "8. 천적곤충 단일/배열 모두 처리 — 배열 1건이 naturalEnemies로 매핑됨",
    passed:
      detail?.naturalEnemies.length === 1 &&
      detail.naturalEnemies[0]?.id === "E00000020" &&
      detail.naturalEnemies[0]?.nameKor === "깍지무당벌레",
    message: JSON.stringify(detail?.naturalEnemies),
  });

  const singleEnemyResponse = {
    service: {
      cropName: "사과",
      insectSpeciesKor: "가루깍지벌레",
      enemyInsectList: { insectKey: "E00000099", enemyInsectSpeciesKor: "무당벌레" },
    },
  };
  const singleEnemyDetail = normalizeInsectDetailResponse(singleEnemyResponse, "x");

  results.push({
    label: "9. 천적곤충이 단일 객체(배열 아님)로 와도 배열로 변환됨",
    passed:
      singleEnemyDetail?.naturalEnemies.length === 1 &&
      singleEnemyDetail?.naturalEnemies[0]?.nameKor === "무당벌레",
    message: JSON.stringify(singleEnemyDetail?.naturalEnemies),
  });

  const missingFieldsResponse = {
    service: { cropName: "사과", insectSpeciesKor: "가루깍지벌레" },
  };
  const missingDetail = normalizeInsectDetailResponse(missingFieldsResponse, "x");

  results.push({
    label: "10. 누락된 문자열 필드는 null로 처리되고 배열 필드는 빈 배열로 처리됨",
    passed:
      missingDetail?.damageInfo === null &&
      missingDetail?.author === null &&
      Array.isArray(missingDetail?.speciesPhotos) &&
      missingDetail?.speciesPhotos.length === 0 &&
      Array.isArray(missingDetail?.naturalEnemies) &&
      missingDetail?.naturalEnemies.length === 0,
    message: JSON.stringify(missingDetail),
  });

  results.push({
    label: "11. HTML 태그(<br/>)가 포함된 원문 문자열이 그대로 보존됨(sanitize하지 않음)",
    passed: detail?.damageInfo?.includes("<br/>") ?? false,
    message: `damageInfo=${JSON.stringify(detail?.damageInfo)}`,
  });

  const errorResponse = {
    service: { errorCode: "ERR_101", errorMsg: "인증키가 등록되지 않았습니다." },
  };

  let errorMessage = "";
  try {
    normalizeInsectDetailResponse(errorResponse, "x");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  results.push({
    label: "12. ERR_101(인증키 누락) 응답 시 에러를 던짐",
    passed: errorMessage.includes("ERR_101"),
    message: errorMessage,
  });

  const emptyResponse = { service: {} };
  const emptyDetail = normalizeInsectDetailResponse(emptyResponse, "x");

  results.push({
    label: "13. 빈 응답(기본 분류 필드 없음) → null 반환",
    passed: emptyDetail === null,
    message: JSON.stringify(emptyDetail),
  });

  results.push({
    label: "14. source는 항상 리터럴 'NCPMS'",
    passed: detail?.source === "NCPMS",
    message: `source=${JSON.stringify(detail?.source)}`,
  });

  return results;
}
