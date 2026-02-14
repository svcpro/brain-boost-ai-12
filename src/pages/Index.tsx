import NeuralBackground from "@/components/landing/NeuralBackground";
import HeroSection from "@/components/landing/HeroSection";
import ForgettingCurveSection from "@/components/landing/ForgettingCurveSection";
import RankSection from "@/components/landing/RankSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <NeuralBackground />
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg neural-gradient neural-border flex items-center justify-center">
              <span className="text-primary font-bold text-sm">A</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">ACRY</span>
          </div>
          <a
            href="/app"
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold glow-primary hover:glow-primary-strong transition-all duration-300"
          >
            Launch App
          </a>
        </div>
      </nav>

      <HeroSection />
      <ForgettingCurveSection />
      <RankSection />
      <PricingSection />
      <CTASection />

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded neural-gradient neural-border flex items-center justify-center">
              <span className="text-primary font-bold text-xs">A</span>
            </div>
            <span className="font-display font-semibold text-foreground">ACRY</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 ACRY. AI Second Brain for All Exams.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
