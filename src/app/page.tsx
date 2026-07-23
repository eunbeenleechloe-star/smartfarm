import AboutSection from "@/components/landing/AboutSection";
import ChatWidget from "@/components/landing/ChatWidget";
import ContactSection from "@/components/landing/ContactSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import Hero from "@/components/landing/Hero";
import LandingFooter from "@/components/landing/LandingFooter";
import Navbar from "@/components/landing/Navbar";
import RiskCheckSection from "@/components/landing/RiskCheckSection";
import StatsSection from "@/components/landing/StatsSection";

export default function LandingPage() {
  return (
    <>
      <Navbar />
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
