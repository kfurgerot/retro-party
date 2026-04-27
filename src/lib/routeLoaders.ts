export const loadPortalPage = () => import("@/pages/Portal");
export const loadDashboardPage = () => import("@/pages/Dashboard");
export const loadHomePage = () => import("@/pages/Home");
export const loadPlayPage = () => import("@/pages/Index");
export const loadPreparePage = () => import("@/pages/Prepare");
export const loadPrepareRetroPage = () => import("@/pages/PrepareRetro");
export const loadPreparePlanningPokerPage = () => import("@/pages/PreparePlanningPoker");
export const loadSkillsMatrixPreparePage = () => import("@/pages/SkillsMatrixPrepare");
export const loadSkillsMatrixTemplateEditorPage = () =>
  import("@/pages/SkillsMatrixTemplateEditor");
export const loadRadarPartyPage = () => import("@/pages/RadarParty");
export const loadSkillsMatrixPage = () => import("@/pages/SkillsMatrix");
export const loadTemplateEditorPage = () => import("@/pages/TemplateEditor");
export const loadPokerTemplateEditorPage = () => import("@/pages/PokerTemplateEditor");
export const loadResetPasswordPage = () => import("@/pages/ResetPassword");
export const loadNotFoundPage = () => import("@/pages/NotFound");
export const loadTermsPage = () => import("@/pages/Terms");
export const loadAppDashboardPage = () => import("@/pages/AppDashboard");
export const loadExperienceCatalogPage = () => import("@/pages/ExperienceCatalog");
export const loadAppSessionsPage = () => import("@/pages/AppSessions");
export const loadAppTemplatesPage = () => import("@/pages/AppTemplates");
export const loadJoinPage = () => import("@/pages/Join");
export const loadLandingPage = () => import("@/pages/Landing");
export const loadAppSettingsPage = () => import("@/pages/AppSettings");
export const loadSessionSharePage = () => import("@/pages/SessionShare");
export const loadComingSoonPage = () => import("@/pages/ComingSoon");
export const loadAppShell = () =>
  import("@/components/app-shell-v2/AppShell").then((m) => ({ default: m.AppShell }));
