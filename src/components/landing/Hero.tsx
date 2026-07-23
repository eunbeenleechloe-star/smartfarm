"use client";

import { motion } from "framer-motion";
import RotatingBadge from "@/components/landing/RotatingBadge";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-background px-4 pt-32 pb-24 sm:px-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-10 select-none font-display text-[14rem] font-bold leading-none text-primary-light/10 sm:text-[20rem]"
      >
        FARM
      </span>

      <div className="relative mx-auto max-w-[1200px]">
        <div className="flex items-start justify-between gap-6">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-3xl font-display text-4xl font-bold leading-[1.15] text-text sm:text-6xl"
          >
            당신의 밭에 닥칠 위험을,{" "}
            <span className="text-primary underline decoration-accent decoration-8 underline-offset-4">
              팜가드
            </span>
            가 먼저 압니다
          </motion.h1>

          <div className="hidden text-primary sm:block">
            <RotatingBadge text="농사최고" />
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
          className="mt-6 max-w-xl text-lg text-muted"
        >
          우리는 전국 표준 데이터에 머무르지 않고, 실시간 기상·토양 정보까지
          읽어내 농사가 더 잘 이뤄지도록 돕습니다.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10"
        >
          <a
            href="#input"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            내 지역 위험 확인하기
          </a>
        </motion.div>
      </div>

      <motion.a
        href="#input"
        aria-label="아래로 스크롤"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-primary"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4v16m0 0-6-6m6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </motion.a>
    </section>
  );
}
