import type { CropAnalysisResult } from "@/services/cropAnalysis";
import type { CropPestsResponse } from "@/types/cropPests";

/**
 * "AI 맞춤 재배 리포트"의 출력 타입. LLM은 이미 계산된 analysis/pests 결과를 쉬운 말로
 * 설명만 할 뿐, 점수·위험도·비료량을 다시 계산하지 않는다(CLAUDE.md 원칙 7).
 * isFallback은 LLM이 스스로 판단하지 않고 서버가 어느 경로로 만들었는지에 따라 그대로 정한다.
 */
export interface FarmAnalysisReport {
  summary: string;
  strengths: string[];
  cautions: string[];
  immediateActions: string[];
  missingDataNotice: string | null;
  dataBasisNotice: string;
  disclaimer: string;
  isFallback: boolean;
}

/** POST /api/analysis-report 요청 바디. */
export interface AnalysisReportRequest {
  analysis: CropAnalysisResult;
  pests: CropPestsResponse | null;
}

export interface AnalysisReportResponse {
  report: FarmAnalysisReport;
}
