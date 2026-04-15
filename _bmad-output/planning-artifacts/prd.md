---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-retro-party-dev.md
  - _bmad-output/planning-artifacts/product-brief-retro-party-dev-distillate.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/ux-wireframes-ecrans-critiques.md
  - _bmad-output/planning-artifacts/ux-prototype-interactif-plan.md
  - _bmad-output/project-context.md
  - README.md
  - src/pages/Home.tsx
  - src/pages/PlanningPoker.tsx
  - src/pages/RadarParty.tsx
  - server/index.js
  - server/restApi.js
workflowType: "prd"
status: "complete"
---

# Product Requirements Document - AgileSuite V1

**Auteur:** Karl FURGEROT  
**Date:** 2026-04-13

## 1. Executive Summary

AgileSuite V1 est une suite tout-en-un pour les rituels Agile, composée de trois modules: **Retro Party**, **Planning Poker** et **Radar Agile**.  
L’objectif produit est d’augmenter l’engagement des équipes Agile en réduisant la friction de facilitation et en offrant une expérience fluide, rapide et utile sur desktop et mobile.

La stratégie V1 est:

- unifier les parcours d’entrée et de session (`create/join/resume`, onboarding, lobby, lancement),
- fiabiliser l’expérience temps réel (présence, reconnexion, reprise),
- concentrer la valeur sur les facilitateurs (Scrum Masters, Agile Coaches),
- lancer en **free** pour maximiser l’adoption.

## 2. Problème Produit

Les équipes Agile utilisent souvent plusieurs outils non intégrés pour animer les cérémonies.  
Conséquences:

- perte de temps en setup et transitions,
- charge cognitive forte pour le facilitateur,
- baisse d’engagement des participants,
- difficulté à maintenir une dynamique collective continue.

AgileSuite doit résoudre ce problème avec un flux unifié et des interactions temps réel robustes.

## 3. Vision et Positionnement

### Vision V1

Permettre aux équipes Agile de lancer et animer leurs rituels dans un environnement unique, engageant et actionnable.

### Positionnement

**AgileSuite = outil tout-en-un des rituels Agile**:

- rétro,
- estimation,
- diagnostic d’équipe.

## 4. Objectifs et Non-Objectifs

### Objectifs V1

1. Réduire le temps entre l’intention de session et un lobby prêt.
2. Augmenter le taux de sessions effectivement lancées.
3. Améliorer la satisfaction facilitateur.
4. Offrir une cohérence UX inter-modules sans refonte technique majeure.

### Non-Objectifs V1

1. Intégrations avancées (Jira, Slack, SSO).
2. Fonctionnalités enterprise étendues (gouvernance org, conformité avancée).
3. Monétisation payante en V1.

## 5. Personas et Cibles

### Persona primaire: Facilitateur Agile

- Rôles: Scrum Master, Agile Coach.
- Besoin: lancer rapidement une session, garder le contrôle, obtenir un résultat utile.
- Frustration actuelle: outils fragmentés, perte de rythme, faible participation.

### Persona secondaire: Participant d’équipe Agile

- Besoin: rejoindre vite, comprendre quoi faire, participer sans friction.
- Frustration actuelle: onboarding confus, état session peu clair, transitions cassées.

## 6. Succès Produit (KPIs)

### KPIs principaux V1

1. **Temps entrée -> lobby prêt**: < 30 secondes.
2. **Taux de session lancée après création de room**: > 80%.
3. **Satisfaction facilitateur post-session**: >= 4/5.

### Signaux complémentaires

- taux de retour des facilitateurs,
- taux de complétion des sessions (module dépendant),
- taux d’abandon avant lancement.

## 7. Scope V1

### In Scope

- Hub d’entrée unifié AgileSuite.
- Parcours `create/join/resume`.
- Onboarding profil simple (nom/avatar).
- Lobby unifié avec états host/participant.
- Lancement de session:
  - Retro Party,
  - Planning Poker,
  - Radar Agile.
- Restitution Radar individuelle et équipe.
- Compatibilité desktop/mobile.

### Out of Scope

- Intégrations externes avancées.
- Gestion multi-organisation enterprise.
- Billing/paywall.

## 8. Parcours Utilisateur Cibles

### J1 - Facilitateur: créer et lancer

1. Ouvrir AgileSuite.
2. Choisir un module.
3. Créer une session.
4. Inviter l’équipe (code/lien).
5. Vérifier l’état de présence.
6. Lancer l’activité.

### J2 - Participant: rejoindre

1. Ouvrir via lien ou code.
2. Compléter pseudo/avatar.
3. Voir l’état de session et l’hôte.
4. Attendre ou basculer automatiquement sur l’activité.

### J3 - Radar Agile: diagnostiquer et restituer

1. Host crée session Radar.
2. Participants répondent au questionnaire.
3. Résultat individuel disponible.
4. Vue équipe consolidée.
5. Discussion atelier guidée sur axes prioritaires.

## 9. Exigences Fonctionnelles

## 9.1 Hub et Navigation

- `FR-001` Le système doit afficher les 3 modules dans un hub unique.
- `FR-002` Le système doit permettre les intentions `Créer`, `Rejoindre`, `Reprendre`.
- `FR-003` Le système doit mémoriser la dernière session par module (code + profil) pour `Reprendre`.
- `FR-004` Le système doit conserver des conventions UI cohérentes inter-modules (header, step, action bar).

## 9.2 Gestion Session (Transverse)

- `FR-010` Le système doit permettre création de room et génération de code unique.
- `FR-011` Le système doit permettre rejoindre une room via code ou lien.
- `FR-012` Le système doit gérer les rôles host/participant.
- `FR-013` Le système doit afficher un lobby avec présence et statut de connexion.
- `FR-014` Le système doit supporter reconnexion avec reprise de session via sessionId.
- `FR-015` Le système doit limiter la capacité d’une room à 20 participants.
- `FR-016` Le système doit empêcher le lancement par un non-host.

## 9.3 Retro Party

- `FR-020` Le module Retro doit permettre démarrage de partie depuis lobby.
- `FR-021` La logique de partie online doit rester autoritaire côté serveur.
- `FR-022` Le module doit supporter les interactions temps réel principales de partie.

## 9.4 Planning Poker

- `FR-030` Le module doit permettre création/join de table poker.
- `FR-031` Le host doit pouvoir démarrer une session d’estimation.
- `FR-032` Le module doit supporter vote, reveal, reset, et gestion de story title.
- `FR-033` Le module doit gérer rôle joueur/spectateur.

## 9.5 Radar Agile

- `FR-040` Le module doit exposer le questionnaire Radar.
- `FR-041` Le host doit pouvoir créer une session et définir la participation host.
- `FR-042` Les participants doivent pouvoir soumettre leurs réponses.
- `FR-043` Le système doit calculer radar individuel + insights individuels.
- `FR-044` Le système doit calculer radar équipe + insights équipe.
- `FR-045` Le système doit exposer une vue progression des participants pour le host.

## 9.6 Auth et Templates

- `FR-050` Le système doit fournir auth register/login/logout/me.
- `FR-051` Le système doit permettre reset password par email.
- `FR-052` Le système doit permettre création et gestion de templates.
- `FR-053` Le système doit permettre lancement de room depuis template.

## 9.7 Instrumentation Produit

- `FR-060` Le système doit tracer les événements clés: vue hub, sélection module, action primaire, complétion session.
- `FR-061` Le système doit permettre calcul des KPI V1 avec ces événements.

## 10. Exigences Non Fonctionnelles

### Performance & Fluidité

- `NFR-001` Les écrans critiques doivent rester fluides sur desktop et mobile modernes.
- `NFR-002` Le parcours entrée -> lobby doit être optimisé pour une exécution rapide.

### Fiabilité Temps Réel

- `NFR-010` Les mises à jour de lobby/session doivent être cohérentes pour tous les participants.
- `NFR-011` La reconnexion doit restaurer le contexte session de manière fiable.

### Sécurité

- `NFR-020` Sessions auth avec cookie HttpOnly + SameSite.
- `NFR-021` Validation stricte des payloads API.
- `NFR-022` Requêtes SQL paramétrées uniquement.
- `NFR-023` Rate limits API/auth maintenus.

### Accessibilité

- `NFR-030` Cible minimale WCAG AA sur les écrans critiques.
- `NFR-031` Navigation clavier et focus visible sur parcours create/join/lobby/start.
- `NFR-032` Messages d’erreur actionnables et non dépendants de la couleur seule.

### Compatibilité

- `NFR-040` Support desktop + mobile.
- `NFR-041` Compatibilité exécution locale via Docker Compose.

### Observabilité

- `NFR-050` Logs erreurs backend exploitables pour diagnostic.
- `NFR-051` Événements analytics suffisants pour pilotage produit.

## 11. Contraintes et Dépendances

- Stack technique existante à conserver (React/TS/Vite + Node/Express + Socket.IO + Postgres).
- Règles de robustesse temps réel et sécurité définies dans `_bmad-output/project-context.md`.
- Aucune dépendance additionnelle majeure sans justification explicite.
- Livraison compatible avec architecture Docker/Nginx existante.

## 12. Risques et Mitigations

- `R-01` Différenciation insuffisante face à des outils spécialisés.
  - Mitigation: renforcer la promesse “tout-en-un” et la cohérence inter-modules.
- `R-02` Friction persistante dans onboarding/lobby.
  - Mitigation: priorité produit absolue sur le parcours critique.
- `R-03` Dispersion roadmap due à 3 modules.
  - Mitigation: prioriser d’abord les briques transverses (hub/session/lobby/analytics).
- `R-04` Modèle free sans plan post-adoption.
  - Mitigation: formaliser une stratégie de monétisation post-V1 hors périmètre implémentation V1.

## 13. Plan de Release (V1)

### Phase 1 - Fondations d’expérience

- Hub unifié.
- Parcours create/join/resume harmonisés.
- Onboarding et lobby cohérents.

### Phase 2 - Robustesse runtime

- Reconnexion/reprise durcies.
- États host/participant clarifiés.
- Instrumentation KPI active.

### Phase 3 - Consolidation module

- Stabilisation Retro Party.
- Stabilisation Planning Poker.
- Stabilisation Radar Agile (progress + restitution).

## 14. Critères d’Acceptation Globaux

1. Les 3 modules sont accessibles depuis un hub unique.
2. Les parcours create/join/resume sont opérationnels sur desktop et mobile.
3. Le host peut lancer une session depuis un lobby lisible.
4. Un participant peut rejoindre et reprendre une session sans réinitialisation manuelle.
5. Les KPI V1 sont mesurables via analytics.
6. Les exigences sécurité de base sont respectées.

## 15. Questions Ouvertes (post-PRD)

1. Canal d’acquisition V1 le plus efficace pour Scrum Masters/Coaches.
2. Définition exacte des seuils KPI et fenêtres de mesure.
3. Stratégie de monétisation post-V1 (freemium/team plan) sans casser l’adoption.
4. Priorisation des futures intégrations externes.

