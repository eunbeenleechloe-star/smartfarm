/**
 * 로그인/마이페이지/커뮤니티/검색은 심사 범위 밖의 미완성 부가기능이라 내비게이션에서
 * 뺐다(라우트·컴포넌트 파일 자체는 남겨둠 — src/app/mypage, src/app/community,
 * src/components/landing/{LoginModal,CommunitySection}). 핵심 흐름(지역·작물 입력 →
 * 적합도 점수 → 위험 → AI 리포트)과 무관하다.
 */
const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/guide", label: "서비스소개" },
  { href: "/risk", label: "위험분석" },
  { href: "/guide#features", label: "가이드" },
  { href: "/ai-chat", label: "AI 농사 상담" },
  { href: "/contact", label: "문의" },
];

export default function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 sm:px-6">
        <a href="/" className="text-2xl font-bold text-primary sm:text-3xl">
          흙기사
        </a>
        <ul className="hidden gap-6 text-sm font-medium text-text sm:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <a href={item.href} className="hover:text-primary">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
