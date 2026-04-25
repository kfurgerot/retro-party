import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, PageShell, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { useAuth } from "@/contexts/AuthContext";
import { api, type DashboardActivitiesResponse } from "@/net/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const formatDateTime = (value: string | null) => {
  if (!value) return "Date inconnue";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const statusLabel = (value: string) => {
  if (value === "started") return "Démarrée";
  if (value === "ended") return "Terminée";
  if (value === "lobby") return "Lobby";
  if (value === "open") return "Ouverte";
  if (value === "archived") return "Archivé";
  if (value === "active") return "Actif";
  return value;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardActivitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const joinInputRef = useRef<HTMLInputElement>(null);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError("Saisis un code valide.");
      return;
    }
    setJoinError(null);
    setJoinLoading(true);
    try {
      const result = await api.resolveRoom(code);
      setJoinOpen(false);
      setJoinCode("");
      if (result.module === "skills-matrix") {
        const params = new URLSearchParams({ mode: "join", code: result.code });
        if (user) {
          params.set("auto", "1");
          if (user.displayName) params.set("name", user.displayName);
        }
        navigate(`/skills-matrix?${params.toString()}`);
      } else if (result.module === "radar-party") {
        navigate(`/radar-party?mode=join&code=${result.code}`);
      } else {
        navigate(`/play?mode=join&code=${result.code}`);
      }
    } catch {
      setJoinError("Code introuvable. Vérifie qu'il est correct.");
    } finally {
      setJoinLoading(false);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getDashboardActivities();
      setDashboard(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadDashboard();
  }, [authLoading, user]);

  const totalActivities = useMemo(
    () => dashboard?.modules.reduce((sum, moduleItem) => sum + moduleItem.totalActivities, 0) ?? 0,
    [dashboard],
  );

  if (authLoading || !user) {
    return (
      <div className="relative flex min-h-svh items-center justify-center bg-[#f7f8f3] px-4">
        <div className="rounded-2xl border border-[#d8e2d9] bg-white/72 px-4 py-3 text-sm font-bold text-[#647067] shadow-sm">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <PageShell tone="saas" maxWidth="5xl">
      <div className="mx-auto w-full max-w-[960px]">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#163832] text-sm text-white shadow-sm">
                ⚡
              </div>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#24443d]">
                Agile Suite
              </span>
            </div>
            <h1 className="text-[clamp(26px,5vw,42px)] font-black leading-none tracking-tight text-[#12201d]">
              Dashboard
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#647067]">
              Activités par module et historique de tes sessions/templates.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SecondaryButton
              tone="saas"
              className="h-10 min-h-0 px-3 text-xs"
              onClick={() => navigate("/")}
            >
              Retour
            </SecondaryButton>
            <SecondaryButton
              tone="saas"
              className="h-10 min-h-0 px-3 text-xs"
              onClick={() => {
                setJoinCode("");
                setJoinError(null);
                setJoinOpen(true);
              }}
            >
              Rejoindre
            </SecondaryButton>
            <PrimaryButton
              tone="saas"
              className="h-10 min-h-0 px-3 text-xs"
              onClick={() => void loadDashboard()}
            >
              Actualiser
            </PrimaryButton>
          </div>
        </header>

        <Card tone="saas" className="mb-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.08em] text-[#66766f]">
                Vue d'ensemble
              </div>
              <div className="mt-1 text-sm font-semibold text-[#24443d]">
                {totalActivities} activité{totalActivities > 1 ? "s" : ""} historisée
              </div>
            </div>
            <div className="text-xs text-[#647067]">
              Dernière mise à jour : {formatDateTime(dashboard?.generatedAt ?? null)}
            </div>
          </div>
        </Card>

        {error && (
          <Card
            tone="saas"
            className="mb-4 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600"
          >
            {error}
          </Card>
        )}

        {loading ? (
          <Card tone="saas" className="p-5 text-sm text-[#647067]">
            Chargement du dashboard...
          </Card>
        ) : (
          <div className="space-y-4">
            {dashboard?.modules.map((moduleItem) => (
              <Card key={moduleItem.moduleId} tone="saas" className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{moduleItem.moduleIcon}</span>
                    <div className="text-sm font-black text-[#18211f]">
                      {moduleItem.moduleLabel}
                    </div>
                  </div>
                  <div className="rounded-full border border-[#d8e2d9] bg-white/70 px-2 py-1 text-xs font-bold text-[#647067]">
                    {moduleItem.totalActivities} activité{moduleItem.totalActivities > 1 ? "s" : ""}
                  </div>
                </div>

                {moduleItem.activities.length === 0 ? (
                  <div className="rounded-xl border border-[#d8e2d9] bg-white/58 px-3 py-3 text-xs text-[#647067]">
                    Aucune activité pour le moment.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {moduleItem.activities.map((activity) => {
                      const canReopen =
                        activity.moduleId === "skills-matrix" &&
                        activity.activityType === "session" &&
                        !!activity.sessionCode &&
                        activity.status !== "ended";
                      return (
                        <div
                          key={activity.id}
                          className="rounded-xl border border-[#d8e2d9] bg-white/58 px-3 py-3"
                        >
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-bold text-[#18211f]">{activity.title}</div>
                            <div className="flex items-center gap-1.5">
                              <div className="rounded-full border border-[#d8e2d9] bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[#647067]">
                                {statusLabel(activity.status)}
                              </div>
                              {canReopen && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      mode: "join",
                                      code: activity.sessionCode!,
                                      auto: "1",
                                    });
                                    if (user?.displayName) {
                                      params.set("name", user.displayName);
                                    }
                                    navigate(`/skills-matrix?${params.toString()}`);
                                  }}
                                  className="rounded-full border border-[#b8d7ce] bg-[#eaf5f1] px-2.5 py-0.5 text-[11px] font-bold text-[#0f766e] transition hover:bg-[#d7eee7]"
                                >
                                  Rouvrir
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-[#647067]">
                            {activity.activityLabel} · {formatDateTime(activity.occurredAt)}
                          </div>
                          {activity.details ? (
                            <div className="mt-1 text-xs text-[#7b8781]">{activity.details}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}

            <Card tone="saas" className="p-4 sm:p-5">
              <div className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-[#66766f]">
                Évolutions prévues
              </div>
              <ul className="space-y-1 text-sm text-[#54645d]">
                {(dashboard?.roadmap.upcoming ?? []).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </div>

      <Dialog
        open={joinOpen}
        onOpenChange={(v) => {
          setJoinOpen(v);
          if (!v) setJoinError(null);
        }}
      >
        <DialogContent
          className="max-w-sm rounded-2xl border border-[#d8e2d9] bg-[#f7f8f3] p-0 shadow-2xl [&>button]:text-[#647067] [&>button]:hover:text-[#24443d]"
          onOpenAutoFocus={() => joinInputRef.current?.focus()}
        >
          <div className="rounded-t-2xl border-b border-[#d8e2d9] bg-white/70 px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#163832] text-sm text-white">
                ⚡
              </div>
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#24443d]">
                Agile Suite
              </span>
            </div>
            <DialogHeader>
              <DialogTitle className="text-base font-black text-[#12201d]">
                Rejoindre une partie
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-[#647067]">
                Entre le code room communiqué par l'animateur. Fonctionne pour tous les modules.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={(e) => void handleJoinSubmit(e)} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[#66766f]">
                Code room
              </label>
              <input
                ref={joinInputRef}
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setJoinError(null);
                }}
                placeholder="Ex. ABC123"
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-2xl border border-[#cfd9d1] bg-white/80 px-4 text-center text-lg font-black tracking-[0.2em] text-[#18211f] placeholder:text-[#8b9891] outline-none transition focus:border-[#8fa49a] focus:ring-2 focus:ring-[#163832]/20"
              />
            </div>

            {joinError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={joinLoading || joinCode.trim().length < 4}
              className="h-11 w-full rounded-2xl bg-[#163832] text-sm font-black text-white shadow-[0_12px_26px_rgba(22,56,50,0.18)] transition hover:bg-[#1f4a43] disabled:opacity-40"
            >
              {joinLoading ? "Recherche..." : "Rejoindre"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
