import type { CropId } from "@/types/analysis";

/**
 * 적합도 점수(cropScoring.ts)가 실제로 읽는 작물 기준값의 출처 레지스트리.
 *
 * cropScoring.ts는 값을 아래 두 파일에서 읽는다(둘 다 그대로 두고 수정하지 않는다):
 * - temperature/ph/ec/texture → cropResearchStandards.ts (작물 단위 sources[] 배열)
 * - rainfall → cropStandards.ts(레거시 flat 구조, 작물별 sources[] 배열)
 *
 * 두 파일 모두 출처를 "작물 단위"로만 기록하고 있어(필드별로 분리돼 있지 않음), 여기서도
 * 실제로 그 파일에 적힌 출처 문자열만 그대로 옮긴다 — 기관명이나 URL을 새로 추측해 채우지
 * 않는다. 값 자체가 null이거나 그 필드를 뒷받침하는 출처가 명시돼 있지 않으면
 * verified: false로 남긴다.
 */

export interface FieldSource {
  /** cropScoring.ts의 ScoreDetail.field와 동일한 값(temperature/ph/ec/texture/rainfall). */
  field: string;
  /** 원본 파일(cropResearchStandards.ts/cropStandards.ts)의 sources[] 문자열을 그대로 옮긴 값. 여러 개면 세미콜론으로 구분. */
  sourceName: string | null;
  /** 원본 파일 어디에도 URL이 없어 현재 전부 null이다. */
  url: string | null;
  verified: boolean;
  note?: string;
}

const APPLE_RESEARCH_SOURCES =
  "농촌진흥청 『농업기술길잡이5-사과재배』; 농사로 농업기술포털 사과재배; 한국농촌경제연구원 『우리나라 토양양분 관리정책의 평가』 p.17";
const PEAR_RESEARCH_SOURCES =
  "농촌진흥청 『농업기술길잡이-배』 제4장 재배환경과 개원; 농촌진흥청 『농업기술길잡이-배』 제6장 이상기상에 대한 경감 대책";
const POTATO_RESEARCH_SOURCES =
  "농촌진흥청 『농업기술길잡이-감자』 제4장 감자의 생장과 발육; 농촌진흥청 『농업기술길잡이-감자』 제7장 가꿈꼴별 재배 기술; 농촌진흥청 『농업기술길잡이-감자』 제10장 감자 병해충과 방제";
const CUCUMBER_RESEARCH_SOURCES = "농사로 도시농업 텃밭 가꾸기 오이편";
const LETTUCE_RESEARCH_SOURCES =
  "농촌진흥청 『농업기술길잡이-상추』 제2장 재배환경; 농사로 농업기술포털 상추재배";

const PEAR_LEGACY_RAINFALL_SOURCES =
  "농촌진흥청 농업기술길잡이-배 제4장; 농촌진흥청 농업기술길잡이-배 제6장";

const RESEARCH_LEVEL_NOTE = "작물 단위 출처(필드별 세부 출처는 분리돼 있지 않음)";
const UNVERIFIED_NOTE = "공식 출처 대조 필요";

export const cropStandardSources: Record<CropId, FieldSource[]> = {
  apple: [
    { field: "temperature", sourceName: APPLE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ph", sourceName: APPLE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ec", sourceName: APPLE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "texture", sourceName: APPLE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "rainfall", sourceName: "농사로", url: null, verified: true, note: "적정 강수량 연 1,300mm 이하" },
  ],
  pear: [
    { field: "temperature", sourceName: PEAR_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ph", sourceName: PEAR_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ec", sourceName: "흙토람", url: null, verified: true, note: "적정 EC 2.0dS/m 이하(뿌리활력·과실비대 이상적 0.5~1.5dS/m)" },
    { field: "texture", sourceName: PEAR_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "rainfall", sourceName: PEAR_LEGACY_RAINFALL_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
  ],
  potato: [
    { field: "temperature", sourceName: POTATO_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ph", sourceName: POTATO_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ec", sourceName: "농사로 《농업환경 표준분석법》", url: null, verified: true, note: "적정 1.0~1.5, 주의 1.5~2.0(생육저하), 위험 2.0dS/m 이상(염류장애)" },
    { field: "texture", sourceName: POTATO_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "rainfall", sourceName: "농촌진흥청 《농업기술길잡이-감자 재배기술 및 생육환경》", url: null, verified: true, note: "전 생육기간 400~800mm(300~500mm에서도 재배 가능). 파종기·덩이줄기 비대기 수분 공급이 크기·수확량 결정" },
  ],
  cucumber: [
    { field: "temperature", sourceName: CUCUMBER_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ph", sourceName: CUCUMBER_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ec", sourceName: CUCUMBER_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "texture", sourceName: CUCUMBER_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    // cropStandards.ts(레거시)의 cucumber.rainfall은 전부 null이고 sources도 빈 배열이다.
    // (cropResearchStandards.cucumber.rainfall.monthly에 월간 기준이 있지만, 실제 scoring의
    // rainfall은 이 레거시 값을 읽으므로 그 출처는 여기 적용되지 않는다.)
    { field: "rainfall", sourceName: null, url: null, verified: false, note: UNVERIFIED_NOTE },
  ],
  lettuce: [
    { field: "temperature", sourceName: LETTUCE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ph", sourceName: LETTUCE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "ec", sourceName: LETTUCE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "texture", sourceName: LETTUCE_RESEARCH_SOURCES, url: null, verified: true, note: RESEARCH_LEVEL_NOTE },
    { field: "rainfall", sourceName: "농사로 《농업기술길잡이-상추》/채소·화훼 양액토경재배 기술 가이드", url: null, verified: true, note: "재배기간 150~250mm. 여름 3.0~6.0L/㎡·일, 겨울 2.0~2.5L/㎡·일. 소량 자주 관수 필수" },
  ],
};

const EXPECTED_FIELDS = ["temperature", "ph", "ec", "texture", "rainfall"];
const ALL_CROP_IDS: CropId[] = ["apple", "pear", "cucumber", "potato", "lettuce"];

export interface CropStandardSourcesSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/**
 * 레지스트리 자체의 정합성만 점검한다(실제 출처가 맞는지는 사람이 대조해야 한다):
 * 모든 작물에 5개 필드가 빠짐없이 있는지, URL을 추측해 채운 곳이 없는지,
 * verified 값과 sourceName 유무가 서로 모순되지 않는지.
 */
export function runCropStandardSourcesSelfChecks(): CropStandardSourcesSelfCheckResult[] {
  const results: CropStandardSourcesSelfCheckResult[] = [];

  results.push({
    label: "1. 5개 고정 작물 모두 레지스트리에 존재",
    passed: ALL_CROP_IDS.every((id) => Array.isArray(cropStandardSources[id])),
    message: `crops=${Object.keys(cropStandardSources).join(", ")}`,
  });

  for (const cropId of ALL_CROP_IDS) {
    const entries = cropStandardSources[cropId];
    const fields = entries.map((entry) => entry.field);

    results.push({
      label: `2-${cropId}. 5개 필드(temperature/ph/ec/texture/rainfall) 모두 존재, 중복 없음`,
      passed:
        EXPECTED_FIELDS.every((field) => fields.includes(field)) &&
        new Set(fields).size === fields.length &&
        fields.length === EXPECTED_FIELDS.length,
      message: `fields=${JSON.stringify(fields)}`,
    });

    results.push({
      label: `3-${cropId}. url을 추측해 채운 항목 없음(전부 null)`,
      passed: entries.every((entry) => entry.url === null),
      message: `urls=${JSON.stringify(entries.map((e) => e.url))}`,
    });

    results.push({
      label: `4-${cropId}. verified 값과 sourceName 유무가 모순되지 않음`,
      passed: entries.every((entry) =>
        entry.verified ? entry.sourceName !== null : entry.sourceName === null,
      ),
      message: `entries=${JSON.stringify(entries.map((e) => ({ field: e.field, verified: e.verified, hasSource: e.sourceName !== null })))}`,
    });
  }

  const unverified = ALL_CROP_IDS.flatMap((cropId) =>
    cropStandardSources[cropId]
      .filter((entry) => !entry.verified)
      .map((entry) => `${cropId}.${entry.field}`),
  );
  results.push({
    label: "5. verified:false 항목 집계(사람이 최종 확인해야 할 목록)",
    passed: true,
    message: `unverified=${JSON.stringify(unverified)}`,
  });

  return results;
}
