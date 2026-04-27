import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, type NavigateFunction } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fr } from "@/i18n/fr";
import { api, type TemplateItem, type SuiteModuleId } from "@/net/api";
import { PrepareAuthForm } from "@/features/templates/PrepareAuthForm";
import { isTemplateForModule, type TemplateModuleId } from "@/features/templates/templateModule";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { ArrowLeft, Play, Trash2, Settings2, Plus, AlertCircle } from "lucide-react";

type LaunchContext = {
  navigate: NavigateFunction;
  userDisplayName: string;
};

type TemplatePrepareModulePageProps = {
  moduleId: TemplateModuleId;
  introText: string;
  newTemplateTitle: string;
  newTemplatePlaceholder: string;
  emptyStateText: string;
  editRoute: (templateId: string) => string;
  createBaseConfig?: Record<string, unknown>;
  launchTemplate: (templateId: string, ctx: LaunchContext) => Promise<void>;
};

export const TemplatePrepareModulePage = ({
  moduleId,
  introText,
  newTemplateTitle,
  newTemplatePlaceholder,
  emptyStateText,
  editRoute,
  createBaseConfig,
  launchTemplate,
}: TemplatePrepareModulePageProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const exp = EXPERIENCE_BY_ID[moduleId as SuiteModuleId];

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setError(null);
    try {
      const response = await api.listTemplates();
      setTemplates(response.items.filter((template) => isTemplateForModule(template, moduleId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    } finally {
      setLoadingTemplates(false);
    }
  }, [moduleId]);

  useEffect(() => {
    if (user) void loadTemplates();
    else setTemplates([]);
  }, [loadTemplates, user]);

  const submitCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError(fr.prepare.templateNameRequired);
      return;
    }
    setCreatingTemplate(true);
    setError(null);
    try {
      const response = await api.createTemplate({
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || null,
        baseConfig: createBaseConfig,
      });
      setNewTemplateName("");
      setNewTemplateDescription("");
      navigate(editRoute(response.template.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    setError(null);
    try {
      await api.deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((item) => item.id !== templateId));
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    }
  };

  const handleLaunchTemplate = async (templateId: string) => {
    if (!user) return;
    setError(null);
    setLaunchingId(templateId);
    try {
      await launchTemplate(templateId, {
        navigate,
        userDisplayName: user.displayName || fr.prepare.hostPlaceholder,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
      setLaunchingId(null);
    }
  };

  if (authLoading) {
    return (
      <div
        className="flex min-h-svh items-center justify-center text-[var(--ds-text-muted)]"
        style={{ background: "var(--ds-bg)" }}
      >
        {fr.prepare.loading}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-svh" style={{ background: "var(--ds-bg)" }}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
          style={{
            background: `radial-gradient(60% 60% at 50% 0%, rgba(${exp.accentRgb},0.18), transparent 70%)`,
          }}
        />
        <div className="relative mx-auto flex min-h-svh max-w-md items-center justify-center px-5 py-8">
          <PrepareAuthForm onSuccess={() => void loadTemplates()} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh text-[var(--ds-text-primary)]" style={{ background: "var(--ds-bg)" }}>
      <header className="sticky top-0 z-30 border-b border-[var(--ds-border)] bg-[var(--ds-bg)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-3 px-5 sm:px-8">
          <Link
            to="/app"
            className="ds-focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[var(--ds-text-muted)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
            aria-label="Retour au dashboard"
          >
            <ArrowLeft size={15} />
          </Link>
          <nav className="flex min-w-0 items-center gap-1.5 text-[12.5px]" aria-label="Breadcrumb">
            <Link
              to="/app"
              className="text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
            >
              Dashboard
            </Link>
            <span className="text-[var(--ds-text-faint)]">/</span>
            <Link
              to="/app/templates"
              className="text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
            >
              Templates
            </Link>
            <span className="text-[var(--ds-text-faint)]">/</span>
            <span className="truncate font-medium text-[var(--ds-text-primary)]">{exp.label}</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10">
        <div className="ds-fade-in space-y-8 pb-12">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
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
                  Préparer
                </p>
                <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[30px]">
                  {exp.label}
                </h1>
                <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-[var(--ds-text-muted)]">
                  {introText}
                </p>
              </div>
            </div>
          </section>

          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <section className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-5 sm:p-6">
            <h2 className="text-[14px] font-semibold text-[var(--ds-text-primary)]">
              {newTemplateTitle}
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
              Vous pourrez ensuite éditer le contenu en détail.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={newTemplateName}
                onChange={(event) => setNewTemplateName(event.target.value)}
                placeholder={newTemplatePlaceholder}
                className="ds-focus-ring h-10 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
              />
              <input
                value={newTemplateDescription}
                onChange={(event) => setNewTemplateDescription(event.target.value)}
                placeholder={`${fr.prepare.description} (${fr.prepare.optional})`}
                className="ds-focus-ring h-10 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[13px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:border-indigo-400/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitCreateTemplate}
                disabled={creatingTemplate || !newTemplateName.trim()}
                className="ds-focus-ring inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: exp.accent }}
              >
                <Plus size={13} />
                {creatingTemplate ? fr.prepare.creating : fr.prepare.create}
              </button>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-baseline gap-2.5">
              <h2 className="text-[14px] font-semibold text-[var(--ds-text-primary)]">
                Vos templates
              </h2>
              <span
                className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
                style={{
                  background: `rgba(${exp.accentRgb},0.12)`,
                  borderColor: `rgba(${exp.accentRgb},0.3)`,
                  color: exp.accent,
                }}
              >
                {templates.length}
              </span>
            </div>

            {loadingTemplates ? (
              <SkeletonList />
            ) : templates.length === 0 ? (
              <EmptyState icon={exp.icon} text={emptyStateText} />
            ) : (
              <div className="space-y-2.5">
                {templates.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={template}
                    accent={exp.accent}
                    accentRgb={exp.accentRgb}
                    launching={launchingId === template.id}
                    onEdit={() => navigate(editRoute(template.id))}
                    onLaunch={() => void handleLaunchTemplate(template.id)}
                    onDelete={() => void deleteTemplate(template.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

function TemplateRow({
  template,
  accent,
  accentRgb,
  launching,
  onEdit,
  onLaunch,
  onDelete,
}: {
  template: TemplateItem;
  accent: string;
  accentRgb: string;
  launching: boolean;
  onEdit: () => void;
  onLaunch: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="ds-card-hover group flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] p-4 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[13.5px] font-semibold text-[var(--ds-text-primary)]">
          {template.name}
        </h3>
        <p className="mt-0.5 truncate text-[12px] text-[var(--ds-text-muted)]">
          {template.description || fr.prepare.noDescription}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 text-[12.5px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
        >
          <Settings2 size={12} />
          {fr.prepare.edit}
        </button>
        <button
          type="button"
          onClick={onLaunch}
          disabled={launching}
          className="ds-focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: accent,
            boxShadow: `0 4px 14px rgba(${accentRgb},0.35)`,
          }}
        >
          <Play size={12} />
          {launching ? "…" : fr.prepare.launchParty}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ds-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-faint)] transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
          aria-label={fr.prepare.delete}
          title={fr.prepare.delete}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-6 py-10 text-center">
      <div className="text-[28px]">{icon}</div>
      <p className="mt-2 text-[13px] text-[var(--ds-text-muted)]">{text}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[64px] animate-pulse rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)]"
        />
      ))}
    </div>
  );
}
