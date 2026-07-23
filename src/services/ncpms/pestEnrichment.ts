import type { CropRiskItem } from "@/lib/cropRiskAnalyzer";
import type {
  CropId,
  NormalizedDiseaseDetail,
  NormalizedDiseaseSearchItem,
  NormalizedInsectDetail,
  NormalizedInsectSearchItem,
} from "@/types/analysis";
import { searchDiseases, type SearchDiseasesParams } from "./diseaseSearch";
import { getDiseaseDetail } from "./diseaseDetail";
import { searchInsects, type SearchInsectsParams } from "./insectSearch";
import { getInsectDetail } from "./insectDetail";

/**
 * cropRiskAnalyzer가 만든 위험 목록을 NCPMS 병해충 정보(설명/피해정보/발생생태/방제방법/이미지)로
 * 보강하는 독립 서비스.
 *
 * 이 모듈은 위험도를 계산하지 않는다. 위험 판단(severity 등)은 cropRiskAnalyzer의 결과를 그대로
 * 신뢰하며, 여기서는 위험 제목에 병해충명이 명확히 있을 때만 NCPMS를 조회해 설명을 덧붙인다.
 * cropAnalysis.ts는 이 파일에서 수정하지 않는다 — 통합은 별도 작업이다.
 */

/** NCPMS 검색 결과 중 cropName/nameKor 우선순위 매칭에 필요한 최소 필드. */
interface SearchMatchable {
  id: string;
  cropName: string | null;
  nameKor: string;
}

interface MatchResult<T extends SearchMatchable> {
  item: T | null;
  reason: string;
}

/**
 * 검색 결과가 여러 건일 때 확정 우선순위.
 * 1) cropName 정확 일치 2) (그 안에서) 병해충 한글명 정확 일치 3) 그래도 여럿이면 확정하지 않음(모호).
 * 첫 번째 결과를 임의로 채택하지 않는다.
 */
function pickBestMatch<T extends SearchMatchable>(
  items: T[],
  cropName: string,
  query: string,
): MatchResult<T> {
  if (items.length === 0) {
    return { item: null, reason: "검색 결과 없음" };
  }

  const cropMatches = items.filter((item) => item.cropName === cropName);
  const pool = cropMatches.length > 0 ? cropMatches : items;

  if (pool.length === 1) {
    return {
      item: pool[0],
      reason: cropMatches.length === 1 ? "cropName 정확 일치" : "검색 결과 1건",
    };
  }

  const nameMatches = pool.filter((item) => item.nameKor === query);
  if (nameMatches.length === 1) {
    return { item: nameMatches[0], reason: "병해충명 정확 일치" };
  }

  return {
    item: null,
    reason: `검색 결과 ${items.length}건 중 cropName/병해충명이 정확히 일치하는 항목이 없어 확정하지 않음(모호)`,
  };
}

type PestRuleType = "disease" | "insect";

interface PestNameRule {
  type: PestRuleType;
  query: string;
}

/**
 * 위험 제목에서 병해충명을 추출하는 규칙을 한곳에서 관리한다.
 * 조사 근거(제공된 예시)가 있는 이름만 등록한다 — 근거 없는 병해충명을 임의로 추가하지 않는다.
 * 새 이름을 추가할 때는 실제 근거를 확인한 뒤 이 표에만 추가하면 된다.
 */
const PEST_NAME_RULES: Record<string, PestNameRule> = {
  역병: { type: "disease", query: "역병" },
  노균병: { type: "disease", query: "노균병" },
  흰가루병: { type: "disease", query: "흰가루병" },
  진딧물: { type: "insect", query: "진딧물" },
};

/** "고온 위험", "집중강우 위험"처럼 병해충명이 없는 제목은 null을 반환해 검색을 건너뛴다. */
function matchPestNameRule(title: string): PestNameRule | null {
  for (const [keyword, rule] of Object.entries(PEST_NAME_RULES)) {
    if (title.includes(keyword)) return rule;
  }
  return null;
}

/**
 * NCPMS 병해충 정보 보강 결과 1건.
 * disease/insect 필드는 NCPMS 원본 상세 텍스트를 그대로 담고 있어 `<br/>` 등 HTML 태그가
 * 섞여 있을 수 있다. 이 서비스는 sanitize하지 않으며, UI에서 렌더링할 때
 * sanitize-html/DOMPurify 또는 plain-text 변환이 필요하다.
 */
export interface EnrichedPestInfo {
  riskId: string | null;
  type: PestRuleType;
  searchName: string;
  disease?: NormalizedDiseaseDetail;
  insect?: NormalizedInsectDetail;
  matched: boolean;
  matchReason: string | null;
  source: "NCPMS";
}

export interface PestEnrichmentInput {
  cropId: CropId;
  cropName: string;
  risks: CropRiskItem[];
}

/** 테스트에서 실제 네트워크 호출 없이 검색/상세 조회를 대체할 수 있도록 하는 의존성. */
export interface PestEnrichmentDeps {
  searchDiseases: (params: SearchDiseasesParams) => Promise<NormalizedDiseaseSearchItem[]>;
  getDiseaseDetail: (sickKey: string) => Promise<NormalizedDiseaseDetail | null>;
  searchInsects: (params: SearchInsectsParams) => Promise<NormalizedInsectSearchItem[]>;
  getInsectDetail: (insectKey: string) => Promise<NormalizedInsectDetail | null>;
}

const defaultDeps: PestEnrichmentDeps = {
  searchDiseases,
  getDiseaseDetail,
  searchInsects,
  getInsectDetail,
};

interface EnrichmentOutcome {
  matched: boolean;
  matchReason: string;
  disease?: NormalizedDiseaseDetail;
  insect?: NormalizedInsectDetail;
}

async function resolveDisease(
  cropName: string,
  query: string,
  deps: PestEnrichmentDeps,
  searchCache: Map<string, unknown>,
  detailCache: Map<string, unknown>,
): Promise<EnrichmentOutcome> {
  const searchKey = `disease-search|${cropName}|${query}`;
  let results = searchCache.get(searchKey) as NormalizedDiseaseSearchItem[] | undefined;
  if (!results) {
    results = await deps.searchDiseases({ cropName, sickNameKor: query });
    searchCache.set(searchKey, results);
  }

  const { item, reason } = pickBestMatch(results, cropName, query);
  if (!item) return { matched: false, matchReason: reason };

  const detailKey = `disease-detail|${item.id}`;
  let detail = detailCache.has(detailKey)
    ? (detailCache.get(detailKey) as NormalizedDiseaseDetail | null)
    : undefined;
  if (detail === undefined) {
    detail = await deps.getDiseaseDetail(item.id).catch(() => null);
    detailCache.set(detailKey, detail);
  }

  if (!detail) return { matched: false, matchReason: "병 상세정보 조회 실패 또는 데이터 없음" };
  return { matched: true, matchReason: reason, disease: detail };
}

async function resolveInsect(
  cropName: string,
  query: string,
  deps: PestEnrichmentDeps,
  searchCache: Map<string, unknown>,
  detailCache: Map<string, unknown>,
): Promise<EnrichmentOutcome> {
  const searchKey = `insect-search|${cropName}|${query}`;
  let results = searchCache.get(searchKey) as NormalizedInsectSearchItem[] | undefined;
  if (!results) {
    results = await deps.searchInsects({ cropName, insectKorName: query });
    searchCache.set(searchKey, results);
  }

  const { item, reason } = pickBestMatch(results, cropName, query);
  if (!item) return { matched: false, matchReason: reason };

  const detailKey = `insect-detail|${item.id}`;
  let detail = detailCache.has(detailKey)
    ? (detailCache.get(detailKey) as NormalizedInsectDetail | null)
    : undefined;
  if (detail === undefined) {
    detail = await deps.getInsectDetail(item.id).catch(() => null);
    detailCache.set(detailKey, detail);
  }

  if (!detail) return { matched: false, matchReason: "해충 상세정보 조회 실패 또는 데이터 없음" };
  return { matched: true, matchReason: reason, insect: detail };
}

async function enrichOneRisk(
  risk: CropRiskItem,
  cropName: string,
  deps: PestEnrichmentDeps,
  searchCache: Map<string, unknown>,
  detailCache: Map<string, unknown>,
): Promise<EnrichedPestInfo | null> {
  const rule = matchPestNameRule(risk.title);
  if (!rule) return null;

  try {
    const outcome =
      rule.type === "disease"
        ? await resolveDisease(cropName, rule.query, deps, searchCache, detailCache)
        : await resolveInsect(cropName, rule.query, deps, searchCache, detailCache);

    return {
      riskId: risk.id,
      type: rule.type,
      searchName: rule.query,
      ...(outcome.disease ? { disease: outcome.disease } : {}),
      ...(outcome.insect ? { insect: outcome.insect } : {}),
      matched: outcome.matched,
      matchReason: outcome.matchReason,
      source: "NCPMS",
    };
  } catch (error) {
    // 키/민감정보는 로그에 남기지 않는다 — 에러 메시지만 남긴다(getRequiredEnv/NCPMS 오류 처리기 모두 값 자체를 포함하지 않음).
    console.error(
      `[pestEnrichment] NCPMS 조회 실패 (type=${rule.type}, query=${rule.query}):`,
      error instanceof Error ? error.message : String(error),
    );
    return {
      riskId: risk.id,
      type: rule.type,
      searchName: rule.query,
      matched: false,
      matchReason: "NCPMS 조회 중 오류 발생",
      source: "NCPMS",
    };
  }
}

/**
 * 위험 목록을 순서대로 처리한다(동시 실행 시 동일 캐시 키에 대한 중복 호출이 발생할 수 있어
 * 의도적으로 순차 처리한다). 병해충명이 없는 위험은 결과에 포함되지 않는다.
 * 검색/상세 조회가 실패해도 예외를 던지지 않고 matched=false로 반환하므로
 * 이 함수를 호출하는 cropAnalysis 쪽 흐름이 실패하지 않는다.
 */
export async function enrichPestInfo(
  input: PestEnrichmentInput,
  deps: PestEnrichmentDeps = defaultDeps,
): Promise<EnrichedPestInfo[]> {
  const searchCache = new Map<string, unknown>();
  const detailCache = new Map<string, unknown>();

  const results: EnrichedPestInfo[] = [];
  for (const risk of input.risks) {
    const enriched = await enrichOneRisk(risk, input.cropName, deps, searchCache, detailCache);
    if (enriched) results.push(enriched);
  }
  return results;
}

export interface PestEnrichmentSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

function makeRisk(title: string, id = `risk-${title}`): CropRiskItem {
  return {
    id,
    // 실제 CropRiskType에는 병해충 타입이 아직 없어(향후 cropRiskAnalyzer 확장 필요) 테스트
    // 픽스처로 기존 타입을 재사용한다. 이 서비스의 매칭 로직은 title만 본다.
    type: "heavyRain",
    title,
    severity: "warning",
    evidence: "테스트 픽스처",
    action: "테스트 픽스처",
  };
}

function makeCallCounter<TArgs extends unknown[], TReturn>(
  impl: (...args: TArgs) => TReturn,
): ((...args: TArgs) => TReturn) & { callCount: number } {
  const fn = ((...args: TArgs): TReturn => {
    fn.callCount += 1;
    return impl(...args);
  }) as ((...args: TArgs) => TReturn) & { callCount: number };
  fn.callCount = 0;
  return fn;
}

/**
 * 실제 API 키/네트워크 없이 enrichPestInfo()의 매칭·캐시·에러 처리 규칙을 점검한다.
 * PestEnrichmentDeps를 스텁으로 교체해 검증하며, 스텁 응답은 필드 매핑 검증용 테스트
 * 픽스처이지 실제 NCPMS 데이터가 아니다.
 */
export async function runPestEnrichmentSelfChecks(): Promise<PestEnrichmentSelfCheckResult[]> {
  const results: PestEnrichmentSelfCheckResult[] = [];

  const sampleDiseaseDetail: NormalizedDiseaseDetail = {
    id: "D00000001",
    cropName: "감자",
    nameKor: "역병",
    nameChn: null,
    nameEng: "Late blight",
    infectionRoute: null,
    developmentCondition: null,
    symptoms: "잎에 갈색 병반이 생긴다.<br/>습도가 높으면 급속히 확산된다.",
    preventionMethod: null,
    biologicalControlMethod: null,
    chemicalControlMethod: null,
    pathogenNames: [],
    pathogenFeatures: [],
    pathogenImages: [],
    diseaseImages: [],
    etc: null,
    source: "NCPMS",
  };

  const sampleInsectDetail: NormalizedInsectDetail = {
    id: "H00000001",
    cropName: "오이",
    orderName: null,
    genusName: null,
    familyName: null,
    speciesName: null,
    speciesNameKor: "진딧물",
    subspeciesName: null,
    subgenusName: null,
    author: null,
    authorYear: null,
    distributionInfo: null,
    morphologyInfo: null,
    quarantineInfo: null,
    ecologyInfo: null,
    damageInfo: "잎과 줄기를 흡즙하여 생육을 저해한다.",
    preventionMethod: null,
    biologicalControlMethod: null,
    chemicalControlMethod: null,
    speciesPhotos: [],
    pestImages: [],
    naturalEnemies: [],
    detailLink: null,
    source: "NCPMS",
  };

  // 1. "감자 역병 위험" → 병 검색
  {
    const searchDiseasesSpy = makeCallCounter(async (): Promise<NormalizedDiseaseSearchItem[]> => [
      {
        id: "D00000001",
        cropName: "감자",
        nameKor: "역병",
        nameChn: null,
        nameEng: null,
        thumbnailUrl: null,
        originalImageUrl: null,
        source: "NCPMS",
      },
    ]);
    const searchInsectsSpy = makeCallCounter(async (): Promise<NormalizedInsectSearchItem[]> => {
      throw new Error("해충 검색은 호출되면 안 됨");
    });

    const output = await enrichPestInfo(
      {
        cropId: "potato",
        cropName: "감자",
        risks: [makeRisk("감자 역병 위험")],
      },
      {
        searchDiseases: searchDiseasesSpy,
        getDiseaseDetail: async () => sampleDiseaseDetail,
        searchInsects: searchInsectsSpy,
        getInsectDetail: async () => null,
      },
    );

    results.push({
      label: "1. '감자 역병 위험' → 병 검색 수행, 해충 검색은 호출 안 함",
      passed:
        output.length === 1 &&
        output[0].type === "disease" &&
        output[0].matched === true &&
        searchDiseasesSpy.callCount === 1 &&
        searchInsectsSpy.callCount === 0,
      message: `output=${JSON.stringify(output)}, diseaseCalls=${searchDiseasesSpy.callCount}, insectCalls=${searchInsectsSpy.callCount}`,
    });
  }

  // 2. "오이 노균병 위험" → 병 검색
  {
    const output = await enrichPestInfo(
      {
        cropId: "cucumber",
        cropName: "오이",
        risks: [makeRisk("오이 노균병 위험")],
      },
      {
        searchDiseases: async () => [
          {
            id: "D00000002",
            cropName: "오이",
            nameKor: "노균병",
            nameChn: null,
            nameEng: null,
            thumbnailUrl: null,
            originalImageUrl: null,
            source: "NCPMS",
          },
        ],
        getDiseaseDetail: async () => sampleDiseaseDetail,
        searchInsects: async () => [],
        getInsectDetail: async () => null,
      },
    );

    results.push({
      label: "2. '오이 노균병 위험' → 병 검색, searchName='노균병'",
      passed: output.length === 1 && output[0].type === "disease" && output[0].searchName === "노균병",
      message: JSON.stringify(output.map((o) => ({ type: o.type, searchName: o.searchName }))),
    });
  }

  // 3. "진딧물 위험" → 해충 검색
  {
    const output = await enrichPestInfo(
      {
        cropId: "cucumber",
        cropName: "오이",
        risks: [makeRisk("진딧물 위험")],
      },
      {
        searchDiseases: async () => {
          throw new Error("병 검색은 호출되면 안 됨");
        },
        getDiseaseDetail: async () => null,
        searchInsects: async () => [
          {
            id: "H00000001",
            cropName: "오이",
            nameKor: "진딧물",
            speciesName: null,
            thumbnailUrl: null,
            originalImageUrl: null,
            source: "NCPMS",
          },
        ],
        getInsectDetail: async () => sampleInsectDetail,
      },
    );

    results.push({
      label: "3. '진딧물 위험' → 해충 검색 수행",
      passed: output.length === 1 && output[0].type === "insect" && output[0].matched === true,
      message: JSON.stringify(output),
    });
  }

  // 4. "집중강우 위험" → 검색하지 않음
  {
    const searchDiseasesSpy = makeCallCounter(async (): Promise<NormalizedDiseaseSearchItem[]> => []);
    const searchInsectsSpy = makeCallCounter(async (): Promise<NormalizedInsectSearchItem[]> => []);

    const output = await enrichPestInfo(
      {
        cropId: "apple",
        cropName: "사과",
        risks: [makeRisk("집중강우 위험")],
      },
      {
        searchDiseases: searchDiseasesSpy,
        getDiseaseDetail: async () => null,
        searchInsects: searchInsectsSpy,
        getInsectDetail: async () => null,
      },
    );

    results.push({
      label: "4. '집중강우 위험' → NCPMS 검색을 전혀 수행하지 않고 결과에도 포함 안 됨",
      passed:
        output.length === 0 && searchDiseasesSpy.callCount === 0 && searchInsectsSpy.callCount === 0,
      message: `output.length=${output.length}, diseaseCalls=${searchDiseasesSpy.callCount}, insectCalls=${searchInsectsSpy.callCount}`,
    });
  }

  // 5. 검색 결과 없음 → matched=false
  {
    const output = await enrichPestInfo(
      {
        cropId: "potato",
        cropName: "감자",
        risks: [makeRisk("감자 역병 위험")],
      },
      {
        searchDiseases: async () => [],
        getDiseaseDetail: async () => null,
        searchInsects: async () => [],
        getInsectDetail: async () => null,
      },
    );

    results.push({
      label: "5. 검색 결과 없음 → matched=false, reason에 명시",
      passed:
        output.length === 1 && output[0].matched === false && output[0].matchReason === "검색 결과 없음",
      message: JSON.stringify(output),
    });
  }

  // 6. 복수 결과 모호 → 자동 확정하지 않음
  {
    const output = await enrichPestInfo(
      {
        cropId: "potato",
        cropName: "감자",
        risks: [makeRisk("감자 역병 위험")],
      },
      {
        searchDiseases: async () => [
          {
            id: "D00000001",
            cropName: "고추",
            nameKor: "역병",
            nameChn: null,
            nameEng: null,
            thumbnailUrl: null,
            originalImageUrl: null,
            source: "NCPMS",
          },
          {
            id: "D00000002",
            cropName: "토마토",
            nameKor: "역병",
            nameChn: null,
            nameEng: null,
            thumbnailUrl: null,
            originalImageUrl: null,
            source: "NCPMS",
          },
        ],
        getDiseaseDetail: async () => sampleDiseaseDetail,
        searchInsects: async () => [],
        getInsectDetail: async () => null,
      },
    );

    results.push({
      label: "6. cropName 불일치 + 병명이 동일한 항목 2건 → 자동 확정하지 않고 matched=false",
      passed:
        output.length === 1 &&
        output[0].matched === false &&
        (output[0].matchReason?.includes("모호") ?? false),
      message: JSON.stringify(output),
    });
  }

  // 7. 동일 병명 중복 참조 → API 1회만 호출
  {
    const searchDiseasesSpy = makeCallCounter(async (): Promise<NormalizedDiseaseSearchItem[]> => [
      {
        id: "D00000001",
        cropName: "감자",
        nameKor: "역병",
        nameChn: null,
        nameEng: null,
        thumbnailUrl: null,
        originalImageUrl: null,
        source: "NCPMS",
      },
    ]);
    const getDiseaseDetailSpy = makeCallCounter(async () => sampleDiseaseDetail);

    const output = await enrichPestInfo(
      {
        cropId: "potato",
        cropName: "감자",
        risks: [makeRisk("감자 역병 위험(1차)", "risk-1"), makeRisk("감자 역병 위험(2차)", "risk-2")],
      },
      {
        searchDiseases: searchDiseasesSpy,
        getDiseaseDetail: getDiseaseDetailSpy,
        searchInsects: async () => [],
        getInsectDetail: async () => null,
      },
    );

    results.push({
      label: "7. 동일 병명을 참조하는 위험 2건 → 검색/상세조회 API는 1회만 호출, 결과는 2건",
      passed:
        output.length === 2 &&
        output.every((o) => o.matched) &&
        searchDiseasesSpy.callCount === 1 &&
        getDiseaseDetailSpy.callCount === 1,
      message: `output.length=${output.length}, searchCalls=${searchDiseasesSpy.callCount}, detailCalls=${getDiseaseDetailSpy.callCount}`,
    });
  }

  // 8. 상세 API 실패 → 전체 함수는 정상 반환
  {
    let threw = false;
    let output: EnrichedPestInfo[] = [];
    try {
      output = await enrichPestInfo(
        {
          cropId: "potato",
          cropName: "감자",
          risks: [makeRisk("감자 역병 위험")],
        },
        {
          searchDiseases: async () => [
            {
              id: "D00000001",
              cropName: "감자",
              nameKor: "역병",
              nameChn: null,
              nameEng: null,
              thumbnailUrl: null,
              originalImageUrl: null,
              source: "NCPMS",
            },
          ],
          getDiseaseDetail: async () => {
            throw new Error("상세 API 실패(테스트)");
          },
          searchInsects: async () => [],
          getInsectDetail: async () => null,
        },
      );
    } catch {
      threw = true;
    }

    results.push({
      label: "8. 상세 API 실패해도 enrichPestInfo는 예외 없이 matched=false로 반환",
      passed: !threw && output.length === 1 && output[0].matched === false,
      message: `threw=${threw}, output=${JSON.stringify(output)}`,
    });
  }

  // 9. source 리터럴 확인
  {
    const output = await enrichPestInfo(
      {
        cropId: "potato",
        cropName: "감자",
        risks: [makeRisk("감자 역병 위험")],
      },
      {
        searchDiseases: async () => [
          {
            id: "D00000001",
            cropName: "감자",
            nameKor: "역병",
            nameChn: null,
            nameEng: null,
            thumbnailUrl: null,
            originalImageUrl: null,
            source: "NCPMS",
          },
        ],
        getDiseaseDetail: async () => sampleDiseaseDetail,
        searchInsects: async () => [],
        getInsectDetail: async () => null,
      },
    );

    results.push({
      label: "9. source는 항상 리터럴 'NCPMS'",
      passed: output.length === 1 && output[0].source === "NCPMS",
      message: `source=${JSON.stringify(output[0]?.source)}`,
    });
  }

  return results;
}
