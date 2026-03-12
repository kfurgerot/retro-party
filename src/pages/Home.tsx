import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RetroScreenBackground } from "@/components/screens/RetroScreenBackground";
import { PressStartScreen } from "@/components/screens/PressStartScreen";
import { SelectExperienceScreen, type ExperienceId } from "@/components/screens/SelectExperienceScreen";
import { fr } from "@/i18n/fr";
import { CTA_NEON_PRIMARY, CTA_NEON_SECONDARY } from "@/lib/uiTokens";
import { loadPlayPage } from "@/lib/routeLoaders";

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stage, setStage] = useState<"press-start" | "select-experience" | "select-entry">(() => {
    const params = new URLSearchParams(location.search);
    const stageParam = params.get("stage");
    if (stageParam === "select-experience") return "select-experience";
    if (stageParam === "entry") return "select-entry";
    return "press-start";
  });
  const playPrefetchedRef = useRef(false);

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

  if (stage === "press-start") {
    return <PressStartScreen onStart={handleStart} />;
  }
  if (stage === "select-experience") {
    return (
      <SelectExperienceScreen
        stepLabel={`${fr.onlineOnboarding.step} 1/5`}
        onBack={() => setStage("press-start")}
        onSelect={(experience: ExperienceId) => {
          if (experience !== "retro-party") return;
          setStage("select-entry");
        }}
      />
    );
  }

  return (
    <div className="scanlines relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8">
      <RetroScreenBackground />
      <Card className="relative z-10 w-full max-w-2xl border-cyan-300/60 bg-card/88 shadow-[0_0_0_2px_rgba(34,211,238,0.3),0_0_34px_rgba(34,211,238,0.32)] backdrop-blur">
        <CardHeader>
          <div className="mb-2 flex justify-end text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">
            <span className="rounded-full border border-cyan-300/40 px-2 py-0.5">
              {fr.onlineOnboarding.step} 2/5
            </span>
          </div>
          <CardTitle className="text-center text-2xl text-cyan-200">{fr.home.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-slate-300">
            {fr.home.modeDescription}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className={`h-12 font-semibold ${CTA_NEON_PRIMARY}`}
              onClick={() => navigate("/play?from=entry")}
              onMouseEnter={prefetchPlayRoute}
              onFocus={prefetchPlayRoute}
              title={fr.home.quickPartyTitle}
            >
              {fr.home.playNow}
            </Button>
            <Button
              variant="secondary"
              className={`h-12 ${CTA_NEON_SECONDARY}`}
              onClick={() => navigate("/prepare")}
              title={fr.home.preparePartyTitle}
            >
              {fr.home.prepareParty}
            </Button>
          </div>
          <div className="pt-1">
            <Button
              variant="secondary"
              className={`w-full sm:w-auto ${CTA_NEON_SECONDARY}`}
              onClick={() => setStage("select-experience")}
            >
              {fr.selectExperience.back}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;
