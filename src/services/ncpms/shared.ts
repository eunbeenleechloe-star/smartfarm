export const NCPMS_BASE_URL = "http://ncpms.rda.go.kr/npmsAPI/service";

export const NCPMS_ERROR_MESSAGES: Record<string, string> = {
  ERR_101: "인증키가 누락되었습니다.",
  ERR_102: "서비스가 중지되었습니다.",
  ERR_103: "잘못된 서비스코드입니다.",
  ERR_104: "해당 서비스에 대한 권한이 없습니다.",
  ERR_105: "인증받지 않은 도메인입니다.",
  ERR_201: "필수 파라미터가 누락되었거나 잘못되었습니다.",
  ERR_901: "NCPMS 내부 오류가 발생했습니다.",
};

/** 원본 JSON 안에서 ERR_ 코드가 있는지 얕게(최대 3단계) 탐색한다. 실제 에러 응답의 정확한 위치가 문서에 없어 방어적으로 탐색한다. */
export function findNcpmsErrorCode(value: unknown, depth = 0): string | null {
  if (depth > 3 || value === null || typeof value !== "object") return null;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v === "string" && v in NCPMS_ERROR_MESSAGES) return v;
    if (typeof v === "object" && v !== null) {
      const found = findNcpmsErrorCode(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** ERR_ 코드가 발견되면 명확한 메시지로 throw한다. SVC01/SVC05 등 모든 NCPMS 서비스가 공유한다. */
export function throwIfNcpmsError(data: unknown): void {
  const errorCode = findNcpmsErrorCode(data);
  if (errorCode) {
    throw new Error(`NCPMS 오류(${errorCode}): ${NCPMS_ERROR_MESSAGES[errorCode]}`);
  }
}
