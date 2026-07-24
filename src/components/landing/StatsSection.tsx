import ScrollReveal from "@/components/landing/ScrollReveal";

const STATS = [
  { value: "5", label: "지원 작물 (사과·배·오이·감자·상추)" },
  { value: "5", label: "적합도 평가 항목 (기온·pH·EC·토성·강수량)" },
  { value: "4", label: "단기 위험 유형 (저온·고온·집중강우·과습)" },
  { value: "100%", label: "결측 항목 투명 공개 (0점 처리 없음)" },
];

export default function StatsSection() {
  return (
    <section className="bg-dark px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 sm:grid-cols-2">
        <ScrollReveal className="relative">
          <img
            src="/images/data-analysis.png"
            alt="공공데이터 분석 일러스트"
            className="h-72 w-full rounded-2xl object-contain sm:h-96"
          />
          <div className="mt-6">
            <h2 className="text-3xl font-bold text-white">
              신뢰할 수 있는 공공데이터
              <br />
              기반 분석
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/75">
              기상청 단기예보와 토양 통계, 농촌진흥청 재배 기준을 바탕으로
              분석하며, mock 데이터를 사용한 경우 화면에 그대로 표시합니다.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="rounded-3xl bg-white p-8 shadow-xl">
            <div className="grid grid-cols-2 gap-8">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <div className="text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted">
              * 실제 서비스 지표가 아닌, 현재 구현 범위를 보여주는 예시 수치입니다.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
