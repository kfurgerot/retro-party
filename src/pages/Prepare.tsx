import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, HostUser, TemplateItem } from "@/net/api";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { ExperienceId, SelectExperienceScreen } from "@/components/screens/SelectExperienceScreen";
import { PixelCard } from "@/components/game/PixelCard";
import { PixelButton } from "@/components/game/PixelButton";
import { fr } from "@/i18n/fr";

type AuthMode = "login" | "register";

const PreparePage = () => {
  const navigate = useNavigate();
  const [selectedExperience, setSelectedExperience] = useState<ExperienceId | null>(null);
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
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
    return `Mes templates - ${user.displayName}`;
  }, [user]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    try {
      if (authMode === "register") {
        if (!displayName.trim()) {
          setError("Nom d'affichage requis");
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const submitForgotPassword = async () => {
    setError(null);
    setInfoMessage(null);
    if (!email.trim()) {
      setError("Renseigne ton email pour recevoir le lien.");
      return;
    }
    try {
      const response = await api.forgotPassword({ email: email.trim() });
      setInfoMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const submitCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError("Nom de template requis");
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const deleteTemplate = async (templateId: string) => {
    setError(null);
    try {
      await api.deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((item) => item.id !== templateId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  if (!selectedExperience) {
    return (
      <SelectExperienceScreen
        onSelect={(experience) => setSelectedExperience(experience)}
        onBack={() => navigate("/")}
      />
    );
  }

  if (selectedExperience !== "retro-party") {
    return (
      <div className="scanlines flex min-h-svh w-full items-center justify-center p-6">
        <PixelCard className="w-full max-w-xl p-6 text-center">
          <div className="font-pixel text-2xl">{fr.templateEditor.comingSoon}</div>
          <div className="mt-2 text-sm opacity-80">
            Cette experience n&apos;est pas encore disponible pour la preparation.
          </div>
          <div className="mt-6">
            <PixelButton onClick={() => setSelectedExperience(null)} variant="secondary">
              {fr.templateEditor.backToTools}
            </PixelButton>
          </div>
        </PixelCard>
      </div>
    );
  }

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full max-w-4xl border-cyan-300/60 bg-card/90">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg text-cyan-200 break-words">{title}</CardTitle>
          <Button variant="secondary" onClick={() => navigate("/")} className="w-full sm:w-auto">
            Accueil
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-slate-300">Chargement...</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {infoMessage && <p className="text-sm text-emerald-300">{infoMessage}</p>}

          {!loading && !user && (
            <form onSubmit={submitAuth} className="grid gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={authMode === "login" ? "default" : "secondary"}
                  onClick={() => setAuthMode("login")}
                >
                  Connexion
                </Button>
                <Button
                  type="button"
                  variant={authMode === "register" ? "default" : "secondary"}
                  onClick={() => setAuthMode("register")}
                >
                  Inscription
                </Button>
              </div>
              {authMode === "register" && (
                <div className="grid gap-1">
                  <Label htmlFor="displayName">Nom d'affichage</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={fr.prepare.hostPlaceholder}
                  />
                </div>
              )}
              <div className="grid gap-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="host@company.com"
                  required
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-fit">
                {authMode === "register" ? "Creer mon compte" : "Se connecter"}
              </Button>
              {authMode === "login" && (
                <Button type="button" variant="link" className="w-fit p-0" onClick={submitForgotPassword}>
                  Mot de passe oublie ?
                </Button>
              )}
            </form>
          )}

          {!loading && user && (
            <>
              <div className="flex flex-wrap items-end gap-2 rounded border border-cyan-300/20 p-3">
                <div className="w-full min-w-0 flex-1 space-y-1 sm:min-w-56">
                  <Label htmlFor="templateName">Nouveau template</Label>
                  <Input
                    id="templateName"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Sprint retro equipe API"
                  />
                </div>
                <div className="w-full min-w-0 flex-1 space-y-1 sm:min-w-56">
                  <Label htmlFor="templateDescription">Description</Label>
                  <Input
                    id="templateDescription"
                    value={newTemplateDescription}
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
                <Button onClick={submitCreateTemplate} disabled={creatingTemplate} className="w-full sm:w-auto">
                  {creatingTemplate ? "Creation..." : "Creer"}
                </Button>
                <Button variant="secondary" onClick={handleLogout} className="w-full sm:w-auto">
                  Se deconnecter
                </Button>
              </div>

              {loadingTemplates ? (
                <p className="text-sm text-slate-300">Chargement des templates...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-300">Aucun template pour le moment.</p>
              ) : (
                <div className="grid gap-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded border border-cyan-300/20 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-cyan-100 break-words">{template.name}</p>
                        <p className="text-xs text-slate-300 break-words">{template.description || "Sans description"}</p>
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                        <Button
                          variant="secondary"
                          className="w-full sm:w-auto"
                          onClick={() => navigate(`/prepare/templates/${template.id}`)}
                        >
                          Editer
                        </Button>
                        <Button className="w-full sm:w-auto" onClick={() => launchTemplate(template.id)}>
                          {fr.prepare.launchParty}
                        </Button>
                        <Button
                          variant="destructive"
                          className="w-full sm:w-auto"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          Supprimer
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
