import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import {
  EXPERIENCE_CATEGORIES,
  EXPERIENCES,
  type ExperienceCategoryId,
} from "@/design-system/tokens";
import { ArrowRight, CheckCircle2, Compass, LogIn, Sparkles, Wand2, Zap } from "lucide-react";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  provider_not_configured: "Cette méthode de connexion n'est pas encore configurée.",
  provider_not_supported: "Fournisseur de connexion non supporté.",
  access_denied: "Connexion annulée. Aucune autorisation n'a été accordée.",
  flow_expired: "La tentative de connexion a expiré. Réessayez.",
  invalid_state: "La tentative de connexion n'est plus valide. Réessayez.",
  missing_code: "Le code de connexion OAuth est manquant.",
  missing_profile: "Impossible de récupérer le profil depuis le fournisseur.",
  missing_email: "Aucune adresse e-mail exploitable n'a été fournie.",
  oauth_failed: "La connexion externe a échoué. Réessayez dans quelques instants.",
};

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [authInitialTab, setAuthInitialTab] = useState<"login" | "register" | "forgot">("login");
  const [authInitialEmail, setAuthInitialEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "oauth_error") return;
    const reason = params.get("reason") || "oauth_failed";
    setOauthError(OAUTH_ERROR_MESSAGES[reason] ?? OAUTH_ERROR_MESSAGES.oauth_failed);
    setAuthOpen(true);
    params.delete("auth");
    params.delete("reason");
    const search = params.toString();
    const cleanUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  // Came from /invite/:token without an auth session: open the signup modal
  // pre-filled with the invited email and route post-auth back to /invite.
  useEffect(() => {
    const state = location.state as { invitation?: string; email?: string } | null;
    if (!state || !state.invitation) return;
    if (loading) return; // wait for auth check
    if (user) return; // shouldn't happen — Invitation.tsx auto-accepts in this case
    setAuthInitialTab("register");
    if (state.email) setAuthInitialEmail(state.email);
    setPendingPath(`/invite/${state.invitation}`);
    setAuthOpen(true);
    // clear location.state so a manual close + reopen doesn't re-trigger
    window.history.replaceState({}, "", window.location.href);
  }, [location.state, loading, user]);

  const handleStart = (path: string) => {
    if (loading) return;
    if (user) {
      navigate(path);
    } else {
      setPendingPath(path);
      setOauthError(null);
      setAuthOpen(true);
    }
  };

  const handleAuthSuccess = () => {
    navigate(pendingPath || "/app");
  };

  return (
    <div
      className="relative min-h-svh text-[var(--ds-text-primary)]"
      style={{ background: "var(--ds-bg)" }}
    >
      <Background />

      <Header user={!!user} loading={loading} onLogin={() => setAuthOpen(true)} />

      <main className="relative">
        <Hero
          onStart={handleStart}
          hasUser={!!user}
          loading={loading}
          onLogin={() => setAuthOpen(true)}
        />

        <Categories />

        <Experiences onStart={handleStart} />

        <HowItWorks />

        <FinalCta hasUser={!!user} onStart={handleStart} onLogin={() => setAuthOpen(true)} />
      </main>

      <Footer />

      <AuthModal
        open={authOpen}
        onOpenChange={(v) => {
          setAuthOpen(v);
          if (!v) {
            setOauthError(null);
            setPendingPath(null);
            setAuthInitialEmail("");
            setAuthInitialTab("login");
          }
        }}
        onSuccess={handleAuthSuccess}
        initialTab={authInitialTab}
        initialEmail={authInitialEmail}
        postAuthPath={pendingPath}
        oauthError={oauthError}
      />
    </div>
  );
}

function Background() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[640px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.18), transparent 70%), radial-gradient(40% 40% at 80% 10%, rgba(236,72,153,0.10), transparent 70%), radial-gradient(40% 40% at 10% 30%, rgba(16,185,129,0.10), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </>
  );
}

function Header({
  user,
  loading,
  onLogin,
}: {
  user: boolean;
  loading: boolean;
  onLogin: () => void;
}) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/" className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-pink-500 to-emerald-500 text-sm font-bold text-white shadow-md">
          A
        </div>
        <span className="text-[15px] font-semibold tracking-tight">AgileSuite</span>
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        <a
          href="#experiences"
          className="rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--ds-text-muted)] transition hover:text-[var(--ds-text-primary)]"
        >
          Experiences
        </a>
        <a
          href="#how"
          className="rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--ds-text-muted)] transition hover:text-[var(--ds-text-primary)]"
        >
          Comment ça marche
        </a>
        <Link
          to="/portal-legacy"
          className="rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--ds-text-faint)] transition hover:text-[var(--ds-text-muted)]"
          title="Ancienne interface"
        >
          Legacy
        </Link>
      </nav>

      <div className="flex items-center gap-2">
        <Link
          to="/join"
          className="ds-focus-ring flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
        >
          <LogIn size={13} />
          Rejoindre
        </Link>
        {loading ? null : user ? (
          <Link
            to="/app"
            className="ds-focus-ring flex h-9 items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500 px-3 text-[12.5px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400"
          >
            Mon dashboard
            <ArrowRight size={13} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="ds-focus-ring flex h-9 items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 text-[12.5px] font-semibold text-indigo-200 transition hover:bg-indigo-500/25 hover:text-white"
          >
            Se connecter
          </button>
        )}
      </div>
    </header>
  );
}

function Hero({
  onStart,
  hasUser,
  loading,
  onLogin,
}: {
  onStart: (path: string) => void;
  hasUser: boolean;
  loading: boolean;
  onLogin: () => void;
}) {
  return (
    <section className="relative mx-auto w-full max-w-[1200px] px-5 pb-16 pt-12 text-center sm:px-8 sm:pt-20">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 py-1 text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--ds-text-muted)]">
        <Sparkles size={11} className="text-indigo-300" />
        La suite agile sans la corvée
      </div>

      <h1 className="mx-auto mt-6 max-w-[820px] text-[clamp(34px,6vw,56px)] font-semibold leading-[1.05] tracking-tight">
        Animez vos rituels agiles{" "}
        <span className="bg-gradient-to-r from-indigo-300 via-pink-300 to-emerald-300 bg-clip-text text-transparent">
          comme un produit
        </span>
        , pas comme un atelier.
      </h1>

      <p className="mx-auto mt-5 max-w-[640px] text-[15px] leading-relaxed text-[var(--ds-text-muted)] sm:text-[16px]">
        Rétrospectives, estimations, diagnostics, montée en compétences — quatre experiences
        connectées, conçues pour faire avancer vos équipes sans les ennuyer.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        {loading ? (
          <div className="h-12 w-48 animate-pulse rounded-xl bg-[var(--ds-surface-2)]" />
        ) : hasUser ? (
          <Link
            to="/app"
            className="ds-focus-ring inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-500 px-5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400"
          >
            Aller au dashboard
            <ArrowRight size={14} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            className="ds-focus-ring inline-flex h-12 items-center gap-2 rounded-xl bg-indigo-500 px-5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400"
          >
            Commencer gratuitement
            <ArrowRight size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onStart(EXPERIENCES[0].hostRoute)}
          className="ds-focus-ring inline-flex h-12 items-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-5 text-[14px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
        >
          <Zap size={14} />
          Lancer une rétro maintenant
        </button>
      </div>

      <div className="mx-auto mt-7 inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[var(--ds-text-faint)]">
        <Bullet>Pas de carte bancaire</Bullet>
        <Bullet>Mobile, tablette, desktop</Bullet>
        <Bullet>Code session en 1 clic</Bullet>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckCircle2 size={12} className="text-emerald-400/80" />
      {children}
    </span>
  );
}

function Categories() {
  return (
    <section className="relative mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {EXPERIENCE_CATEGORIES.map((cat) => (
          <CategoryTile
            key={cat.id}
            id={cat.id}
            label={cat.label}
            tagline={cat.tagline}
            rgb={cat.rgb}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  id,
  label,
  tagline,
  rgb,
}: {
  id: ExperienceCategoryId;
  label: string;
  tagline: string;
  rgb: string;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4 transition hover:border-[var(--ds-border-strong)] sm:p-5"
      data-id={id}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-50 blur-3xl transition-opacity group-hover:opacity-80"
        style={{ background: `rgba(${rgb},0.5)` }}
      />
      <div className="relative">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: `rgb(${rgb})` }} />
        <h3 className="mt-3 text-[15px] font-semibold text-[var(--ds-text-primary)]">{label}</h3>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--ds-text-muted)]">{tagline}</p>
      </div>
    </div>
  );
}

function Experiences({ onStart }: { onStart: (path: string) => void }) {
  return (
    <section
      id="experiences"
      className="relative mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16"
    >
      <SectionHeading
        eyebrow="Experiences"
        title="Quatre rituels, une suite"
        subtitle="Chaque experience peut être lancée à la volée ou préparée à l'avance avec un template."
      />
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {EXPERIENCES.map((exp) => (
          <article
            key={exp.id}
            className="ds-card-hover group relative overflow-hidden rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5"
          >
            <div
              className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-60"
              style={{ background: `rgba(${exp.accentRgb},0.45)` }}
            />
            <div className="relative flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-[22px]"
                style={{
                  background: `rgba(${exp.accentRgb},0.12)`,
                  borderColor: `rgba(${exp.accentRgb},0.35)`,
                }}
              >
                {exp.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-semibold text-[var(--ds-text-primary)]">
                  {exp.label}
                </h3>
                <p className="text-[12.5px] text-[var(--ds-text-muted)]">{exp.tagline}</p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--ds-text-secondary)]">
                  {exp.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onStart(exp.hostRoute)}
                    className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white transition"
                    style={{ background: exp.accent }}
                  >
                    Lancer une session
                    <ArrowRight size={12} />
                  </button>
                  {exp.prepareRoute ? (
                    <button
                      type="button"
                      onClick={() => onStart(exp.prepareRoute!)}
                      className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
                    >
                      Préparer
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Wand2,
      title: "Préparez (ou pas)",
      desc: "Lancez en 1 clic, ou créez un template pour réutiliser ce qui marche dans vos équipes.",
    },
    {
      icon: Compass,
      title: "Animez",
      desc: "Code de session partageable, vue temps réel, expérience fluide en présentiel comme à distance.",
    },
    {
      icon: Sparkles,
      title: "Capitalisez",
      desc: "Synthèse, exports, action items. Chaque session laisse une trace utile à l'équipe.",
    },
  ];
  return (
    <section
      id="how"
      className="relative mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16"
    >
      <SectionHeading
        eyebrow="Comment ça marche"
        title="De l'idée à l'action en trois temps"
        subtitle="Pas de courbe d'apprentissage. Vos équipes sont opérationnelles dès la première session."
      />
      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] p-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[var(--ds-text-muted)]">
                <step.icon size={16} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-faint)]">
                Étape {i + 1}
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-[var(--ds-text-primary)]">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ds-text-muted)]">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta({
  hasUser,
  onStart,
  onLogin,
}: {
  hasUser: boolean;
  onStart: (path: string) => void;
  onLogin: () => void;
}) {
  return (
    <section className="relative mx-auto w-full max-w-[1200px] px-5 pb-16 pt-8 sm:px-8 sm:pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--ds-border)] bg-gradient-to-br from-[var(--ds-surface-2)] via-[var(--ds-surface-1)] to-[var(--ds-surface-0)] p-8 text-center sm:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(50% 70% at 50% 0%, rgba(99,102,241,0.25), transparent 70%)",
          }}
        />
        <div className="relative">
          <h2 className="text-[clamp(22px,4vw,32px)] font-semibold tracking-tight">
            Prêt à animer la prochaine ?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--ds-text-muted)]">
            Une session lancée en 30 secondes. Vos équipes vous diront merci.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {hasUser ? (
              <button
                type="button"
                onClick={() => onStart("/app")}
                className="ds-focus-ring inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-500 px-5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400"
              >
                Aller au dashboard
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="ds-focus-ring inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-500 px-5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400"
              >
                Créer un compte
                <ArrowRight size={14} />
              </button>
            )}
            <Link
              to="/join"
              className="ds-focus-ring inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-5 text-[14px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
            >
              <LogIn size={14} />
              Rejoindre une session
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-[640px] text-center">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[clamp(22px,4vw,32px)] font-semibold tracking-tight text-[var(--ds-text-primary)]">
        {title}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--ds-text-muted)]">{subtitle}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-[var(--ds-border)] bg-[var(--ds-bg)]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-4 px-5 py-8 text-[12.5px] text-[var(--ds-text-faint)] sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-pink-500 to-emerald-500 text-[10px] font-bold text-white">
            A
          </div>
          <span>AgileSuite — animez vos rituels agiles, simplement.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/terms" className="hover:text-[var(--ds-text-muted)]">
            CGU
          </Link>
          <Link to="/portal-legacy" className="hover:text-[var(--ds-text-muted)]">
            Ancienne interface
          </Link>
        </div>
      </div>
    </footer>
  );
}
