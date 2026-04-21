import { TemplatePrepareModulePage } from "@/features/templates/TemplatePrepareModulePage";
import { TOOL_ACCENT } from "@/lib/uiTokens";
import { api } from "@/net/api";

const SKILLS_ACCENT = TOOL_ACCENT["skills-matrix"];

export default function SkillsMatrixPreparePage() {
  return (
    <TemplatePrepareModulePage
      moduleId="skills-matrix"
      moduleLabel="Matrice de Compétences"
      moduleIcon="🧩"
      introText="Prépare la configuration de ta matrice (échelle, catégories, compétences) avant l'atelier."
      newTemplateTitle="Nouveau template Matrice de Compétences"
      newTemplatePlaceholder="Nom du template (ex: Equipe Produit)"
      emptyStateText="Aucun template Matrice de Compétences. Crée-en un ci-dessus."
      emptyStateIcon="🧩"
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
        await api.skillsMatrixApplyTemplate(created.session.code, { templateId });
        navigate(
          `/skills-matrix?mode=join&code=${encodeURIComponent(created.session.code)}&name=${encodeURIComponent(
            hostName,
          )}&avatar=0&auto=1`,
        );
      }}
      theme={{
        accentColor: SKILLS_ACCENT.ambientColor,
        accentGlow: SKILLS_ACCENT.ambientGlow,
        moduleTextClass: "text-cyan-400",
        moduleCountBadgeClass: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
        createButtonClass: "bg-cyan-500 hover:bg-cyan-400 text-slate-950",
        createButtonShadow: "0 4px 16px rgba(14,165,233,0.3)",
        launchButtonClass: "bg-cyan-500 hover:bg-cyan-400 text-slate-950",
        launchButtonShadow: "0 4px 12px rgba(14,165,233,0.3)",
      }}
    />
  );
}
