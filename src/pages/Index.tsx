import { useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import NeuralBackground from "@/components/landing/NeuralBackground";
import HeroSection from "@/components/landing/HeroSection";
import Footer from "@/components/landing/Footer";
import ACRYLogo from "@/components/landing/ACRYLogo";
import MobileLanding from "@/components/landing/MobileLanding";
import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";


// Lazy load below-fold sections
const ProblemSection = lazy(() => import("@/components/landing/ProblemSection"));
const HowItWorksSection = lazy(() => import("@/components/landing/HowItWorksSection"));
const BrainDemoSection = lazy(() => import("@/components/landing/BrainDemoSection"));
const StudyModesSection = lazy(() => import("@/components/landing/StudyModesSection"));
const SocialProofSection = lazy(() => import("@/components/landing/SocialProofSection"));
const ForgettingCurveSection = lazy(() => import("@/components/landing/ForgettingCurveSection"));
const RankSection = lazy(() => import("@/components/landing/RankSection"));
const PricingSection = lazy(() => import("@/components/landing/PricingSection"));
const CTASection = lazy(() => import("@/components/landing/CTASection"));

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Capture memorable referral handle (?ref=rahul123) on root domain
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.length >= 3 && ref.length <= 32 && /^[a-z0-9_]+$/i.test(ref)) {
      sessionStorage.setItem("myrank_ref", ref);
      localStorage.setItem("acry_pending_ref", ref);
      // Track click via edge function (service role can update click_count)
      supabase.functions
        .invoke("myrank-engine", { body: { action: "track_click", handle: ref } })
        .catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user) {
      navigate("/app", { replace: true });
      return;
    }
    // Check coming soon mode
    if (!loading && !user) {
      supabase
        .from("coming_soon_config")
        .select("is_enabled")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.is_enabled) {
            navigate("/coming-soon", { replace: true });
          }
        });
    }
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <NeuralBackground />
      
      {/* Sticky Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <ACRYLogo variant="navbar" animate={false} />
          <div className="flex items-center gap-3">
            <Link
              to="/auth?splash=1"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold glow-primary hover:glow-primary-strong transition-all duration-300"
            >
              <Rocket className="w-3.5 h-3.5" />
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      <HeroSection />

      <Suspense fallback={<div className="h-48" />}>
        <ProblemSection />
        <HowItWorksSection />
        <BrainDemoSection />
        <StudyModesSection />
        <SocialProofSection />
        <ForgettingCurveSection />
        <RankSection />
        <PricingSection />
        <CTASection />
      </Suspense>

      <Footer />
    </div>
  );
};

export default Index;
