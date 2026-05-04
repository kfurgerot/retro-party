import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { useAuth } from "@/contexts/useAuth";
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
  if (value === "live") return "Démarrée";
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
      } else if (result.module === "planning-poker") {
        navigate(`/play?experience=planning-poker&mode=join&code=${result.code}`);
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
      <div className="scanlines relative flex min-h-svh items-center justify-center bg-slate-950 px-4">
        <div className="neon-surface px-4 py-3 text-sm font-semibold text-cyan-100">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-svh overflow-hidden bg-[#0a0a14] text-slate-100"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 10%, rgba(99,102,241,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 30% at 80% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)
          `,
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[960px] px-4 pb-12 pt-6 sm:px-5 sm:pt-7">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
                ⚡
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
                Agile Suite
              </span>
            </div>
            <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold leading-none tracking-tight text-slate-50">
              Dashboard
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Activités par module et historique de tes sessions/templates.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SecondaryButton className="h-10 min-h-0 px-3 text-xs" onClick={() => navigate("/")}>
              Retour
            </SecondaryButton>
            <SecondaryButton
              className="h-10 min-h-0 px-3 text-xs border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20"
              onClick={() => {
                setJoinCode("");
                setJoinError(null);
                setJoinOpen(true);
              }}
            >
              Rejoindre
            </SecondaryButton>
            <PrimaryButton
              className="h-10 min-h-0 px-3 text-xs"
              onClick={() => void loadDashboard()}
            >
              Actualiser
            </PrimaryButton>
          </div>
        </header>

        <Card className="mb-4 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Vue d'ensemble
              </div>
              <div className="mt-1 text-sm text-slate-200">
                {totalActivities} activité{totalActivities > 1 ? "s" : ""} historisée
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Dernière mise à jour : {formatDateTime(dashboard?.generatedAt ?? null)}
            </div>
          </div>
        </Card>

        {error && (
          <Card className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </Card>
        )}

        {loading ? (
          <Card className="rounded-2xl p-5 text-sm text-slate-300">Chargement du dashboard...</Card>
        ) : (
          <div className="space-y-4">
            {dashboard?.modules.map((moduleItem) => (
              <Card key={moduleItem.moduleId} className="rounded-2xl p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{moduleItem.moduleIcon}</span>
                    <div className="text-sm font-semibold text-slate-100">
                      {moduleItem.moduleLabel}
                    </div>
                  </div>
                  <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-slate-300">
                    {moduleItem.totalActivities} activité{moduleItem.totalActivities > 1 ? "s" : ""}
                  </div>
                </div>

                {moduleItem.activities.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-slate-500">
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
                          className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
                        >
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-100">
                              {activity.title}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-300">
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
                                  className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                                >
                                  Rouvrir
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">
                            {activity.activityLabel} · {formatDateTime(activity.occurredAt)}
                          </div>
                          {activity.details ? (
                            <div className="mt-1 text-xs text-slate-500">{activity.details}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))}

            <Card className="rounded-2xl p-4 sm:p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Évolutions prévues
              </div>
              <ul className="space-y-1 text-sm text-slate-300">
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
          className="max-w-sm rounded-2xl border border-white/[0.08] bg-[#0d0d1a] p-0 shadow-2xl [&>button]:text-slate-400 [&>button]:hover:text-slate-100"
          onOpenAutoFocus={() => joinInputRef.current?.focus()}
        >
          <div className="rounded-t-2xl border-b border-white/[0.08] bg-gradient-to-r from-indigo-500/14 via-violet-500/9 to-pink-500/12 px-5 py-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
                ⚡
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-300">
                Agile Suite
              </span>
            </div>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-100">
                Rejoindre une partie
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-slate-400">
                Entre le code room communiqué par l'animateur. Fonctionne pour tous les modules.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={(e) => void handleJoinSubmit(e)} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
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
                className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-center text-lg font-bold tracking-[0.2em] text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/30"
              />
            </div>

            {joinError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {joinError}
              </div>
            )}

            <button
              type="submit"
              disabled={joinLoading || joinCode.trim().length < 4}
              className="h-11 w-full rounded-2xl bg-indigo-500 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40"
              style={{ boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
            >
              {joinLoading ? "Recherche..." : "Rejoindre"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
