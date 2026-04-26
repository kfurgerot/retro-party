import { useNavigate } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Objet",
    content: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme AgileSuite (ci-après « le Service »), éditée par Karl Furgerot (ci-après « l'Éditeur »). En créant un compte ou en utilisant le Service, l'utilisateur accepte sans réserve les présentes CGU.`,
  },
  {
    title: "2. Description du service",
    content: `AgileSuite est une plateforme collaborative proposant des outils dédiés aux équipes pratiquant des méthodes agiles : Planning Poker, Rétro Party, Radar Party, Skills Matrix et autres modules. Le Service est accessible depuis un navigateur web, sans installation logicielle requise.`,
  },
  {
    title: "3. Accès au service",
    content: `L'accès au Service nécessite la création d'un compte utilisateur. L'utilisateur s'engage à fournir des informations exactes et à les maintenir à jour. Chaque compte est strictement personnel et non cessible. L'utilisateur est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte.`,
  },
  {
    title: "4. Utilisation acceptable",
    content: `L'utilisateur s'engage à utiliser le Service de manière licite et respectueuse. Sont notamment interdits : l'utilisation du Service à des fins illégales ou frauduleuses, la diffusion de contenus illicites, discriminatoires ou portant atteinte aux droits de tiers, toute tentative de contournement des mécanismes de sécurité, l'utilisation de robots ou de scripts automatisés non autorisés.`,
  },
  {
    title: "5. Données personnelles",
    content: `Les données collectées (adresse e-mail, nom d'affichage, activité de session) sont utilisées exclusivement pour le fonctionnement du Service et l'amélioration de l'expérience utilisateur. Elles ne sont ni revendues ni transmises à des tiers à des fins commerciales. Conformément au Règlement Général sur la Protection des Données (RGPD), l'utilisateur dispose d'un droit d'accès, de rectification, de suppression et de portabilité de ses données, exercable en contactant l'Éditeur.`,
  },
  {
    title: "6. Propriété intellectuelle",
    content: `L'ensemble des éléments constituant le Service (code source, design, textes, marques, logos) sont la propriété exclusive de l'Éditeur ou de ses partenaires. Toute reproduction, distribution ou exploitation sans autorisation préalable est interdite. Les contenus créés par les utilisateurs au sein du Service (templates, sessions) restent leur propriété ; l'utilisateur concède à l'Éditeur une licence d'utilisation limitée aux stricts besoins du Service.`,
  },
  {
    title: "7. Disponibilité et évolution du service",
    content: `L'Éditeur s'efforce d'assurer la disponibilité du Service 24h/24 et 7j/7, sans toutefois s'y engager contractuellement. Des interruptions pour maintenance, mises à jour ou en cas de force majeure peuvent survenir. L'Éditeur se réserve le droit de modifier, suspendre ou interrompre tout ou partie du Service à tout moment, sans préavis ni indemnité.`,
  },
  {
    title: "8. Limitation de responsabilité",
    content: `Le Service est fourni « en l'état », sans garantie d'aucune sorte. L'Éditeur ne saurait être tenu responsable des préjudices indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le Service, notamment la perte de données, l'interruption d'activité ou tout dommage lié à des défauts du Service. La responsabilité totale de l'Éditeur est limitée aux sommes effectivement perçues de l'utilisateur au cours des douze mois précédant le litige.`,
  },
  {
    title: "9. Résiliation",
    content: `L'utilisateur peut supprimer son compte à tout moment depuis les paramètres de son profil. L'Éditeur se réserve le droit de suspendre ou résilier un compte sans préavis en cas de violation des présentes CGU ou de comportement abusif. La résiliation entraîne la suppression des données associées au compte dans un délai raisonnable, sauf obligation légale de conservation.`,
  },
  {
    title: "10. Modification des CGU",
    content: `L'Éditeur peut modifier les présentes CGU à tout moment. Les utilisateurs sont informés des modifications significatives par e-mail ou par notification dans le Service. La poursuite de l'utilisation du Service après modification vaut acceptation des nouvelles conditions.`,
  },
  {
    title: "11. Droit applicable et juridiction",
    content: `Les présentes CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux français compétents, après tentative de résolution amiable.`,
  },
  {
    title: "12. Contact",
    content: `Pour toute question relative aux présentes CGU ou à vos données personnelles, vous pouvez contacter l'Éditeur à l'adresse suivante : karl.furgerot@gmail.com`,
  },
];

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen text-slate-100"
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 10%, rgba(99,102,241,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 pb-20 pt-8">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-200"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Retour
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
              ⚡
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
              Agile Suite
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">
            Conditions Générales d'Utilisation
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Dernière mise à jour : avril 2026 — Version 1.0
          </p>
        </div>

        {/* Intro card */}
        <div className="mb-8 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] px-5 py-4 text-sm leading-relaxed text-indigo-100/80">
          Ces conditions régissent votre utilisation de la plateforme AgileSuite. Veuillez les lire
          attentivement avant de créer un compte ou d'utiliser nos services. En vous inscrivant,
          vous acceptez l'ensemble des dispositions ci-dessous.
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-5"
            >
              <h2 className="mb-2.5 text-sm font-bold uppercase tracking-[0.08em] text-indigo-300">
                {section.title}
              </h2>
              <p className="text-sm leading-relaxed text-slate-400">{section.content}</p>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between border-t border-white/[0.06] pt-6 text-xs text-slate-600">
          <span>© {new Date().getFullYear()} AgileSuite — Tous droits réservés</span>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-lg px-3 py-1.5 text-slate-500 transition hover:text-slate-300"
          >
            Retour au portail
          </button>
        </div>
      </div>
    </div>
  );
}
