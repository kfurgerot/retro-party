import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  LogIn,
  MessageSquareText,
  Play,
  Radar,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { api } from "@/net/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ToolId =
  | "planning-poker"
  | "retro-party"
  | "radar-party"
  | "skills-matrix"
  | "draw-duel"
  | "retro-generator";
type ModuleCategoryId = "insight" | "action" | "pilotage";
type ModuleCategoryFilterId = "all" | ModuleCategoryId;

type ModuleCategory = {
  id: ModuleCategoryId;
  label: string;
  rgb: string;
};

type Tool = {
  id: ToolId;
  label: string;
  tagline: string;
  icon: string;
  status: "live" | "soon";
  color: string;
  glow: string;
  desc: string;
  hostRoute: string | null;
  joinRoute: (code: string) => string | null;
  hasPrepare?: boolean;
  categories: ModuleCategoryId[];
};

const MODULE_CATEGORIES: ModuleCategory[] = [
  { id: "insight", label: "Insight", rgb: "14,165,233" },
  { id: "action", label: "Action", rgb: "99,102,241" },
  { id: "pilotage", label: "Pilotage", rgb: "245,158,11" },
];

const CATEGORY_BY_ID = Object.fromEntries(
  MODULE_CATEGORIES.map((category) => [category.id, category]),
) as Record<ModuleCategoryId, ModuleCategory>;

const TOOLS: Tool[] = [
  {
    id: "planning-poker",
    label: "Planning Poker",
    tagline: "Estimez ensemble, décidez vite",
    icon: "🃏",
    status: "live",
    color: "#6366f1",
    glow: "rgba(99,102,241,0.3)",
    desc: "Votes synchronisés en temps réel, révélation simultanée, stats instantanées.",
    hostRoute: "/play?from=portal&experience=planning-poker",
    joinRoute: (code) => `/play?from=portal&experience=planning-poker&mode=join&code=${code}`,
    hasPrepare: true,
    categories: ["action", "pilotage"],
  },
  {
    id: "retro-party",
    label: "Rétro Party",
    tagline: "Rétrospective en mode jeu",
    icon: "🎲",
    status: "live",
    color: "#ec4899",
    glow: "rgba(236,72,153,0.3)",
    desc: "Plateau de jeu collaboratif, questions Agile, mini-jeux d'équipe.",
    hostRoute: "/play?from=portal",
    joinRoute: (code) => `/play?from=portal&mode=join&code=${code}`,
    hasPrepare: true,
    categories: ["insight", "action"],
  },
  {
    id: "radar-party",
    label: "Radar Party",
    tagline: "Visualisez la santé de votre équipe",
    icon: "📡",
    status: "live",
    color: "#10b981",
    glow: "rgba(16,185,129,0.3)",
    desc: "Questionnaire Agile, radar individuel & équipe, insights atelier.",
    hostRoute: "/radar-party?from=portal&mode=host",
    joinRoute: (code) => `/radar-party?mode=join&code=${code}`,
    categories: ["insight", "pilotage"],
  },
  {
    id: "skills-matrix",
    label: "Matrice de Compétences",
    tagline: "Cartographiez les forces de l'équipe",
    icon: "🧩",
    status: "live",
    color: "#0ea5e9",
    glow: "rgba(14,165,233,0.3)",
    desc: "Auto-évaluation, niveau requis et dashboard des compétences à risque.",
    hostRoute: "/skills-matrix?from=portal&mode=host",
    joinRoute: (code) => `/skills-matrix?mode=join&code=${code}`,
    hasPrepare: true,
    categories: ["insight", "pilotage"],
  },
  {
    id: "draw-duel",
    label: "Draw Duel",
    tagline: "Dessinez, devinez, riez",
    icon: "✏️",
    status: "soon",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.2)",
    desc: "Mini-jeu de dessin collaboratif pour briser la glace.",
    hostRoute: null,
    joinRoute: () => null,
    categories: ["action"],
  },
  {
    id: "retro-generator",
    label: "Rétro Generator",
    tagline: "Formats de rétro sur mesure",
    icon: "⚙️",
    status: "soon",
    color: "#64748b",
    glow: "rgba(100,116,139,0.15)",
    desc: "Génère des formats de rétrospective adaptés à votre contexte.",
    hostRoute: null,
    joinRoute: () => null,
    categories: ["insight"],
  },
];

const PREPARE_ROUTE_BY_TOOL: Record<ToolId, string | null> = {
  "planning-poker": "/prepare/planning-poker",
  "retro-party": "/prepare/retro-party",
  "radar-party": null,
  "skills-matrix": "/prepare/skills-matrix",
  "draw-duel": null,
  "retro-generator": null,
};

const FEATURED_USE_CASES: Array<{
  id: ToolId;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  Icon: LucideIcon;
}> = [
  {
    id: "planning-poker",
    eyebrow: "Estimation",
    title: "Planning Poker",
    description:
      "Votes synchronisés, révélation simultanée et décisions visibles par toute l'équipe.",
    accent: "#2563eb",
    Icon: BarChart3,
  },
  {
    id: "retro-party",
    eyebrow: "Rétrospective",
    title: "Retro Party",
    description:
      "Un atelier rythmé pour faire émerger les sujets utiles et maintenir l'engagement.",
    accent: "#db2777",
    Icon: MessageSquareText,
  },
  {
    id: "skills-matrix",
    eyebrow: "Diagnostic",
    title: "Skills Matrix",
    description:
      "Une lecture claire des compétences, des écarts et des priorités d'accompagnement.",
    accent: "#0891b2",
    Icon: Radar,
  },
];

const WORKFLOW_STEPS = [
  {
    title: "Prépare",
    description: "Choisis le module et, si besoin, personnalise tes questions ou tes stories.",
    Icon: ClipboardList,
  },
  {
    title: "Invite",
    description: "Partage un code room simple avec les participants, sans configuration technique.",
    Icon: Users,
  },
  {
    title: "Anime",
    description: "Pilote l'atelier en temps réel avec une interface lisible sur mobile et desktop.",
    Icon: Sparkles,
  },
];

// ─── Account modal ─────────────────────────────────────────────────────────────

type AccountSection = "overview" | "profile" | "security";

const ACCOUNT_SECTIONS: Array<{
  id: AccountSection;
  label: string;
  mobileLabel: string;
  hint: string;
  icon: string;
}> = [
  {
    id: "overview",
    label: "Vue d'ensemble",
    mobileLabel: "Vue",
    hint: "Actions rapides",
    icon: "📊",
  },
  {
    id: "profile",
    label: "Profil",
    mobileLabel: "Profil",
    hint: "Informations personnelles",
    icon: "👤",
  },
  {
    id: "security",
    label: "Sécurité",
    mobileLabel: "Sécurité",
    hint: "Mot de passe et session",
    icon: "🔒",
  },
];

const AccountModal = ({
  open,
  onOpenChange,
  onOpenDashboard,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenDashboard: () => void;
  onLogout: () => Promise<void>;
}) => {
  const { user, updateProfile, changePassword } = useAuth();
  const [section, setSection] = useState<AccountSection>("overview");
  const [displayName, setDisplayName] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setSection("overview");
    setPasswordModalOpen(false);
    setDisplayName(user.displayName ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setError(null);
    setInfo(null);
  }, [open, user]);

  if (!user) return null;

  const inputCls =
    "h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50";

  const identityBase = (user.displayName || user.email).trim();
  const initials = identityBase
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const nextName = displayName.trim();
    if (nextName.length < 2) {
      setError("Le nom d'affichage doit contenir au moins 2 caractères.");
      return;
    }
    setProfileLoading(true);
    try {
      await updateProfile(nextName);
      setInfo("Profil mis à jour.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setError(null);
    setInfo(null);
    if (newPassword.length < 8) {
      setPasswordError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }
    setPasswordLoading(true);
    try {
      const message = await changePassword(currentPassword, newPassword);
      setInfo(message || "Mot de passe mis à jour.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordModalOpen(false);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setInfo(null);
    setLogoutLoading(true);
    try {
      await onLogout();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 shadow-2xl [&>button]:text-slate-400 [&>button]:hover:text-slate-100">
        <div className="flex max-h-[90vh] flex-col sm:min-h-[560px]">
          <div className="border-b border-white/[0.08] bg-gradient-to-r from-indigo-500/12 via-violet-500/8 to-pink-500/10 p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-indigo-500 to-pink-500 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-slate-100">
                  {user.displayName || "Utilisateur"}
                </div>
                <div className="truncate text-xs text-slate-400">{user.email}</div>
              </div>
              <span className="ml-auto rounded-full border border-indigo-300/30 bg-indigo-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-indigo-200">
                Mon compte
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Plan</div>
                <div className="text-sm font-semibold text-slate-100">Personal</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Accès</div>
                <div className="text-sm font-semibold text-slate-100">3 modules actifs</div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  Workspace
                </div>
                <div className="text-sm font-semibold text-slate-100">Agile Suite</div>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr]">
            <aside className="border-b border-white/[0.06] p-3 md:border-b-0 md:border-r md:border-white/[0.06] md:p-4">
              <nav className="grid grid-cols-3 gap-2 md:hidden">
                {ACCOUNT_SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition",
                      section === item.id
                        ? "border-indigo-400/45 bg-indigo-500/15 text-indigo-100"
                        : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.05]",
                    )}
                  >
                    <span className="text-sm leading-none">{item.icon}</span>
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em]">
                      {item.mobileLabel}
                    </span>
                  </button>
                ))}
              </nav>

              <nav className="hidden gap-2 md:flex md:flex-col">
                {ACCOUNT_SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                      section === item.id
                        ? "border-indigo-400/45 bg-indigo-500/15 text-indigo-100"
                        : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.05]",
                    )}
                  >
                    <span className="text-sm leading-none">{item.icon}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold uppercase tracking-[0.08em]">
                        {item.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">{item.hint}</span>
                    </span>
                  </button>
                ))}
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                className="mt-3 hidden h-10 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50 md:block"
              >
                {logoutLoading ? "Déconnexion..." : "Se déconnecter"}
              </button>
            </aside>

            <main className="min-h-0 overflow-y-auto p-4 sm:p-5">
              {error && (
                <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              {info && (
                <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {info}
                </div>
              )}

              {section === "overview" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-4">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-indigo-300">
                      Dashboard
                    </div>
                    <p className="mb-3 text-sm text-indigo-100/90">
                      Consulte les activités par module et l'historique de tes sessions.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenDashboard}
                      className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 sm:w-auto sm:px-5"
                    >
                      Ouvrir le dashboard
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Informations du compte
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                        <div className="text-[11px] text-slate-500">Nom d'affichage</div>
                        <div className="truncate font-medium text-slate-100">
                          {user.displayName || "Utilisateur"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                        <div className="text-[11px] text-slate-500">Adresse e-mail</div>
                        <div className="truncate font-medium text-slate-100">{user.email}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {section === "profile" && (
                <form
                  onSubmit={handleProfileSubmit}
                  className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"
                >
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Informations personnelles
                    </div>
                    <p className="text-xs text-slate-500">
                      Mets à jour ton identité affichée dans les modules AgileSuite.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-500">Nom d'affichage</label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={inputCls}
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-500">Adresse e-mail</label>
                    <input
                      value={user.email}
                      disabled
                      className={cn(inputCls, "cursor-not-allowed opacity-70")}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50 sm:w-auto sm:px-5"
                  >
                    {profileLoading ? "Mise à jour..." : "Enregistrer le profil"}
                  </button>
                </form>
              )}

              {section === "security" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Changer le mot de passe
                    </p>
                    <p className="mb-3 text-xs text-slate-500">
                      Ouvre une fenêtre dédiée pour mettre à jour ton mot de passe en toute
                      sécurité.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordError(null);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordModalOpen(true);
                      }}
                      className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 sm:w-auto sm:px-5"
                    >
                      Mettre à jour le mot de passe
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 md:hidden">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Session
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={logoutLoading}
                      className="h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.03] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      {logoutLoading ? "Déconnexion..." : "Se déconnecter"}
                    </button>
                  </div>
                </div>
              )}

              <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
                <DialogContent className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-5 shadow-2xl [&>button]:text-slate-400 [&>button]:hover:text-slate-100">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-slate-100">
                      Mettre à jour le mot de passe
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Confirme ton mot de passe actuel, puis saisis le nouveau mot de passe.
                    </p>
                  </div>

                  {passwordError && (
                    <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {passwordError}
                    </div>
                  )}

                  <form onSubmit={handlePasswordSubmit} className="space-y-2">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Mot de passe actuel"
                      className={inputCls}
                      required
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe"
                      className={inputCls}
                      required
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmer le nouveau mot de passe"
                      className={inputCls}
                      required
                    />

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setPasswordModalOpen(false)}
                        className="h-11 rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="h-11 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
                      >
                        {passwordLoading ? "Mise à jour..." : "Confirmer"}
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </main>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Tool cards ────────────────────────────────────────────────────────────────

const ModuleCategoryBadge = ({
  categoryId,
  highlighted = false,
}: {
  categoryId: ModuleCategoryId;
  highlighted?: boolean;
}) => {
  const category = CATEGORY_BY_ID[categoryId];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{
        borderColor: `rgba(${category.rgb}, ${highlighted ? 0.62 : 0.36})`,
        background: `rgba(${category.rgb}, ${highlighted ? 0.26 : 0.12})`,
        color: highlighted ? "#f8fafc" : "#cbd5e1",
      }}
    >
      {category.label}
    </span>
  );
};

const ToolCategoryTags = ({
  tool,
  activeCategoryId,
  className,
}: {
  tool: Tool;
  activeCategoryId: ModuleCategoryId | null;
  className?: string;
}) => (
  <div className={cn("flex flex-wrap gap-1.5", className)}>
    {tool.categories.map((categoryId) => (
      <ModuleCategoryBadge
        key={`${tool.id}-${categoryId}`}
        categoryId={categoryId}
        highlighted={categoryId === activeCategoryId}
      />
    ))}
  </div>
);

type ToolActionsContentProps = {
  tool: Tool;
  code: string;
  isLoggedIn: boolean;
  buttonLayout?: "stack" | "split";
  onCodeChange: (id: ToolId, value: string) => void;
  onCreate: (id: ToolId) => void;
  onJoin: (id: ToolId, code: string) => void;
  onPrepare: (id: ToolId) => void;
  onLoginRequired: (id: ToolId) => void;
};

const ToolActionsContent = ({
  tool,
  code,
  isLoggedIn,
  buttonLayout = "split",
  onCodeChange,
  onCreate,
  onJoin,
  onPrepare,
  onLoginRequired,
}: ToolActionsContentProps) => {
  const isLive = tool.status === "live";
  const canJoin = isLive && code.trim().length >= 4;
  const canCreate = isLive && !!tool.hostRoute;
  const canPrepare = isLive && !!tool.hasPrepare;

  if (!isLive) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Module en préparation
        </p>
        <p className="mt-1 text-[11px] text-slate-500">Ce module sera disponible prochainement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Rejoindre une session
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Saisis le code partagé par l'animateur.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div
            className={cn(
              "flex h-10 items-center gap-2 rounded-2xl border px-2.5 transition",
              "bg-white/[0.04]",
              canJoin
                ? "border-white/[0.2] shadow-[0_0_0_1px_rgba(99,102,241,0.28)]"
                : "border-white/[0.08]",
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] font-mono text-[11px] font-semibold text-slate-400">
              #
            </span>
            <input
              value={code}
              onChange={(e) => onCodeChange(tool.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canJoin) onJoin(tool.id, code);
              }}
              placeholder="AB12"
              autoComplete="off"
              inputMode="text"
              className="h-full w-full border-none bg-transparent px-0 font-mono text-sm tracking-widest text-slate-100 outline-none placeholder:tracking-[0.08em] placeholder:text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={() => canJoin && onJoin(tool.id, code)}
            disabled={!canJoin}
            className={cn(
              "h-10 rounded-2xl px-4 text-[13px] font-semibold transition",
              canJoin
                ? "text-white hover:brightness-110"
                : "cursor-not-allowed bg-white/5 text-slate-600",
            )}
            style={canJoin ? { background: tool.color } : undefined}
          >
            Rejoindre
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Code court (4 à 6 caractères)</p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <div className="mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Démarrer une nouvelle session
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {canPrepare
              ? "Lance tout de suite ou prépare d'abord ton atelier."
              : "Crée une salle et invite ton équipe en quelques secondes."}
          </p>
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-2",
            canPrepare && buttonLayout === "split" && "sm:grid-cols-2",
          )}
        >
          <button
            type="button"
            onClick={() => canCreate && onCreate(tool.id)}
            disabled={!canCreate}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-center text-[13px] font-semibold transition",
              canCreate
                ? "text-white hover:brightness-110"
                : "cursor-not-allowed bg-white/5 text-slate-600",
            )}
            style={
              canCreate
                ? {
                    background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
                    boxShadow: `0 4px 12px ${tool.glow}`,
                  }
                : undefined
            }
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="leading-none"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span className="leading-none">Créer une session</span>
          </button>

          {canPrepare && (
            <button
              type="button"
              onClick={() => (isLoggedIn ? onPrepare(tool.id) : onLoginRequired(tool.id))}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-center text-[13px] font-semibold transition",
                isLoggedIn
                  ? "border-white/[0.12] bg-white/[0.05] text-slate-200 hover:border-white/[0.2] hover:bg-white/[0.08]"
                  : "border-indigo-400/35 bg-indigo-500/10 text-indigo-200 hover:border-indigo-300/55 hover:bg-indigo-500/18",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  isLoggedIn
                    ? "border border-white/[0.18] bg-white/[0.08] text-slate-300"
                    : "border border-indigo-300/35 bg-indigo-500/15 text-indigo-200",
                )}
              >
                {isLoggedIn ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className="leading-none"
                  >
                    <path d="m5 12 4 4 10-10" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    className="leading-none"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
              </span>
              <span className="leading-none">Préparer une partie</span>
            </button>
          )}
        </div>

        {canPrepare && !isLoggedIn && (
          <p className="mt-2 text-[11px] text-slate-500">
            Connexion requise pour accéder à la préparation.
          </p>
        )}
      </div>
    </div>
  );
};

const ToolCard = ({
  tool,
  activeCategoryId,
  isOpen,
  code,
  isLoggedIn,
  onToggle,
  onCodeChange,
  onCreate,
  onJoin,
  onPrepare,
  onLoginRequired,
}: {
  tool: Tool;
  activeCategoryId: ModuleCategoryId | null;
  isOpen: boolean;
  code: string;
  isLoggedIn: boolean;
  onToggle: (id: ToolId) => void;
  onCodeChange: (id: ToolId, value: string) => void;
  onCreate: (id: ToolId) => void;
  onJoin: (id: ToolId, code: string) => void;
  onPrepare: (id: ToolId) => void;
  onLoginRequired: (id: ToolId) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const isLive = tool.status === "live";
  const active = isOpen || hovered;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-200",
        isLive ? "opacity-100" : "opacity-50",
      )}
      style={{
        background:
          active && isLive
            ? `linear-gradient(135deg, ${tool.color}14, ${tool.color}08)`
            : "rgba(255,255,255,0.02)",
        borderColor:
          active && isLive
            ? `${tool.color}60`
            : isLive
              ? `${tool.color}26`
              : "rgba(255,255,255,0.06)",
        boxShadow:
          active && isLive
            ? `0 0 0 1px ${tool.color}30, 0 8px 32px ${tool.glow}`
            : isLive
              ? `0 0 0 1px ${tool.color}1a`
              : "none",
      }}
    >
      {isOpen && isLive && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${tool.color}, transparent)` }}
        />
      )}

      <button
        type="button"
        onClick={() => isLive && onToggle(tool.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "w-full p-5 text-left",
          isLive
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a14]"
            : "cursor-default",
        )}
        aria-expanded={isOpen}
        aria-controls={`tool-actions-${tool.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-3xl leading-none">{tool.icon}</span>
          <div className="flex items-center gap-2">
            {tool.status === "live" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                Disponible
              </span>
            ) : (
              <span className="rounded-full border border-slate-600/20 bg-slate-700/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Bientôt
              </span>
            )}
            {isLive && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cn(
                  "text-slate-400 transition-transform duration-300",
                  isOpen ? "rotate-180" : "rotate-0",
                )}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 text-[15px] font-bold leading-tight text-slate-100">
            {tool.label}
          </div>
          <div className="text-xs leading-relaxed text-slate-500">{tool.desc}</div>
          <ToolCategoryTags tool={tool} activeCategoryId={activeCategoryId} className="mt-3" />
        </div>
      </button>

      <div
        id={`tool-actions-${tool.id}`}
        aria-hidden={!isOpen || !isLive}
        className={cn(
          "grid transition-all duration-300 ease-out",
          isOpen && isLive
            ? "mt-0 grid-rows-[1fr] opacity-100"
            : "mt-0 grid-rows-[0fr] opacity-0 pointer-events-none",
        )}
      >
        <div className="overflow-hidden">
          <div className="m-3 mt-0">
            <ToolActionsContent
              tool={tool}
              code={code}
              isLoggedIn={isLoggedIn}
              buttonLayout="split"
              onCodeChange={onCodeChange}
              onCreate={onCreate}
              onJoin={onJoin}
              onPrepare={onPrepare}
              onLoginRequired={onLoginRequired}
            />
          </div>
        </div>
      </div>
    </article>
  );
};

const ToolDesktopCard = ({
  tool,
  activeCategoryId,
  isSelected,
  onSelect,
}: {
  tool: Tool;
  activeCategoryId: ModuleCategoryId | null;
  isSelected: boolean;
  onSelect: (id: ToolId) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const isLive = tool.status === "live";
  const active = isSelected || hovered;

  return (
    <button
      type="button"
      onClick={() => onSelect(tool.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex min-h-[180px] w-full flex-col rounded-2xl border p-5 text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a14]",
        isLive ? "opacity-100" : "opacity-60",
      )}
      style={{
        background:
          active && isLive
            ? `linear-gradient(135deg, ${tool.color}16, ${tool.color}08)`
            : "rgba(255,255,255,0.02)",
        borderColor: active
          ? `${tool.color}60`
          : isLive
            ? `${tool.color}26`
            : "rgba(255,255,255,0.06)",
        boxShadow:
          active && isLive
            ? `0 0 0 1px ${tool.color}30, 0 8px 24px ${tool.glow}`
            : isLive
              ? `0 0 0 1px ${tool.color}1a`
              : "none",
      }}
      aria-pressed={isSelected}
    >
      {isSelected && isLive && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${tool.color}, transparent)` }}
        />
      )}
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-3xl leading-none">{tool.icon}</span>
        {tool.status === "live" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            Disponible
          </span>
        ) : (
          <span className="rounded-full border border-slate-600/20 bg-slate-700/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Bientôt
          </span>
        )}
      </div>
      <div className="text-[15px] font-bold leading-tight text-slate-100">{tool.label}</div>
      <div className="mt-1 text-[12px] text-slate-500">{tool.tagline}</div>
      <div className="mt-3 text-xs leading-relaxed text-slate-500">{tool.desc}</div>
      <ToolCategoryTags tool={tool} activeCategoryId={activeCategoryId} className="mt-3" />
    </button>
  );
};

const ToolDesktopDetailPanel = ({
  tool,
  activeCategoryId,
  code,
  isLoggedIn,
  onCodeChange,
  onCreate,
  onJoin,
  onPrepare,
  onLoginRequired,
}: {
  tool: Tool;
  activeCategoryId: ModuleCategoryId | null;
  code: string;
  isLoggedIn: boolean;
  onCodeChange: (id: ToolId, value: string) => void;
  onCreate: (id: ToolId) => void;
  onJoin: (id: ToolId, code: string) => void;
  onPrepare: (id: ToolId) => void;
  onLoginRequired: (id: ToolId) => void;
}) => (
  <aside className="sticky top-7 self-start">
    <article
      className="overflow-hidden rounded-2xl border p-4"
      style={{
        background: `linear-gradient(135deg, ${tool.color}10, rgba(255,255,255,0.02))`,
        borderColor: `${tool.color}38`,
        boxShadow: `0 0 0 1px ${tool.color}1f`,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-tight text-slate-100">{tool.label}</div>
          <div className="mt-0.5 text-xs text-slate-500">{tool.tagline}</div>
        </div>
        <span className="text-2xl leading-none">{tool.icon}</span>
      </div>

      <div className="mb-3 text-xs leading-relaxed text-slate-500">{tool.desc}</div>
      <ToolCategoryTags tool={tool} activeCategoryId={activeCategoryId} className="mb-3" />

      <ToolActionsContent
        tool={tool}
        code={code}
        isLoggedIn={isLoggedIn}
        buttonLayout="stack"
        onCodeChange={onCodeChange}
        onCreate={onCreate}
        onJoin={onJoin}
        onPrepare={onPrepare}
        onLoginRequired={onLoginRequired}
      />
    </article>
  </aside>
);

// ─── Portal ────────────────────────────────────────────────────────────────────

export default function Portal() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const defaultDesktopToolId = TOOLS.find((entry) => entry.status === "live")?.id ?? TOOLS[0].id;
  const defaultCategoryId: ModuleCategoryFilterId = "all";
  const [openTool, setOpenTool] = useState<ToolId | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<ModuleCategoryFilterId>(defaultCategoryId);
  const [selectedToolId, setSelectedToolId] = useState<ToolId>(defaultDesktopToolId);
  const [joinCodes, setJoinCodes] = useState<Record<ToolId, string>>({
    "planning-poker": "",
    "retro-party": "",
    "radar-party": "",
    "skills-matrix": "",
    "draw-duel": "",
    "retro-generator": "",
  });
  const [mounted, setMounted] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pendingPrepareRoute, setPendingPrepareRoute] = useState<string | null>(null);

  const [globalJoinOpen, setGlobalJoinOpen] = useState(false);
  const [globalJoinCode, setGlobalJoinCode] = useState("");
  const [globalJoinError, setGlobalJoinError] = useState<string | null>(null);
  const [globalJoinLoading, setGlobalJoinLoading] = useState(false);
  const globalJoinInputRef = useRef<HTMLInputElement>(null);
  const modulesSectionRef = useRef<HTMLElement>(null);

  const handleGlobalJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = globalJoinCode.trim().toUpperCase();
    if (code.length < 4) {
      setGlobalJoinError("Saisis un code valide.");
      return;
    }
    setGlobalJoinError(null);
    setGlobalJoinLoading(true);
    try {
      const result = await api.resolveRoom(code);
      setGlobalJoinOpen(false);
      setGlobalJoinCode("");
      if (result.module === "skills-matrix") {
        const params = new URLSearchParams({ mode: "join", code: result.code });
        if (user) {
          params.set("auto", "1");
          if (user.displayName) params.set("name", user.displayName);
        }
        navigate(`/skills-matrix?${params.toString()}`);
      } else if (result.module === "radar-party") {
        navigate(`/radar-party?mode=join&code=${result.code}`);
      } else {
        navigate(`/play?mode=join&code=${result.code}`);
      }
    } catch {
      setGlobalJoinError("Code introuvable. Vérifie qu'il est correct.");
    } finally {
      setGlobalJoinLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const toolsForCategory = useMemo(
    () =>
      selectedCategoryId === "all"
        ? TOOLS
        : TOOLS.filter((entry) => entry.categories.includes(selectedCategoryId)),
    [selectedCategoryId],
  );
  const categoryStats = useMemo(() => {
    const stats = MODULE_CATEGORIES.reduce(
      (acc, category) => ({
        ...acc,
        [category.id]: { total: 0, active: 0 },
      }),
      {} as Record<ModuleCategoryId, { total: number; active: number }>,
    );
    for (const tool of TOOLS) {
      for (const categoryId of tool.categories) {
        stats[categoryId].total += 1;
        if (tool.status === "live") stats[categoryId].active += 1;
      }
    }
    return stats;
  }, []);

  useEffect(() => {
    if (toolsForCategory.length === 0) {
      setOpenTool(null);
      return;
    }
    if (!toolsForCategory.some((entry) => entry.id === selectedToolId)) {
      setSelectedToolId(toolsForCategory[0].id);
    }
    if (openTool && !toolsForCategory.some((entry) => entry.id === openTool)) {
      setOpenTool(null);
    }
  }, [openTool, selectedToolId, toolsForCategory]);

  // After login succeeds from modal, continue to the prepare route that was requested.
  const handleAuthSuccess = () => {
    if (pendingPrepareRoute) {
      const route = pendingPrepareRoute;
      setPendingPrepareRoute(null);
      navigate(route);
    }
  };

  const handleCreate = (toolId: ToolId) => {
    const tool = TOOLS.find((entry) => entry.id === toolId);
    if (tool?.hostRoute) navigate(tool.hostRoute);
  };

  const handleJoin = (toolId: ToolId, code: string) => {
    const tool = TOOLS.find((entry) => entry.id === toolId);
    if (!tool) return;
    const route = tool.joinRoute(code.trim().toUpperCase());
    if (route) navigate(route);
  };

  const handleToolToggle = (toolId: ToolId) => {
    setSelectedToolId(toolId);
    setOpenTool((current) => (current === toolId ? null : toolId));
  };

  const handleDesktopToolSelect = (toolId: ToolId) => {
    setSelectedToolId(toolId);
  };

  const handleCategorySelect = (categoryId: ModuleCategoryFilterId) => {
    setSelectedCategoryId(categoryId);
  };

  const handleExploreModules = () => {
    modulesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCodeChange = (toolId: ToolId, value: string) => {
    setJoinCodes((prev) => ({
      ...prev,
      [toolId]: value.toUpperCase().slice(0, 6),
    }));
  };

  const handlePrepare = (toolId: ToolId) => {
    const route = PREPARE_ROUTE_BY_TOOL[toolId];
    if (!route) return;
    if (user) {
      navigate(route);
      return;
    }
    setPendingPrepareRoute(route);
    setLoginOpen(true);
  };

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";
  const selectedDesktopTool =
    toolsForCategory.find((entry) => entry.id === selectedToolId) ??
    toolsForCategory[0] ??
    TOOLS[0];
  const activeToolsInCategory = toolsForCategory.filter((entry) => entry.status === "live").length;
  const highlightedCategoryId = selectedCategoryId === "all" ? null : selectedCategoryId;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f7f8f3] text-[#18211f]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />

      <div
        className="relative z-10 mx-auto max-w-[1180px] px-4 pb-14 pt-4 sm:px-6 lg:px-8"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.4s ease, transform 0.4s ease",
          transform: mounted ? "translateY(0)" : "translateY(16px)",
        }}
      >
        <header className="sticky top-0 z-30 -mx-4 mb-8 border-b border-black/5 bg-[#f7f8f3]/88 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleExploreModules}
              className="flex min-w-0 items-center gap-2 text-left"
              aria-label="AgileSuite"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#163832] text-white shadow-[0_10px_22px_rgba(22,56,50,0.22)]">
                <Zap className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight tracking-tight text-[#163832]">
                  AgileSuite
                </span>
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-[#647067] sm:block">
                  Ateliers collaboratifs
                </span>
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setGlobalJoinCode("");
                  setGlobalJoinError(null);
                  setGlobalJoinOpen(true);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#cfd8cf] bg-white/70 px-3 text-[13px] font-extrabold text-[#24443d] shadow-sm transition hover:border-[#aebcaf] hover:bg-white"
              >
                <LogIn className="h-4 w-4" />
                Rejoindre
              </button>

              {!authLoading &&
                (user ? (
                  <button
                    type="button"
                    onClick={() => setAccountOpen(true)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b8c7bb] bg-[#163832] text-sm font-bold text-white shadow-sm transition hover:bg-[#1f4a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/35"
                    title="Mon compte"
                  >
                    {initials}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPrepareRoute(null);
                      setLoginOpen(true);
                    }}
                    className="hidden h-10 shrink-0 items-center gap-2 rounded-xl bg-[#163832] px-4 text-[13px] font-extrabold text-white shadow-[0_10px_22px_rgba(22,56,50,0.18)] transition hover:bg-[#1f4a43] sm:flex"
                  >
                    <KeyRound className="h-4 w-4" />
                    Se connecter
                  </button>
                ))}
            </div>
          </div>
        </header>

        <main>
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)] lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d8ddd3] bg-white/70 px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#42645c] shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#0f8f72]" />
                Suite SaaS pour équipes Agile
              </div>
              <h1 className="max-w-[11ch] text-[42px] font-black leading-[0.96] tracking-tight text-[#12201d] sm:max-w-[13ch] sm:text-[64px] lg:text-[76px]">
                Animez vos ateliers Agile en ligne.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#52615c] sm:text-lg">
                Planning poker, rétrospectives et diagnostics d'équipe dans une expérience simple,
                visuelle et synchronisée en temps réel.
              </p>

              <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={handleExploreModules}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#163832] px-5 text-sm font-black text-white shadow-[0_18px_36px_rgba(22,56,50,0.22)] transition hover:bg-[#1f4a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163832]/35"
                >
                  Choisir un atelier
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGlobalJoinCode("");
                    setGlobalJoinError(null);
                    setGlobalJoinOpen(true);
                  }}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#c9d4ca] bg-white/75 px-5 text-sm font-black text-[#24443d] shadow-sm transition hover:border-[#aebcaf] hover:bg-white"
                >
                  <LogIn className="h-4 w-4" />
                  Rejoindre avec un code
                </button>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2 text-center sm:max-w-lg">
                {[
                  ["4", "modules live"],
                  ["1 code", "pour inviter"],
                  ["mobile", "et desktop"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-[#dce4db] bg-white/58 px-2 py-3 shadow-sm"
                  >
                    <div className="text-lg font-black text-[#163832]">{value}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[#6f7a75]">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[28px] border border-[#d5ded5] bg-[#fcfdf9] p-3 shadow-[0_24px_70px_rgba(22,56,50,0.16)]">
                <div className="overflow-hidden rounded-[22px] border border-[#e2e8df] bg-[#f9fbf5]">
                  <div className="flex items-center justify-between border-b border-[#e4ebe3] bg-white/75 px-4 py-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#698077]">
                        Atelier en direct
                      </div>
                      <div className="mt-0.5 text-sm font-black text-[#15231f]">
                        Sprint Planning
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#cdd9d0] bg-[#eff6ee] px-3 py-1.5 text-xs font-black text-[#24443d]">
                      Code R4D8
                    </div>
                  </div>

                  <div className="grid gap-3 p-4 sm:grid-cols-[1fr_170px]">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-[#dbe5dc] bg-white px-4 py-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#789087]">
                            Story active
                          </span>
                          <span className="rounded-full bg-[#e8f1ff] px-2 py-1 text-[11px] font-black text-[#2563eb]">
                            Vote ouvert
                          </span>
                        </div>
                        <p className="text-sm font-bold leading-5 text-[#1b2925]">
                          Afficher le score d'équipe après chaque diagnostic.
                        </p>
                        <div className="mt-4 grid grid-cols-5 gap-2">
                          {["1", "2", "3", "5", "8"].map((point, index) => (
                            <span
                              key={point}
                              className={cn(
                                "flex h-12 items-center justify-center rounded-xl border text-sm font-black",
                                index === 3
                                  ? "border-[#2563eb] bg-[#2563eb] text-white"
                                  : "border-[#d7e0d8] bg-[#f4f7f2] text-[#49615a]",
                              )}
                            >
                              {point}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-[#dbe5dc] bg-white px-4 py-3 shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#789087]">
                            Consensus
                          </div>
                          <div className="mt-2 text-3xl font-black text-[#163832]">82%</div>
                        </div>
                        <div className="rounded-2xl border border-[#dbe5dc] bg-white px-4 py-3 shadow-sm">
                          <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#789087]">
                            Participants
                          </div>
                          <div className="mt-2 flex -space-x-2">
                            {["AM", "JL", "SN", "+2"].map((name) => (
                              <span
                                key={name}
                                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#163832] text-[11px] font-black text-white"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#dbe5dc] bg-white p-3 shadow-sm">
                      <div className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#789087]">
                        Santé équipe
                      </div>
                      <div className="relative mx-auto flex aspect-square max-w-[160px] items-center justify-center rounded-full border border-[#dce6dd] bg-[#f4f8f2]">
                        <div className="absolute h-[72%] w-[72%] rounded-full border border-[#cbd8ce]" />
                        <div className="absolute h-[46%] w-[46%] rounded-full border border-[#d2ded4]" />
                        <div className="h-[58%] w-[58%] rounded-[34%_66%_42%_58%] bg-[#0f8f72]/20 ring-2 ring-[#0f8f72]/55" />
                      </div>
                      <div className="mt-4 space-y-2">
                        {[
                          ["Clarté", "w-[86%]", "bg-[#0f8f72]"],
                          ["Focus", "w-[68%]", "bg-[#2563eb]"],
                          ["Flow", "w-[74%]", "bg-[#d97706]"],
                        ].map(([label, width, color]) => (
                          <div key={label}>
                            <div className="mb-1 text-[11px] font-bold text-[#66766f]">{label}</div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#edf2eb]">
                              <div className={cn("h-full rounded-full", width, color)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[#15231f]">
                  Démarrez par votre besoin
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#647067]">
                  Trois entrées rapides pour lancer l'atelier adapté à votre moment d'équipe.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {FEATURED_USE_CASES.map(({ id, eyebrow, title, description, accent, Icon }) => {
                const canPrepare = !!PREPARE_ROUTE_BY_TOOL[id];
                return (
                  <article
                    key={id}
                    className="rounded-[24px] border border-[#d8e2d9] bg-white/72 p-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_42px_rgba(22,56,50,0.12)]"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm"
                        style={{ backgroundColor: accent }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full border border-[#dce5dd] bg-[#f6f8f3] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#66766f]">
                        {eyebrow}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-[#15231f]">{title}</h3>
                    <p className="mt-2 min-h-[66px] text-sm leading-6 text-[#5f6f68]">
                      {description}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleCreate(id)}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#163832] px-3 text-sm font-black text-white transition hover:bg-[#1f4a43]"
                      >
                        <Play className="h-4 w-4" />
                        Lancer
                      </button>
                      {canPrepare ? (
                        <button
                          type="button"
                          onClick={() => handlePrepare(id)}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd8cd] bg-white px-3 text-sm font-black text-[#24443d] transition hover:border-[#aebcaf]"
                        >
                          Préparer
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCreate(id)}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd8cd] bg-white px-3 text-sm font-black text-[#24443d] transition hover:border-[#aebcaf]"
                        >
                          Voir
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-12 grid gap-3 md:grid-cols-3">
            {WORKFLOW_STEPS.map(({ title, description, Icon }, index) => (
              <div
                key={title}
                className="rounded-[22px] border border-[#d8e2d9] bg-white/55 p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e8eee8] text-[#24443d]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-black text-[#98a49e]">0{index + 1}</span>
                </div>
                <h3 className="text-base font-black text-[#15231f]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#647067]">{description}</p>
              </div>
            ))}
          </section>

          <section ref={modulesSectionRef} className="mt-12 scroll-mt-24">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-[#15231f]">
                  Modules disponibles
                </h2>
                <p className="mt-1 text-sm text-[#647067]">
                  Filtrez par usage ou sélectionnez directement le module à lancer.
                </p>
              </div>
              <span className="hidden rounded-full border border-[#d8e2d9] bg-white/70 px-3 py-1.5 text-xs font-black text-[#66766f] sm:inline-flex">
                {activeToolsInCategory} / {toolsForCategory.length} actifs
              </span>
            </div>

            <div className="scrollbar-none mb-4 overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCategorySelect("all")}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black transition",
                    selectedCategoryId === "all"
                      ? "border-[#163832] bg-[#163832] text-white"
                      : "border-[#d2ded4] bg-white/70 text-[#54645d] hover:bg-white",
                  )}
                >
                  <span>Tout</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      selectedCategoryId === "all" ? "bg-white/15 text-white" : "bg-[#edf2eb]",
                    )}
                  >
                    {TOOLS.length}
                  </span>
                </button>
                {MODULE_CATEGORIES.map((category) => {
                  const categoryCount = categoryStats[category.id].total;
                  const isActiveCategory = selectedCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category.id)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-black transition",
                        isActiveCategory
                          ? "text-white"
                          : "border-[#d2ded4] bg-white/70 text-[#54645d] hover:bg-white",
                      )}
                      style={
                        isActiveCategory
                          ? {
                              borderColor: `rgba(${category.rgb}, 0.85)`,
                              background: `rgb(${category.rgb})`,
                            }
                          : undefined
                      }
                    >
                      <span>{category.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px]",
                          isActiveCategory ? "bg-white/15 text-white" : "bg-[#edf2eb]",
                        )}
                      >
                        {categoryCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {toolsForCategory.length === 0 ? (
              <div className="rounded-2xl border border-[#d8e2d9] bg-white/70 px-4 py-3 text-sm text-[#647067]">
                Aucun module n'est encore rattaché à cette catégorie.
              </div>
            ) : (
              <div className="rounded-[28px] border border-[#102d27] bg-[#0a0a14] p-3 shadow-[0_24px_70px_rgba(22,56,50,0.16)] sm:p-4">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
                  {toolsForCategory.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      activeCategoryId={highlightedCategoryId}
                      isOpen={openTool === tool.id}
                      code={joinCodes[tool.id]}
                      isLoggedIn={!!user}
                      onToggle={handleToolToggle}
                      onCodeChange={handleCodeChange}
                      onCreate={handleCreate}
                      onJoin={handleJoin}
                      onPrepare={handlePrepare}
                      onLoginRequired={handlePrepare}
                    />
                  ))}
                </div>
                <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)] lg:items-start lg:gap-4">
                  <div className="grid content-start self-start grid-cols-2 gap-2.5 xl:grid-cols-3">
                    {toolsForCategory.map((tool) => (
                      <ToolDesktopCard
                        key={tool.id}
                        tool={tool}
                        activeCategoryId={highlightedCategoryId}
                        isSelected={selectedToolId === tool.id}
                        onSelect={handleDesktopToolSelect}
                      />
                    ))}
                  </div>
                  <ToolDesktopDetailPanel
                    tool={selectedDesktopTool}
                    activeCategoryId={highlightedCategoryId}
                    code={joinCodes[selectedDesktopTool.id]}
                    isLoggedIn={!!user}
                    onCodeChange={handleCodeChange}
                    onCreate={handleCreate}
                    onJoin={handleJoin}
                    onPrepare={handlePrepare}
                    onLoginRequired={handlePrepare}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="mt-12 rounded-[28px] border border-[#d8e2d9] bg-[#163832] p-5 text-white shadow-[0_24px_60px_rgba(22,56,50,0.18)] sm:p-7">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#d7eee7]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Cadre SaaS
                </div>
                <h2 className="text-2xl font-black tracking-tight">
                  Un espace prêt pour vos ateliers
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7d9d3]">
                  Les sessions restent simples à rejoindre, les préparations sont rattachées à votre
                  compte et les conditions d'utilisation sont accessibles avant inscription.
                </p>
              </div>
              <Link
                to="/cgu"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20"
              >
                Lire les CGU
              </Link>
            </div>
          </section>
        </main>

        <footer className="mt-10 flex flex-col gap-3 border-t border-[#d8e2d9] pt-5 text-sm text-[#66766f] sm:flex-row sm:items-center sm:justify-between">
          <span>AgileSuite © 2026 Karl FURGEROT</span>
          <div className="flex flex-wrap gap-4">
            <Link to="/cgu" className="font-bold text-[#24443d] hover:text-[#163832]">
              CGU
            </Link>
            <button
              type="button"
              onClick={() => {
                setGlobalJoinCode("");
                setGlobalJoinError(null);
                setGlobalJoinOpen(true);
              }}
              className="font-bold text-[#24443d] hover:text-[#163832]"
            >
              Rejoindre une session
            </button>
          </div>
        </footer>
      </div>

      {/* Global join modal */}
      <Dialog
        open={globalJoinOpen}
        onOpenChange={(v) => {
          setGlobalJoinOpen(v);
          if (!v) setGlobalJoinError(null);
        }}
      >
        <DialogContent
          className="max-w-sm rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 shadow-2xl [&>button]:text-slate-400 [&>button]:hover:text-slate-100"
          onOpenAutoFocus={() => globalJoinInputRef.current?.focus()}
        >
          <div className="rounded-t-2xl border-b border-white/[0.08] bg-gradient-to-r from-indigo-500/14 via-violet-500/9 to-pink-500/12 px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
                ⚡
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
                Agile Suite
              </span>
            </div>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-100">
                Rejoindre une partie
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-slate-400">
                Entre le code room communiqué par l'animateur. Fonctionne pour tous les modules.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={(e) => void handleGlobalJoin(e)} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                Code room
              </label>
              <input
                ref={globalJoinInputRef}
                value={globalJoinCode}
                onChange={(e) => {
                  setGlobalJoinCode(e.target.value.toUpperCase());
                  setGlobalJoinError(null);
                }}
                placeholder="Ex. ABC123"
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-center text-lg font-bold tracking-[0.2em] text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/30"
              />
            </div>

            {globalJoinError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {globalJoinError}
              </div>
            )}

            <button
              type="submit"
              disabled={globalJoinLoading || globalJoinCode.trim().length < 4}
              className="h-11 w-full rounded-2xl bg-indigo-500 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40"
              style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
            >
              {globalJoinLoading ? "Recherche..." : "Rejoindre"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Auth modal */}
      <AuthModal
        open={loginOpen}
        onOpenChange={(v) => {
          setLoginOpen(v);
          if (!v) setPendingPrepareRoute(null);
        }}
        onSuccess={handleAuthSuccess}
      />
      <AccountModal
        open={accountOpen}
        onOpenChange={setAccountOpen}
        onOpenDashboard={() => {
          setAccountOpen(false);
          navigate("/dashboard");
        }}
        onLogout={async () => {
          await logout();
        }}
      />
    </div>
  );
}
