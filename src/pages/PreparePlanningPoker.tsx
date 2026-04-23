import { TemplatePrepareModulePage } from "@/features/templates/TemplatePrepareModulePage";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { api } from "@/net/api";

const PLANNING_ACCENT = TOOL_ACCENT["planning-poker"];

export default function PreparePlanningPokerPage() {
  return (
    <TemplatePrepareModulePage
      moduleId="planning-poker"
      moduleLabel="Planning Poker"
      moduleIcon="🃏"
      introText="Prépare tes sessions de planning poker avec tes stories à estimer."
      newTemplateTitle="Nouveau template Planning Poker"
      newTemplatePlaceholder="Nom du template (ex: Sprint 42)"
      emptyStateText="Aucun template Planning Poker. Crée-en un ci-dessus."
      emptyStateIcon="🃏"
      editRoute={(templateId) => `/prepare/poker/${templateId}`}
      createBaseConfig={{ module: "planning-poker", voteSystem: "fibonacci" }}
      launchTemplate={async (templateId, { navigate, userDisplayName }) => {
        const response = await api.launchPokerTemplateRoom(templateId);
        const nextName = encodeURIComponent(userDisplayName);
        navigate(
          `/play?experience=planning-poker&mode=join&code=${response.roomCode}&name=${nextName}&avatar=0&auto=1`,
        );
      }}
      theme={{
        accentColor: PLANNING_ACCENT.ambientColor,
        accentGlow: PLANNING_ACCENT.ambientGlow,
        moduleTextClass: "text-violet-400",
        moduleCountBadgeClass: "border-violet-400/20 bg-violet-500/10 text-violet-300",
        createButtonClass: "bg-violet-500 hover:bg-violet-400",
        createButtonShadow: "0 4px 16px rgba(139,92,246,0.3)",
        launchButtonClass: "bg-violet-500 hover:bg-violet-400",
        launchButtonShadow: "0 4px 12px rgba(139,92,246,0.3)",
      }}
    />
  );
}
