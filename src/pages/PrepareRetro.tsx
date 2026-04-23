import { TemplatePrepareModulePage } from "@/features/templates/TemplatePrepareModulePage";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { api } from "@/net/api";

const RETRO_ACCENT = TOOL_ACCENT["retro-party"];

export default function PrepareRetroPage() {
  return (
    <TemplatePrepareModulePage
      moduleId="retro-party"
      moduleLabel="Rétro Party"
      moduleIcon="🎲"
      introText="Prépare tes sessions de rétrospective à l'avance avec des questions personnalisées."
      newTemplateTitle="Nouveau template Rétro Party"
      newTemplatePlaceholder="Nom du template (ex: Sprint 42)"
      emptyStateText="Aucun template Rétro Party. Crée-en un ci-dessus."
      emptyStateIcon="🎲"
      editRoute={(templateId) => `/prepare/templates/${templateId}`}
      launchTemplate={async (templateId, { navigate, userDisplayName }) => {
        const response = await api.launchTemplateRoom(templateId);
        const nextName = encodeURIComponent(userDisplayName);
        navigate(`/play?mode=join&code=${response.roomCode}&name=${nextName}&avatar=0&auto=1`);
      }}
      theme={{
        accentColor: RETRO_ACCENT.ambientColor,
        accentGlow: RETRO_ACCENT.ambientGlow,
        moduleTextClass: "text-pink-400",
        moduleCountBadgeClass: "border-pink-400/20 bg-pink-500/10 text-pink-300",
        createButtonClass: "bg-pink-500 hover:bg-pink-400",
        createButtonShadow: "0 4px 16px rgba(236,72,153,0.3)",
        launchButtonClass: "bg-pink-500 hover:bg-pink-400",
        launchButtonShadow: "0 4px 12px rgba(236,72,153,0.3)",
      }}
    />
  );
}
