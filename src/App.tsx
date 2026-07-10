import { lazy, Suspense, useEffect, type ComponentType } from "react";
import ACRYLogo from "@/components/landing/ACRYLogo";
import InstitutionLayout from "@/components/InstitutionLayout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";

const retryLazy = (
  factory: () => Promise<{ default: ComponentType<any> }>,
  cacheKey: string,
) => lazy(async () => {
  try {
    return await factory();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Failed to fetch dynamically imported module") && !sessionStorage.getItem(cacheKey)) {
      sessionStorage.setItem(cacheKey, "1");
      window.location.replace(`${window.location.pathname}?_cache_bust=${Date.now()}`);
      return new Promise<{ default: ComponentType<any> }>(() => {});
    }
    throw error;
  }
});

// Lazy load all pages
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const AppDashboard = lazy(() => import("./pages/AppDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminPanel = retryLazy(() => import("./pages/AdminPanel"), "acry_admin_panel_import_retry_v1");
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const CommunityDetailPage = lazy(() => import("./pages/CommunityDetailPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const RefundPolicyPage = lazy(() => import("./pages/RefundPolicyPage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage"));
const AcceleratorPage = lazy(() => import("./pages/AcceleratorPage"));
const DebatePracticePage = lazy(() => import("./pages/DebatePracticePage"));
const MyRankLanding = lazy(() => import("./pages/myrank/MyRankLanding"));
const MyRankTest = lazy(() => import("./pages/myrank/MyRankTest"));
const MyRankResult = lazy(() => import("./pages/myrank/MyRankResult"));
const MyRankLeaderboard = lazy(() => import("./pages/myrank/MyRankLeaderboard"));
const InstituteAdminPage = lazy(() => import("./pages/InstituteAdminPage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const InstituteLoginPage = lazy(() => import("./pages/InstituteLoginPage"));
const InstituteSignupPage = lazy(() => import("./pages/InstituteSignupPage"));
const InstituteJoinPage = lazy(() => import("./pages/InstituteJoinPage"));
const CampusAmbassadorBlueprint = lazy(() => import("./pages/CampusAmbassadorBlueprint"));
const AmbassadorDashboard = lazy(() => import("./pages/ambassador/AmbassadorDashboard"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));
const MissionSuccessBatch = lazy(() => import("./pages/MissionSuccessBatch"));

// Lazy load heavy components
const PWAInstallBanner = lazy(() => import("@/components/app/PWAInstallBanner"));
const OfflineBanner = lazy(() => import("@/components/app/OfflineBanner"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — avoid redundant refetches
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <ACRYLogo variant="icon" animate={true} className="w-10 h-10 animate-pulse" />
  </div>
);

const GlobalErrorCatcher = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      const message = e.reason instanceof Error ? e.reason.message : String(e.reason || "");
      if (message.includes("Failed to fetch dynamically imported module")) {
        const key = "acry_dynamic_import_recovery_v1";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.replace(`${window.location.pathname}?_cache_bust=${Date.now()}`);
        }
      }
      console.error("[Unhandled Rejection]", e.reason);
      e.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
  <GlobalErrorCatcher>
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/coming-soon" element={<ComingSoonPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/myrank" element={<MyRankLanding />} />
              <Route path="/myrank/test" element={<MyRankTest />} />
              <Route path="/myrank/result" element={<MyRankResult />} />
              <Route path="/myrank/leaderboard" element={<MyRankLeaderboard />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/app" element={
                <ProtectedRoute>
                  <AppDashboard />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <UserProfilePage />
                </ProtectedRoute>
              } />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <AIChatPage />
                </ProtectedRoute>
              } />
              <Route path="/community" element={
                <ProtectedRoute>
                  <CommunityPage />
                </ProtectedRoute>
              } />
              <Route path="/community/:slug" element={
                <ProtectedRoute>
                  <CommunityDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/accelerator" element={
                <ProtectedRoute>
                  <AcceleratorPage />
                </ProtectedRoute>
              } />
              <Route path="/debate" element={
                <ProtectedRoute>
                  <DebatePracticePage />
                </ProtectedRoute>
              } />
              <Route path="/invite/:token" element={<AcceptInvitePage />} />
              <Route path="/institute/login" element={<InstituteLoginPage />} />
              <Route path="/institute/signup" element={<InstituteSignupPage />} />
              <Route path="/join/:code" element={<InstituteJoinPage />} />
              <Route path="/i/:code" element={<InstituteJoinPage />} />
              <Route path="/institute" element={
                <ProtectedRoute>
                  <InstituteAdminPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={
                <AdminProtectedRoute>
                  <AdminPanel />
                </AdminProtectedRoute>
              } />
              {/* Institution path-based sub-routes (slug-based) */}
              <Route path="/inst/:institutionSlug" element={<InstitutionLayout />}>
                <Route index element={<Index />} />
                <Route path="auth" element={<AuthPage />} />
                <Route path="app" element={
                  <ProtectedRoute>
                    <AppDashboard />
                  </ProtectedRoute>
                } />
              </Route>
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/refund-policy" element={<RefundPolicyPage />} />
              <Route path="/cookie-policy" element={<CookiePolicyPage />} />
              <Route path="/campus-ambassador" element={<CampusAmbassadorBlueprint />} />
              <Route path="/blueprint/campus-ambassador" element={<CampusAmbassadorBlueprint />} />
              <Route path="/ambassador" element={<AmbassadorDashboard />} />
              <Route path="/ambassador/:section" element={<AmbassadorDashboard />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Suspense fallback={null}>
            <PWAInstallBanner />
            <OfflineBanner />
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
  </GlobalErrorCatcher>
  </ErrorBoundary>
);

export default App;
