import { TemplatePrepareModulePage } from "@/features/templates/TemplatePrepareModulePage";
import { api } from "@/net/api";

export default function PrepareRetroPage() {
  return (
    <TemplatePrepareModulePage
      moduleId="retro-party"
      introText="Préparez vos rétrospectives à l'avance avec des questions, thèmes et règles personnalisés."
      newTemplateTitle="Nouveau template Retro Party"
      newTemplatePlaceholder="Nom du template (ex: Sprint 42)"
      emptyStateText="Aucun template Retro Party. Créez-en un ci-dessus."
      editRoute={(templateId) => `/prepare/templates/${templateId}`}
      launchTemplate={async (templateId, { navigate, userDisplayName }) => {
        const response = await api.launchTemplateRoom(templateId);
        const nextName = encodeURIComponent(userDisplayName);
        navigate(`/play?mode=join&code=${response.roomCode}&name=${nextName}&avatar=0&auto=1`);
      }}
    />
  );
}
