import ScrollReveal from "@/components/landing/ScrollReveal";

export default function AboutSection() {
  return (
    <section id="about" className="bg-background px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <ScrollReveal className="grid items-center gap-10 overflow-hidden rounded-3xl bg-primary p-8 sm:grid-cols-2 sm:p-12">
          <img
            src="/images/farmland-field.jpg"
            alt="농경지 전경"
            className="h-64 w-full rounded-2xl object-cover sm:h-80"
          />

          <div>
            <h2 className="text-3xl font-bold text-white">
              내 지역의 토양과 앞으로의 날씨를 분석해,
              <br />
              작물 재배 위험을 미리 알려드립니다
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/85">
              공공데이터 기반 기상·토양 정보와 작물별 공식 생육 기준을 비교해
              적합도 점수와 단기 위험을 함께 보여드립니다. 결측 데이터는 숨기지
              않고 평가에서 제외된 항목으로 그대로 알려드립니다.
            </p>
            <a
              href="/risk"
              className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-primary hover:opacity-90"
            >
              자세히 보기
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
