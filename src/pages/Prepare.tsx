import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, HostUser, TemplateItem } from "@/net/api";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";

type AuthMode = "login" | "register";

const PreparePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (!user) return "Connexion host";
    return `Mes templates - ${user.displayName}`;
  }, [user]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
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

  const submitCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError("Nom de template requis");
      return;
    }
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
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setCreatingTemplate(false);
    }
  };

  const launchTemplate = async (templateId: string) => {
    if (!user) return;
    setError(null);
    try {
      const response = await api.launchTemplateRoom(templateId);
      const nextName = encodeURIComponent(user.displayName || "Host");
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
    try {
      await api.logout();
      setUser(null);
      setTemplates([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full max-w-4xl border-cyan-300/60 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-cyan-200">{title}</CardTitle>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Accueil
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-slate-300">Chargement...</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

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
                    placeholder="Host"
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
            </form>
          )}

          {!loading && user && (
            <>
              <div className="flex flex-wrap items-end gap-2 rounded border border-cyan-300/20 p-3">
                <div className="min-w-56 flex-1 space-y-1">
                  <Label htmlFor="templateName">Nouveau template</Label>
                  <Input
                    id="templateName"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Sprint retro equipe API"
                  />
                </div>
                <div className="min-w-56 flex-1 space-y-1">
                  <Label htmlFor="templateDescription">Description</Label>
                  <Input
                    id="templateDescription"
                    value={newTemplateDescription}
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
                <Button onClick={submitCreateTemplate} disabled={creatingTemplate}>
                  {creatingTemplate ? "Creation..." : "Creer"}
                </Button>
                <Button variant="secondary" onClick={handleLogout}>
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
                      <div>
                        <p className="font-semibold text-cyan-100">{template.name}</p>
                        <p className="text-xs text-slate-300">{template.description || "Sans description"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/prepare/templates/${template.id}`)}
                        >
                          Editer
                        </Button>
                        <Button onClick={() => launchTemplate(template.id)}>Lancer une room</Button>
                        <Button variant="destructive" onClick={() => deleteTemplate(template.id)}>
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
