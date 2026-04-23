import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { PageShell } from "@/components/app-shell";
import { useAuth } from "@/contexts/AuthContext";
import { fr } from "@/i18n/fr";
import { api, type TemplateItem } from "@/net/api";
import { PrepareAuthForm } from "@/features/templates/PrepareAuthForm";
import { isTemplateForModule, type TemplateModuleId } from "@/features/templates/templateModule";

const inputCls =
  "w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50 transition";

type TemplatePrepareModuleTheme = {
  accentColor: string;
  accentGlow: string;
  moduleTextClass: string;
  moduleCountBadgeClass: string;
  createButtonClass: string;
  createButtonShadow: string;
  launchButtonClass: string;
  launchButtonShadow: string;
};

type LaunchContext = {
  navigate: NavigateFunction;
  userDisplayName: string;
};

type TemplatePrepareModulePageProps = {
  moduleId: TemplateModuleId;
  moduleLabel: string;
  moduleIcon: string;
  introText: string;
  newTemplateTitle: string;
  newTemplatePlaceholder: string;
  emptyStateText: string;
  emptyStateIcon: string;
  editRoute: (templateId: string) => string;
  createBaseConfig?: Record<string, unknown>;
  launchTemplate: (templateId: string, ctx: LaunchContext) => Promise<void>;
  theme: TemplatePrepareModuleTheme;
};

const TemplateCard = ({
  template,
  onEdit,
  onLaunch,
  onDelete,
  launchButtonClass,
  launchButtonShadow,
}: {
  template: TemplateItem;
  onEdit: () => void;
  onLaunch: () => void;
  onDelete: () => void;
  launchButtonClass: string;
  launchButtonShadow: string;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.09]">
    <div className="min-w-0 flex-1">
      <p className="break-words font-semibold text-slate-100">{template.name}</p>
      <p className="mt-0.5 break-words text-xs text-slate-500">
        {template.description || fr.prepare.noDescription}
      </p>
    </div>
    <div className="flex flex-wrap gap-2 sm:justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
      >
        {fr.prepare.edit}
      </button>
      <button
        type="button"
        onClick={onLaunch}
        className={`h-9 rounded-xl px-4 text-sm font-bold text-white transition ${launchButtonClass}`}
        style={{ boxShadow: launchButtonShadow }}
      >
        {fr.prepare.launchParty}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="h-9 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
      >
        {fr.prepare.delete}
      </button>
    </div>
  </div>
);

export const TemplatePrepareModulePage = ({
  moduleId,
  moduleLabel,
  moduleIcon,
  introText,
  newTemplateTitle,
  newTemplatePlaceholder,
  emptyStateText,
  emptyStateIcon,
  editRoute,
  createBaseConfig,
  launchTemplate,
  theme,
}: TemplatePrepareModulePageProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();

  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

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
    try {
      await launchTemplate(templateId, {
        navigate,
        userDisplayName: user.displayName || fr.prepare.hostPlaceholder,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    }
  };

  const handleLogout = async () => {
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    }
  };

  const initials = useMemo(
    () =>
      user?.displayName
        ? user.displayName
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "?",
    [user?.displayName],
  );

  if (authLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "#0a0a14" }}
      >
        <div className="text-sm text-slate-500">{fr.prepare.loading}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <PageShell
        accentColor="rgba(99,102,241,0.08)"
        accentGlow="rgba(99,102,241,0.04)"
        maxWidth="sm"
      >
        <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center py-8">
          <PrepareAuthForm onSuccess={() => void loadTemplates()} />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell accentColor={theme.accentColor} accentGlow={theme.accentGlow} maxWidth="4xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
            ⚡
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
            Agile Suite
          </span>
          <span className="text-slate-700">/</span>
          <span
            className={`text-xs font-bold uppercase tracking-[0.12em] ${theme.moduleTextClass}`}
          >
            Préparer
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-[11px] font-bold">
              {initials}
            </div>
            <span className="text-xs text-slate-400">{user.displayName}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
          >
            {fr.prepare.logout}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
          >
            {fr.prepare.home}
          </button>
        </div>
      </div>

      <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
        {moduleIcon} {moduleLabel}
      </h1>
      <p className="mb-7 text-sm text-slate-500">{introText}</p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="mb-3 text-sm font-semibold text-slate-200">{newTemplateTitle}</p>
        <div className="flex flex-wrap gap-3">
          <input
            value={newTemplateName}
            onChange={(event) => setNewTemplateName(event.target.value)}
            placeholder={newTemplatePlaceholder}
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <input
            value={newTemplateDescription}
            onChange={(event) => setNewTemplateDescription(event.target.value)}
            placeholder={`${fr.prepare.description} (${fr.prepare.optional})`}
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <button
            type="button"
            onClick={submitCreateTemplate}
            disabled={creatingTemplate}
            className={`h-11 rounded-xl px-6 text-sm font-bold text-white transition disabled:opacity-50 whitespace-nowrap ${theme.createButtonClass}`}
            style={{ boxShadow: theme.createButtonShadow }}
          >
            {creatingTemplate ? fr.prepare.creating : `+ ${fr.prepare.create}`}
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className={`text-xs font-bold uppercase tracking-[0.12em] ${theme.moduleTextClass}`}>
          {moduleLabel}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] ${theme.moduleCountBadgeClass}`}
        >
          {templates.length}
        </span>
      </div>

      {loadingTemplates ? (
        <p className="py-8 text-center text-sm text-slate-500">{fr.prepare.loadingTemplates}</p>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-8 text-center">
          <div className="mb-2 text-2xl">{emptyStateIcon}</div>
          <p className="text-sm text-slate-500">{emptyStateText}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => navigate(editRoute(template.id))}
              onLaunch={() => void handleLaunchTemplate(template.id)}
              onDelete={() => void deleteTemplate(template.id)}
              launchButtonClass={theme.launchButtonClass}
              launchButtonShadow={theme.launchButtonShadow}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
};
