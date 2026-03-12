import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  loadHomePage,
  loadNotFoundPage,
  loadPlayPage,
  loadPreparePage,
  loadResetPasswordPage,
  loadTemplateEditorPage,
} from "@/lib/routeLoaders";
import { UI_MODE } from "@/lib/uiMode";

const Home = lazy(loadHomePage);
const Index = lazy(loadPlayPage);
const PreparePage = lazy(loadPreparePage);
const TemplateEditorPage = lazy(loadTemplateEditorPage);
const ResetPasswordPage = lazy(loadResetPasswordPage);
const NotFound = lazy(loadNotFoundPage);

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="scanlines relative flex min-h-svh items-center justify-center bg-slate-950 px-4">
    <div className="neon-surface px-4 py-3 text-sm font-semibold text-cyan-100">
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play" element={<Index />} />
              <Route path="/prepare" element={<PreparePage />} />
              <Route path="/prepare/templates/:templateId" element={<TemplateEditorPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
