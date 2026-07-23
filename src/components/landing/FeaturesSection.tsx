"use client";

import { useRef } from "react";
import ScrollReveal from "@/components/landing/ScrollReveal";

const FEATURES = [
  {
    icon: "🌡️",
    title: "기후 리스크",
    description: "단기예보 기반 저온·고온·집중강우·과습 위험을 미리 알려드려요.",
  },
  {
    icon: "🧪",
    title: "토양 적합도",
    description: "pH·EC·토성 실측값을 작물별 공식 기준과 비교해 점수로 보여드려요.",
  },
  {
    icon: "🌱",
    title: "비료사용처방",
    description: "공식 출처 기반 질소·인산·칼리·퇴비·석회 처방을 안내해드려요.",
  },
  {
    icon: "📋",
    title: "데이터 신뢰도",
    description: "mock·실측 여부와 결측 항목을 숨기지 않고 그대로 공개해요.",
  },
];

export default function FeaturesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollByCards(direction: 1 | -1) {
    scrollRef.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  return (
    <section id="features" className="bg-dark px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <ScrollReveal className="max-w-xs">
            <h2 className="font-display text-3xl font-bold text-white">
              우리 서비스가
              <br />
              다루는 위험요소들
            </h2>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => scrollByCards(-1)}
                aria-label="이전 카드"
                className="rounded-full border border-white/30 p-2 text-white hover:bg-white/10"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollByCards(1)}
                aria-label="다음 카드"
                className="rounded-full border border-white/30 p-2 text-white hover:bg-white/10"
              >
                →
              </button>
            </div>
          </ScrollReveal>

          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 sm:max-w-2xl">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="w-64 shrink-0 rounded-2xl bg-dark-card p-6"
              >
                <span className="text-3xl" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-white/70">{feature.description}</p>
                <a
                  href="#input"
                  className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
                >
                  자세히 보기 →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
