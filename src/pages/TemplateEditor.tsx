import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, TemplateItem, TemplateQuestion } from "@/net/api";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { fr } from "@/i18n/fr";

type ThemeTab = "all" | "blue" | "green" | "red" | "violet" | "bonus" | "other";

const THEME_META: Record<Exclude<ThemeTab, "all" | "other">, { label: string; className: string }> = {
  blue: { label: fr.templateEditor.blue, className: "text-blue-300" },
  green: { label: fr.templateEditor.green, className: "text-green-300" },
  red: { label: fr.templateEditor.red, className: "text-red-300" },
  violet: { label: "Violet", className: "text-violet-300" },
  bonus: { label: "Bonus", className: "text-yellow-300" },
};

function normalizeCategory(value: string | null | undefined): ThemeTab {
  if (!value) return "other";
  const raw = value.trim().toLowerCase();
  if (raw === "purple") return "violet";
  if (raw === "yellow" || raw === "star") return "bonus";
  if (raw === "blue" || raw === "green" || raw === "red" || raw === "violet" || raw === "bonus") {
    return raw;
  }
  return "other";
}

const TemplateEditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseConfigText, setBaseConfigText] = useState("{}");

  const [activeTab, setActiveTab] = useState<ThemeTab>("all");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState<"blue" | "green" | "red" | "violet" | "bonus">(
    "blue"
  );

  const validTemplateId = typeof templateId === "string" && templateId.length > 0;

  const load = useCallback(async () => {
    if (!validTemplateId || !templateId) return;
    setLoading(true);
    setError(null);
    try {
      const [templateResponse, questionsResponse] = await Promise.all([
        api.getTemplate(templateId),
        api.listTemplateQuestions(templateId),
      ]);
      const nextTemplate = templateResponse.template;
      setTemplate(nextTemplate);
      setName(nextTemplate.name);
      setDescription(nextTemplate.description || "");
      setBaseConfigText(JSON.stringify(nextTemplate.baseConfig ?? {}, null, 2));
      setQuestions(questionsResponse.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [templateId, validTemplateId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveTemplate = async () => {
    if (!templateId || !template) return;
    setSaving(true);
    setError(null);
    try {
      let parsedBaseConfig: Record<string, unknown>;
      try {
        parsedBaseConfig = JSON.parse(baseConfigText) as Record<string, unknown>;
      } catch {
        setError("JSON invalide dans baseConfig");
        return;
      }

      const response = await api.patchTemplate(templateId, {
        name: name.trim(),
        description: description.trim() || null,
        baseConfig: parsedBaseConfig,
      });
      setTemplate(response.template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async () => {
    if (!templateId || !newQuestionText.trim()) return;
    setError(null);
    try {
      const response = await api.createTemplateQuestion(templateId, {
        text: newQuestionText.trim(),
        category: newQuestionCategory,
      });
      setQuestions((prev) => [...prev, response.question].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewQuestionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const toggleQuestion = async (question: TemplateQuestion) => {
    if (!templateId) return;
    setError(null);
    try {
      const response = await api.patchTemplateQuestion(templateId, question.id, {
        isActive: !question.isActive,
      });
      setQuestions((prev) => prev.map((item) => (item.id === question.id ? response.question : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const editQuestion = async (question: TemplateQuestion) => {
    if (!templateId) return;
    const nextText = window.prompt("Question", question.text);
    if (!nextText || !nextText.trim()) return;
    const nextCategory = window.prompt(
      "Categorie (blue | green | red | violet | bonus)",
      normalizeCategory(question.category) === "other" ? "" : normalizeCategory(question.category)
    );
    if (nextCategory === null) return;
    setError(null);
    try {
      const normalizedCategory = normalizeCategory(nextCategory);
      const response = await api.patchTemplateQuestion(templateId, question.id, {
        text: nextText.trim(),
        category: normalizedCategory === "other" ? null : normalizedCategory,
      });
      setQuestions((prev) => prev.map((item) => (item.id === question.id ? response.question : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!templateId) return;
    setError(null);
    try {
      await api.deleteTemplateQuestion(templateId, questionId);
      setQuestions((prev) => prev.filter((item) => item.id !== questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const reorderQuestion = async (questionId: string, direction: -1 | 1) => {
    if (!templateId) return;
    const currentIndex = questions.findIndex((item) => item.id === questionId);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= questions.length) return;

    const nextQuestions = [...questions];
    [nextQuestions[currentIndex], nextQuestions[nextIndex]] = [nextQuestions[nextIndex], nextQuestions[currentIndex]];
    setQuestions(nextQuestions);

    try {
      const response = await api.reorderTemplateQuestions(
        templateId,
        nextQuestions.map((item) => item.id)
      );
      setQuestions(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      load();
    }
  };

  const launchRoom = async () => {
    if (!templateId) return;
    setError(null);
    try {
      const response = await api.launchTemplateRoom(templateId);
      navigate(`/play?mode=join&code=${response.roomCode}&name=${fr.prepare.hostPlaceholder}&avatar=0&auto=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const canSave = useMemo(() => !!name.trim() && !saving, [name, saving]);

  const counts = useMemo(() => {
    return questions.reduce(
      (acc, question) => {
        const category = normalizeCategory(question.category);
        acc[category] = (acc[category] ?? 0) + 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, blue: 0, green: 0, red: 0, violet: 0, bonus: 0, other: 0 } as Record<ThemeTab, number>
    );
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (activeTab === "all") return questions;
    return questions.filter((question) => normalizeCategory(question.category) === activeTab);
  }, [questions, activeTab]);

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full max-w-5xl border-cyan-300/60 bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-cyan-200">Edition template</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/prepare")}>
              Mes templates
            </Button>
            <Button variant="secondary" onClick={() => navigate("/")}>
              Accueil
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-sm text-slate-300">Chargement...</p>}
          {!validTemplateId && <p className="text-sm text-red-300">Template invalide.</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

          {!loading && template && (
            <>
              <div className="grid gap-3 rounded border border-cyan-300/20 p-3">
                <div className="grid gap-1">
                  <Label htmlFor="template-name">Nom</Label>
                  <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="template-description">Description</Label>
                  <Input
                    id="template-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="template-base-config">Base config (JSON)</Label>
                  <Textarea
                    id="template-base-config"
                    value={baseConfigText}
                    onChange={(e) => setBaseConfigText(e.target.value)}
                    className="min-h-36"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveTemplate} disabled={!canSave}>
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </Button>
                  <Button onClick={launchRoom}>{fr.templateEditor.launchParty}</Button>
                </div>
              </div>

              <div className="grid gap-3 rounded border border-cyan-300/20 p-3">
                <p className="text-sm font-semibold text-cyan-100">Questions du template</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                  <Input
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Nouvelle question"
                  />
                  <select
                    value={newQuestionCategory}
                    onChange={(e) =>
                      setNewQuestionCategory(e.target.value as "blue" | "green" | "red" | "violet" | "bonus")
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="blue">{fr.templateEditor.blue}</option>
                    <option value="green">{fr.templateEditor.green}</option>
                    <option value="red">{fr.templateEditor.red}</option>
                    <option value="violet">Violet</option>
                    <option value="bonus">Bonus</option>
                  </select>
                  <Button onClick={addQuestion}>Ajouter</Button>
                </div>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ThemeTab)}>
                  <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                    <TabsTrigger value="all">Tous ({counts.all})</TabsTrigger>
                    <TabsTrigger value="blue">{fr.templateEditor.blue} ({counts.blue})</TabsTrigger>
                    <TabsTrigger value="green">{fr.templateEditor.green} ({counts.green})</TabsTrigger>
                    <TabsTrigger value="red">{fr.templateEditor.red} ({counts.red})</TabsTrigger>
                    <TabsTrigger value="violet">Violet ({counts.violet})</TabsTrigger>
                    <TabsTrigger value="bonus">Bonus ({counts.bonus})</TabsTrigger>
                    <TabsTrigger value="other">Autres ({counts.other})</TabsTrigger>
                  </TabsList>

                  <TabsContent value={activeTab}>
                    {filteredQuestions.length === 0 ? (
                      <p className="text-sm text-slate-300">Aucune question pour cet onglet.</p>
                    ) : (
                      <div className="grid gap-2">
                        {filteredQuestions.map((question) => {
                          const normalized = normalizeCategory(question.category);
                          const theme =
                            normalized === "other" ? { label: "Autre", className: "text-slate-300" } : THEME_META[normalized];
                          return (
                            <div
                              key={question.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-300/15 p-2"
                            >
                              <div className="min-w-64 flex-1">
                                <p className="text-sm text-cyan-100">{question.text}</p>
                                <p className={`text-xs ${theme.className}`}>
                                  {theme.label} | {question.isActive ? fr.templateEditor.active : fr.templateEditor.inactive}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => reorderQuestion(question.id, -1)}>
                                  {fr.templateEditor.up}
                                </Button>
                                <Button variant="secondary" onClick={() => reorderQuestion(question.id, 1)}>
                                  {fr.templateEditor.down}
                                </Button>
                                <Button variant="secondary" onClick={() => toggleQuestion(question)}>
                                  {question.isActive ? "Desactiver" : "Activer"}
                                </Button>
                                <Button variant="secondary" onClick={() => editQuestion(question)}>
                                  Editer
                                </Button>
                                <Button variant="destructive" onClick={() => deleteQuestion(question.id)}>
                                  Supprimer
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TemplateEditorPage;

