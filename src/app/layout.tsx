import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import type { ReactNode } from "react";
import Navbar from "@/components/landing/Navbar";
import "./globals.css";

const gaegu = Gaegu({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gaegu",
  display: "swap",
});

export const metadata: Metadata = {
  title: "흙기사 - 농사 리스크 가이드",
  description: "시작부터 수확까지, 내 땅을 지키는 든든한 기사",
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
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
