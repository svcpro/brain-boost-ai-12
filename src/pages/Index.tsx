import { useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import NeuralBackground from "@/components/landing/NeuralBackground";
import HeroSection from "@/components/landing/HeroSection";

// Lazy load below-fold sections
const ForgettingCurveSection = lazy(() => import("@/components/landing/ForgettingCurveSection"));
const RankSection = lazy(() => import("@/components/landing/RankSection"));
const PricingSection = lazy(() => import("@/components/landing/PricingSection"));
const CTASection = lazy(() => import("@/components/landing/CTASection"));

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/app", { replace: true });
    }
  }, [user, loading, navigate]);

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
            href="/auth"
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold glow-primary hover:glow-primary-strong transition-all duration-300"
          >
            Launch App
          </a>
        </div>
      </nav>

      <HeroSection />
      <Suspense fallback={<div className="h-96" />}>
        <ForgettingCurveSection />
        <RankSection />
        <PricingSection />
        <CTASection />
      </Suspense>

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
