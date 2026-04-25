import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { fr } from "@/i18n/fr";
import { PageShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

type ThemeTab = "all" | "blue" | "green" | "red" | "violet" | "bonus" | "other";
type ThemeKey = Exclude<ThemeTab, "all" | "other">;
type StatusFilter = "all" | "active" | "inactive";

const THEME_META: Record<ThemeKey, { label: string; color: string; bg: string; dot: string }> = {
  blue: {
    label: fr.templateEditor.understand,
    color: "#93c5fd",
    bg: "rgba(59,130,246,0.12)",
    dot: "#3b82f6",
  },
  green: {
    label: fr.templateEditor.improve,
    color: "#6ee7b7",
    bg: "rgba(16,185,129,0.12)",
    dot: "#10b981",
  },
  red: {
    label: fr.templateEditor.frictions,
    color: "#fca5a5",
    bg: "rgba(239,68,68,0.12)",
    dot: "#ef4444",
  },
  violet: {
    label: fr.templateEditor.vision,
    color: "#c4b5fd",
    bg: "rgba(139,92,246,0.12)",
    dot: "#8b5cf6",
  },
  bonus: {
    label: fr.templateEditor.kudobox,
    color: "#fcd34d",
    bg: "rgba(245,158,11,0.12)",
    dot: "#f59e0b",
  },
};
const THEME_ORDER: ThemeKey[] = ["blue", "green", "red", "violet", "bonus"];

const inputCls =
  "w-full h-11 rounded-xl border border-[#d8e2d9] bg-white/80 px-4 text-sm text-[#18211f] placeholder:text-[#8b9891] outline-none focus:border-[#8fa49a] focus:ring-2 focus:ring-[#163832]/20 transition";

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
  return (
    value === "blue" ||
    value === "green" ||
    value === "red" ||
    value === "violet" ||
    value === "bonus"
  );
}

const CategoryChip = ({ category }: { category: ThemeTab }) => {
  if (category === "all" || category === "other") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#d8e2d9] bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[#647067]">
        {category === "other" ? fr.templateEditor.other : fr.templateEditor.all}
      </span>
    );
  }
  const meta = THEME_META[category];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
};

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
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
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
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
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
      setQuestions((prev) =>
        [...prev, response.question].sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setNewQuestionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
    }
  };

  const toggleQuestion = async (question: TemplateQuestion) => {
    if (!templateId) return;
    setError(null);
    try {
      const response = await api.patchTemplateQuestion(templateId, question.id, {
        isActive: !question.isActive,
      });
      setQuestions((prev) =>
        prev.map((item) => (item.id === question.id ? response.question : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
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
      setQuestions((prev) =>
        prev.map((item) => (item.id === editingQuestion.id ? response.question : item)),
      );
      setEditingQuestion(null);
      setEditingQuestionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
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
      setQuestions((prev) =>
        prev.map((item) => (item.id === question.id ? response.question : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!templateId) return;
    setError(null);
    try {
      await api.deleteTemplateQuestion(templateId, questionId);
      setQuestions((prev) => prev.filter((item) => item.id !== questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
    }
  };

  const deleteQuestionsByTheme = async (theme: ThemeKey) => {
    if (!templateId) return;
    const idsToDelete = questions
      .filter((q) => normalizeCategory(q.category) === theme)
      .map((q) => q.id);
    if (!idsToDelete.length) {
      setBulkDeleteTheme(null);
      return;
    }
    setDeletingThemeQuestions(true);
    setError(null);
    try {
      await Promise.all(idsToDelete.map((id) => api.deleteTemplateQuestion(templateId, id)));
      setQuestions((prev) => prev.filter((q) => normalizeCategory(q.category) !== theme));
      setBulkDeleteTheme(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
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
    [nextQuestions[currentIndex], nextQuestions[nextIndex]] = [
      nextQuestions[nextIndex],
      nextQuestions[currentIndex],
    ];
    setQuestions(nextQuestions);
    try {
      const response = await api.reorderTemplateQuestions(
        templateId,
        nextQuestions.map((item) => item.id),
      );
      setQuestions(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
      load();
    }
  };

  const launchRoom = async () => {
    if (!templateId) return;
    setError(null);
    try {
      const response = await api.launchTemplateRoom(templateId);
      navigate(
        `/play?mode=join&code=${response.roomCode}&name=${fr.prepare.hostPlaceholder}&avatar=0&auto=1`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.templateEditor.unknownError);
    }
  };

  const canSave = useMemo(() => !!name.trim() && !saving, [name, saving]);

  const counts = useMemo(
    () =>
      questions.reduce(
        (acc, q) => {
          const cat = normalizeCategory(q.category);
          acc[cat] = (acc[cat] ?? 0) + 1;
          acc.all += 1;
          return acc;
        },
        { all: 0, blue: 0, green: 0, red: 0, violet: 0, bonus: 0, other: 0 } as Record<
          ThemeTab,
          number
        >,
      ),
    [questions],
  );

  const filteredQuestions = useMemo(() => {
    const themeFiltered =
      activeTab === "all"
        ? questions
        : questions.filter((q) => normalizeCategory(q.category) === activeTab);
    if (statusFilter === "active") return themeFiltered.filter((q) => q.isActive);
    if (statusFilter === "inactive") return themeFiltered.filter((q) => !q.isActive);
    return themeFiltered;
  }, [questions, activeTab, statusFilter]);

  const selectedThemeForBulkDelete = isThemeKey(activeTab) ? activeTab : null;
  const selectedThemeCount = selectedThemeForBulkDelete ? counts[selectedThemeForBulkDelete] : 0;

  const selectCls =
    "h-11 w-full rounded-xl border border-[#d8e2d9] bg-white px-3 text-sm text-[#18211f] outline-none focus:border-[#8fa49a] focus:ring-2 focus:ring-[#163832]/20 transition";

  return (
    <PageShell
      tone="saas"
      accentColor="rgba(236,72,153,0.08)"
      accentGlow="rgba(236,72,153,0.04)"
      maxWidth="5xl"
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
            ⚡
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
            Agile Suite
          </span>
          <span className="text-[#9aa79f]">/</span>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-pink-400">
            Préparer
          </span>
          {template && (
            <>
              <span className="text-[#9aa79f]">/</span>
              <span className="max-w-[200px] truncate text-xs text-[#647067]">{template.name}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/prepare/retro-party")}
            className="h-9 rounded-xl border border-[#d8e2d9] bg-white/70 px-4 text-sm font-semibold text-[#54645d] transition hover:bg-white hover:text-white"
          >
            {fr.templateEditor.myTemplates}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-9 rounded-xl border border-[#d8e2d9] bg-white/70 px-4 text-sm font-semibold text-[#647067] transition hover:bg-white hover:text-[#24443d]"
          >
            {fr.templateEditor.home}
          </button>
        </div>
      </div>

      {loading && (
        <p className="py-8 text-center text-sm text-[#7b8781]">{fr.templateEditor.loading}</p>
      )}
      {!validTemplateId && (
        <p className="text-sm text-red-300">{fr.templateEditor.invalidTemplate}</p>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && template && (
        <div className="space-y-5">
          {/* Template info */}
          <div className="rounded-2xl border border-[#d8e2d9] bg-white/60 p-5">
            <p className="mb-4 text-sm font-semibold text-[#24443d]">{fr.templateEditor.title}</p>
            <div className="flex flex-wrap gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={fr.templateEditor.name}
                className={`${inputCls} min-w-[180px] flex-1`}
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={fr.templateEditor.description}
                className={`${inputCls} min-w-[180px] flex-1`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={!canSave}
                  className="h-11 rounded-xl border border-indigo-400/40 bg-indigo-500 px-5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40"
                >
                  {saving ? fr.templateEditor.saving : fr.templateEditor.save}
                </button>
                <button
                  type="button"
                  onClick={launchRoom}
                  className="h-11 rounded-xl bg-pink-500 px-5 text-sm font-bold text-white transition hover:bg-pink-400"
                  style={{ boxShadow: "0 4px 12px rgba(236,72,153,0.3)" }}
                >
                  {fr.templateEditor.launchParty}
                </button>
              </div>
            </div>
          </div>

          {/* Add question */}
          <div className="rounded-2xl border border-[#d8e2d9] bg-white/60 p-5">
            <p className="mb-4 text-sm font-semibold text-[#24443d]">
              {fr.templateEditor.addQuestion}
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                placeholder={fr.templateEditor.newQuestionPlaceholder}
                className={`${inputCls} min-w-[240px] flex-1`}
              />
              <button
                type="button"
                onClick={addQuestion}
                className="h-11 rounded-xl bg-indigo-500 px-5 text-sm font-bold text-white transition hover:bg-indigo-400"
              >
                + {fr.templateEditor.add}
              </button>
            </div>
            {/* Category picker */}
            <div className="mt-3 flex flex-wrap gap-2">
              {THEME_ORDER.map((themeKey) => {
                const isActive = newQuestionCategory === themeKey;
                const meta = THEME_META[themeKey];
                return (
                  <button
                    key={themeKey}
                    type="button"
                    onClick={() => setNewQuestionCategory(themeKey)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                      isActive
                        ? "ring-1"
                        : "border border-[#d8e2d9] bg-white/60 text-[#647067] hover:bg-white",
                    )}
                    style={isActive ? { background: meta.bg, color: meta.color } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question list */}
          <div className="rounded-2xl border border-[#d8e2d9] bg-white/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#24443d]">
                {fr.templateEditor.existingQuestions}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {/* Theme filter */}
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as ThemeTab)}
                  className={selectCls + " w-auto min-w-[140px]"}
                >
                  <option value="all">
                    {fr.templateEditor.all} ({counts.all})
                  </option>
                  {THEME_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {THEME_META[k].label} ({counts[k]})
                    </option>
                  ))}
                  <option value="other">
                    {fr.templateEditor.others} ({counts.other})
                  </option>
                </select>
                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className={selectCls + " w-auto min-w-[120px]"}
                >
                  <option value="all">{fr.templateEditor.all}</option>
                  <option value="active">{fr.templateEditor.activePlural}</option>
                  <option value="inactive">{fr.templateEditor.inactivePlural}</option>
                </select>
                {/* Bulk delete */}
                {selectedThemeForBulkDelete && selectedThemeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkDeleteTheme(selectedThemeForBulkDelete)}
                    className="h-9 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
                  >
                    {fr.templateEditor.deleteThemeQuestions} ({selectedThemeCount})
                  </button>
                )}
              </div>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="rounded-xl border border-[#d8e2d9] bg-white/60 px-4 py-8 text-center text-sm text-[#7b8781]">
                {fr.templateEditor.noQuestionsForFilter}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQuestions.map((question) => {
                  const normalized = normalizeCategory(question.category);
                  const currentIndex = questions.findIndex((item) => item.id === question.id);
                  const canMoveUp = currentIndex > 0;
                  const canMoveDown = currentIndex >= 0 && currentIndex < questions.length - 1;
                  return (
                    <div
                      key={question.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-[#d8e2d9] bg-white/60 px-4 py-3 transition hover:border-[#b9c8bd]"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm break-words",
                            question.isActive ? "text-[#18211f]" : "text-[#7b8781] line-through",
                          )}
                        >
                          {question.text}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <CategoryChip category={normalized} />
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
                              question.isActive
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border border-[#d8e2d9] bg-white/60 text-[#8b9891]",
                            )}
                          >
                            {question.isActive
                              ? fr.templateEditor.active
                              : fr.templateEditor.inactive}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="h-8 rounded-lg border border-[#d8e2d9] bg-white/70 px-3 text-xs font-semibold text-[#647067] transition hover:bg-white hover:text-[#24443d]"
                          >
                            {fr.templateEditor.actions} ▾
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-[min(14rem,calc(100vw-2rem))] rounded-xl border border-[#d8e2d9] bg-white text-[#24443d] shadow-xl"
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
                            {question.isActive
                              ? fr.templateEditor.disable
                              : fr.templateEditor.enable}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditQuestion(question)}>
                            {fr.templateEditor.edit}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="opacity-50 text-xs">
                            {fr.templateEditor.changeTheme}
                          </DropdownMenuItem>
                          {THEME_ORDER.map((themeKey) => (
                            <DropdownMenuItem
                              key={themeKey}
                              disabled={normalized === themeKey}
                              onClick={() => changeQuestionCategory(question, themeKey)}
                            >
                              <span
                                className="mr-2 h-2 w-2 rounded-full inline-block"
                                style={{ background: THEME_META[themeKey].dot }}
                              />
                              {THEME_META[themeKey].label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteQuestion(question.id)}
                            className="text-red-400 focus:text-red-300"
                          >
                            {fr.templateEditor.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit question dialog */}
      <Dialog
        open={!!editingQuestion}
        onOpenChange={(open) => {
          if (!open) {
            setEditingQuestion(null);
            setEditingQuestionText("");
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl border border-[#d8e2d9] bg-white p-6 text-[#18211f] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#12201d]">
              {fr.templateEditor.editQuestion}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={editingQuestionText}
            onChange={(e) => setEditingQuestionText(e.target.value)}
            className="min-h-28 rounded-xl border border-[#d8e2d9] bg-white/80 text-[#18211f] placeholder:text-[#8b9891] focus-visible:ring-indigo-400/50"
          />
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingQuestion(null);
                setEditingQuestionText("");
              }}
              className="h-10 rounded-xl border border-[#d8e2d9] bg-white/70 px-5 text-sm font-semibold text-[#54645d] transition hover:bg-white"
            >
              {fr.templateEditor.cancel}
            </button>
            <button
              type="button"
              onClick={saveEditedQuestion}
              disabled={!editingQuestionText.trim() || savingQuestionEdit}
              className="h-10 rounded-xl bg-indigo-500 px-5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40"
            >
              {savingQuestionEdit ? fr.templateEditor.saving : fr.templateEditor.saveButton}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete dialog */}
      <AlertDialog
        open={!!bulkDeleteTheme}
        onOpenChange={(open) => !open && setBulkDeleteTheme(null)}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl border border-[#d8e2d9] bg-white p-6 text-[#18211f] shadow-2xl">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base font-bold text-[#12201d]">
              {fr.templateEditor.deleteThemeConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#647067]">
              {bulkDeleteTheme
                ? fr.templateEditor.deleteThemeConfirmWithCount
                    .replace("{count}", String(counts[bulkDeleteTheme]))
                    .replace("{theme}", THEME_META[bulkDeleteTheme].label)
                : fr.templateEditor.deleteThemeConfirmFallback}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-2 space-x-0">
            <AlertDialogCancel className="h-11 rounded-xl border border-[#d8e2d9] bg-white/70 text-[#54645d] hover:bg-white">
              {fr.templateEditor.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl border border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300"
              disabled={!bulkDeleteTheme || deletingThemeQuestions}
              onClick={(e) => {
                e.preventDefault();
                if (bulkDeleteTheme) void deleteQuestionsByTheme(bulkDeleteTheme);
              }}
            >
              {deletingThemeQuestions ? fr.templateEditor.deleting : fr.templateEditor.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default TemplateEditorPage;
