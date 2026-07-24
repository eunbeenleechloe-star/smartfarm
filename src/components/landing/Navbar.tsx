"use client";

import { useEffect, useState } from "react";
import LoginModal from "@/components/landing/LoginModal";
import { getAuthUser, type AuthUser } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/#hero", label: "홈" },
  { href: "/#about", label: "서비스소개" },
  { href: "/#input", label: "위험분석" },
  { href: "/#features", label: "가이드" },
  { href: "/ai-chat", label: "AI 농사 상담" },
  { href: "/community", label: "커뮤니티" },
  { href: "/#contact", label: "문의" },
];

export default function Navbar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    setUser(getAuthUser());
  }, []);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 sm:px-6">
        <a href="/#hero" className="font-title text-2xl font-bold text-primary sm:text-3xl">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="검색 (준비 중)"
            aria-label="검색 (준비 중)"
            className="rounded-full border border-border p-2 text-muted opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {user ? (
            <a
              href="/mypage"
              title="마이페이지"
              className="flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              마이페이지
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              title="로그인"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text hover:border-primary hover:text-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              로그인
            </button>
          )}
        </div>
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={(email) => {
            setUser({ email });
            setShowLogin(false);
          }}
        />
      )}
    </nav>
  );
}
