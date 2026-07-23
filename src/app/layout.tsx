import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const gaegu = Gaegu({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gaegu",
  display: "swap",
});

export const metadata: Metadata = {
  title: "팜가드 - 농사 리스크 가이드",
  description: "내 지역의 토양과 앞으로의 날씨를 분석해, 작물 재배 위험을 미리 알려주는 AI 농업 가이드",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ko" className={gaegu.variable}>
      <head>
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
