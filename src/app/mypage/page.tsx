"use client";

import { useEffect, useState } from "react";
import LandingFooter from "@/components/landing/LandingFooter";
import { cropResearchStandards } from "@/data/cropResearchStandards";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { getHistory, type HistoryEntry } from "@/lib/history";

export default function MyPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getAuthUser());
    setHistory(getHistory());
    setReady(true);
  }, []);

  return (
    <>
      <main className="min-h-screen bg-background px-4 pt-32 pb-24 sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="text-3xl font-bold text-text">마이페이지</h1>

          {ready && !user && (
            <p className="mt-6 text-muted">
              로그인이 필요해요. 헤더 오른쪽의 로그인 버튼을 이용해주세요.
            </p>
          )}

          {ready && user && (
            <>
              <p className="mt-2 text-muted">{user.email}님이 조회한 작물 데이터 기록이에요.</p>

              {history.length === 0 ? (
                <p className="mt-8 text-sm text-muted">
                  아직 조회한 작물 데이터가 없어요. 위험분석을 먼저 이용해보세요.
                </p>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {history.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="text-sm font-semibold text-primary">
                        {cropResearchStandards[entry.cropId].name}
                      </div>
                      <div className="mt-1 text-base font-medium text-text">{entry.address}</div>
                      <div className="mt-2 text-xs text-muted">
                        {new Date(entry.date).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
