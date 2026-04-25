import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { PageShell } from "@/components/app-shell";
import { useAuth } from "@/contexts/AuthContext";
import { fr } from "@/i18n/fr";
import { api, type TemplateItem } from "@/net/api";
import { PrepareAuthForm } from "@/features/templates/PrepareAuthForm";
import { isTemplateForModule, type TemplateModuleId } from "@/features/templates/templateModule";

const inputCls =
  "w-full h-11 rounded-xl border border-[#cfd9d1] bg-white/80 px-4 text-sm text-[#18211f] placeholder:text-[#8b9891] outline-none focus:border-[#8fa49a] focus:ring-2 focus:ring-[#163832]/20 transition";

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
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d8e2d9] bg-white/70 p-4 shadow-sm transition hover:border-[#b9c8bd] hover:bg-white">
    <div className="min-w-0 flex-1">
      <p className="break-words font-bold text-[#18211f]">{template.name}</p>
      <p className="mt-0.5 break-words text-xs text-[#647067]">
        {template.description || fr.prepare.noDescription}
      </p>
    </div>
    <div className="flex flex-wrap gap-2 sm:justify-end">
      <button
        type="button"
        onClick={onEdit}
        className="h-9 rounded-xl border border-[#cbd8cd] bg-white px-4 text-sm font-bold text-[#24443d] transition hover:border-[#aebcaf]"
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
        className="h-9 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-600 transition hover:bg-red-100"
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
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f3]">
        <div className="rounded-2xl border border-[#d8e2d9] bg-white/70 px-4 py-3 text-sm font-bold text-[#647067] shadow-sm">
          {fr.prepare.loading}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <PageShell
        accentColor="rgba(99,102,241,0.08)"
        accentGlow="rgba(99,102,241,0.04)"
        maxWidth="sm"
        tone="saas"
      >
        <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center py-8">
          <PrepareAuthForm onSuccess={() => void loadTemplates()} />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      accentColor={theme.accentColor}
      accentGlow={theme.accentGlow}
      maxWidth="4xl"
      tone="saas"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#163832] text-sm text-white shadow-sm">
            ⚡
          </div>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#24443d]">
            Agile Suite
          </span>
          <span className="text-[#9aa79f]">/</span>
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#66766f]">
            Préparer
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 rounded-full border border-[#d8e2d9] bg-white/70 px-3 py-1.5 shadow-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#163832] text-[11px] font-bold text-white">
              {initials}
            </div>
            <span className="text-xs font-semibold text-[#54645d]">{user.displayName}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[#d8e2d9] bg-white/70 px-3 py-1.5 text-xs font-bold text-[#66766f] transition hover:bg-white hover:text-[#24443d]"
          >
            {fr.prepare.logout}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full border border-[#d8e2d9] bg-white/70 px-3 py-1.5 text-xs font-bold text-[#66766f] transition hover:bg-white hover:text-[#24443d]"
          >
            {fr.prepare.home}
          </button>
        </div>
      </div>

      <h1 className="mb-1.5 text-3xl font-black tracking-tight text-[#12201d] sm:text-4xl">
        {moduleIcon} {moduleLabel}
      </h1>
      <p className="mb-7 max-w-2xl text-sm leading-6 text-[#647067]">{introText}</p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-[24px] border border-[#d8e2d9] bg-white/72 p-5 shadow-sm">
        <p className="mb-3 text-sm font-black text-[#18211f]">{newTemplateTitle}</p>
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
        <span className="text-xs font-black uppercase tracking-[0.12em] text-[#24443d]">
          {moduleLabel}
        </span>
        <span className="rounded-full border border-[#d8e2d9] bg-white/70 px-2 py-0.5 text-[10px] font-bold text-[#647067]">
          {templates.length}
        </span>
      </div>

      {loadingTemplates ? (
        <p className="py-8 text-center text-sm text-[#647067]">{fr.prepare.loadingTemplates}</p>
      ) : templates.length === 0 ? (
        <div className="rounded-[24px] border border-[#d8e2d9] bg-white/70 px-5 py-8 text-center shadow-sm">
          <div className="mb-2 text-2xl">{emptyStateIcon}</div>
          <p className="text-sm text-[#647067]">{emptyStateText}</p>
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
