---
title: "Product Brief: retro-party-dev"
status: "complete"
created: "2026-04-13T14:31:16+02:00"
updated: "2026-04-13T14:31:16+02:00"
inputs:
  - README.md
  - package.json
  - src/App.tsx
  - src/pages/Home.tsx
  - src/pages/PlanningPoker.tsx
  - src/pages/RadarParty.tsx
  - server/index.js
  - server/restApi.js
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/ux-wireframes-ecrans-critiques.md
  - _bmad-output/planning-artifacts/ux-prototype-interactif-plan.md
---

# Product Brief: AgileSuite

## Résumé Exécutif

AgileSuite est une suite tout-en-un pour animer les rituels Agile d’équipe avec une expérience plus engageante, plus fluide et plus utile que les outils fragmentés.  
Le produit rassemble dans un seul environnement trois modules complémentaires: **Retro Party**, **Planning Poker** et **Radar Agile**.

Le problème adressé est simple: les équipes Agile jonglent entre plusieurs outils, perdent du temps en setup, et vivent des cérémonies parfois mécaniques et peu engageantes. AgileSuite réduit cette friction avec un parcours unifié de création/rejoindre/lobby/lancement, une expérience temps réel robuste, et des formats orientés action.

Notre ambition V1 est de devenir l’outil de référence des **Scrum Masters** et **Agile Coaches** pour lancer des sessions rapides, faire participer les équipes, et transformer les rituels en moments à valeur ajoutée.

## Le Problème

Aujourd’hui, un facilitateur Agile doit souvent composer avec un patchwork d’outils (board, rétro, estimation, diagnostic). Cela crée:

- une charge cognitive élevée avant même de commencer la session,
- des pertes de temps (setup, invitations, transitions entre outils),
- une baisse d’engagement des participants,
- une difficulté à maintenir une dynamique de groupe cohérente.

Le coût du statu quo n’est pas seulement opérationnel: des rituels moins fluides produisent moins d’alignement, moins d’apprentissage d’équipe et moins de valeur décisionnelle.

## La Solution

AgileSuite propose une expérience unifiée de facilitation Agile:

- **Retro Party**: rétrospective multijoueur orientée engagement.
- **Planning Poker**: estimation collaborative rapide en temps réel.
- **Radar Agile**: diagnostic individuel et équipe avec restitution visuelle et insights.

Le design produit met l’accent sur:

- un flux d’entrée court (create/join/resume),
- un lobby lisible avec états explicites (participants, rôle host, action suivante),
- des interactions temps réel robustes (reconnexion, sessions persistées, feedback immédiat),
- une cohérence UX inter-modules.

## Ce Qui Nous Différencie

- **All-in-one Agile rituals**: un seul produit au lieu d’un assemblage d’outils.
- **Expérience orientée facilitation**: priorité à la mise en session et au lancement sans friction.
- **Gamification utile**: engagement et énergie d’équipe sans sacrifier la lisibilité.
- **Complémentarité des modules**: rétro + estimation + diagnostic dans une même logique.

Notre avantage n’est pas un “moat technique” isolé, mais la combinaison: **expérience unifiée + rapidité d’exécution + cohérence produit**.

## Cibles Prioritaires

### Cible primaire

- **Scrum Masters**
- **Agile Coaches**

### Cible secondaire

- Équipes produit/tech participantes des cérémonies.
- Leads qui souhaitent objectiver l’état d’équipe (Radar).

## Critères de Succès (V1)

Objectif principal: améliorer l’engagement par une expérience de rituel fluide et rapide.

KPIs de pilotage:

1. **Temps “entrée -> lobby prêt” < 30 secondes**.
2. **Taux de session lancée après création de room > 80%**.
3. **Satisfaction facilitateur >= 4/5** (après session).

Signaux complémentaires:

- taux de retour des facilitateurs (usage récurrent),
- participation complète aux sessions Radar/Retro,
- réduction des abandons en phase onboarding/lobby.

## Scope Produit V1

### In Scope

- Hub unique d’accès aux modules.
- Retro Party (temps réel).
- Planning Poker (temps réel).
- Radar Agile (questionnaire + insights individuels/équipe).
- Parcours unifiés create/join/lobby/start.
- Expérience responsive desktop/mobile.

### Out of Scope (V1)

- Intégrations avancées (Jira/Slack/SSO).
- Monétisation payante (positionnement initial **free**).
- Fonctionnalités enterprise avancées (gouvernance org, conformité avancée).

## Modèle d’Adoption

Le produit est **free** en V1 pour maximiser l’adoption et la répétition d’usage sur les rituels d’équipe.

Hypothèse clé:

- La valeur perçue en session (rapidité + engagement + clarté) crée naturellement la récurrence.

Approche de traction:

- focus sur les facilitateurs (Scrum Masters/Coaches),
- onboarding simple orienté “première session en quelques minutes”,
- preuve de valeur immédiate via les 3 modules.

## Risques Principaux et Réponse Produit

- **Risque 1: faible différenciation perçue** face aux outils existants.  
  Réponse: insister sur la promesse tout-en-un et l’expérience unifiée.

- **Risque 2: friction temps réel** (connexion, reconnexion, rôles).  
  Réponse: fiabilité lobby/session comme priorité de qualité.

- **Risque 3: dispersion du scope** sur 3 modules.  
  Réponse: priorisation stricte des parcours critiques communs avant enrichissements.

## Vision (24-36 mois)

Si V1 réussit, AgileSuite devient la couche de facilitation Agile de référence:

- un cockpit de rituels d’équipe dans un seul produit,
- des insights transverses entre rétrospectives, estimations et diagnostics,
- une expérience de cérémonie continue, cohérente et mesurable.

La trajectoire long terme est de passer d’un outil de session à un **système d’amélioration continue d’équipe**.

