import ScrollReveal from "@/components/landing/ScrollReveal";

const CONTACT_EMAIL = "iseoyeon769@gmail.com";

export default function ContactSection() {
  return (
    <section id="contact" className="bg-background px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <ScrollReveal className="grid items-center gap-10 rounded-3xl border border-border bg-card p-8 sm:grid-cols-2 sm:p-12">
          <div>
            <h2 className="font-display text-3xl font-bold text-text">문의하기</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              서비스 이용 중 궁금한 점이나 제안하고 싶은 내용이 있다면 언제든
              편하게 연락해주세요.
            </p>
            <p className="mt-6 text-sm text-muted">
              문의 및 제휴 담당팀에게 문의하세요:
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          <img
            src="/images/contact-agent.png"
            alt="상담원 안내 일러스트"
            className="h-64 w-full rounded-2xl object-cover sm:h-72"
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
