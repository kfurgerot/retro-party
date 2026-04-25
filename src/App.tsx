import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import {
  loadPortalPage,
  loadDashboardPage,
  loadHomePage,
  loadNotFoundPage,
  loadPlayPage,
  loadPrepareRetroPage,
  loadPreparePlanningPokerPage,
  loadSkillsMatrixPreparePage,
  loadSkillsMatrixTemplateEditorPage,
  loadRadarPartyPage,
  loadSkillsMatrixPage,
  loadResetPasswordPage,
  loadTemplateEditorPage,
  loadPokerTemplateEditorPage,
  loadTermsPage,
} from "@/lib/routeLoaders";
import { UI_MODE } from "@/lib/uiMode";
import { AuthProvider } from "@/contexts/AuthContext";

const Portal = lazy(loadPortalPage);
const Dashboard = lazy(loadDashboardPage);
const Home = lazy(loadHomePage);
const Index = lazy(loadPlayPage);
const PrepareRetroPage = lazy(loadPrepareRetroPage);
const PreparePlanningPokerPage = lazy(loadPreparePlanningPokerPage);
const SkillsMatrixPreparePage = lazy(loadSkillsMatrixPreparePage);
const SkillsMatrixTemplateEditorPage = lazy(loadSkillsMatrixTemplateEditorPage);
const RadarPartyPage = lazy(loadRadarPartyPage);
const SkillsMatrixPage = lazy(loadSkillsMatrixPage);
const TemplateEditorPage = lazy(loadTemplateEditorPage);
const PokerTemplateEditorPage = lazy(loadPokerTemplateEditorPage);
const ResetPasswordPage = lazy(loadResetPasswordPage);
const TermsPage = lazy(loadTermsPage);
const NotFound = lazy(loadNotFoundPage);

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#f7f8f3] px-4 text-[#18211f]">
    <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
    <div className="relative z-10 rounded-[24px] border border-[#d8e2d9] bg-white/72 px-4 py-3 text-sm font-bold text-[#24443d] shadow-sm backdrop-blur">
      Chargement...
    </div>
  </div>
);

const App = () => {
  useEffect(() => {
    document.documentElement.dataset.uiMode = UI_MODE;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Portal />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/home" element={<Home />} />
                <Route path="/play" element={<Index />} />
                <Route path="/prepare" element={<Navigate to="/prepare/retro-party" replace />} />
                <Route path="/prepare/retro-party" element={<PrepareRetroPage />} />
                <Route path="/prepare/planning-poker" element={<PreparePlanningPokerPage />} />
                <Route path="/prepare/skills-matrix" element={<SkillsMatrixPreparePage />} />
                <Route
                  path="/prepare/skills-matrix/:templateId"
                  element={<SkillsMatrixTemplateEditorPage />}
                />
                <Route path="/radar-party" element={<RadarPartyPage />} />
                <Route path="/skills-matrix" element={<SkillsMatrixPage />} />
                <Route path="/prepare/templates/:templateId" element={<TemplateEditorPage />} />
                <Route path="/prepare/poker/:templateId" element={<PokerTemplateEditorPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/cgu" element={<TermsPage />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
