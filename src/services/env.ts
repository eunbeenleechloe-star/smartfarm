/**
 * 환경변수를 앞뒤 공백 없이 안전하게 읽는다.
 * 값이 없거나 공백만 있으면 명확한 오류를 던진다.
 * 오류 메시지에는 환경변수 이름만 포함하고 값(키 원문)은 절대 남기지 않는다.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`환경변수 ${name}가 설정되지 않았거나 값이 비어 있습니다.`);
  }
  return value;
}
