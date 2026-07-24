"use client";

import { useState } from "react";
import ScrollReveal from "@/components/landing/ScrollReveal";

type ChatMessage = { from: "user" | "ai"; text: string };

const FAQ_ANSWERS: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["적합도", "점수"],
    answer:
      "적합도 점수는 기온·pH·EC·토성·강수량 실측값을 작물별 공식 생육 기준과 비교해 계산돼요. 결측 항목은 0점이 아니라 평가에서 제외돼요.",
  },
  {
    keywords: ["비료", "시비", "처방"],
    answer:
      "비료 처방은 농촌진흥청 등 공식 자료 또는 API 값만 사용해요. 실제 살포량은 토양검정 결과와 재배면적에 따라 달라질 수 있으니 참고용으로 봐주세요.",
  },
  {
    keywords: ["위험", "리스크", "날씨", "기상"],
    answer:
      "단기예보를 기반으로 저온·고온·집중강우·과습 같은 위험 요소를 분석해서 알려드려요. 자세한 내용은 위쪽 '위험분석' 영역에서 지역과 작물을 선택해보세요.",
  },
  {
    keywords: ["mock", "목", "가짜", "임시"],
    answer:
      "실제 공공 API 응답을 받지 못했을 때만 임시(mock) 데이터를 사용하고, 그 경우 결과 화면에 mock 여부를 그대로 표시해요.",
  },
];

function buildAnswer(question: string): string {
  const matched = FAQ_ANSWERS.find((item) =>
    item.keywords.some((keyword) => question.includes(keyword))
  );
  if (matched) return matched.answer;
  return "아직 정확히 답변드리기 어려운 질문이에요. '위험분석' 결과 화면의 데이터 출처와 설명을 함께 참고해주세요.";
}

export default function AiChatSection() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "ai", text: "안녕하세요, 무엇이든 물어보세요!" },
  ]);
  const [input, setInput] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;

    setMessages((prev) => [
      ...prev,
      { from: "user", text: question },
      { from: "ai", text: buildAnswer(question) },
    ]);
    setInput("");
  }

  return (
    <section id="ai-chat" className="bg-background px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-text">AI 농사 상담</h2>
          <p className="mt-2 text-muted">궁금한 점을 자유롭게 물어보세요.</p>
        </ScrollReveal>

        <ScrollReveal
          delay={0.1}
          className="mt-8 flex h-[28rem] flex-col rounded-2xl border border-border bg-card"
        >
          <div className="flex-1 space-y-3 overflow-y-auto p-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  message.from === "ai"
                    ? "bg-status-info-bg text-text"
                    : "ml-auto bg-primary text-white"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-border p-4"
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="예: 비료 처방은 어떻게 계산되나요?"
              className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              전송
            </button>
          </form>
        </ScrollReveal>
      </div>
    </section>
  );
}
