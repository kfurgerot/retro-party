import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IndividualRecommendationsSection } from "./IndividualRecommendationsSection";
import type { IndividualRecommendationCard } from "@/features/radarParty/individualRecommendations";

const buildCards = (): IndividualRecommendationCard[] => [
  {
    kind: "reinforce",
    axis: "learning",
    axisLabel: "Apprentissages",
    score: 22,
    title: "A renforcer: Apprentissages",
    observation: "Score actuel: 22/100. C'est la priorite la plus faible du profil individuel.",
    suggestionLabel: "Suggestion",
    suggestion: "Transformer les constats en actions d'amelioration concretes et suivies.",
    firstStep: "Choisir une action d'apprentissage a tester des cette semaine.",
    indicator: "Taux d'actions d'amelioration terminees sur la periode.",
  },
  {
    kind: "next-lever",
    axis: "speed",
    axisLabel: "Vitesse",
    score: 31,
    title: "Prochain levier: Vitesse",
    observation: "Score actuel: 31/100. C'est un levier secondaire a travailler apres la priorite principale.",
    suggestionLabel: "Suggestion",
    suggestion: "Fluidifier le flux en traitant le principal point de ralentissement.",
    firstStep: "Identifier un goulot et lancer une action de debouchage cette semaine.",
    indicator: "Evolution du lead time et du nombre de travaux bloques.",
  },
  {
    kind: "preserve",
    axis: "value",
    axisLabel: "Valeur",
    score: 84,
    title: "A preserver: Valeur",
    observation: "Score actuel: 84/100. C'est un point fort a conserver pendant la progression.",
    suggestionLabel: "Suggestion",
    suggestion: "Preserver l'orientation valeur dans les prochaines decisions.",
    firstStep: "Continuer a verifier l'impact attendu sur un sujet cle chaque semaine.",
    indicator: "Maintien du score value et retours utilisateurs exploites.",
  },
];

describe("IndividualRecommendationsSection", () => {
  it("does not render when there are no cards", () => {
    const { container } = render(<IndividualRecommendationsSection cards={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders recommendation cards with non-prescriptive helper copy", () => {
    render(<IndividualRecommendationsSection cards={buildCards()} />);

    expect(screen.getByText("Recommandations suggerees (2 semaines)")).toBeInTheDocument();
    expect(screen.getByText("Suggestions automatiques (sans IA externe).")).toBeInTheDocument();
    expect(screen.getByText("A adapter a ton contexte: ce sont des pistes, pas des obligations.")).toBeInTheDocument();

    expect(screen.getAllByText("Constat:")).toHaveLength(3);
    expect(screen.getAllByText("Suggestion:")).toHaveLength(3);
    expect(screen.getAllByText("Premier pas:")).toHaveLength(3);
    expect(screen.getAllByText("Indicateur (2 semaines):")).toHaveLength(3);
  });

  it("uses responsive layout classes for mobile and desktop", () => {
    const { container } = render(<IndividualRecommendationsSection cards={buildCards()} />);

    const recommendationsGrid = container.querySelector("div.md\\:grid-cols-2");
    expect(recommendationsGrid).toBeInTheDocument();
  });
});
