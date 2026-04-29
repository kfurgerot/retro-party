import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PlanningPokerGameScreen } from "@/components/screens/PlanningPokerGameScreen";
import { IdentityStep, SessionLobby, ConnectingState } from "@/components/app-shell-v2/pre-game";
import type { PresenceParticipant } from "@/components/app-shell-v2/pre-game";
import { usePlanningPokerOnlineState } from "@/hooks/usePlanningPokerOnlineState";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { setHostSession } from "@/lib/hostSession";
import { PlanningPokerRole, PlanningPokerVoteSystem } from "@/types/planningPoker";
import { PLANNING_POKER_DECKS } from "@/lib/planningPoker";
import { EXPERIENCE_BY_ID } from "@/design-system/tokens";
import { cn } from "@/lib/utils";
import { fr } from "@/i18n/fr";

const cleanDisplayName = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 16);

type InitialParams = {
  mode: "host" | "join";
  code: string;
  name: string;
  avatar: number;
  autoSubmit: boolean;
  direct: boolean;
  fromEntry: boolean;
  fresh: boolean;
};

const PlanningPokerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const initialParams = useMemo<InitialParams>(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const code = params.get("code");
    const name = params.get("name");
    const avatar = Number(params.get("avatar"));
    const auto = params.get("auto");
    const from = params.get("from");
    return {
      mode: mode === "join" ? "join" : "host",
      code: code ? code.toUpperCase() : "",
      name: name ? name.trim() : "",
      avatar: Number.isFinite(avatar) ? Math.max(0, Math.floor(avatar)) : 0,
      autoSubmit: auto === "1",
      direct: auto === "1" || !!code,
      fromEntry: from === "entry",
      fresh: params.get("new") === "1",
    };
  }, [location.search]);

  const online = usePlanningPokerOnlineState({
    skipRestore: initialParams.fresh,
    restoreCode: initialParams.mode === "join" ? initialParams.code : null,
  });
  const { leaveRoom } = online;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.key !== "default") return;
    leaveRoom();
    navigate("/?stage=select-experience", { replace: true });
  }, [leaveRoom, location.key, navigate]);

  const connectedDisplayName = cleanDisplayName(user?.displayName || "");
  const { profile, setProfile } = useProfile(
    "planning-poker",
    initialParams.name || connectedDisplayName || undefined,
    initialParams.avatar,
  );
  const forceProfileBeforeJoin = useMemo(
    () => initialParams.mode === "join" && !!initialParams.code && !initialParams.autoSubmit,
    [initialParams.autoSubmit, initialParams.code, initialParams.mode],
  );
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => forceProfileBeforeJoin || (!profile.name && !initialParams.direct),
  );
  const [connectedLaunchProfileApplied, setConnectedLaunchProfileApplied] = useState(false);
  const [voteSystem, setVoteSystem] = useState<PlanningPokerVoteSystem>("fibonacci");
  const [role, setRole] = useState<PlanningPokerRole>("player");

  useEffect(() => {
    if (!online.code) {
      setHostSession(null);
      return;
    }
    setHostSession({
      code: online.code,
      moduleId: "planning-poker",
      isHost: online.isHost,
      participantSessionId: online.sessionId,
    });
    return () => setHostSession(null);
  }, [online.code, online.isHost, online.sessionId]);

  useEffect(() => {
    if (connectedLaunchProfileApplied || authLoading) return;
    if (
      !connectedDisplayName ||
      initialParams.mode !== "host" ||
      initialParams.direct ||
      online.code
    ) {
      return;
    }
    setProfile({ name: connectedDisplayName, avatar: profile.avatar });
    setShowOnboarding(true);
    setConnectedLaunchProfileApplied(true);
  }, [
    authLoading,
    connectedDisplayName,
    connectedLaunchProfileApplied,
    initialParams.direct,
    initialParams.mode,
    online.code,
    profile.avatar,
    setProfile,
  ]);

  const directSubmitRef = React.useRef(false);
  useEffect(() => {
    if (directSubmitRef.current) return;
    if (online.code || showOnboarding) return;
    if (!initialParams.autoSubmit && !initialParams.direct) return;
    const name = (profile.name || initialParams.name || connectedDisplayName).trim();
    if (name.length < 2) return;
    directSubmitRef.current = true;
    if (initialParams.mode === "join" && initialParams.code) {
      online.joinRoom(initialParams.code, name, profile.avatar ?? initialParams.avatar, "player");
    } else {
      online.createRoom(name, profile.avatar ?? initialParams.avatar, "player", voteSystem);
    }
  }, [
    connectedDisplayName,
    initialParams.autoSubmit,
    initialParams.avatar,
    initialParams.code,
    initialParams.direct,
    initialParams.mode,
    initialParams.name,
    online,
    online.code,
    profile.avatar,
    profile.name,
    showOnboarding,
    voteSystem,
  ]);

  const leaveSession = () => {
    online.leaveRoom();
    navigate("/app");
  };

  if (online.state.phase === "lobby") {
    if (!online.code && showOnboarding) {
      const handleIdentitySubmit = ({ name, avatar }: { name: string; avatar: number }) => {
        setProfile({ name, avatar });
        setShowOnboarding(false);
        if (initialParams.mode === "join" && initialParams.code) {
          online.joinRoom(initialParams.code, name, avatar, "player");
        } else {
          online.createRoom(name, avatar, "player", voteSystem);
        }
      };
      const exp = EXPERIENCE_BY_ID["planning-poker"];
      return (
        <IdentityStep
          connected={online.connected}
          moduleLabel={exp.label}
          moduleIcon={exp.icon}
          accentRgb={exp.accentRgb}
          brandLabel={fr.planningPoker.gameTitle}
          initialName={profile.name || undefined}
          initialAvatar={profile.avatar}
          overallStepStart={3}
          overallStepTotal={5}
          sessionPreview={
            initialParams.mode === "join" && initialParams.code
              ? { code: initialParams.code, status: "lobby" }
              : null
          }
          primaryLabel={initialParams.mode === "join" ? "Rejoindre la table" : "Créer la table"}
          onSubmit={handleIdentitySubmit}
          onBack={() => navigate("/")}
        />
      );
    }

    if (!online.code) {
      const exp = EXPERIENCE_BY_ID["planning-poker"];
      return (
        <ConnectingState
          accentRgb={exp.accentRgb}
          mode={initialParams.mode === "join" ? "joining" : "creating"}
          code={initialParams.mode === "join" ? initialParams.code : null}
          onBack={() => navigate("/")}
        />
      );
    }

    const exp = EXPERIENCE_BY_ID["planning-poker"];
    const selfName = (profile.name || connectedDisplayName || "").trim();
    const activeVoteSystem = online.state.voteSystem || voteSystem;
    const activeRole = online.myRole || role;
    const participants: PresenceParticipant[] = online.state.players.map((p, i) => ({
      id: p.socketId ?? `${p.name}-${i}`,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      isSelf: !!selfName && p.name.trim().toLowerCase() === selfName.toLowerCase(),
      state: p.connected === false ? "offline" : p.isHost ? "ready" : "idle",
    }));
    const hostPlayer = online.state.players.find((p) => p.isHost);
    const shareUrl =
      typeof window !== "undefined" ? `${window.location.origin}/join/${online.code}` : undefined;
    const shareMessage = `Rejoins-moi sur ${exp.label} avec le code ${online.code} → ${shareUrl ?? ""}`;

    return (
      <SessionLobby
        roomCode={online.code}
        connected={online.connected}
        moduleLabel={exp.label}
        moduleIcon={exp.icon}
        accentRgb={exp.accentRgb}
        brandLabel={fr.planningPoker.gameTitle}
        sessionTitle={null}
        participants={participants}
        isHost={online.isHost}
        canStart={online.isHost}
        shareUrl={shareUrl}
        shareMessage={shareMessage}
        waitingHostName={hostPlayer?.name}
        onLeave={leaveSession}
        onStart={online.startSession}
        playerSetupTitle="Mon rôle"
        playerSetupPanel={
          <PlanningPokerRoleControl
            accentRgb={exp.accentRgb}
            value={activeRole}
            onChange={(nextRole) => {
              setRole(nextRole);
              online.setRole(nextRole);
            }}
          />
        }
        hostSetupTitle="Système de vote"
        hostSetupPanel={
          online.isHost ? (
            <PlanningPokerDeckControl
              accentRgb={exp.accentRgb}
              value={activeVoteSystem}
              onChange={(next) => {
                setVoteSystem(next);
                online.setVoteSystem(next);
              }}
            />
          ) : null
        }
      />
    );
  }

  return (
    <PlanningPokerGameScreen
      state={online.state}
      history={online.history}
      myPlayerId={online.myPlayerId}
      myRole={online.myRole}
      myVote={online.myVote}
      isHost={online.isHost}
      onVoteCard={online.voteCard}
      onOpenVotes={online.openVotes}
      onReopenStoryVote={online.reopenStoryVote}
      onRevealVotes={online.revealVotes}
      onResetVotes={online.resetVotes}
      onRevoteCurrentStory={online.revoteCurrentStory}
      onRoleChange={online.setRole}
      onVoteSystemChange={online.setVoteSystem}
      onStoryTitleChange={online.setStoryTitle}
      onSelectPokerStory={online.selectPokerStory}
      onSelectPokerStoryByTitle={online.selectPokerStoryByTitle}
      onUpdatePreparedStoryTitle={online.updatePreparedStoryTitle}
      onAddPreparedStory={online.addPreparedStory}
    />
  );
};

export default PlanningPokerPage;

const VOTE_SYSTEM_OPTIONS: Array<{ value: PlanningPokerVoteSystem; label: string }> = [
  { value: "fibonacci", label: "Fibonacci" },
  { value: "man-day", label: "JH" },
  { value: "tshirt", label: "T-Shirt" },
];

const displayDeckValue = (value: string) => (value === "☕" ? "Café" : value);

const PlanningPokerRoleControl: React.FC<{
  value: PlanningPokerRole;
  onChange: (next: PlanningPokerRole) => void;
  accentRgb: string;
}> = ({ value, onChange, accentRgb }) => {
  const options: Array<{ value: PlanningPokerRole; label: string; hint: string }> = [
    { value: "player", label: "Joueur", hint: "Tu votes les estimations" },
    { value: "spectator", label: "Spectateur", hint: "Tu observes sans voter" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "ds-focus-ring flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition",
              active
                ? "text-[var(--ds-text-primary)]"
                : "border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)]",
            )}
            style={
              active
                ? {
                    borderColor: `rgba(${accentRgb},0.55)`,
                    background: `rgba(${accentRgb},0.12)`,
                    boxShadow: `0 0 0 1px rgba(${accentRgb},0.4)`,
                  }
                : undefined
            }
          >
            <span className="text-[13px] font-semibold">{opt.label}</span>
            <span className="text-[11.5px] text-[var(--ds-text-faint)]">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  );
};

const PlanningPokerDeckControl: React.FC<{
  value: PlanningPokerVoteSystem;
  onChange: (next: PlanningPokerVoteSystem) => void;
  accentRgb: string;
}> = ({ value, onChange, accentRgb }) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5">
        {VOTE_SYSTEM_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={cn(
                "ds-focus-ring h-9 rounded-xl border text-[12.5px] font-semibold transition",
                active
                  ? "text-[var(--ds-text-primary)]"
                  : "border-[var(--ds-border)] bg-[var(--ds-surface-0)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)]",
              )}
              style={
                active
                  ? {
                      borderColor: `rgba(${accentRgb},0.55)`,
                      background: `rgba(${accentRgb},0.12)`,
                      boxShadow: `0 0 0 1px rgba(${accentRgb},0.4)`,
                    }
                  : undefined
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PLANNING_POKER_DECKS[value].map((v) => (
          <span
            key={`deck-${v}`}
            className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-2 py-0.5 font-mono text-[11px] text-[var(--ds-text-faint)]"
          >
            {displayDeckValue(v)}
          </span>
        ))}
      </div>
    </div>
  );
};
