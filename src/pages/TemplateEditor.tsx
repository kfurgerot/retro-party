import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, TemplateItem, TemplateQuestion } from "@/net/api";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { fr } from "@/i18n/fr";

type ThemeTab = "all" | "blue" | "green" | "red" | "violet" | "bonus" | "other";
type ThemeKey = Exclude<ThemeTab, "all" | "other">;
type StatusFilter = "all" | "active" | "inactive";

const THEME_META: Record<
  ThemeKey,
  { label: string; className: string; chipClassName: string }
> = {
  blue: {
    label: "Comprendre",
    className: "text-blue-300",
    chipClassName: "bg-tile-blue",
  },
  green: {
    label: "Ameliorer",
    className: "text-green-300",
    chipClassName: "bg-tile-green",
  },
  red: {
    label: "Frictions",
    className: "text-red-300",
    chipClassName: "bg-tile-red",
  },
  violet: {
    label: "Vision",
    className: "text-violet-300",
    chipClassName: "bg-tile-violet",
  },
  bonus: {
    label: "Kudobox",
    className: "text-yellow-300",
    chipClassName: "bg-tile-star",
  },
};
const THEME_ORDER: ThemeKey[] = ["blue", "green", "red", "violet", "bonus"];
const neutralSecondaryBtn =
  "border-cyan-300/50 bg-cyan-500/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18)] hover:bg-cyan-500/25 hover:text-cyan-50";
const activeCyanBtn =
  "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_0_2px_rgba(34,211,238,0.35)] hover:bg-cyan-400";

function normalizeCategory(value: string | null | undefined): ThemeTab {
  if (!value) return "other";
  const raw = value.trim().toLowerCase();
  if (raw === "comprendre") return "blue";
  if (raw === "ameliorer" || raw === "améliorer") return "green";
  if (raw === "frictions") return "red";
  if (raw === "vision") return "violet";
  if (raw === "kudobox") return "bonus";
  if (raw === "purple") return "violet";
  if (raw === "yellow" || raw === "star") return "bonus";
  if (raw === "blue" || raw === "green" || raw === "red" || raw === "violet" || raw === "bonus") {
    return raw;
  }
  return "other";
}

function isThemeKey(value: ThemeTab): value is ThemeKey {
  return value === "blue" || value === "green" || value === "red" || value === "violet" || value === "bonus";
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
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({});

  const [activeTab, setActiveTab] = useState<ThemeTab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState<ThemeKey>("blue");
  const [editingQuestion, setEditingQuestion] = useState<TemplateQuestion | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");
  const [savingQuestionEdit, setSavingQuestionEdit] = useState(false);
  const [bulkDeleteTheme, setBulkDeleteTheme] = useState<ThemeKey | null>(null);
  const [deletingThemeQuestions, setDeletingThemeQuestions] = useState(false);

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
      setBaseConfig(nextTemplate.baseConfig ?? {});
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
      const response = await api.patchTemplate(templateId, {
        name: name.trim(),
        description: description.trim() || null,
        baseConfig,
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

  const openEditQuestion = (question: TemplateQuestion) => {
    setEditingQuestion(question);
    setEditingQuestionText(question.text);
  };

  const saveEditedQuestion = async () => {
    if (!templateId || !editingQuestion || !editingQuestionText.trim()) return;
    setSavingQuestionEdit(true);
    setError(null);
    try {
      const response = await api.patchTemplateQuestion(templateId, editingQuestion.id, {
        text: editingQuestionText.trim(),
      });
      setQuestions((prev) => prev.map((item) => (item.id === editingQuestion.id ? response.question : item)));
      setEditingQuestion(null);
      setEditingQuestionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingQuestionEdit(false);
    }
  };

  const changeQuestionCategory = async (question: TemplateQuestion, nextCategory: ThemeKey) => {
    if (!templateId) return;
    setError(null);
    try {
      const response = await api.patchTemplateQuestion(templateId, question.id, {
        category: nextCategory,
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

  const deleteQuestionsByTheme = async (theme: ThemeKey) => {
    if (!templateId) return;
    const idsToDelete = questions
      .filter((question) => normalizeCategory(question.category) === theme)
      .map((question) => question.id);
    if (!idsToDelete.length) {
      setBulkDeleteTheme(null);
      return;
    }

    setDeletingThemeQuestions(true);
    setError(null);
    try {
      await Promise.all(idsToDelete.map((questionId) => api.deleteTemplateQuestion(templateId, questionId)));
      setQuestions((prev) => prev.filter((question) => normalizeCategory(question.category) !== theme));
      setBulkDeleteTheme(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDeletingThemeQuestions(false);
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
    const themeFiltered =
      activeTab === "all"
        ? questions
        : questions.filter((question) => normalizeCategory(question.category) === activeTab);
    if (statusFilter === "active") return themeFiltered.filter((question) => question.isActive);
    if (statusFilter === "inactive") return themeFiltered.filter((question) => !question.isActive);
    return themeFiltered;
  }, [questions, activeTab, statusFilter]);

  const selectedThemeForBulkDelete = isThemeKey(activeTab) ? activeTab : null;
  const selectedThemeCount = selectedThemeForBulkDelete ? counts[selectedThemeForBulkDelete] : 0;

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-x-hidden overflow-y-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full min-w-0 max-w-5xl border-cyan-300/40 bg-slate-900/55 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_24px_rgba(34,211,238,0.12)] backdrop-blur">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold uppercase tracking-[0.14em] text-cyan-100/90">
            Edition template
          </CardTitle>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="secondary"
              className={`w-full sm:w-auto ${neutralSecondaryBtn}`}
              onClick={() => navigate("/prepare")}
            >
              Mes templates
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/")}
              className={`w-full sm:w-auto ${neutralSecondaryBtn}`}
            >
              Accueil
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={saveTemplate}
                    disabled={!canSave}
                    className={`w-full sm:w-auto ${activeCyanBtn}`}
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={launchRoom}
                    className={`w-full sm:w-auto ${activeCyanBtn}`}
                  >
                    {fr.templateEditor.launchParty}
                  </Button>
                </div>
              </div>

              <div className="grid min-w-0 gap-4 rounded border border-cyan-300/20 p-3">
                <div className="min-w-0 rounded-lg border border-cyan-300/20 bg-slate-950/30 p-3">
                  <p className="mb-3 text-sm font-semibold text-cyan-100">Ajouter une question</p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      placeholder="Nouvelle question"
                    />
                    <Button
                      variant="secondary"
                      onClick={addQuestion}
                      className={`w-full sm:w-auto ${activeCyanBtn}`}
                    >
                      Ajouter
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {THEME_ORDER.map((themeKey) => {
                      const isActive = newQuestionCategory === themeKey;
                      return (
                        <Button
                          key={themeKey}
                          type="button"
                          variant="outline"
                          className={`justify-start border-cyan-300/30 bg-slate-900/55 text-cyan-100 hover:bg-slate-900/70 hover:text-cyan-50 ${
                            isActive
                              ? "border-cyan-300/80 bg-cyan-500/35 !text-cyan-50 hover:!text-cyan-50"
                              : ""
                          }`}
                          onClick={() => setNewQuestionCategory(themeKey)}
                        >
                          <span
                            className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-black/40 ${THEME_META[themeKey].chipClassName}`}
                          />
                          <span>{isActive ? "* " : ""}{THEME_META[themeKey].label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-cyan-300/20 bg-slate-950/20 p-3">
                  <p className="mb-3 text-sm font-semibold text-cyan-100">Questions existantes</p>
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <Label htmlFor="theme-filter">Type de question</Label>
                      <select
                        id="theme-filter"
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value as ThemeTab)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="all">Tous ({counts.all})</option>
                        <option value="blue">{THEME_META.blue.label} ({counts.blue})</option>
                        <option value="green">{THEME_META.green.label} ({counts.green})</option>
                        <option value="red">{THEME_META.red.label} ({counts.red})</option>
                        <option value="violet">{THEME_META.violet.label} ({counts.violet})</option>
                        <option value="bonus">{THEME_META.bonus.label} ({counts.bonus})</option>
                        <option value="other">Autres ({counts.other})</option>
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="status-filter">Statut</Label>
                      <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="all">Tous</option>
                        <option value="active">Actifs</option>
                        <option value="inactive">Inactifs</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!selectedThemeForBulkDelete || selectedThemeCount === 0}
                      className="h-auto w-full whitespace-normal break-words py-2 text-left sm:w-auto"
                      onClick={() => {
                        if (!selectedThemeForBulkDelete) return;
                        setBulkDeleteTheme(selectedThemeForBulkDelete);
                      }}
                    >
                      Supprimer les questions du theme
                      {selectedThemeForBulkDelete ? ` (${THEME_META[selectedThemeForBulkDelete].label})` : ""}
                    </Button>
                  </div>
                  {filteredQuestions.length === 0 ? (
                    <p className="text-sm text-slate-300">Aucune question pour ce filtre.</p>
                  ) : (
                    <div className="grid gap-2">
                      {filteredQuestions.map((question) => {
                        const normalized = normalizeCategory(question.category);
                        const theme =
                          normalized === "other" ? { label: "Autre", className: "text-slate-300" } : THEME_META[normalized];
                        const currentIndex = questions.findIndex((item) => item.id === question.id);
                        const canMoveUp = currentIndex > 0;
                        const canMoveDown = currentIndex >= 0 && currentIndex < questions.length - 1;
                        return (
                          <div
                            key={question.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-300/15 p-2"
                          >
                            <div className="w-full min-w-0 flex-1 sm:w-auto sm:min-w-64">
                              <p className="text-sm text-cyan-100 break-words">{question.text}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={theme.className}>
                                  {theme.label}
                                </Badge>
                                <Badge variant={question.isActive ? "default" : "secondary"}>
                                  {question.isActive ? fr.templateEditor.active : fr.templateEditor.inactive}
                                </Badge>
                              </div>
                            </div>
                            <div className="w-full sm:w-auto sm:self-start">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    className={`w-full sm:w-auto ${neutralSecondaryBtn}`}
                                  >
                                    Actions
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="w-[min(14rem,calc(100vw-2rem))]"
                                >
                                  <DropdownMenuItem
                                    disabled={!canMoveUp}
                                    onClick={() => reorderQuestion(question.id, -1)}
                                  >
                                    {fr.templateEditor.up}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!canMoveDown}
                                    onClick={() => reorderQuestion(question.id, 1)}
                                  >
                                    {fr.templateEditor.down}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleQuestion(question)}>
                                    {question.isActive ? "Desactiver" : "Activer"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditQuestion(question)}>
                                    Editer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem disabled className="opacity-80">
                                    Changer de theme
                                  </DropdownMenuItem>
                                  {THEME_ORDER.map((themeKey) => (
                                    <DropdownMenuItem
                                      key={themeKey}
                                      disabled={normalized === themeKey}
                                      onClick={() => changeQuestionCategory(question, themeKey)}
                                    >
                                      {THEME_META[themeKey].label}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => deleteQuestion(question.id)}
                                    className="text-red-400 focus:text-red-300"
                                  >
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editingQuestion}
        onOpenChange={(open) => {
          if (!open) {
            setEditingQuestion(null);
            setEditingQuestionText("");
          }
        }}
      >
        <DialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editer la question</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="edit-question-text">Question</Label>
            <Textarea
              id="edit-question-text"
              value={editingQuestionText}
              onChange={(e) => setEditingQuestionText(e.target.value)}
              className="min-h-28"
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              className={neutralSecondaryBtn}
              onClick={() => {
                setEditingQuestion(null);
                setEditingQuestionText("");
              }}
            >
              Annuler
            </Button>
            <Button
              variant="secondary"
              className={activeCyanBtn}
              disabled={!editingQuestionText.trim() || savingQuestionEdit}
              onClick={saveEditedQuestion}
            >
              {savingQuestionEdit ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!bulkDeleteTheme} onOpenChange={(open) => !open && setBulkDeleteTheme(null)}>
        <AlertDialogContent className="border-cyan-300/30 bg-slate-950/95 text-cyan-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer toutes les questions du theme ?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {bulkDeleteTheme
                ? `Cette action supprimera ${counts[bulkDeleteTheme]} question(s) du theme ${THEME_META[bulkDeleteTheme].label}.`
                : "Cette action supprimera toutes les questions du theme selectionne."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={neutralSecondaryBtn}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!bulkDeleteTheme || deletingThemeQuestions}
              onClick={(e) => {
                e.preventDefault();
                if (!bulkDeleteTheme) return;
                void deleteQuestionsByTheme(bulkDeleteTheme);
              }}
            >
              {deletingThemeQuestions ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TemplateEditorPage;


