import AboutSection from "@/components/landing/AboutSection";
import ChatWidget from "@/components/landing/ChatWidget";
import ContactSection from "@/components/landing/ContactSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import Hero from "@/components/landing/Hero";
import LandingFooter from "@/components/landing/LandingFooter";
import RiskCheckSection from "@/components/landing/RiskCheckSection";
import StatsSection from "@/components/landing/StatsSection";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <RiskCheckSection />
      <AboutSection />
      <StatsSection />
      <FeaturesSection />
      <ContactSection />
      <LandingFooter />
      <ChatWidget />
    </>
  );
}
