import { NextResponse } from "next/server";
import { analyzeFarm } from "@/services/analyze";
import type { AnalysisInput } from "@/types/analysis";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalysisInput;

    if (!body.location?.address || !body.crop) {
      return NextResponse.json(
        { message: "지역과 작물을 입력해주세요." },
        { status: 400 },
      );
    }

    const result = await analyzeFarm(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        message: "분석 중 오류가 발생했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
