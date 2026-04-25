import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "1. Objet",
    body: "Les présentes Conditions Générales d'Utilisation encadrent l'accès et l'utilisation d'AgileSuite, une plateforme d'ateliers Agile en ligne incluant notamment Planning Poker, Retro Party, Radar Party et Skills Matrix.",
  },
  {
    title: "2. Accès au service",
    body: "L'utilisateur peut rejoindre certaines sessions avec un code d'invitation. La préparation d'ateliers, la gestion de templates et l'accès au dashboard peuvent nécessiter la création d'un compte.",
  },
  {
    title: "3. Compte utilisateur",
    body: "L'utilisateur s'engage à fournir des informations exactes, à protéger ses identifiants et à informer l'éditeur en cas d'utilisation non autorisée de son compte.",
  },
  {
    title: "4. Usage acceptable",
    body: "Le service doit être utilisé dans un cadre professionnel, collaboratif et licite. Toute tentative de perturbation, d'accès non autorisé, de collecte abusive ou de détournement du service est interdite.",
  },
  {
    title: "5. Données et contenus",
    body: "Les contenus saisis dans les ateliers restent sous la responsabilité des utilisateurs. AgileSuite peut traiter les données nécessaires au fonctionnement des sessions, à l'authentification et à l'amélioration du service.",
  },
  {
    title: "6. Disponibilité",
    body: "L'éditeur met en oeuvre des efforts raisonnables pour maintenir le service accessible, sans garantir une disponibilité permanente ni l'absence totale d'interruptions.",
  },
  {
    title: "7. Responsabilité",
    body: "AgileSuite est un outil de facilitation. Les décisions prises à partir des ateliers, diagnostics ou restitutions relèvent de la responsabilité des équipes et organisations utilisatrices.",
  },
  {
    title: "8. Évolution des CGU",
    body: "Les présentes CGU peuvent être mises à jour pour tenir compte de l'évolution du service, du cadre légal ou des pratiques de sécurité. La date de mise à jour est indiquée sur cette page.",
  },
];

export default function Terms() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] px-4 py-6 text-[#18211f] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-[#d4ded5] bg-white/70 px-3 py-2 text-sm font-bold text-[#24443d] shadow-sm transition hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'accueil
        </Link>

        <header className="rounded-[28px] border border-[#d8e2d9] bg-white/75 p-5 shadow-sm sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#163832] text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#66766f]">
            AgileSuite
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#12201d] sm:text-5xl">
            Conditions Générales d'Utilisation
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#5f6f68]">
            Version du 25 avril 2026. Ce document présente les règles d'utilisation du service et
            les engagements attendus des utilisateurs.
          </p>
        </header>

        <div className="mt-5 space-y-3">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-[#d8e2d9] bg-white/68 p-5 shadow-sm"
            >
              <h2 className="text-base font-black text-[#15231f]">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#5f6f68]">{section.body}</p>
            </section>
          ))}
        </div>

        <footer className="mt-6 rounded-2xl border border-[#d8e2d9] bg-[#163832] p-5 text-sm leading-6 text-[#d8e9e4]">
          Pour toute question sur ces conditions, contactez l'éditeur du service AgileSuite.
        </footer>
      </div>
    </main>
  );
}
