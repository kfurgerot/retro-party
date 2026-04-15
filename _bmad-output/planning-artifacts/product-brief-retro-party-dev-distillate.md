---
title: "Product Brief Distillate: retro-party-dev"
type: llm-distillate
source: "product-brief-retro-party-dev.md"
created: "2026-04-13T14:35:43+02:00"
purpose: "Token-efficient context for downstream PRD creation"
---

# Distillate PRD - AgileSuite

## Résumé exécutable

- Produit ciblé: suite Agile complète, pas module isolé.
- MVP validé: Retro Party + Radar Agile + Planning Poker.
- Cible primaire validée: Scrum Masters et Agile Coaches.
- Objectif produit V1: engagement d'équipe via une expérience de rituel fluide, rapide, actionnable.
- Modèle validé V1: free.

## Hypothèses produit à préserver

- La valeur principale vient de l'unification des rituels, pas d'une feature unique.
- Le gain perçu le plus fort est la réduction de friction avant lancement de session.
- La récurrence d'usage dépend de la qualité du flux create/join/lobby/start.
- L'engagement est amélioré si l'expérience reste lisible malgré la couche gamifiée.

## Requirements hints (pré-PRD)

- Parcours unique cross-modules: create/join/resume avec conventions homogènes.
- Lobby-first UX: état session, rôle host, participants, action suivante toujours visibles.
- Temps réel fiable: reconnexion, reprise de session, feedback présence.
- Responsiveness stricte: desktop facilitateur + mobile participant.
- Accessibilité minimale: WCAG AA, focus visible, erreurs actionnables.
- Instrumentation produit: événements d'entrée module, lancement session, abandon pré-lobby, complétion.

## Indicateurs de succès à transformer en exigences PRD

- KPI 1: temps "entrée -> lobby prêt" < 30 secondes.
- KPI 2: taux de session lancée après création room > 80%.
- KPI 3: satisfaction facilitateur >= 4/5.
- Mesures complémentaires: taux de retour facilitateur, completion des sessions, churn pré-lancement.

## Scope signals

- In scope V1:
- Hub unique AgileSuite.
- Retro Party, Planning Poker, Radar Agile en version exploitable.
- Parcours unifiés create/join/lobby/start.
- Out of scope V1:
- Intégrations avancées (Jira, Slack, SSO).
- Monétisation payante.
- Fonctions enterprise avancées (gouvernance org, conformité étendue).

## Rejected ideas / décisions négatives (à ne pas reproposer)

- Ne pas limiter le brief à un module unique.
- Ne pas lancer V1 en modèle payant.
- Ne pas inclure les intégrations avancées dans la première release.
- Ne pas privilégier un enrichissement visuel au détriment de la lisibilité opérationnelle.

## Contexte UX déjà produit (réutilisable PRD)

- Artefact UX principal: `ux-design-specification.md` (vision, parcours, patterns, stratégie composants).
- Wireframes critiques: `ux-wireframes-ecrans-critiques.md` (desktop/mobile, états, mapping code).
- Plan prototype: `ux-prototype-interactif-plan.md` (frames, interactions, transitions, tests).
- Décisions UX clés: typographie sobre, densité aérée, accessibilité yes/AA.

## Contexte technique utile pour cadrage PRD

- Stack front: React + TypeScript + Vite + Tailwind + Radix/shadcn.
- Realtime: Socket.IO client/serveur, logique autoritaire serveur.
- Backend: Node/Express + Postgres.
- Déploiement: Docker Compose (frontend/backend/postgres) + Nginx.
- Sécurité auth en place: session cookie HttpOnly/SameSite, rate limits, reset password, SQL paramétré.
- Module Radar déjà doté d'API session/participants/progress/submission/team results.
- Limites runtime déjà présentes: rooms max joueurs = 20.

## Scénarios utilisateur détaillés (capture conversation + code)

- Facilitateur:
- entre dans Hub -> choisit module -> crée session -> invite équipe -> lance au bon moment.
- Participant:
- rejoint via code/lien -> onboarding minimal pseudo/avatar -> attend signal lancement -> entre en session.
- Radar:
- host crée session -> participants répondent -> restitution individuelle + équipe -> discussion d'axes prioritaires.

## Intelligence concurrentielle minimale (à approfondir en PRD)

- Parabol couvre déjà retrospectives + sprint poker + templates + intégrations.
- Outils de rétro/atelier (EasyRetro, Ludi ex-Metro Retro) positionnent fortement l'engagement remote.
- Opportunité AgileSuite: différenciation par "all-in-one rituals + expérience unifiée + radar diagnostic".
- Risque marché principal: être perçu comme "encore un outil de plus" sans promesse claire d'unification.

## Risques produit prioritaires

- Risque de différenciation faible face aux outils établis.
- Risque d'échec d'adoption si friction entrée/session reste élevée.
- Risque de dispersion du focus produit avec 3 modules simultanés.
- Risque économique du modèle free sans stratégie de soutenabilité post-adoption.

## Questions ouvertes à résoudre en PRD

- Quelle promesse marketing exacte en une phrase (positionnement final)?
- Quel canal d'acquisition initial le plus crédible (communautés Agile, bouche-à-oreille, contenu)?
- Quelle définition opérationnelle de "session lancée" et "lobby prêt" pour KPI instrumentation?
- Quelle fréquence cible d'usage par équipe (hebdo, bi-hebdo) pour qualifier la rétention?
- Quel plan de monétisation ultérieur sans casser l'adoption initiale free?
- Quelles limites V1 explicites par module (profondeur fonctionnelle minimale acceptable)?

