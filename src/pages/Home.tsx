import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PressStartScreen } from "@/components/screens/PressStartScreen";
import {
  SelectExperienceScreen,
  type ExperienceId,
} from "@/components/screens/SelectExperienceScreen";
import { fr } from "@/i18n/fr";
import { Card, PrimaryButton, SecondaryButton } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { APP_SHELL_SURFACE_SOFT } from "@/lib/uiTokens";
import { loadPlayPage } from "@/lib/routeLoaders";

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [entryChoice, setEntryChoice] = useState<"play" | "prepare">("play");
  const [selectedExperience, setSelectedExperience] = useState<ExperienceId>(() => {
    const params = new URLSearchParams(location.search);
    const experienceParam = params.get("experience");
    if (experienceParam === "agile-radar") return "agile-radar";
    return experienceParam === "planning-poker" ? "planning-poker" : "retro-party";
  });
  const [stage, setStage] = useState<"press-start" | "select-experience" | "select-entry">(() => {
    const params = new URLSearchParams(location.search);
    const stageParam = params.get("stage");
    if (stageParam === "select-experience") return "select-experience";
    if (stageParam === "entry") return "select-entry";
    return "press-start";
  });
  const playPrefetchedRef = useRef(false);
  const [progressPct, setProgressPct] = useState(20);
  const selectedExperienceBrandLabel =
    selectedExperience === "planning-poker"
      ? fr.planningPoker.gameTitle
      : selectedExperience === "agile-radar"
        ? "Radar Party"
        : fr.home.title;
  const selectedExperienceTitle =
    selectedExperience === "planning-poker"
      ? fr.planningPoker.gameTitle
      : selectedExperience === "agile-radar"
        ? "Radar Party"
        : fr.home.title;

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

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(() => prefetchPlayRoute(), { timeout: 1200 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
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
          if (
            experience !== "retro-party" &&
            experience !== "planning-poker" &&
            experience !== "agile-radar"
          )
            return;
          setSelectedExperience(experience);
          setProgressPct(20);
          setEntryChoice("play");
          setStage("select-entry");
        }}
      />
    );
  }

  return (
    <div className="relative flex min-h-svh w-full items-start justify-center overflow-hidden bg-[#f7f8f3] text-[#18211f] px-4 pb-28 pt-4 sm:pb-28 sm:pt-6">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(14,116,144,0.13)_0%,transparent_34%),linear-gradient(225deg,rgba(245,158,11,0.12)_0%,transparent_32%),linear-gradient(180deg,#f7f8f3_0%,#eef4ef_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 bg-[repeating-linear-gradient(90deg,rgba(15,23,42,0.045)_0,rgba(15,23,42,0.045)_1px,transparent_1px,transparent_72px)]" />

      <Card className="relative z-10 flex min-h-[82svh] w-full max-w-4xl flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#24443d]/80">
          <span>{selectedExperienceBrandLabel}</span>
          <span className="rounded-full border border-[#163832]/35 px-2 py-0.5">
            {`${fr.onlineOnboarding.step} 2/5`}
          </span>
        </div>

        <h1 className="mt-4 text-center text-xl text-[#24443d] drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] sm:text-3xl">
          {selectedExperienceTitle}
        </h1>

        <div className="mt-4 h-1 w-full overflow-hidden rounded bg-white/62">
          <div
            className="h-full rounded bg-cyan-400/90 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <Card className="mt-6 rounded-md p-4 sm:p-5">
          <div
            className={cn(
              "grid flex-1 content-start grid-cols-1 gap-3",
              selectedExperience !== "planning-poker" ? "sm:grid-cols-2" : "",
            )}
          >
            <button
              type="button"
              onClick={() => setEntryChoice("play")}
              onDoubleClick={() =>
                navigate(
                  selectedExperience === "planning-poker"
                    ? "/play?from=entry&experience=planning-poker"
                    : selectedExperience === "agile-radar"
                      ? "/radar-party?from=entry&mode=host"
                      : "/play?from=entry",
                )
              }
              onMouseEnter={prefetchPlayRoute}
              onFocus={prefetchPlayRoute}
              title={fr.home.quickPartyTitle}
              className={cn(
                `${APP_SHELL_SURFACE_SOFT} p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`,
                entryChoice === "play"
                  ? "border-cyan-300/50 bg-[#edf5ef]"
                  : "hover:border-cyan-300/45 hover:bg-white/72",
              )}
            >
              <div className="text-sm font-semibold text-[#24443d]">{fr.home.playNow}</div>
              <div className="mt-1 text-xs text-[#647067]">{fr.home.quickPartyTitle}</div>
            </button>
            {selectedExperience !== "planning-poker" ? (
              <button
                type="button"
                onClick={() => setEntryChoice("prepare")}
                onDoubleClick={() =>
                  navigate(
                    selectedExperience === "agile-radar"
                      ? "/radar-party?from=entry&mode=join"
                      : "/prepare",
                  )
                }
                title={fr.home.preparePartyTitle}
                className={cn(
                  `${APP_SHELL_SURFACE_SOFT} p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`,
                  entryChoice === "prepare"
                    ? "border-cyan-300/50 bg-[#edf5ef]"
                    : "hover:border-cyan-300/45 hover:bg-white/72",
                )}
              >
                <div className="text-sm font-semibold text-[#24443d]">{fr.home.prepareParty}</div>
                <div className="mt-1 text-xs text-[#647067]">{fr.home.preparePartyTitle}</div>
              </button>
            ) : null}
          </div>
        </Card>
      </Card>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:block">
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-[#163832]/35 bg-[#f7f8f3]/94 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="flex items-center justify-between gap-2">
            <SecondaryButton className="h-11" onClick={() => setStage("select-experience")}>
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              className="h-11"
              onClick={() => {
                if (entryChoice === "play") {
                  navigate(
                    selectedExperience === "planning-poker"
                      ? "/play?from=entry&experience=planning-poker"
                      : selectedExperience === "agile-radar"
                        ? "/radar-party?from=entry&mode=host"
                        : "/play?from=entry",
                  );
                  return;
                }
                if (selectedExperience === "agile-radar") {
                  navigate("/radar-party?from=entry&mode=join");
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
        <Card className="pointer-events-auto mx-auto w-full max-w-4xl border-[#163832]/35 bg-[#f7f8f3]/94 p-3 shadow-[0_0_0_1px_rgba(34,211,238,0.2),0_8px_28px_rgba(2,6,23,0.55)]">
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton className="h-12 min-h-0" onClick={() => setStage("select-experience")}>
              {fr.selectExperience.back}
            </SecondaryButton>
            <PrimaryButton
              className="h-12 min-h-0"
              onClick={() => {
                if (entryChoice === "play") {
                  navigate(
                    selectedExperience === "planning-poker"
                      ? "/play?from=entry&experience=planning-poker"
                      : selectedExperience === "agile-radar"
                        ? "/radar-party?from=entry&mode=host"
                        : "/play?from=entry",
                  );
                  return;
                }
                if (selectedExperience === "agile-radar") {
                  navigate("/radar-party?from=entry&mode=join");
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
