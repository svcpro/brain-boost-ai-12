import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";

// Lazy load all pages
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const AppDashboard = lazy(() => import("./pages/AppDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const CommunityDetailPage = lazy(() => import("./pages/CommunityDetailPage"));

// Lazy load heavy components
const PWAInstallBanner = lazy(() => import("@/components/app/PWAInstallBanner"));
const OfflineBanner = lazy(() => import("@/components/app/OfflineBanner"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 rounded-lg neural-gradient neural-border flex items-center justify-center animate-pulse">
      <span className="text-primary font-bold text-sm">A</span>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
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
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={
                <AdminProtectedRoute>
                  <AdminPanel />
                </AdminProtectedRoute>
              } />
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
);

export default App;
