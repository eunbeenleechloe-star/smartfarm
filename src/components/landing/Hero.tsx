"use client";

import { motion } from "framer-motion";

const MENU_LINKS = [
  { href: "/risk", label: "위험 분석" },
  { href: "/guide", label: "작물 가이드" },
  { href: "/data-sources", label: "데이터 출처" },
];

export default function Hero() {
  return (
    <section id="hero" className="px-4 pb-16 pt-32 sm:px-6">
      <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[2.5rem] bg-dark p-6 sm:p-12">
        <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="font-bold leading-[1.15] text-white"
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
              className="mt-4 text-lg text-white/70 sm:text-3xl"
            >
              농사를 위한 가장 빠르고 든든한 지원군
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
                자세히 보기
              </a>

              <div className="mt-6 flex flex-wrap gap-3">
                {MENU_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-white/30 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.img
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            src="/images/hero-knight-shovel-transparent.png"
            alt="흙기사 실루엣"
            className="mx-auto h-64 w-auto max-w-full object-contain sm:h-[26rem]"
          />
        </div>
      </div>
    </section>
  );
}
