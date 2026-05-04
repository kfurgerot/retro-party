import { HostPill } from "@/components/app-shell-v2/HostPill";
import { SessionEndedListener } from "@/components/app-shell-v2/SessionEndedListener";
import {
  loadAppDashboardPage,
  loadAppSettingsPage,
  loadAppShell,
  loadAppSessionsPage,
  loadAppTeamDetailPage,
  loadAppTeamsPage,
  loadAppTemplatesPage,
  loadDashboardPage,
  loadExperienceCatalogPage,
  loadInvitationPage,
  loadJoinPage,
  loadLandingPage,
  loadNotFoundPage,
  loadPlayPage,
  loadPokerTemplateEditorPage,
  loadPortalPage,
  loadPreparePlanningPokerPage,
  loadPrepareRetroPage,
  loadRadarPartyPage,
  loadResetPasswordPage,
  loadSessionSharePage,
  loadSkillsMatrixPage,
  loadSkillsMatrixPreparePage,
  loadSkillsMatrixTemplateEditorPage,
  loadTemplateEditorPage,
  loadTermsPage,
} from "@/lib/routeLoaders";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const Portal = lazy(loadPortalPage);
const Dashboard = lazy(loadDashboardPage);
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
const AppShell = lazy(loadAppShell);
const AppDashboard = lazy(loadAppDashboardPage);
const ExperienceCatalog = lazy(loadExperienceCatalogPage);
const AppSessions = lazy(loadAppSessionsPage);
const AppTemplates = lazy(loadAppTemplatesPage);
const JoinPage = lazy(loadJoinPage);
const Landing = lazy(loadLandingPage);
const AppSettings = lazy(loadAppSettingsPage);
const SessionShare = lazy(loadSessionSharePage);
const AppTeams = lazy(loadAppTeamsPage);
const AppTeamDetail = lazy(loadAppTeamDetailPage);
const InvitationPage = lazy(loadInvitationPage);

const RouteFallback = () => (
  <div
    className="relative flex min-h-svh items-center justify-center px-4"
    style={{ background: "#0a0a14" }}
  >
    <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-400">
      <svg
        className="animate-spin"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      Chargement...
    </div>
  </div>
);

export function AppRoutes() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/portal-legacy" element={<Portal />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/r/:code" element={<SessionShare />} />
          <Route path="/invite/:token" element={<InvitationPage />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<AppDashboard />} />
            <Route path="experiences" element={<ExperienceCatalog />} />
            <Route path="sessions" element={<AppSessions />} />
            <Route path="templates" element={<AppTemplates />} />
            <Route path="teams" element={<AppTeams />} />
            <Route path="teams/:teamId" element={<AppTeamDetail />} />
            <Route path="settings" element={<AppSettings />} />
          </Route>
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
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <HostPill />
      <SessionEndedListener />
    </>
  );
}
