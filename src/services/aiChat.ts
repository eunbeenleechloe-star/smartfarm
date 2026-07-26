import { getRequiredEnv } from "./env";

/**
 * "AI 농사 상담" 챗봇 서비스. 사용자 질문 하나를 그대로 Gemini에 전달하고 텍스트 답변만
 * 반환한다. 여기서는 아무 수치도 계산하지 않는다 — farmReport.ts와 달리 이 챗봇은
 * 계산된 분석 결과를 설명하는 게 아니라 일반 농사 질문에 답하는 용도라 자유 텍스트로 응답한다.
 */

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_OUTPUT_TOKENS = 2048;
const MAX_QUESTION_LENGTH = 1000;

const SYSTEM_PROMPT =
  "당신은 흙기사 서비스의 농업 상담원입니다. 작물 재배, 토양, 날씨, 병충해 관련 질문에 답변합니다. " +
  "답변 대상은 귀농 초보 농업인이므로 전문 용어를 피하고 초등학생도 이해할 만큼 쉬운 말로 설명하세요. " +
  "전문 용어를 꼭 써야 한다면 바로 뒤에 괄호로 쉬운 말을 덧붙이세요. " +
  "문장은 짧게 끊어서 쓰고, 불필요한 배경 설명 없이 바로 핵심과 실천 방법부터 말하세요. " +
  "이 답변은 마크다운을 지원하지 않는 채팅창에 그대로 표시되니 **, ##, - 같은 마크다운 문법을 " +
  "절대 쓰지 말고, 목록은 줄바꿈과 숫자(1. 2. 3.)만으로 표현하세요.";

/** 모델이 지시를 어기고 남긴 마크다운 기호를 제거한다(굵게/제목/목록 기호). */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[*-]\s+/gm, "");
}

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
    finishReason?: string;
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
          // 답변 전에 안 보이는 "생각" 토큰을 쓰면 그만큼 maxOutputTokens 예산을 깎아먹어
          // 실제 답변이 중간에 잘린다. gemini-3.6-flash는 thinkingBudget:0을 거부(HTTP 400)하므로
          // thinkingLevel을 최소로 낮춰 생각 토큰 비중만 줄인다.
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Gemini API 오류: HTTP ${res.status}`);
    }

    const data = (await res.json()) as GeminiGenerateContentResponse;
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini 응답에 텍스트가 없습니다.");
    }

    if (candidate?.finishReason === "MAX_TOKENS") {
      console.warn(`[ai-chat] 응답이 maxOutputTokens(${MAX_OUTPUT_TOKENS})에서 잘렸습니다.`);
    }

    return stripMarkdown(text.trim());
  } finally {
    clearTimeout(timeoutId);
  }
}
