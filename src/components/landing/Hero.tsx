"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section id="hero" className="px-4 pb-16 pt-32 sm:px-6">
      <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[2.5rem] bg-dark p-6 sm:p-12">
        <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white sm:text-base"
            >
              귀농·초보 농업인을 위한 재배 적합도 분석
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mt-4 font-bold leading-[1.15] text-white"
            >
              <span className="block text-4xl sm:text-6xl">시작부터 수확까지</span>
              <span className="mt-2 block text-2xl sm:text-4xl">
                내 땅을 지키는 든든한 기사
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="mt-4 whitespace-nowrap text-base leading-relaxed text-white/70 sm:text-xl"
            >
              지역과 작물만 고르면 적합도·위험·비료를 한눈에 확인할 수 있습니다.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="mt-8"
            >
              <a
                href="/risk"
                className="inline-flex items-center rounded-full bg-white px-8 py-4 text-base font-semibold text-primary hover:opacity-90 sm:text-lg"
              >
                적합도 진단하기
              </a>
            </motion.div>
          </div>

          <motion.img
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            src="/images/hero-knight-shovel-sparkle.png"
            alt="흙기사 실루엣"
            className="mx-auto h-80 w-auto max-w-full object-contain sm:h-[34rem]"
          />
        </div>
      </div>
    </section>
  );
}
