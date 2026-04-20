import { FormEvent, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/net/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type ToolId = "planning-poker" | "retro-party" | "radar-party" | "draw-duel" | "retro-generator";

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
};

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
  },
];

// ─── Auth modal ────────────────────────────────────────────────────────────────

type AuthTab = "login" | "register" | "forgot";

const AuthModal = ({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setError(null);
    setInfo(null);
    setPassword("");
  };

  const handleTab = (t: AuthTab) => {
    setTab(t);
    reset();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email.trim(), password);
        onSuccess();
        onOpenChange(false);
      } else if (tab === "register") {
        if (!displayName.trim()) {
          setError("Le nom d'affichage est requis.");
          setLoading(false);
          return;
        }
        await register(email.trim(), password, displayName.trim());
        onSuccess();
        onOpenChange(false);
      } else {
        if (!email.trim()) {
          setError("Saisis ton adresse e-mail.");
          setLoading(false);
          return;
        }
        const res = await api.forgotPassword({ email: email.trim() });
        setInfo(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50 transition";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 shadow-2xl [&>button]:text-slate-400 [&>button]:hover:text-slate-100">
        <div className="p-6">
          {/* Brand */}
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
              ⚡
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
              Agile Suite
            </span>
          </div>

          {/* Tabs */}
          <div className="mb-5 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
            {(["login", "register", "forgot"] as AuthTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTab(t)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
                  tab === t
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                {t === "login" ? "Connexion" : t === "register" ? "Inscription" : "Mot de passe"}
              </button>
            ))}
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === "register" && (
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ton nom d'affichage"
                className={inputCls}
                autoFocus
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Adresse e-mail"
              required
              className={inputCls}
              autoFocus={tab !== "register"}
            />
            {tab !== "forgot" && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe (min. 8 caractères)"
                required
                className={inputCls}
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full rounded-xl bg-indigo-500 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
            >
              {loading
                ? "..."
                : tab === "login"
                  ? "Se connecter"
                  : tab === "register"
                    ? "Créer mon compte"
                    : "Envoyer le lien"}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AccountModal = ({
  open,
  onOpenChange,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLogout: () => Promise<void>;
}) => {
  const { user, updateProfile, changePassword } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setDisplayName(user.displayName ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setInfo(null);
  }, [open, user]);

  if (!user) return null;

  const inputCls =
    "w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50";

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
    setError(null);
    setInfo(null);
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setPasswordLoading(true);
    try {
      const message = await changePassword(currentPassword, newPassword);
      setInfo(message || "Mot de passe mis à jour.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
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
      <DialogContent className="max-w-md rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 shadow-2xl [&>button]:text-slate-400 [&>button]:hover:text-slate-100">
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-sm font-bold text-white">
              {user.displayName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100">Mon compte</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
          </div>

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

          <div className="space-y-4">
            <form
              onSubmit={handleProfileSubmit}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Informations personnelles
              </p>
              <label className="mb-1 block text-xs text-slate-500">Nom d'affichage</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                maxLength={60}
              />
              <button
                type="submit"
                disabled={profileLoading}
                className="mt-3 h-10 w-full rounded-lg bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {profileLoading ? "Mise à jour..." : "Mettre à jour"}
              </button>
            </form>

            <form
              onSubmit={handlePasswordSubmit}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Sécurité
              </p>
              <div className="space-y-2">
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
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="mt-3 h-10 w-full rounded-lg bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {passwordLoading ? "Mise à jour..." : "Changer le mot de passe"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              {logoutLoading ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Tool card ─────────────────────────────────────────────────────────────────

const ToolCard = ({
  tool,
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
  isOpen: boolean;
  code: string;
  isLoggedIn: boolean;
  onToggle: (id: ToolId) => void;
  onCodeChange: (id: ToolId, value: string) => void;
  onCreate: (id: ToolId) => void;
  onJoin: (id: ToolId, code: string) => void;
  onPrepare: () => void;
  onLoginRequired: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const isLive = tool.status === "live";
  const active = isOpen || hovered;
  const canJoin = isLive && code.trim().length >= 4;
  const canCreate = isLive && !!tool.hostRoute;
  const canPrepare = isLive && !!tool.hasPrepare;

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
          <div className="m-3 mt-0 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Code Room
            </label>
            <input
              value={code}
              onChange={(e) => onCodeChange(tool.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canJoin) onJoin(tool.id, code);
              }}
              placeholder="Ex: AB12"
              className="mb-3 h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 font-mono text-sm tracking-widest text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-white/[0.18] focus:ring-1 focus:ring-indigo-400/60"
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  canPrepare ? (isLoggedIn ? onPrepare() : onLoginRequired()) : undefined
                }
                disabled={!canPrepare}
                className={cn(
                  "h-10 rounded-lg border text-[13px] font-semibold transition",
                  canPrepare
                    ? "border-white/[0.12] bg-white/[0.05] text-slate-200 hover:border-white/[0.2] hover:bg-white/[0.08]"
                    : "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-slate-600",
                )}
              >
                Préparer
              </button>
              <button
                type="button"
                onClick={() => canJoin && onJoin(tool.id, code)}
                disabled={!canJoin}
                className={cn(
                  "h-10 rounded-lg text-[13px] font-semibold transition",
                  canJoin
                    ? "text-white hover:brightness-110"
                    : "cursor-not-allowed bg-white/5 text-slate-600",
                )}
                style={canJoin ? { background: tool.color } : undefined}
              >
                Rejoindre
              </button>
              <button
                type="button"
                onClick={() => canCreate && onCreate(tool.id)}
                disabled={!canCreate}
                className={cn(
                  "h-10 rounded-lg text-[13px] font-semibold transition",
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
                + Créer
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

// ─── Portal ────────────────────────────────────────────────────────────────────

export default function Portal() {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const [openTool, setOpenTool] = useState<ToolId | null>(null);
  const [joinCodes, setJoinCodes] = useState<Record<ToolId, string>>({
    "planning-poker": "",
    "retro-party": "",
    "radar-party": "",
    "draw-duel": "",
    "retro-generator": "",
  });
  const [mounted, setMounted] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pendingPrepare, setPendingPrepare] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // After login succeeds from modal, go to /prepare if that was the intent
  const handleAuthSuccess = () => {
    if (pendingPrepare) {
      setPendingPrepare(false);
      navigate("/prepare");
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
    setOpenTool((current) => (current === toolId ? null : toolId));
  };

  const handleCodeChange = (toolId: ToolId, value: string) => {
    setJoinCodes((prev) => ({
      ...prev,
      [toolId]: value.toUpperCase().slice(0, 6),
    }));
  };

  const handlePrepare = () => {
    if (user) {
      navigate("/prepare");
    } else {
      setPendingPrepare(true);
      setLoginOpen(true);
    }
  };

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div
      className="relative min-h-screen overflow-hidden text-slate-100"
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 10%, rgba(99,102,241,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 30% at 80% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)
          `,
        }}
      />

      <div
        className="relative z-10 mx-auto max-w-[900px] px-5 pb-16 pt-7"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.4s ease, transform 0.4s ease",
          transform: mounted ? "translateY(0)" : "translateY(16px)",
        }}
      >
        {/* Header */}
        <header className="mb-9">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pr-2">
              <div className="mb-2.5 inline-flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
                  ⚡
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
                  Agile Suite
                </span>
              </div>
              <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold leading-none tracking-tight text-slate-50">
                {authLoading
                  ? "Chargement…"
                  : user
                    ? `Bonjour, ${user.displayName.split(" ")[0]} 👋`
                    : "Bienvenue 👋"}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Quelle expérience lance-t-on aujourd'hui ?
              </p>
            </div>

            {/* User badge / login button */}
            {!authLoading &&
              (user ? (
                <button
                  type="button"
                  onClick={() => setAccountOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/15 text-sm font-bold text-indigo-100 transition hover:bg-indigo-500/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a14]"
                  title="Mon compte"
                >
                  {initials}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPendingPrepare(false);
                    setLoginOpen(true);
                  }}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-[13px] font-semibold text-indigo-300 transition hover:bg-indigo-500/20 hover:text-indigo-200"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Se connecter
                </button>
              ))}
          </div>
        </header>

        {/* Tool grid */}
        <section className="mb-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
              Outils disponibles
            </h2>
            <span className="rounded-full border border-white/[0.05] bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-600">
              3 / 5 actifs
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
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
        </section>

        {/* Recent sessions placeholder */}
        <section className="mt-7">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
            Accès rapide
          </h2>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => navigate("/prepare")}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3 text-left transition-all hover:border-white/[0.08] hover:bg-white/[0.035]"
            >
              <span className="text-lg leading-none">📋</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-200">
                  Préparer une Rétro Party
                </div>
                <div className="text-[11px] text-slate-500">
                  {user
                    ? "Gérer tes templates et questions personnalisées"
                    : "Connexion requise · Crée tes questions Agile à l'avance"}
                </div>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#475569"
                strokeWidth="2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => navigate("/prepare")}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3 text-left transition-all hover:border-white/[0.08] hover:bg-white/[0.035]"
            >
              <span className="text-lg leading-none">🃏</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-200">
                  Préparer un Planning Poker
                </div>
                <div className="text-[11px] text-slate-500">
                  {user
                    ? "Gérer tes templates de stories à estimer"
                    : "Connexion requise · Prépare tes stories à l'avance"}
                </div>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#475569"
                strokeWidth="2"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </section>
      </div>

      {/* Auth modal */}
      <AuthModal
        open={loginOpen}
        onOpenChange={(v) => {
          setLoginOpen(v);
          if (!v) setPendingPrepare(false);
        }}
        onSuccess={handleAuthSuccess}
      />
      <AccountModal
        open={accountOpen}
        onOpenChange={setAccountOpen}
        onLogout={async () => {
          await logout();
        }}
      />
    </div>
  );
}
