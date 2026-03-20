import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PressStartScreen } from "@/components/screens/PressStartScreen";
import { SelectExperienceScreen, type ExperienceId } from "@/components/screens/SelectExperienceScreen";
import { fr } from "@/i18n/fr";
import { AuthLayout, PrimaryButton, SecondaryButton } from "@/components/app-shell";
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
        stepCurrent={1}
        stepTotal={5}
        onBack={() => setStage("press-start")}
        onSelect={(experience: ExperienceId) => {
          if (experience !== "retro-party") return;
          setStage("select-entry");
        }}
      />
    );
  }

  return (
    <AuthLayout
      title={fr.home.title}
      subtitle={fr.home.modeDescription}
      stepLabel={`${fr.onlineOnboarding.step} 2/5`}
    >
      <div className="mx-auto h-1.5 w-full max-w-md overflow-hidden rounded bg-slate-900/55">
        <div
          className="h-full rounded bg-cyan-400/90 transition-all duration-300"
          style={{ width: "40%" }}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PrimaryButton
          className="h-12"
          onClick={() => navigate("/play?from=entry")}
          onMouseEnter={prefetchPlayRoute}
          onFocus={prefetchPlayRoute}
          title={fr.home.quickPartyTitle}
        >
          {fr.home.playNow}
        </PrimaryButton>
        <SecondaryButton
          className="h-12"
          onClick={() => navigate("/prepare")}
          title={fr.home.preparePartyTitle}
        >
          {fr.home.prepareParty}
        </SecondaryButton>
      </div>
      <div className="pt-3">
        <SecondaryButton className="w-full sm:w-auto" onClick={() => setStage("select-experience")}>
          {fr.selectExperience.back}
        </SecondaryButton>
      </div>
    </AuthLayout>
  );
};

export default Home;
