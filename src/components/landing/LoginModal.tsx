"use client";

import { useState } from "react";
import { loginUser } from "@/lib/auth";

export default function LoginModal({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) return;
    loginUser(email.trim());
    onLogin(email.trim());
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text">로그인</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            로그인
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          ※ 데모용 로그인이에요. 입력한 이메일로 임시 로그인돼요.
        </p>
      </div>
    </div>
  );
}
