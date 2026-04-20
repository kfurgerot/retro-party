# Retro Agile - Vision P3 UX/Game Design

## 1. Audit critique (sans complaisance)

### Forces actuelles

- Le produit est fonctionnel de bout en bout (host, lobby, partie, resultats).
- La logique metier et les flux multijoueur sont stables.
- Une base de design system existe (tokens CTA, surfaces, i18n FR, perf basique).

### Faiblesses majeures

- La direction retro est devenue un carcan:
  - style tres marque, mais faible lisibilite sur mobile et faible perception "produit premium".
  - surcharge visuelle (glows, scans, multiples couches neon) qui concurrence l'information.
- Le plateau est puissant mais cognitivement couteux:
  - zoom/pan permanent, micro-elements nombreux, difficile a lire rapidement sur smartphone.
  - la comprehension "ou je suis / quoi faire" n'est pas immediate.
- Trop d'interruptions de flux:
  - empilement de modales et overlays selon les etats.
  - transitions parfois longues ou peu explicites.
- Le role host est robuste mais pas "premium":
  - beaucoup d'informations dans une meme vue.
  - manque d'assistance decisionnelle ("pret a lancer ?" / "qui bloque ?").
- Les joueurs passifs restent souvent spectateurs inertes:
  - peu d'anticipation et peu de feedback orientes engagement.

## 2. Remises en question assumees

- **Le retro ne doit plus etre la direction principale**.
  - A conserver comme accent nostalgique optionnel, pas comme identite dominante.
- **Le plateau libre doit etre simplifie**.
  - Une representation "parcours d'etapes" plus claire est preferable.
- **Le jeu doit prioriser lisibilite et rythme** avant effet visuel.
- **Mobile et desktop doivent etre 2 experiences adaptees**, pas une declinaison responsive minimale.

## 3. Vision cible

Positionnement cible: **Party game collaboratif premium**.

Principes:

- 1 action principale visible par ecran.
- Lecture en 3 secondes: contexte, action, consequence.
- Feedback continu: qui joue, progression, prochaine etape.
- Interface "game first" mais sobre: motion utile, transitions courtes, hierarchie stricte.

## 4. Direction artistique recommandee

Direction retenue: **Arcade Moderne Clair**.

Caracteristiques:

- Fond neutre profond, cartes claires, contrastes forts.
- Couleurs semantiques constantes (themes de questions), sans glow excessif.
- Typographie moderne lisible (sans effet pixel dominant).
- Animations courtes de statut (tour actif, resultat, progression).
- Effets "retro" en micro-accent optionnel uniquement.

## 5. Strategie mobile / PC

### Mobile

- Priorite au flux vertical, CTA pleine largeur, infos progressives.
- Plateau simplifie en vue etapes/chapitres, carte detail au tap.
- Bandeau sticky "A toi de jouer / Action attendue".

### Desktop

- Espace split: aire de jeu + panneau contexte.
- Plus de meta-infos visibles en simultane.
- Navigation rapide entre joueurs, log, legende.

## 6. Proposition de refonte plateau

Recommandation P3: passer a un **plateau hybride etapes + noeuds**.

- Niveau 1 (global): parcours lineaire de manches et zones (Comprendre, Ameliorer, Frictions, Vision, Bonus).
- Niveau 2 (local): micro-noeuds contextuels affiches seulement pendant l'action du tour.
- Benefits:
  - lecture immediate sur mobile,
  - reduction du bruit,
  - maintien du sentiment de progression.

## 7. Plan d'action priorise

### P3-A (quick wins)

- Simplifier la hierarchie visuelle de `GameScreen`.
- Introduire un mode "UI moderne" (feature flag style) pour migrer sans casse.
- Renforcer les feedbacks "tour actif / action attendue / derniere action".

### P3-B (structurant)

- Refaire le shell de partie: header statut + zone centrale + panneau secondaire adaptatif.
- Repenser lobby host: checklist de lancement + statut joueurs.
- Refaire ecran resultats avec narration de fin.

### P3-C (plateau v2)

- Introduire composant `BoardV2` hybride.
- Mapping des regles existantes sur la nouvelle vue (sans changer logique serveur).
- Fallback temporaire sur plateau legacy via feature flag.

### P3-D (finalisation)

- QA mobile/desktop (host + joueur actif/passif).
- Ajustements de rythme (timings overlays, transitions, temps morts).
- Stabilisation et retrait progressif des styles legacy.

## 8. Zones/fichiers a modifier (ordre recommande)

- Fondations:
  - `src/index.css`
  - `src/lib/uiTokens.ts`
  - `src/i18n/fr.ts`
- Shell et flux:
  - `src/components/screens/GameScreen.tsx`
  - `src/components/screens/OnlineLobbyScreen.tsx`
  - `src/components/screens/ResultsScreen.tsx`
  - `src/pages/Home.tsx`
- Plateau:
  - `src/components/game/GameBoard.tsx` (transition)
  - `src/components/game/BoardV2.tsx` (nouveau)
- Etats et instrumentation:
  - `src/pages/Index.tsx`
  - `src/lib/perf.ts`

## 9. Premiers changements concrets proposes

1. Creer un **flag de direction visuelle** (legacy vs modern) pour migrer ecran par ecran.
2. Refaire `GameScreen` en layout 3 zones (Action / Contexte / Feed) avec CTA unique.
3. Refondre `OnlineLobbyScreen` version host-first (readiness, blocages, lancement guide).
4. Introduire `BoardV2` en parallele du plateau legacy.

## 10. Plan de refonte technique (React vs Pixi)

### Separation stricte des responsabilites

- React (app shell): auth, home, onboarding, lobby, prepare, template editor, modales globales, navigation.
- Pixi (in-game): rendu plateau, actions contextuelles du tour, feedback visuel de lancer, badges in-canvas, animations courtes.

### Architecture cible des dossiers

```text
src/
  components/
    app-shell/              # UI applicative reusable (hors partie)
      PrimaryButton.tsx
      SecondaryButton.tsx
      Card.tsx
      Modal.tsx
      Input.tsx
      AuthLayout.tsx
      LobbyCard.tsx
      SectionHeader.tsx
    game/
      pixi-ui/              # Primitives UI Pixi homogenes
        theme.ts
        GamePanel.ts
        GameButton.ts
        DiceResultCard.ts
      PixiBoardCanvas.tsx
      GameBoardPixi.tsx
  lib/
    uiTokens.ts             # Tokens centralises app shell + conventions de surface
```

### Migration etape par etape

1. Fondations: tokens centralises et composants app-shell.
2. Ecrans hors partie: migration Home + Lobby vers app-shell.
3. In-game: factorisation de l'overlay action Pixi en primitives reusables.
4. HUD/UX: harmonisation des etats de tour et des CTA prioritaires.
5. Nettoyage: suppression progressive des styles redondants, conservation des feature flags.
