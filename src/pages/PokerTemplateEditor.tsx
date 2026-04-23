import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, TemplateItem, TemplateQuestion } from "@/net/api";
import { PageShell } from "@/components/app-shell";
import { useAuth } from "@/contexts/AuthContext";

const inputCls =
  "w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-violet-400/50 transition";

const VOTE_SYSTEM_OPTIONS = [
  { value: "fibonacci", label: "Fibonacci" },
  { value: "man-day", label: "Jours/Homme" },
  { value: "tshirt", label: "T-Shirt" },
];

const TITLE_HEADERS = new Set([
  "title",
  "story",
  "story title",
  "story name",
  "user story",
  "userstory",
  "user story title",
  "us",
  "summary",
  "nom",
  "name",
  "titre",
  "intitule",
  "label",
  "libelle",
]);

const DESCRIPTION_HEADERS = new Set([
  "description",
  "desc",
  "details",
  "detail",
  "category",
  "categorie",
  "commentaire",
  "comment",
  "note",
  "notes",
]);

type ParsedCsvStories = {
  stories: Array<{ title: string; description: string | null }>;
  skippedRows: number;
  invalidRows: string[];
};

type CsvDecodedContent = {
  content: string;
  encoding: "utf-8" | "windows-1252" | "utf-16le" | "utf-16be";
};

const normalizeCsvHeader = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const countDelimiter = (line: string, delimiter: string): number => {
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }
  return count;
};

const detectDelimiter = (content: string): string => {
  const firstNonEmptyLine =
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const candidates = [";", ",", "\t"];
  let best = ";";
  let maxCount = -1;
  candidates.forEach((delimiter) => {
    const count = countDelimiter(firstNonEmptyLine, delimiter);
    if (count > maxCount) {
      best = delimiter;
      maxCount = count;
    }
  });
  return best;
};

const parseCsvRows = (content: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentValue += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && content[i + 1] === "\n") {
        i += 1;
      }
      currentRow.push(currentValue.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
};

const findHeaderIndex = (headers: string[], aliases: Set<string>): number =>
  headers.findIndex((header) => aliases.has(header));

const decodeCsvFile = async (file: File): Promise<CsvDecodedContent> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0) {
    return { content: "", encoding: "utf-8" };
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      content: new TextDecoder("utf-16le").decode(bytes),
      encoding: "utf-16le",
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      content: new TextDecoder("utf-16be").decode(bytes),
      encoding: "utf-16be",
    };
  }

  try {
    return {
      content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
    };
  } catch {
    return {
      content: new TextDecoder("windows-1252").decode(bytes),
      encoding: "windows-1252",
    };
  }
};

const parseStoriesCsv = (rawContent: string): ParsedCsvStories => {
  const content = rawContent.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(content);
  const rows = parseCsvRows(content, delimiter);

  if (rows.length === 0) {
    throw new Error("Le fichier CSV est vide.");
  }

  const normalizedHeaders = rows[0].map(normalizeCsvHeader);
  const titleHeaderIndex = findHeaderIndex(normalizedHeaders, TITLE_HEADERS);
  const descriptionHeaderIndex = findHeaderIndex(normalizedHeaders, DESCRIPTION_HEADERS);
  const hasHeader = titleHeaderIndex >= 0 || descriptionHeaderIndex >= 0;

  const titleIndex = titleHeaderIndex >= 0 ? titleHeaderIndex : 0;
  const descriptionIndex =
    descriptionHeaderIndex >= 0 ? descriptionHeaderIndex : hasHeader ? -1 : 1;

  const stories: ParsedCsvStories["stories"] = [];
  const invalidRows: string[] = [];
  let skippedRows = 0;

  for (let rowIndex = hasHeader ? 1 : 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const lineNumber = rowIndex + 1;
    const title = (row[titleIndex] ?? "").trim();
    const description = descriptionIndex >= 0 ? (row[descriptionIndex] ?? "").trim() || null : null;

    if (!title && !description) {
      skippedRows += 1;
      continue;
    }

    if (!title) {
      invalidRows.push(`Ligne ${lineNumber}: titre manquant.`);
      continue;
    }
    if (title.length > 500) {
      invalidRows.push(`Ligne ${lineNumber}: titre trop long (max 500 caractères).`);
      continue;
    }
    if (description && description.length > 40) {
      invalidRows.push(`Ligne ${lineNumber}: description trop longue (max 40 caractères).`);
      continue;
    }

    stories.push({ title, description });
  }

  return { stories, skippedRows, invalidRows };
};

const PokerTemplateEditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [template, setTemplate] = useState<TemplateItem | null>(null);
  const [stories, setStories] = useState<TemplateQuestion[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [voteSystem, setVoteSystem] = useState("fibonacci");

  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDesc, setNewStoryDesc] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportInfo, setCsvImportInfo] = useState<string | null>(null);
  const [csvImportWarning, setCsvImportWarning] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [editingStory, setEditingStory] = useState<TemplateQuestion | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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
      const tpl = templateResponse.template;
      setTemplate(tpl);
      setName(tpl.name);
      setDescription(tpl.description || "");
      setVoteSystem((tpl.baseConfig?.voteSystem as string) || "fibonacci");
      setStories(questionsResponse.items);
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
        baseConfig: { module: "planning-poker", voteSystem },
      });
      setTemplate(response.template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const addStory = async () => {
    if (!templateId || !newStoryTitle.trim()) return;
    setError(null);
    setCsvImportInfo(null);
    setCsvImportWarning(null);
    try {
      const response = await api.createTemplateQuestion(templateId, {
        text: newStoryTitle.trim(),
        category: newStoryDesc.trim() || null,
      });
      setStories((prev) => [...prev, response.question].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewStoryTitle("");
      setNewStoryDesc("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const importStoriesFromCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!templateId) return;
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    setError(null);
    setCsvImportInfo(null);
    setCsvImportWarning(null);

    try {
      const decodedCsv = await decodeCsvFile(file);
      const parsed = parseStoriesCsv(decodedCsv.content);

      if (parsed.stories.length === 0) {
        throw new Error("Aucune story valide détectée dans ce CSV.");
      }

      setCsvImporting(true);
      const createdStories: TemplateQuestion[] = [];
      for (const story of parsed.stories) {
        const response = await api.createTemplateQuestion(templateId, {
          text: story.title,
          category: story.description,
        });
        createdStories.push(response.question);
      }

      setStories((prev) => [...prev, ...createdStories].sort((a, b) => a.sortOrder - b.sortOrder));

      const importedCount = createdStories.length;
      setCsvImportInfo(
        `${importedCount} story${importedCount > 1 ? "s" : ""} importée${
          importedCount > 1 ? "s" : ""
        } depuis ${file.name}.`,
      );

      if (parsed.skippedRows > 0 || parsed.invalidRows.length > 0) {
        const warningChunks: string[] = [];
        if (decodedCsv.encoding !== "utf-8") {
          warningChunks.push(`Encodage détecté automatiquement : ${decodedCsv.encoding}.`);
        }
        if (parsed.skippedRows > 0) {
          warningChunks.push(`${parsed.skippedRows} ligne(s) vide(s) ignorée(s).`);
        }
        if (parsed.invalidRows.length > 0) {
          warningChunks.push(`${parsed.invalidRows.length} ligne(s) invalide(s) ignorée(s).`);
          warningChunks.push(parsed.invalidRows.slice(0, 3).join(" "));
        }
        setCsvImportWarning(warningChunks.join(" "));
      } else if (decodedCsv.encoding !== "utf-8") {
        setCsvImportWarning(`Encodage détecté automatiquement : ${decodedCsv.encoding}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setCsvImporting(false);
      input.value = "";
    }
  };

  const deleteStory = async (questionId: string) => {
    if (!templateId) return;
    setError(null);
    try {
      await api.deleteTemplateQuestion(templateId, questionId);
      setStories((prev) => prev.filter((s) => s.id !== questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  const openEdit = (story: TemplateQuestion) => {
    setEditingStory(story);
    setEditingTitle(story.text);
    setEditingDesc(story.category || "");
  };

  const saveEdit = async () => {
    if (!templateId || !editingStory || !editingTitle.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      const response = await api.patchTemplateQuestion(templateId, editingStory.id, {
        text: editingTitle.trim(),
        category: editingDesc.trim() || null,
      });
      setStories((prev) => prev.map((s) => (s.id === editingStory.id ? response.question : s)));
      setEditingStory(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSavingEdit(false);
    }
  };

  const reorderStory = async (storyId: string, direction: -1 | 1) => {
    if (!templateId) return;
    const currentIndex = stories.findIndex((s) => s.id === storyId);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= stories.length) return;
    const next = [...stories];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    setStories(next);
    try {
      const response = await api.reorderTemplateQuestions(
        templateId,
        next.map((s) => s.id),
      );
      setStories(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      load();
    }
  };

  const launchRoom = async () => {
    if (!templateId || !user) return;
    setLaunching(true);
    setError(null);
    try {
      await saveTemplate();
      const response = await api.launchPokerTemplateRoom(templateId);
      const nextName = encodeURIComponent(user.displayName || "Host");
      navigate(
        `/play?experience=planning-poker&mode=join&code=${response.roomCode}&name=${nextName}&avatar=0&auto=1`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLaunching(false);
    }
  };

  return (
    <PageShell
      accentColor="rgba(139,92,246,0.08)"
      accentGlow="rgba(139,92,246,0.04)"
      maxWidth="4xl"
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-sm">
            🃏
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
            Agile Suite
          </span>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-violet-400">
            Planning Poker
          </span>
          {template && (
            <>
              <span className="text-slate-700">/</span>
              <span className="max-w-[200px] truncate text-xs text-slate-400">{template.name}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/prepare/planning-poker")}
            className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
          >
            Mes templates
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-200"
          >
            Accueil
          </button>
        </div>
      </div>

      {loading && <p className="py-8 text-center text-sm text-slate-500">Chargement...</p>}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && template && (
        <div className="space-y-5">
          {/* Template info */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="mb-4 text-sm font-semibold text-slate-200">Paramètres de la session</p>
            <div className="flex flex-wrap gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du template"
                className={`${inputCls} min-w-[180px] flex-1`}
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optionnel)"
                className={`${inputCls} min-w-[180px] flex-1`}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400">Système de vote :</span>
              <div className="flex gap-2">
                {VOTE_SYSTEM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVoteSystem(opt.value)}
                    className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-all ${
                      voteSystem === opt.value
                        ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                        : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={!name.trim() || saving}
                  className="h-11 rounded-xl border border-indigo-400/40 bg-indigo-500 px-5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40"
                >
                  {saving ? "Sauvegarde…" : "Sauvegarder"}
                </button>
                <button
                  type="button"
                  onClick={launchRoom}
                  disabled={launching}
                  className="h-11 rounded-xl bg-violet-500 px-5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:opacity-50"
                  style={{ boxShadow: "0 4px 12px rgba(139,92,246,0.35)" }}
                >
                  {launching ? "Lancement…" : "Lancer la session"}
                </button>
              </div>
            </div>
          </div>

          {/* Add story */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="mb-4 text-sm font-semibold text-slate-200">Ajouter une story</p>
            <div className="flex flex-wrap gap-3">
              <input
                value={newStoryTitle}
                onChange={(e) => setNewStoryTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStory()}
                placeholder="Titre de la story (ex: US-42 – Connexion OAuth)"
                className={`${inputCls} min-w-[240px] flex-1`}
              />
              <input
                value={newStoryDesc}
                onChange={(e) => setNewStoryDesc(e.target.value)}
                placeholder="Description courte (optionnel)"
                className={`${inputCls} min-w-[200px] flex-1`}
              />
              <button
                type="button"
                onClick={addStory}
                disabled={!newStoryTitle.trim()}
                className="h-11 rounded-xl bg-violet-500 px-5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:opacity-40"
              >
                + Ajouter
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Import CSV
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Colonnes supportées : <span className="text-slate-300">title/titre</span> et{" "}
                <span className="text-slate-300">description</span> (optionnel). Séparateurs
                acceptés : <span className="text-slate-300">;</span> ou{" "}
                <span className="text-slate-300">,</span>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={importStoriesFromCsv}
                />
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  disabled={csvImporting}
                  className="h-10 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-4 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-40"
                >
                  {csvImporting ? "Import en cours…" : "Importer un fichier CSV"}
                </button>
              </div>
              {csvImportInfo && <p className="mt-2 text-xs text-emerald-300">{csvImportInfo}</p>}
              {csvImportWarning && (
                <p className="mt-2 text-xs text-amber-300">{csvImportWarning}</p>
              )}
            </div>
          </div>

          {/* Stories list */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">
                Stories à estimer <span className="ml-1 text-slate-500">({stories.length})</span>
              </p>
            </div>

            {stories.length === 0 ? (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
                Aucune story pour l'instant. Ajoute des stories ci-dessus.
              </div>
            ) : (
              <div className="space-y-2">
                {stories.map((story, index) => (
                  <div
                    key={story.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:border-white/[0.08]"
                  >
                    <span className="shrink-0 text-xs font-bold text-slate-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-100 break-words">{story.text}</p>
                      {story.category && (
                        <p className="mt-0.5 text-xs text-slate-500 break-words">
                          {story.category}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => reorderStory(story.id, -1)}
                        disabled={index === 0}
                        className="h-8 w-8 rounded-lg border border-white/[0.07] bg-white/[0.02] text-sm text-slate-400 transition hover:bg-white/[0.07] disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderStory(story.id, 1)}
                        disabled={index === stories.length - 1}
                        className="h-8 w-8 rounded-lg border border-white/[0.07] bg-white/[0.02] text-sm text-slate-400 transition hover:bg-white/[0.07] disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(story)}
                        className="h-8 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.07]"
                      >
                        Éditer
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteStory(story.id)}
                        className="h-8 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editingStory}
        onOpenChange={(open) => {
          if (!open) setEditingStory(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-6 text-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-50">Éditer la story</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Titre de la story"
              className={inputCls}
            />
            <Textarea
              value={editingDesc}
              onChange={(e) => setEditingDesc(e.target.value)}
              placeholder="Description courte (optionnel)"
              className="min-h-20 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-400/50"
            />
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setEditingStory(null)}
              className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07]"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={!editingTitle.trim() || savingEdit}
              className="h-10 rounded-xl bg-violet-500 px-5 text-sm font-bold text-white transition hover:bg-violet-400 disabled:opacity-40"
            >
              {savingEdit ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default PokerTemplateEditorPage;
