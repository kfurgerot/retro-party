# UI Style Guide (P2)

Ce guide fixe les regles de base pour les surfaces "neon" afin de garder une interface lisible, coherente et retro sur tout le produit.

## Design Tokens

Source unique des tokens:

- Surfaces: `src/index.css`
- CTA: `src/lib/uiTokens.ts`

Tokens CTA disponibles:

- `CTA_NEON_PRIMARY`
- `CTA_NEON_SECONDARY`
- `CTA_NEON_SECONDARY_SUBTLE`
- `CTA_NEON_DANGER`

Regle:

- Ne plus redefinir localement des constantes `activeCyanBtn` / `neutralSecondaryBtn` / `dangerBtn` si le token existe deja.

## Classes globales

Ces classes sont definies dans `src/index.css`:

- `neon-card`
- `neon-surface`
- `neon-surface-soft`

## Quand utiliser chaque classe

- `neon-card`
  - Pour les cartes principales interactives (stats, blocs de controle, cartes fixes visibles en premier plan).
  - Exemple: panneaux d'etat dans `GameScreen`.

- `neon-surface`
  - Pour les conteneurs de section et les panneaux structurants (lobby, sections de formulaire, listes).
  - Exemple: sections dans `OnlineLobbyScreen` et `Prepare`.

- `neon-surface-soft`
  - Pour les conteneurs secondaires, regroupements de meta infos, barres de contexte.
  - Exemple: bandeau de stats ou wrappers de niveau 2.

## Regles d'usage

- Ne pas recreer localement des classes utilitaires equivalentes si une classe neon existe deja.
- Garder une seule couche de "surface" dominante par zone:
  - un parent `neon-surface`, enfants en `neon-card` ou styles legers.
- Eviter de superposer plusieurs ombres fortes sur le meme bloc.
- Sur mobile, preferer:
  - textes courts,
  - densite reduite,
  - listes scrollables avec `max-h-*` + `overflow-auto`.
- Utiliser en priorite les tokens CTA partages de `src/lib/uiTokens.ts`.

## Exemples rapides

```tsx
<section className="neon-surface p-4 sm:p-5">
  <Card className="neon-card px-3 py-2">...</Card>
</section>
```

```tsx
<div className="neon-surface-soft p-2">...</div>
```

```tsx
import { CTA_NEON_PRIMARY, CTA_NEON_SECONDARY } from "@/lib/uiTokens";

<Button className={CTA_NEON_PRIMARY}>Action principale</Button>
<Button className={CTA_NEON_SECONDARY}>Action secondaire</Button>
```

## A eviter

- Duplicer des constantes de type `const neonPanel = "...shadow..."` dans chaque ecran.
- Duplicer des constantes de type `const activeCyanBtn = "...";` dans chaque ecran.
- Melanger des styles neon custom incompatibles entre ecrans (ombres, opacites, bordures).
- Ajouter des variations de couleur arbitraires sans raison UX claire.
