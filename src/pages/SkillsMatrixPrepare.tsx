import { TemplatePrepareModulePage } from "@/features/templates/TemplatePrepareModulePage";
import { api } from "@/net/api";

export default function SkillsMatrixPreparePage() {
  return (
    <TemplatePrepareModulePage
      moduleId="skills-matrix"
      introText="Préparez la configuration de la matrice (échelle, catégories, compétences) avant l'atelier."
      newTemplateTitle="Nouveau template Skills Matrix"
      newTemplatePlaceholder="Nom du template (ex: Équipe Produit)"
      emptyStateText="Aucun template Skills Matrix. Créez-en un ci-dessus."
      editRoute={(templateId) => `/prepare/skills-matrix/${templateId}`}
      createBaseConfig={{
        module: "skills-matrix",
        scaleMin: 1,
        scaleMax: 5,
        categories: [],
        skills: [],
      }}
      launchTemplate={async (templateId, { navigate, userDisplayName }) => {
        const hostName = userDisplayName?.trim() || "Host";
        const created = await api.skillsMatrixCreateSession({
          displayName: hostName,
          avatar: 0,
        });
        const participantId = created.me?.participantId ?? "";
        if (!participantId) {
          throw new Error("Impossible d'identifier le participant host.");
        }
        await api.skillsMatrixApplyTemplate(created.session.code, { templateId }, participantId);
        navigate(
          `/skills-matrix?mode=join&code=${encodeURIComponent(created.session.code)}&participantId=${encodeURIComponent(
            participantId,
          )}&name=${encodeURIComponent(hostName)}&avatar=0&auto=1`,
        );
      }}
    />
  );
}
