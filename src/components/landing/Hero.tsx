"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-b from-[#e2f3d8] via-background to-background px-4 pt-32 pb-24 sm:px-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-10 select-none font-display text-[14rem] font-bold leading-none text-primary-light/10 sm:text-[20rem]"
      >
        FARM
      </span>

      <div className="relative mx-auto flex max-w-[1200px] flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-3xl text-4xl font-bold leading-[1.15] text-text sm:text-6xl"
          >
            시작부터 수확까지
            <br />
            내 땅을 지키는 든든한 기사
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="mt-6 max-w-xl text-lg text-muted"
          >
            농사를 위한 가장 빠르고 든든한 지원군
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

        <img
          src="/images/mascot-knight.png"
          alt="흙기사 마스코트 캐릭터"
          className="w-40 shrink-0 select-none sm:w-48 lg:w-64"
        />
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
