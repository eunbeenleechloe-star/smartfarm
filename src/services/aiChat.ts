import { getRequiredEnv } from "./env";

/**
 * "AI 농사 상담" 챗봇 서비스. 사용자 질문 하나를 그대로 Gemini에 전달하고 텍스트 답변만
 * 반환한다. 여기서는 아무 수치도 계산하지 않는다 — farmReport.ts와 달리 이 챗봇은
 * 계산된 분석 결과를 설명하는 게 아니라 일반 농사 질문에 답하는 용도라 자유 텍스트로 응답한다.
 */

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_OUTPUT_TOKENS = 1024;
const MAX_QUESTION_LENGTH = 1000;

const SYSTEM_PROMPT =
  "당신은 흙기사 서비스의 농업 전문 AI 상담원입니다. 작물 재배, 토양, 날씨, 병충해 관련 질문에 " +
  "친절하고 정확하게 답변해주세요.";

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

/**
 * Gemini에 질문을 보내고 답변 텍스트를 반환한다. GEMINI_API_KEY 미설정, API 오류, timeout,
 * 응답 파싱 실패 등 어떤 이유로든 실패하면 예외를 던진다 — 호출한 쪽(API 라우트)에서
 * 사용자에게 재시도 안내 메시지를 보여줄 수 있도록 fallback 답변을 만들지 않는다.
 */
export async function getAiChatReply(question: string): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("질문이 비어 있습니다.");
  }

  const apiKey = getRequiredEnv("GEMINI_API_KEY");
  const truncatedQuestion = trimmed.slice(0, MAX_QUESTION_LENGTH);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: truncatedQuestion }] }],
        generationConfig: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Gemini API 오류: HTTP ${res.status}`);
    }

    const data = (await res.json()) as GeminiGenerateContentResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini 응답에 텍스트가 없습니다.");
    }

    return text.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}
