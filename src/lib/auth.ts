const AUTH_STORAGE_KEY = "heukgisa_auth_user";

export type AuthUser = { email: string };

/**
 * 데모용 로컬 인증. 실제 백엔드 연동 전까지는 로컬 스토리지에 이메일만 저장한다.
 * 추후 서버 인증으로 교체할 때 이 모듈의 함수 시그니처만 유지하면 된다.
 */
export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function loginUser(email: string): AuthUser {
  const user: AuthUser = { email };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return user;
}

export function logoutUser(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
