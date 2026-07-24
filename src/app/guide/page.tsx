import AboutSection from "@/components/landing/AboutSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function GuidePage() {
  return (
    <>
      <div className="pt-16">
        <AboutSection />
        <FeaturesSection />
      </div>
      <LandingFooter />
    </>
  );
}
