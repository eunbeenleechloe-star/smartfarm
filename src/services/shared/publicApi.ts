/**
 * data.go.kr(공공데이터포털) 계열 오픈API 공통 유틸.
 * weather/soil/fertilizer 세 서비스가 동일한 요청/파싱 방식을 쓰기 때문에 여기로 모았다.
 */

export class PublicApiError extends Error {}

/**
 * data.go.kr 계열 API는 응답이 없을 때 네트워크 오류(reject)조차 내지 않고 그냥 무한 대기하는
 * 경우가 있다(2026-07 실호출로 확인). fetch()는 브라우저/Node 어느 쪽도 기본 타임아웃이 없어서,
 * 이 경우 호출부의 try/catch가 아예 발동하지 않고 analyzeFarm() 전체가 멈춘다. 그래서 모든
 * 공공데이터 호출에 AbortController 타임아웃을 강제한다.
 */
const DEFAULT_TIMEOUT_MS = 15000;

/** 값 전체를 로그에 남기지 않고 앞 4자리만 노출해 "환경변수가 실제로 로드됐는지"만 확인한다. */
export function maskedKeyPreview(value: string): string {
  if (value.length <= 4) return `${value}... (length: ${value.length})`;
  return `${value.slice(0, 4)}... (length: ${value.length})`;
}

/**
 * data.go.kr serviceKey는 이미 percent-encoding된 상태로 발급된다.
 * URLSearchParams에 그대로 넣으면 다시 인코딩되어 이중 인코딩(auth 실패)이 발생하므로,
 * 한 번 decode한 뒤 URLSearchParams가 인코딩을 한 번만 하도록 만든다.
 */
export function normalizeServiceKey(rawKey: string): string {
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return rawKey;
  }
}

/** 여러 후보 환경변수 이름 중 값이 있는 첫 번째를 반환한다. 앞뒤 공백은 제거한다(값 자체는 로그에 남기지 않는다). */
export function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function requireEnv(...names: string[]): string {
  const value = firstEnv(...names);
  if (!value) {
    throw new PublicApiError(
      `환경변수(${names.join(" | ")})가 설정되지 않았습니다.`,
    );
  }
  return value;
}

function buildUrl(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) usp.set(key, String(value));
  }
  return `${baseUrl}?${usp.toString()}`;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new PublicApiError(`공공데이터 API 응답 시간 초과(${timeoutMs}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchPublicApiJson(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const url = buildUrl(baseUrl, params);
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) {
    throw new PublicApiError(`공공데이터 API HTTP 오류: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPublicApiXml(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const url = buildUrl(baseUrl, params);
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) {
    throw new PublicApiError(`공공데이터 API HTTP 오류: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/** 단순 flat XML(`<response><header>..</header><body><items><item>..</item></items></body></response>`)에서 태그 하나를 뽑는다. */
export function parseXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}

/**
 * `<item>...</item>` 반복 블록을 파싱해 필드명→값 객체 배열로 변환한다.
 * data.go.kr의 이 계열 API들은 item 내부에 중첩 배열/CDATA가 없는 단순 구조라 정규식으로 충분하다.
 */
export function parseXmlItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml))) {
    const inner = itemMatch[1];
    const fieldRegex = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    const field: Record<string, string> = {};
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(inner))) {
      field[fieldMatch[1]] = fieldMatch[2].trim();
    }
    items.push(field);
  }
  return items;
}

/** 문자열이 없거나 유한하지 않으면 null. 0으로 대체하지 않는다. */
export function parseFloatOrNull(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** 후보 필드명을 순서대로 탐색해 처음 존재하는 값을 반환한다(값 없으면 undefined). */
export function pickField(
  item: Record<string, string>,
  candidates: string[],
): string | undefined {
  for (const key of candidates) {
    if (item[key] !== undefined && item[key] !== "") return item[key];
  }
  return undefined;
}

export interface ApiResultStatus {
  ok: boolean;
  code: string | null;
  message: string | null;
}

/**
 * data.go.kr 계열 API는 제공 기관마다 결과 코드 태그명이 다르다
 * (기상청: resultCode/resultMsg, RDA 국립농업과학원: Result_Code/Result_Msg 또는 result_Code/result_Msg).
 * 성공 코드도 "00"(기상청)과 "200"(RDA)으로 다르므로 함께 판별한다.
 */
export function parseXmlResultStatus(xml: string): ApiResultStatus {
  const code =
    parseXmlTag(xml, "resultCode") ??
    parseXmlTag(xml, "Result_Code") ??
    parseXmlTag(xml, "result_Code");
  const message =
    parseXmlTag(xml, "resultMsg") ??
    parseXmlTag(xml, "Result_Msg") ??
    parseXmlTag(xml, "result_Msg");

  if (code === null) {
    // 헤더 태그 자체가 없으면(예: items만 있는 단순 XML) 성공으로 간주하지 않고 판단을 호출부에 위임한다.
    return { ok: true, code: null, message };
  }
  return { ok: code === "00" || code === "200", code, message };
}

/** RDA 계열 API의 "조회 결과 없음"(OK_NO_DATA_ERROR=301)인지 확인한다. 오류가 아니라 정상적인 결측 응답이다. */
export function isNoDataResult(status: ApiResultStatus): boolean {
  return status.code === "301";
}

/** Asia/Seoul 기준 연/월/일/시/분을 반환한다(서버 실행 타임존과 무관하게 KST 계산에 사용). */
export function kstParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === "24" ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
