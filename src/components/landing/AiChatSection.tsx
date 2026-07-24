"use client";

import { useState } from "react";
import ScrollReveal from "@/components/landing/ScrollReveal";

type ChatMessage = { from: "user" | "ai"; text: string };

const ERROR_MESSAGE = "잠시 후 다시 시도해주세요.";

async function fetchAiReply(question: string): Promise<string> {
  const res = await fetch("/api/ai-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    throw new Error(`ai-chat 요청 실패: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { reply?: string };
  if (!data.reply) {
    throw new Error("ai-chat 응답에 답변이 없습니다.");
  }
  return data.reply;
}

export default function AiChatSection() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "ai", text: "안녕하세요, 무엇이든 물어보세요!" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    setMessages((prev) => [...prev, { from: "user", text: question }]);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await fetchAiReply(question);
      setMessages((prev) => [...prev, { from: "ai", text: reply }]);
    } catch (error) {
      console.error("[AiChatSection] Gemini 응답 실패:", error);
      setMessages((prev) => [...prev, { from: "ai", text: ERROR_MESSAGE }]);
    } finally {
      setIsLoading(false);
    }
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
            {isLoading && (
              <div className="max-w-[75%] rounded-2xl bg-status-info-bg px-4 py-2.5 text-sm leading-relaxed text-text">
                답변을 생각하고 있어요...
              </div>
            )}
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
              disabled={isLoading}
              className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-text outline-none focus:border-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              전송
            </button>
          </form>
        </ScrollReveal>
      </div>
    </section>
  );
}
