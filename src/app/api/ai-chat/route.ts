import { NextResponse } from "next/server";
import { getAiChatReply } from "@/services/aiChat";

/**
 * "AI 농사 상담" 챗봇 API. GEMINI_API_KEY는 이 서버 라우트 안에서만 쓰이고
 * 클라이언트로 전달되지 않는다.
 */

const MAX_BODY_LENGTH = 5_000;

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (rawBody.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ message: "요청 데이터가 너무 큽니다." }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const body = parsed as Record<string, unknown>;
  const question = typeof body?.question === "string" ? body.question : "";
  if (!question.trim()) {
    return NextResponse.json({ message: "질문을 입력해주세요." }, { status: 400 });
  }

  try {
    const reply = await getAiChatReply(question);
    return NextResponse.json({ reply });
  } catch (error) {
    console.error(
      "[ai-chat] Gemini 호출 실패:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { message: "잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }
}
