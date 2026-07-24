import type { CropId } from "@/types/analysis";

/**
 * 서비스 CropId와 NCPMS 검색용 한글 작물명 매핑. 한곳에서만 관리한다.
 * CLAUDE.md 고정 작물 목록(apple/pear/cucumber/potato/lettuce) 외 작물을 임의로 추가하지 않는다.
 */
export const NCPMS_CROP_NAME_MAP: Record<CropId, string> = {
  apple: "사과",
  pear: "배",
  cucumber: "오이",
  potato: "감자",
  lettuce: "상추",
};

export function isCropId(value: string): value is CropId {
  return value in NCPMS_CROP_NAME_MAP;
}
