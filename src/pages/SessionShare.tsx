import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type SuiteModuleId } from "@/net/api";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { ArrowRight, Copy, CheckCircle2, AlertCircle, Sparkles, LogIn } from "lucide-react";
import { ActionItemsCard } from "@/components/app-shell-v2/ActionItemsCard";

type Resolved = {
  moduleId: SuiteModuleId;
  code: string;
};

const RESOLVE_TO_MODULE: Record<string, SuiteModuleId> = {
  "skills-matrix": "skills-matrix",
  "radar-party": "radar-party",
  "planning-poker": "planning-poker",
  "retro-party": "retro-party",
};

const PERKS_BY_MODULE: Record<SuiteModuleId, string[]> = {
  "retro-party": [
    "Plateau de jeu collaboratif",
    "Questions, kudos et mini-jeux",
    "Action items à l'arrivée",
  ],
  "planning-poker": [
    "Vote synchronisé en temps réel",
    "Révélation simultanée",
    "Focus sur les écarts qui méritent discussion",
  ],
  "radar-party": [
    "Questionnaire par thèmes",
    "Radar individuel et collectif",
    "Insights actionnables pour l'équipe",
  ],
  "skills-matrix": [
    "Auto-évaluation de l'équipe",
    "Cartographie des compétences à risque",
    "Plan de mentorat suggéré",
  ],
};

export default function SessionShare() {
  const { code: rawCode = "" } = useParams<{ code: string }>();
  const code = rawCode.toUpperCase();
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) {
      setError("Code manquant");
      setLoading(false);
      return;
    }
    let alive = true;
    api
      .resolveRoom(code)
      .then((res) => {
        if (!alive) return;
        const moduleId = RESOLVE_TO_MODULE[res.module] ?? "retro-party";
        setResolved({ moduleId, code: res.code });
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Code introuvable");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignored
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] py-12 text-center text-[13px] text-[var(--ds-text-muted)]">
          Chargement de la session…
        </div>
      </Shell>
    );
  }

  if (error || !resolved) {
    return (
      <Shell>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
            <AlertCircle size={18} />
          </div>
          <h1 className="mt-3 text-[18px] font-semibold text-[var(--ds-text-primary)]">
            Session introuvable
          </h1>
          <p className="mt-1 text-[13px] text-rose-200">
            {error || "Le code de session n'existe pas ou a expiré."}
          </p>
          <Link
            to="/join"
            className="ds-focus-ring mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[13px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            Saisir un autre code
          </Link>
        </div>
      </Shell>
    );
  }

  const exp = EXPERIENCE_BY_ID[resolved.moduleId];
  const perks = PERKS_BY_MODULE[resolved.moduleId];

  return (
    <Shell accentRgb={exp.accentRgb}>
      <article className="overflow-hidden rounded-3xl border border-[var(--ds-border)] bg-gradient-to-br from-[var(--ds-surface-2)] via-[var(--ds-surface-1)] to-[var(--ds-surface-0)] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl border text-[24px]"
            style={{
              background: `rgba(${exp.accentRgb},0.14)`,
              borderColor: `rgba(${exp.accentRgb},0.4)`,
            }}
          >
            {exp.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
              Vous êtes invité·e
            </p>
            <h1 className="mt-0.5 text-[20px] font-semibold tracking-tight text-[var(--ds-text-primary)]">
              {exp.label}
            </h1>
          </div>
        </div>

        <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--ds-text-secondary)]">
          {exp.description}
        </p>

        <div className="mt-6 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
            Code de session
          </p>
          <div
            className="mt-1.5 select-all font-mono text-[34px] font-semibold tracking-[0.3em] sm:text-[40px]"
            style={{ color: exp.accent }}
          >
            {resolved.code}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            to={`/join/${resolved.code}`}
            className="ds-focus-ring inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition"
            style={{
              background: exp.accent,
              boxShadow: `0 8px 24px rgba(${exp.accentRgb},0.35)`,
            }}
          >
            <LogIn size={14} />
            Rejoindre la session
            <ArrowRight size={14} />
          </Link>
          <button
            type="button"
            onClick={handleCopy}
            className="ds-focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[13px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? "Lien copié" : "Copier le lien"}
          </button>
        </div>
      </article>

      <section className="mt-5 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
          Ce que vous allez vivre
        </p>
        <ul className="mt-3 space-y-2">
          {perks.map((perk) => (
            <li
              key={perk}
              className="flex items-start gap-2 text-[13px] text-[var(--ds-text-secondary)]"
            >
              <Sparkles size={13} className="mt-0.5 shrink-0" style={{ color: exp.accent }} />
              {perk}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-5">
        <ActionItemsCard
          sessionCode={resolved.code}
          title="Action items"
          emptyHint="Aucun action item — ajoutez ce sur quoi l'équipe s'engage."
        />
      </div>

      <p className="mt-5 text-center text-[11.5px] text-[var(--ds-text-faint)]">
        Animez vos propres rituels agiles —{" "}
        <Link to="/" className="underline hover:text-[var(--ds-text-muted)]">
          découvrir AgileSuite
        </Link>
      </p>
    </Shell>
  );
}

function Shell({ children, accentRgb }: { children: React.ReactNode; accentRgb?: string }) {
  return (
    <div
      className="relative flex min-h-svh flex-col text-[var(--ds-text-primary)]"
      style={{ background: "var(--ds-bg)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] opacity-70"
        style={{
          background: accentRgb
            ? `radial-gradient(60% 60% at 50% 0%, rgba(${accentRgb},0.18), transparent 70%)`
            : "radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.18), transparent 70%)",
        }}
      />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-[13px] font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-pink-500 to-emerald-500 text-[11px] font-bold text-white">
            A
          </div>
          AgileSuite
        </Link>
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
        <div className="ds-fade-in">{children}</div>
      </main>
    </div>
  );
}
