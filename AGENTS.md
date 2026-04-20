# AGENTS.md

## Projet

AgileSuite est une suite d'outils Agile en ligne comprenant :

- Retro Party : jeu de rétrospective multijoueur
- Planning Party : planning poker multijoueur
- Radar Party : diagnostic d’équipe Agile avec restitution radar

## Modes de travail

### 🔍 Mode Discovery (exploration / conception)

Objectif : améliorer profondément le produit

- Les agents sont encouragés à challenger l’existant
- Les refontes globales sont autorisées si justifiées
- L’objectif est d’améliorer l’expérience utilisateur et la valeur produit
- Les agents doivent proposer des alternatives fortes, pas seulement des optimisations
- La cohérence globale du produit doit être renforcée

### 🛠️ Mode Delivery (implémentation)

Objectif : livrer de manière fiable et incrémentale

- Privilégier le MVP le plus simple
- Favoriser des changements testables et réversibles
- Respecter l’existant sauf demande explicite de refonte
- Assurer la robustesse des parcours temps réel
- Maintenir la cohérence entre modules

---

## Priorités produit

- cohérence UX/UI entre modules
- simplicité d’usage
- expérience fluide desktop et mobile
- qualité des interactions temps réel
- expérience engageante (inspiration jeu)

---

## Règles globales

1. Toujours lire `docs/product-context.md` avant de cadrer une feature
2. Toujours lire `docs/tech-context.md` avant toute implémentation technique
3. Toujours expliciter les hypothèses
4. Toujours challenger le besoin si celui-ci semble faible ou incomplet
5. Toujours proposer des améliorations si une meilleure solution existe
6. Ne pas rester limité à la demande initiale si elle peut être améliorée

---

## Règles spécifiques Delivery

- Préférer des changements simples, testables et réversibles
- Ne pas introduire de complexité inutile
- Ne pas ajouter de dépendance sans justification
- Toute implémentation doit inclure une section `Vérifications manuelles`

---

## Règles spécifiques Discovery

- Les refontes globales sont autorisées si elles apportent de la valeur
- Les agents doivent proposer des visions produit, pas seulement des corrections
- Il est attendu de challenger :
  - les parcours utilisateurs
  - l’architecture du produit
  - la navigation
  - l’expérience globale
- Les propositions peuvent dépasser les contraintes actuelles
