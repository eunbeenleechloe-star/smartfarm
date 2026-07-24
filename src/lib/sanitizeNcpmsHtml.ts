/**
 * NCPMS 상세 문자열(symptoms/damageInfo 등)에는 실제로 <br/>, <p> 같은 HTML 태그가 섞여 온다.
 * 원본 HTML을 dangerouslySetInnerHTML에 그대로 넣지 않고, 줄바꿈 의미가 있는 태그만 개행으로
 * 바꾼 뒤 나머지 태그를 모두 제거해 plain text 줄 배열로 변환한다(권장안 2).
 */

const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (match) => ENTITY_MAP[match] ?? match);
}

/** HTML 태그가 섞인 NCPMS 원본 문자열을 안전한 plain text 줄 배열로 변환한다. */
export function ncpmsHtmlToLines(value: string | null | undefined): string[] {
  if (!value) return [];

  const withLineBreaks = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|li|div|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(withLineBreaks)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export interface SanitizeNcpmsHtmlSelfCheckResult {
  label: string;
  passed: boolean;
  message: string;
}

/** 실제 NCPMS 응답 없이 ncpmsHtmlToLines()의 태그 제거/개행 변환 규칙을 점검한다. */
export function runSanitizeNcpmsHtmlSelfChecks(): SanitizeNcpmsHtmlSelfCheckResult[] {
  const results: SanitizeNcpmsHtmlSelfCheckResult[] = [];

  const brResult = ncpmsHtmlToLines("잎에 갈색 병반이 생긴다.<br/>습도가 높으면 급속히 확산된다.");
  results.push({
    label: "1. <br/>가 줄바꿈으로 변환되어 2줄로 분리됨",
    passed: brResult.length === 2 && brResult[0] === "잎에 갈색 병반이 생긴다." && brResult[1] === "습도가 높으면 급속히 확산된다.",
    message: JSON.stringify(brResult),
  });

  const boldResult = ncpmsHtmlToLines("<strong>주의</strong>: 방제가 필요합니다.");
  results.push({
    label: "2. <strong> 등 알 수 없는 태그는 태그만 제거되고 텍스트는 유지됨",
    passed: boldResult.length === 1 && boldResult[0] === "주의: 방제가 필요합니다.",
    message: JSON.stringify(boldResult),
  });

  const entityResult = ncpmsHtmlToLines("A&amp;B &lt;해충&gt; 발생&nbsp;주의");
  results.push({
    label: "3. HTML 엔티티(&amp; &lt; &gt; &nbsp;)가 원래 문자로 디코딩됨",
    passed: entityResult.length === 1 && entityResult[0] === "A&B <해충> 발생 주의",
    message: JSON.stringify(entityResult),
  });

  const emptyLineResult = ncpmsHtmlToLines("<p></p><p>내용</p>");
  results.push({
    label: "4. 빈 줄은 결과에서 제거됨",
    passed: emptyLineResult.length === 1 && emptyLineResult[0] === "내용",
    message: JSON.stringify(emptyLineResult),
  });

  results.push({
    label: "5. null/빈 문자열 입력 시 빈 배열 반환",
    passed:
      JSON.stringify(ncpmsHtmlToLines(null)) === "[]" && JSON.stringify(ncpmsHtmlToLines("")) === "[]",
    message: `null=${JSON.stringify(ncpmsHtmlToLines(null))}, empty=${JSON.stringify(ncpmsHtmlToLines(""))}`,
  });

  results.push({
    label: "6. dangerouslySetInnerHTML 없이 사용 가능한 순수 문자열만 반환(태그가 결과에 남지 않음)",
    passed: !brResult.some((line) => line.includes("<")) && !boldResult.some((line) => line.includes("<")),
    message: JSON.stringify({ brResult, boldResult }),
  });

  return results;
}
