import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PressStartScreen } from "@/components/screens/PressStartScreen";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { SelectExperienceScreen, type ExperienceId } from "@/components/screens/SelectExperienceScreen";
import { fr } from "@/i18n/fr";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { APP_SHELL_SURFACE_SOFT } from "@/lib/uiTokens";
import { loadPlayPage } from "@/lib/routeLoaders";

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [entryChoice, setEntryChoice] = useState<"play" | "prepare">("play");
  const [stage, setStage] = useState<"press-start" | "select-experience" | "select-entry">(() => {
    const params = new URLSearchParams(location.search);
    const stageParam = params.get("stage");
    if (stageParam === "select-experience") return "select-experience";
    if (stageParam === "entry") return "select-entry";
    return "press-start";
  });
  const playPrefetchedRef = useRef(false);
  const [progressPct, setProgressPct] = useState(20);

  const prefetchPlayRoute = () => {
    if (playPrefetchedRef.current) return;
    playPrefetchedRef.current = true;
    void loadPlayPage();
  };

  const handleStart = () => {
    setStage("select-experience");
  };

  useEffect(() => {
    if (stage === "press-start") return;

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => prefetchPlayRoute(), { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(() => prefetchPlayRoute(), 400);
    return () => window.clearTimeout(timeoutId);
  }, [stage]);

  useLayoutEffect(() => {
    if (stage !== "select-entry") return;
    setProgressPct(20);
    let nextFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      nextFrame = window.requestAnimationFrame(() => {
        setProgressPct(40);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (nextFrame) window.cancelAnimationFrame(nextFrame);
    };
  }, [stage]);

  if (stage === "press-start") {
    return <PressStartScreen onStart={handleStart} />;
  }
  if (stage === "select-experience") {
    return (
      <SelectExperienceScreen
        stepCurrent={1}
        stepTotal={5}
        onBack={() => setStage("press-start")}
        onSelect={(experience: ExperienceId) => {
          if (experience !== "retro-party") return;
          setProgressPct(20);
          setStage("select-entry");
        }}
      />
    );
  }

  return (
    <div className="scanlines relative flex min-h-svh w-full items-start justify-center overflow-hidden px-4 pb-28 pt-4 sm:pb-28 sm:pt-6">
      <RetroScreenBackground />

      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
          <span>{fr.selectExperience.brand}</span>
          <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">
            {`${fr.onlineOnboarding.step} 2/5`}
          </span>
        </div>

        <h1 className="mt-4 text-center text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {fr.home.title}
        </h1>

        <div className="mt-4 h-1 w-full overflow-hidden rounded bg-slate-900/55">
          <div
            className="h-full rounded bg-cyan-400/90 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <Card className="mt-6 rounded-md p-4 sm:p-5">
          <div className="grid flex-1 content-start grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setEntryChoice("play")}
              onDoubleClick={() => navigate("/play?from=entry")}
              onMouseEnter={prefetchPlayRoute}
              onFocus={prefetchPlayRoute}
              title={fr.home.quickPartyTitle}
              className={cn(
                `${APP_SHELL_SURFACE_SOFT} p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`,
                entryChoice === "play"
                  ? "border-cyan-300/50 bg-cyan-500/10"
                  : "hover:border-cyan-300/45 hover:bg-slate-900/70"
              )}
            >
              <div className="text-sm font-semibold text-cyan-100">{fr.home.playNow}</div>
              <div className="mt-1 text-xs text-slate-300">{fr.home.quickPartyTitle}</div>
            </button>
            <button
              type="button"
              onClick={() => setEntryChoice("prepare")}
              onDoubleClick={() => navigate("/prepare")}
              title={fr.home.preparePartyTitle}
              className={cn(
                `${APP_SHELL_SURFACE_SOFT} p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`,
                entryChoice === "prepare"
                  ? "border-cyan-300/50 bg-cyan-500/10"
                  : "hover:border-cyan-300/45 hover:bg-slate-900/70"
              )}
            >
              <div className="text-sm font-semibold text-cyan-100">{fr.home.prepareParty}</div>
              <div className="mt-1 text-xs text-slate-300">{fr.home.preparePartyTitle}</div>
            </button>
          </div>
        </Card>

      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="flex items-center justify-between gap-2">
            <SecondaryButton className="h-11" onClick={() => setStage("select-experience")}>
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              className="h-11"
              onClick={() => {
                if (entryChoice === "play") {
                  navigate("/play?from=entry");
                  return;
                }
                navigate("/prepare");
              }}
            >
              {fr.selectExperience.next}
            </PrimaryButton>
          </div>
        </Card>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-cyan-300/40 bg-slate-950/92 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton className="h-12 min-h-0" onClick={() => setStage("select-experience")}>
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              className="h-12 min-h-0"
              onClick={() => {
                if (entryChoice === "play") {
                  navigate("/play?from=entry");
                  return;
                }
                navigate("/prepare");
              }}
            >
              {fr.selectExperience.next}
            </PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Home;
