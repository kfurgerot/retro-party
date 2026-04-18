import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, TemplateItem } from "@/net/api";
import { useAuth } from "@/contexts/AuthContext";
import { fr } from "@/i18n/fr";
import { PageShell } from "@/components/app-shell";

type AuthTab = "login" | "register" | "forgot";

const inputCls =
  "w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-indigo-400/50 transition";

// ─── Auth form ─────────────────────────────────────────────────────────────────

const AuthForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email.trim(), password);
        onSuccess();
      } else if (tab === "register") {
        if (!displayName.trim()) { setError(fr.prepare.displayNameRequired); setLoading(false); return; }
        await register(email.trim(), password, displayName.trim());
        onSuccess();
      } else {
        if (!email.trim()) { setError(fr.prepare.forgotPasswordNeedEmail); setLoading(false); return; }
        const res = await api.forgotPassword({ email: email.trim() });
        setInfo(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">
          {tab === "login" ? "Connexion" : tab === "register" ? "Créer un compte" : "Mot de passe oublié"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {tab === "forgot"
            ? "On t'envoie un lien de réinitialisation par e-mail."
            : "Accède à tes templates et questions personnalisées."}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {(["login", "register", "forgot"] as AuthTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setError(null); setInfo(null); }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === t
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "login" ? "Connexion" : t === "register" ? "Inscription" : "Récupération"}
          </button>
        ))}
      </div>

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
            placeholder={fr.prepare.hostPlaceholder}
            className={inputCls}
            autoFocus
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={fr.prepare.emailPlaceholder}
          required
          className={inputCls}
          autoFocus={tab !== "register"}
        />
        {tab !== "forgot" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            className={inputCls}
          />
        )}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
        >
          {loading ? "…" : tab === "login" ? fr.prepare.signIn : tab === "register" ? fr.prepare.createAccount : "Envoyer"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => navigate("/")}
        className="mt-5 w-full text-center text-xs text-slate-600 transition hover:text-slate-400"
      >
        ← Retour au portail
      </button>
    </div>
  );
};

// ─── Template card ─────────────────────────────────────────────────────────────

const TemplateCard = ({
  template,
  onEdit,
  onLaunch,
  onDelete,
}: {
  template: TemplateItem;
  onEdit: () => void;
  onLaunch: () => void;
  onDelete: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.09]">
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-slate-100 break-words">{template.name}</p>
      <p className="mt-0.5 text-xs text-slate-500 break-words">
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
        className="h-9 rounded-xl bg-pink-500 px-4 text-sm font-bold text-white transition hover:bg-pink-400"
        style={{ boxShadow: "0 4px 12px rgba(236,72,153,0.3)" }}
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

// ─── Prepare page ──────────────────────────────────────────────────────────────

const PreparePage = () => {
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
      setTemplates(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadTemplates();
    else setTemplates([]);
  }, [user, loadTemplates]);

  const submitCreateTemplate = async () => {
    if (!newTemplateName.trim()) { setError(fr.prepare.templateNameRequired); return; }
    setCreatingTemplate(true);
    setError(null);
    try {
      const response = await api.createTemplate({
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || null,
      });
      setTemplates((prev) => [response.template, ...prev]);
      setNewTemplateName("");
      setNewTemplateDescription("");
      navigate(`/prepare/templates/${response.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const launchTemplate = async (templateId: string) => {
    if (!user) return;
    setError(null);
    try {
      const response = await api.launchTemplateRoom(templateId);
      const nextName = encodeURIComponent(user.displayName || fr.prepare.hostPlaceholder);
      navigate(`/play?mode=join&code=${response.roomCode}&name=${nextName}&avatar=0&auto=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
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

  const handleLogout = async () => {
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0a0a14" }}>
        <div className="text-sm text-slate-500">{fr.prepare.loading}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <PageShell accentColor="rgba(99,102,241,0.08)" accentGlow="rgba(99,102,241,0.04)" maxWidth="sm">
        <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center py-8">
          <AuthForm onSuccess={() => {}} />
        </div>
      </PageShell>
    );
  }

  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <PageShell accentColor="rgba(236,72,153,0.08)" accentGlow="rgba(236,72,153,0.04)" maxWidth="4xl">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
            ⚡
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
            Agile Suite
          </span>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-pink-400">
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
        Mes templates
      </h1>
      <p className="mb-7 text-sm text-slate-500">
        Prépare tes sessions Rétro Party à l'avance : questions personnalisées, catégories, ordre.
      </p>

      {/* Errors */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* New template form */}
      <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <p className="mb-3 text-sm font-semibold text-slate-200">{fr.prepare.newTemplate}</p>
        <div className="flex flex-wrap gap-3">
          <input
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder={fr.prepare.newTemplatePlaceholder}
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <input
            value={newTemplateDescription}
            onChange={(e) => setNewTemplateDescription(e.target.value)}
            placeholder={`${fr.prepare.description} (${fr.prepare.optional})`}
            className={`${inputCls} min-w-[200px] flex-1`}
          />
          <button
            type="button"
            onClick={submitCreateTemplate}
            disabled={creatingTemplate}
            className="h-11 rounded-xl bg-pink-500 px-6 text-sm font-bold text-white transition hover:bg-pink-400 disabled:opacity-50 whitespace-nowrap"
            style={{ boxShadow: "0 4px 16px rgba(236,72,153,0.3)" }}
          >
            {creatingTemplate ? fr.prepare.creating : `+ ${fr.prepare.create}`}
          </button>
        </div>
      </div>

      {/* Templates list */}
      {loadingTemplates ? (
        <p className="py-8 text-center text-sm text-slate-500">{fr.prepare.loadingTemplates}</p>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-12 text-center">
          <div className="mb-2 text-3xl">📋</div>
          <p className="text-sm font-semibold text-slate-300">Aucun template pour l'instant</p>
          <p className="mt-1 text-xs text-slate-500">{fr.prepare.noTemplates}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => navigate(`/prepare/templates/${template.id}`)}
              onLaunch={() => launchTemplate(template.id)}
              onDelete={() => deleteTemplate(template.id)}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default PreparePage;
