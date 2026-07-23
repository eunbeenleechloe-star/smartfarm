"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "#hero", label: "홈" },
  { href: "#about", label: "서비스소개" },
  { href: "#input", label: "위험분석" },
  { href: "#features", label: "가이드" },
  { href: "#contact", label: "문의" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${
        scrolled ? "bg-background/80 shadow-sm backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
        <a href="#hero" className="font-display text-xl font-bold text-primary">
          팜가드
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
      </div>
    </nav>
  );
}
