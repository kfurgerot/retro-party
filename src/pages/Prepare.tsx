import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, HostUser, TemplateItem } from "@/net/api";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { fr } from "@/i18n/fr";

type AuthMode = "login" | "register";
const neutralSecondaryBtn =
  "border-cyan-300/50 bg-cyan-500/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18)] hover:bg-cyan-500/25 hover:text-cyan-50";
const activeCyanBtn =
  "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400";
const dangerBtn =
  "border-rose-300 bg-rose-500 text-white shadow-[0_0_0_2px_rgba(251,113,133,0.3)] hover:bg-rose-400";

const PreparePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [user, setUser] = useState<HostUser | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
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
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.getMe();
        if (cancelled) return;
        setUser(response.user);
      } catch {
        if (cancelled) return;
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadTemplates();
  }, [user, loadTemplates]);

  const title = useMemo(() => {
    if (!user) return fr.prepare.hostLogin;
    return fr.prepare.myTemplatesTitle.replace("{name}", user.displayName);
  }, [user]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    try {
      if (authMode === "register") {
        if (!displayName.trim()) {
          setError(fr.prepare.displayNameRequired);
          return;
        }
        const response = await api.register({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
        setUser(response.user);
      } else {
        const response = await api.login({ email: email.trim(), password });
        setUser(response.user);
      }
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    }
  };

  const submitForgotPassword = async () => {
    setError(null);
    setInfoMessage(null);
    if (!email.trim()) {
      setError(fr.prepare.forgotPasswordNeedEmail);
      return;
    }
    try {
      const response = await api.forgotPassword({ email: email.trim() });
      setInfoMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    }
  };

  const submitCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError(fr.prepare.templateNameRequired);
      return;
    }
    setCreatingTemplate(true);
    setError(null);
    setInfoMessage(null);
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
    setInfoMessage(null);
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
    setInfoMessage(null);
    try {
      await api.logout();
      setUser(null);
      setTemplates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.prepare.unknownError);
    }
  };

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full max-w-4xl border-cyan-300/40 bg-slate-900/55 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_24px_rgba(34,211,238,0.12)] backdrop-blur">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold uppercase tracking-[0.14em] text-cyan-100/90 break-words">
            {title}
          </CardTitle>
          <Button
            variant="secondary"
            onClick={() => navigate("/")}
            className={`w-full sm:w-auto ${neutralSecondaryBtn}`}
          >
            {fr.prepare.home}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-slate-300">{fr.prepare.loading}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {infoMessage && <p className="text-sm text-emerald-300">{infoMessage}</p>}

          {!loading && !user && (
            <form onSubmit={submitAuth} className="grid gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className={authMode === "login" ? activeCyanBtn : neutralSecondaryBtn}
                  onClick={() => setAuthMode("login")}
                >
                  {fr.prepare.login}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className={authMode === "register" ? activeCyanBtn : neutralSecondaryBtn}
                  onClick={() => setAuthMode("register")}
                >
                  {fr.prepare.register}
                </Button>
              </div>
              {authMode === "register" && (
                <div className="grid gap-1">
                  <Label htmlFor="displayName">{fr.prepare.displayName}</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={fr.prepare.hostPlaceholder}
                  />
                </div>
              )}
              <div className="grid gap-1">
                <Label htmlFor="email">{fr.prepare.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={fr.prepare.emailPlaceholder}
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="password">{fr.prepare.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="secondary" className={`w-fit ${activeCyanBtn}`}>
                {authMode === "register" ? fr.prepare.createAccount : fr.prepare.signIn}
              </Button>
              {authMode === "login" && (
                <Button type="button" variant="link" className="w-fit p-0" onClick={submitForgotPassword}>
                  {fr.prepare.forgotPassword}
                </Button>
              )}
            </form>
          )}

          {!loading && user && (
            <>
              <div className="flex flex-wrap items-end gap-2 rounded border border-cyan-300/20 p-3">
                <div className="w-full min-w-0 flex-1 space-y-1 sm:min-w-56">
                  <Label htmlFor="templateName">{fr.prepare.newTemplate}</Label>
                  <Input
                    id="templateName"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder={fr.prepare.newTemplatePlaceholder}
                  />
                </div>
                <div className="w-full min-w-0 flex-1 space-y-1 sm:min-w-56">
                  <Label htmlFor="templateDescription">{fr.prepare.description}</Label>
                  <Input
                    id="templateDescription"
                    value={newTemplateDescription}
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                    placeholder={fr.prepare.optional}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={submitCreateTemplate}
                  disabled={creatingTemplate}
                  className={`w-full sm:w-auto ${activeCyanBtn}`}
                >
                  {creatingTemplate ? fr.prepare.creating : fr.prepare.create}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleLogout}
                  className={`w-full sm:w-auto ${neutralSecondaryBtn}`}
                >
                  {fr.prepare.logout}
                </Button>
              </div>

              {loadingTemplates ? (
                <p className="text-sm text-slate-300">{fr.prepare.loadingTemplates}</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-300">{fr.prepare.noTemplates}</p>
              ) : (
                <div className="grid gap-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded border border-cyan-300/20 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-cyan-100 break-words">{template.name}</p>
                        <p className="text-xs text-slate-300 break-words">{template.description || fr.prepare.noDescription}</p>
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                        <Button
                          variant="secondary"
                          className={`w-full sm:w-auto ${neutralSecondaryBtn}`}
                          onClick={() => navigate(`/prepare/templates/${template.id}`)}
                        >
                          {fr.prepare.edit}
                        </Button>
                        <Button
                          variant="secondary"
                          className={`w-full sm:w-auto ${activeCyanBtn}`}
                          onClick={() => launchTemplate(template.id)}
                        >
                          {fr.prepare.launchParty}
                        </Button>
                        <Button
                          variant="destructive"
                          className={`w-full sm:w-auto ${dangerBtn}`}
                          onClick={() => deleteTemplate(template.id)}
                        >
                          {fr.prepare.delete}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PreparePage;
