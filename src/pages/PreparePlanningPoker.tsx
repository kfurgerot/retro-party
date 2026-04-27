import { TemplatePrepareModulePage } from "@/features/templates/TemplatePrepareModulePage";
import { api } from "@/net/api";

export default function PreparePlanningPokerPage() {
  return (
    <TemplatePrepareModulePage
      moduleId="planning-poker"
      introText="Préparez vos sessions Planning Poker avec les items à estimer et le système de vote."
      newTemplateTitle="Nouveau template Planning Poker"
      newTemplatePlaceholder="Nom du template (ex: Sprint 42)"
      emptyStateText="Aucun template Planning Poker. Créez-en un ci-dessus."
      editRoute={(templateId) => `/prepare/poker/${templateId}`}
      createBaseConfig={{ module: "planning-poker", voteSystem: "fibonacci" }}
      launchTemplate={async (templateId, { navigate, userDisplayName }) => {
        const response = await api.launchPokerTemplateRoom(templateId);
        const nextName = encodeURIComponent(userDisplayName);
        navigate(
          `/play?experience=planning-poker&mode=join&code=${response.roomCode}&name=${nextName}&avatar=0&auto=1`,
        );
      }}
    />
  );
}
