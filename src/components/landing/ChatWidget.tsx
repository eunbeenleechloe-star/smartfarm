"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "적합도 점수는 어떻게 계산되나요?",
    answer:
      "기온·pH·EC·토성·강수량 실측값을 작물별 공식 생육 기준과 비교해 계산합니다. 기준값이 없거나 실측값이 없는 항목은 0점이 아니라 평가에서 제외됩니다.",
  },
  {
    question: "mock 데이터는 무엇인가요?",
    answer:
      "실제 공공 API 대신 임시로 사용하는 예시 데이터입니다. mock 데이터를 사용한 경우 결과 화면의 '데이터 출처' 영역에 그대로 표시됩니다.",
  },
  {
    question: "비료 처방 값은 어디서 나오나요?",
    answer:
      "농촌진흥청 등 공식 자료 또는 API 값만 사용하며, AI가 임의로 계산하지 않습니다. 실제 살포량은 토양검정 결과와 재배면적에 따라 달라질 수 있습니다.",
  },
];

type Message = { from: "user" | "bot"; text: string };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: "안녕하세요! 자주 묻는 질문을 선택해보세요." },
  ]);

  function askFaq(item: FaqItem) {
    setMessages((prev) => [...prev, { from: "user", text: item.question }, { from: "bot", text: item.answer }]);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-primary px-4 py-3">
            <span className="text-sm font-semibold text-white">흙기사 도우미</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="챗봇 닫기"
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.from === "bot"
                    ? "bg-status-info-bg text-text"
                    : "ml-auto max-w-[80%] bg-primary text-white"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-border p-3">
            {FAQ_ITEMS.map((item) => (
              <button
                key={item.question}
                type="button"
                onClick={() => askFaq(item)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left text-xs text-text hover:border-primary"
              >
                {item.question}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "챗봇 닫기" : "챗봇 열기"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-white shadow-lg hover:opacity-90"
      >
        💬
      </button>
    </div>
  );
}
