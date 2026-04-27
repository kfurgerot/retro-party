import { Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import type { SuiteModuleId } from "@/net/api";

type Props = {
  moduleId: SuiteModuleId;
  templateName?: string | null;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  backToListPath: string;
  backToListLabel?: string;
  children: React.ReactNode;
};

export function EditorLayout({
  moduleId,
  templateName,
  title,
  subtitle,
  loading,
  error,
  backToListPath,
  backToListLabel = "Mes templates",
  children,
}: Props) {
  const exp = EXPERIENCE_BY_ID[moduleId];
  const heading = title ?? `Éditer ${exp.label}`;

  return (
    <div className="min-h-svh text-[var(--ds-text-primary)]" style={{ background: "var(--ds-bg)" }}>
      <header className="sticky top-0 z-30 border-b border-[var(--ds-border)] bg-[var(--ds-bg)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-3 px-5 sm:px-8">
          <Link
            to={backToListPath}
            className="ds-focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
            aria-label={backToListLabel}
          >
            <ArrowLeft size={15} />
          </Link>
          <nav
            className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px]"
            aria-label="Breadcrumb"
          >
            <Link
              to="/app"
              className="text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
            >
              Dashboard
            </Link>
            <span className="text-[var(--ds-text-faint)]">/</span>
            <Link
              to={backToListPath}
              className="text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
            >
              {exp.label}
            </Link>
            {templateName ? (
              <>
                <span className="text-[var(--ds-text-faint)]">/</span>
                <span className="truncate font-medium text-[var(--ds-text-primary)]">
                  {templateName}
                </span>
              </>
            ) : null}
          </nav>
          <Link
            to={backToListPath}
            className="ds-focus-ring hidden h-9 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)] sm:flex"
          >
            {backToListLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
        <div className="ds-fade-in space-y-6 pb-12">
          <section className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-[22px]"
              style={{
                background: `rgba(${exp.accentRgb},0.12)`,
                borderColor: `rgba(${exp.accentRgb},0.35)`,
              }}
            >
              {exp.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
                Édition
              </p>
              <h1 className="mt-0.5 text-[24px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[28px]">
                {heading}
              </h1>
              {subtitle ? (
                <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--ds-text-muted)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </section>

          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] py-12 text-center text-[13px] text-[var(--ds-text-muted)]">
              Chargement…
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
