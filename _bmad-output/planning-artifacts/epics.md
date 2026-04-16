---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# retro-party-dev - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for retro-party-dev, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: [FR-001] Le système doit afficher les 3 modules dans un hub unique.
FR2: [FR-002] Le système doit permettre les intentions `Créer`, `Rejoindre`, `Reprendre`.
FR3: [FR-003] Le système doit mémoriser la dernière session par module (code + profil) pour `Reprendre`.
FR4: [FR-004] Le système doit conserver des conventions UI cohérentes inter-modules (header, step, action bar).
FR5: [FR-010] Le système doit permettre création de room et génération de code unique.
FR6: [FR-011] Le système doit permettre rejoindre une room via code ou lien.
FR7: [FR-012] Le système doit gérer les rôles host/participant.
FR8: [FR-013] Le système doit afficher un lobby avec présence et statut de connexion.
FR9: [FR-014] Le système doit supporter reconnexion avec reprise de session via sessionId.
FR10: [FR-015] Le système doit limiter la capacité d’une room à 20 participants.
FR11: [FR-016] Le système doit empêcher le lancement par un non-host.
FR12: [FR-020] Le module Retro doit permettre démarrage de partie depuis lobby.
FR13: [FR-021] La logique de partie online doit rester autoritaire côté serveur.
FR14: [FR-022] Le module doit supporter les interactions temps réel principales de partie.
FR15: [FR-030] Le module doit permettre création/join de table poker.
FR16: [FR-031] Le host doit pouvoir démarrer une session d’estimation.
FR17: [FR-032] Le module doit supporter vote, reveal, reset, et gestion de story title.
FR18: [FR-033] Le module doit gérer rôle joueur/spectateur.
FR19: [FR-040] Le module doit exposer le questionnaire Radar.
FR20: [FR-041] Le host doit pouvoir créer une session et définir la participation host.
FR21: [FR-042] Les participants doivent pouvoir soumettre leurs réponses.
FR22: [FR-043] Le système doit calculer radar individuel + insights individuels.
FR23: [FR-044] Le système doit calculer radar équipe + insights équipe.
FR24: [FR-045] Le système doit exposer une vue progression des participants pour le host.
FR25: [FR-050] Le système doit fournir auth register/login/logout/me.
FR26: [FR-051] Le système doit permettre reset password par email.
FR27: [FR-052] Le système doit permettre création et gestion de templates.
FR28: [FR-053] Le système doit permettre lancement de room depuis template.
FR29: [FR-060] Le système doit tracer les événements clés: vue hub, sélection module, action primaire, complétion session.
FR30: [FR-061] Le système doit permettre calcul des KPI V1 avec ces événements.

### NonFunctional Requirements

NFR1: [NFR-001] Les écrans critiques doivent rester fluides sur desktop et mobile modernes.
NFR2: [NFR-002] Le parcours entrée -> lobby doit être optimisé pour une exécution rapide.
NFR3: [NFR-010] Les mises à jour de lobby/session doivent être cohérentes pour tous les participants.
NFR4: [NFR-011] La reconnexion doit restaurer le contexte session de manière fiable.
NFR5: [NFR-020] Sessions auth avec cookie HttpOnly + SameSite.
NFR6: [NFR-021] Validation stricte des payloads API.
NFR7: [NFR-022] Requêtes SQL paramétrées uniquement.
NFR8: [NFR-023] Rate limits API/auth maintenus.
NFR9: [NFR-030] Cible minimale WCAG AA sur les écrans critiques.
NFR10: [NFR-031] Navigation clavier et focus visible sur parcours create/join/lobby/start.
NFR11: [NFR-032] Messages d’erreur actionnables et non dépendants de la couleur seule.
NFR12: [NFR-040] Support desktop + mobile.
NFR13: [NFR-041] Compatibilité exécution locale via Docker Compose.
NFR14: [NFR-050] Logs erreurs backend exploitables pour diagnostic.
NFR15: [NFR-051] Événements analytics suffisants pour pilotage produit.

### Additional Requirements

- Starter template/baseline explicitement retenu: continuité Vite + React + TypeScript; pas de migration de framework en V1.
- Référence de bootstrap si recréation front isolée: `npm create vite@latest agilesuite-frontend -- --template react-ts`.
- Architecture cible à préserver: monolithe modulaire (frontend SPA + backend API/realtime unique).
- Contrat runtime obligatoire: serveur autoritaire sur état session/partie; client non autoritaire.
- Communication hybride obligatoire: REST pour opérations déterministes + Socket.IO pour synchro collaborative temps réel.
- Base de données cible: PostgreSQL 16.x avec schéma relationnel unique organisé par domaines (auth/session/modules/analytics).
- Auth/session obligatoire: cookie HttpOnly + SameSite=Lax (+ Secure en prod), autorisation par rôles (`host`, `participant`, `spectator` selon module).
- Validation stricte payloads API/socket et standard d’erreur JSON uniforme `{ error, code, details? }`.
- Nommage d’événements socket à standardiser par domaine: `session:*`, `retro:*`, `poker:*`, `radar:*`.
- Versioning des payloads socket à formaliser (ex: champ de version dans metadata) pour évolutivité des contrats.
- Gestion d’état frontend à conserver: React Query pour server-state + hooks de domaine pour runtime interactif.
- Création obligatoire de migrations SQL versionnées sous `server/migrations/` avec stratégie d’ordre/rollback.
- Observabilité minimale obligatoire: logs backend structurés et corrélables (request/session/room), plus instrumentation KPI de bout en bout.
- Compatibilité d’exécution à maintenir: Docker Compose local + Nginx proxy `/api` et `/socket.io`.

### UX Design Requirements

UX-DR1: Implémenter un shell UX transversal AgileSuite (navigation, header de contexte session, statuts, CTA, feedback) commun aux 3 modules.
UX-DR2: Garantir strictement une seule action primaire dominante par écran/étape sur les flux critiques.
UX-DR3: Implémenter une progression explicite Accueil -> Config -> Lobby via un composant stepper réutilisable avec étape courante visible.
UX-DR4: Maintenir en permanence la visibilité des informations critiques de session (module, rôle, état, présence, prochaine action).
UX-DR5: Implémenter `SessionStatusBar` (module badge, état session, rôle, état réseau) avec états `connecting/synced/degraded/error` et annonce des changements critiques.
UX-DR6: Implémenter `InvitePanel` (code + lien + actions copier) avec feedback immédiat et persistant court (toast + confirmation locale).
UX-DR7: Implémenter `LobbyReadinessBoard` (grille participants, capacité, indicateur readiness, seuil de lancement, CTA host).
UX-DR8: Implémenter `FlowStepperHeader` avec variantes desktop/mobile compressée et `aria-current` sur l’étape active.
UX-DR9: Implémenter `PrimaryFlowCTA` avec états `enabled/disabled-with-reason/loading/success`, raison de blocage lisible et variante sticky mobile.
UX-DR10: Implémenter `RecoveryBanner` pour `reconnecting/recovered/failed` avec action de récupération immédiate (`Réessayer`, `Rejoindre`, etc.).
UX-DR11: Standardiser les microcopies d’action et d’état host/participant pour réduire l’ambiguïté “qui peut faire quoi”.
UX-DR12: Standardiser les patterns de feedback: succès concis, warning actionnable, erreur actionnable, statuts realtime persistants.
UX-DR13: Standardiser les patterns de formulaires: progressive disclosure, validation inline contextualisée, prévention double soumission.
UX-DR14: Implémenter des états vides/chargement/erreur/recovery persistants et actionnables (pas uniquement transient).
UX-DR15: Implémenter un système de tokens thémables à 3 niveaux: global AgileSuite, accents par module, composants métier réutilisables.
UX-DR16: Appliquer la direction visuelle D8 (Hybrid Enterprise Game) comme baseline et les patterns D3 pour l’orchestration lobby.
UX-DR17: Formaliser la palette sémantique (base/surface/primary/secondary/accent/success/warning/error) et limiter la concurrence des accents sur une même zone d’action.
UX-DR18: Appliquer une hiérarchie typographique lisible et sobre (Display/H1-H3/Body/Caption), adaptée desktop/mobile.
UX-DR19: Appliquer un système d’espacement 8pt, densité aérée, regroupement fonctionnel explicite et hiérarchie d’information stable.
UX-DR20: Implémenter une stratégie responsive mobile-first avec breakpoints `sm:480`, `md:768`, `lg:1024`, `xl:1280`.
UX-DR21: En mobile, prioriser l’ordre statut -> action primaire -> détails secondaires, avec CTA sticky si pertinent.
UX-DR22: Garantir la cohérence cross-modules: même squelette UX et mêmes patterns de navigation, variations limitées aux accents visuels.
UX-DR23: Couvrir les exigences d’accessibilité WCAG 2.2 AA sur les écrans critiques.
UX-DR24: Garantir navigation clavier complète et focus visible sur create/join/lobby/launch.
UX-DR25: Garantir cibles tactiles minimum 44x44 px sur interactions principales mobile.
UX-DR26: Rendre les feedbacks indépendants de la couleur seule (texte + icône + état explicite).
UX-DR27: Rendre les états temps réel rassurants et non ambigus (arrivées joueurs, progression, disponibilité de lancement).
UX-DR28: Couvrir explicitement les cas d’erreur/recovery critiques: code invalide, serveur indisponible, attente host, reconnexion réseau.
UX-DR29: Aligner les écrans code cibles (`Home`, onboarding, lobby, `Prepare`) avec les patterns UX de la spécification.
UX-DR30: Définir et exécuter une stratégie de tests UX: audit axe/lighthouse, clavier-only, lecteurs d’écran (VoiceOver/NVDA), tests devices iOS Safari + Android Chrome.

### FR Coverage Map

FR-001: Epic 1 - Entrée en session unifiée et hub unique.
FR-002: Epic 1 - Intentions créer/rejoindre/reprendre.
FR-003: Epic 1 - Reprise de session mémorisée.
FR-004: Epic 1 - Cohérence UI inter-modules.
FR-010: Epic 1 - Création room + code unique.
FR-011: Epic 1 - Join via code/lien.
FR-012: Epic 1 - Rôles host/participant.
FR-013: Epic 1 - Lobby présence/statut.
FR-014: Epic 1 - Reconnexion et reprise.
FR-015: Epic 1 - Limite de capacité room à 20.
FR-016: Epic 1 - Blocage lancement par non-host.
FR-020: Epic 2 - Démarrage Retro depuis lobby.
FR-021: Epic 2 - Autorité serveur de la logique Retro.
FR-022: Epic 2 - Interactions temps réel Retro.
FR-030: Epic 3 - Création/join table Planning Poker.
FR-031: Epic 3 - Démarrage session d'estimation par host.
FR-032: Epic 3 - Vote/reveal/reset/story title.
FR-033: Epic 3 - Rôle joueur/spectateur.
FR-040: Epic 4 - Questionnaire Radar.
FR-041: Epic 4 - Session Radar + hostParticipates.
FR-042: Epic 4 - Soumission des réponses.
FR-043: Epic 4 - Radar individuel + insights.
FR-044: Epic 4 - Radar équipe + insights.
FR-045: Epic 4 - Progression participants pour host.
FR-050: Epic 5 - Register/login/logout/me.
FR-051: Epic 5 - Reset password par email.
FR-052: Epic 5 - Création/gestion templates.
FR-053: Epic 5 - Lancement room depuis template.
FR-060: Epic 5 - Traçage événements clés produit.
FR-061: Epic 5 - Calcul KPI V1.

## Epic List

### Epic 1: Entrée en session unifiée et lobby prêt au lancement
Facilitateur et participants peuvent créer/rejoindre/reprendre une session, voir l'état du groupe, et lancer sans ambiguïté de rôle.
**FRs covered:** FR-001, FR-002, FR-003, FR-004, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016

### Epic 2: Retro Party multijoueur fiable
Une équipe peut démarrer et jouer une rétro en temps réel avec autorité serveur et cohérence d'état.
**FRs covered:** FR-020, FR-021, FR-022

### Epic 3: Planning Poker complet et fluide
Une équipe peut estimer (vote/reveal/reset/story title) avec rôles clairs joueur/spectateur.
**FRs covered:** FR-030, FR-031, FR-032, FR-033

### Epic 4: Radar Party de bout en bout
Une équipe peut répondre au questionnaire, obtenir résultats individuels et restitution équipe actionnable.
**FRs covered:** FR-040, FR-041, FR-042, FR-043, FR-044, FR-045

### Epic 5: Facilitation durable (comptes, templates, pilotage KPI)
Le facilitateur sécurise son usage (auth), industrialise ses ateliers (templates) et mesure la valeur (analytics KPI).
**FRs covered:** FR-050, FR-051, FR-052, FR-053, FR-060, FR-061

## Epic 1: Entrée en session unifiée et lobby prêt au lancement

Facilitateur et participants peuvent créer/rejoindre/reprendre une session, voir l'état du groupe, et lancer sans ambiguïté de rôle.

### Story 1.1: Set up initial project from starter template

As a développeur,
I want initialiser la base technique depuis le starter retenu et préparer les fondations d'exécution,
So that les stories produit suivantes s'appuient sur un socle stable et versionnable.

**FRs:** FR-004
**Acceptance Criteria:**

**Given** l'architecture valide la continuité `Vite + React + TypeScript`
**When** le socle de projet est préparé pour delivery
**Then** aucune migration de framework n'est introduite
**And** la compatibilité Docker/Nginx existante est préservée.

**Given** le backend doit évoluer de manière incrémentale
**When** la base technique est finalisée
**Then** le dossier `server/migrations/` est en place avec convention de nommage/exécution
**And** la stratégie d'évolution DB est prête pour les stories qui créent/modifient des entités.

### Story 1.2: Onboarding profil rapide et accessible (pseudo/avatar)

As a participant,
I want renseigner pseudo/avatar avec validation inline claire,
So that je rejoins la session sans friction ni confusion.

**FRs:** FR-002, FR-011
**Acceptance Criteria:**

**Given** l'écran d'onboarding est affiché
**When** les champs sont invalides ou incomplets
**Then** les erreurs sont affichées inline avec message actionnable
**And** la CTA reste désactivée avec raison explicite.

**Given** un usage clavier ou mobile
**When** l'utilisateur complète l'onboarding
**Then** le focus est visible et le parcours est entièrement navigable
**And** les zones tactiles respectent un minimum de 44x44.

### Story 1.3: Création/rejoindre room avec rôles et garde-fou capacité

As a facilitateur ou participant,
I want créer une room ou rejoindre via code/lien avec attribution correcte du rôle,
So that la session démarre dans un état valide et maîtrisé.

**FRs:** FR-010, FR-011, FR-012, FR-015
**Acceptance Criteria:**

**Given** un utilisateur choisit `Créer`
**When** la room est créée
**Then** un code unique est généré
**And** l'utilisateur est positionné comme `host`.

**Given** un utilisateur choisit `Rejoindre` avec code ou lien
**When** la room existe et n'est pas pleine
**Then** l'utilisateur rejoint la room comme `participant`
**And** l'état de présence est mis à jour côté lobby.

**Given** une room a déjà 20 participants
**When** un nouveau participant tente de rejoindre
**Then** l'accès est refusé côté serveur
**And** un message d'erreur explicite est affiché côté client.

### Story 1.4: Lobby room-ready avec statut session, invitation et readiness

As a host,
I want piloter l'invitation et le lancement depuis un lobby vivant,
So that je sais quand lancer l'activité en confiance.

**FRs:** FR-013, FR-016
**Acceptance Criteria:**

**Given** une room active
**When** le host ouvre le lobby
**Then** un `SessionStatusBar` affiche module, rôle, état session et connectivité
**And** un `LobbyReadinessBoard` affiche participants, capacité et readiness.

**Given** le host partage la session
**When** il utilise l'`InvitePanel`
**Then** code et lien sont copiables en un clic
**And** le feedback de copie est immédiat et persistant court.

**Given** un participant non-host tente de lancer
**When** il déclenche l'action de lancement
**Then** l'action est bloquée côté client et côté serveur
**And** une microcopy explicite indique que seul le host peut lancer.

### Story 1.5: Reconnexion/récupération robuste avec bannière de recovery

As a host ou participant,
I want récupérer automatiquement mon contexte après coupure réseau,
So that je reprends la session sans perdre le fil.

**FRs:** FR-014
**Acceptance Criteria:**

**Given** une coupure réseau temporaire
**When** la reconnexion socket est tentée avec `sessionId`
**Then** rôle, room et état de session sont restaurés
**And** une `RecoveryBanner` indique l'état `reconnecting/recovered/failed`.

**Given** la session n'est plus disponible
**When** la reprise échoue
**Then** un message actionnable explique la situation
**And** une action immédiate (`Rejoindre` ou `Créer`) est proposée.

### Story 1.6: Baseline UX cross-modules (tokens, responsive, accessibilité AA)

As a utilisateur AgileSuite,
I want une expérience visuelle cohérente, lisible et accessible sur desktop/mobile,
So that je peux utiliser chaque module avec les mêmes repères et sans friction.

**FRs:** FR-001, FR-003, FR-004
**Acceptance Criteria:**

**Given** l'utilisateur arrive sur le hub AgileSuite
**When** il consulte l'entrée produit
**Then** les 3 modules sont affichés dans un hub unique
**And** l'intention `Reprendre` restaure le dernier contexte mémorisé par module (code + profil).

**Given** les écrans critiques `Home`, onboarding, lobby et `Prepare`
**When** ils sont rendus sur `sm/md/lg/xl`
**Then** l'ordre des informations suit `statut -> action primaire -> détails`
**And** la hiérarchie visuelle reste cohérente entre modules.

**Given** les tokens UI et composants de flux
**When** ils sont appliqués
**Then** palette sémantique, spacing 8pt et typographie sont unifiés
**And** les variations module restent limitées aux accents visuels.

**Given** un audit accessibilité des parcours create/join/lobby/start
**When** les tests clavier, contraste et feedback sont exécutés
**Then** le niveau WCAG 2.2 AA minimum est atteint
**And** les feedbacks ne dépendent jamais de la couleur seule.

## Epic 2: Retro Party multijoueur fiable

Une équipe peut démarrer et jouer une rétro en temps réel avec autorité serveur et cohérence d'état.

### Story 2.1: Lancement Retro depuis le lobby unifié

As a host,
I want lancer une session Retro depuis le lobby room-ready,
So that tous les participants entrent dans la partie sans ambiguïté.

**FRs:** FR-020
**Acceptance Criteria:**

**Given** une room Retro en état prêt
**When** le host clique sur la CTA primaire de lancement
**Then** la phase passe de `lobby` à `playing` côté serveur
**And** tous les participants reçoivent la transition en temps réel.

### Story 2.2: Autorité serveur sur transitions et actions Retro

As a product owner,
I want que la logique de partie Retro soit validée côté serveur,
So that l'état de jeu reste cohérent pour tous les joueurs.

**FRs:** FR-021
**Acceptance Criteria:**

**Given** une action de jeu envoyée par un client
**When** elle est invalide (phase, ordre, permission)
**Then** elle est refusée côté serveur
**And** l'état global de partie reste inchangé.

**Given** une action valide
**When** le serveur la traite
**Then** il diffuse le nouvel état autoritaire
**And** les clients s'alignent sur cet état sans logique concurrente locale.

### Story 2.3: Synchronisation temps réel Retro avec reprise en cours de partie

As a joueur,
I want voir les actions synchronisées instantanément et reprendre après déconnexion,
So that l'expérience reste fluide et juste.

**FRs:** FR-022
**Acceptance Criteria:**

**Given** plusieurs joueurs connectés
**When** une action principale est effectuée
**Then** la mise à jour apparaît de manière cohérente sur tous les clients
**And** les états `lobby/playing/results` restent alignés.

**Given** un joueur se reconnecte en cours de partie
**When** la reprise est validée
**Then** il récupère l'état courant de la partie
**And** il peut continuer sans reset de room.

### Story 2.4: Conformité UX/accessibilité sur les surfaces Retro critiques

As a participant,
I want une interface Retro lisible et actionnable sur mobile et desktop,
So that je participe efficacement quelle que soit ma plateforme.

**FRs:** FR-022
**Acceptance Criteria:**

**Given** les écrans Retro critiques
**When** ils sont testés en navigation clavier et mobile
**Then** le focus et les interactions restent accessibles
**And** les messages d'état sont compréhensibles sans dépendre de la couleur.

## Epic 3: Planning Poker complet et fluide

Une équipe peut estimer (vote/reveal/reset/story title) avec rôles clairs joueur/spectateur.

### Story 3.1: Entrée Planning Poker via le flux unifié

As a facilitateur,
I want créer ou rejoindre une table Planning Poker via le même parcours que les autres modules,
So that l'entrée en session reste cohérente et rapide.

**FRs:** FR-030
**Acceptance Criteria:**

**Given** le module Planning Poker est sélectionné
**When** l'utilisateur choisit créer ou rejoindre
**Then** le flux onboarding/lobby suit les patterns transverses
**And** la présence est visible en temps réel côté host.

### Story 3.2: Cycle d'estimation complet (start, vote, reveal, reset, story title)

As a équipe d'estimation,
I want exécuter un cycle complet de vote et reveal sur une story,
So that la session produit un résultat exploitable.

**FRs:** FR-031, FR-032
**Acceptance Criteria:**

**Given** une room Poker active
**When** le host démarre l'estimation
**Then** les participants peuvent voter
**And** le reveal expose un résultat cohérent pour tous.

**Given** une nouvelle story à estimer
**When** le host met à jour le titre et reset le vote
**Then** un nouveau cycle commence sans état résiduel
**And** l'état serveur et l'UI restent synchronisés.

### Story 3.3: Gestion explicite des rôles joueur/spectateur

As a host,
I want distinguer joueurs et spectateurs avec permissions claires,
So that je contrôle la dynamique de vote sans ambiguïté.

**FRs:** FR-033
**Acceptance Criteria:**

**Given** une table avec rôles mixtes
**When** un utilisateur est `spectator`
**Then** il ne peut pas voter
**And** il conserve la visibilité du déroulé en lecture.

**Given** un changement de rôle en session
**When** le host modifie le rôle
**Then** les permissions sont appliquées immédiatement
**And** l'interface reflète le rôle courant sans rechargement manuel.

### Story 3.4: Reconnexion/reprise fiable pour sessions Poker

As a joueur ou spectateur,
I want retrouver mon rôle et l'état de vote après coupure,
So that je reviens sans perturber la session.

**FRs:** FR-033, FR-014
**Acceptance Criteria:**

**Given** une déconnexion temporaire
**When** l'utilisateur se reconnecte avec session valide
**Then** son rôle et son contexte de phase sont restaurés
**And** la session continue sans reset.

## Epic 4: Radar Party de bout en bout

Une équipe peut répondre au questionnaire, obtenir résultats individuels et restitution équipe actionnable.

### Story 4.1: Création de session Radar et paramétrage hostParticipates

As a host Radar,
I want créer une session et définir la participation du host avant démarrage,
So that le cadre du diagnostic est explicite.

**FRs:** FR-040, FR-041
**Acceptance Criteria:**

**Given** le host ouvre le module Radar
**When** il crée une session
**Then** le questionnaire Radar est disponible
**And** le paramètre `hostParticipates` est configurable avant lancement.

### Story 4.2: Soumission fiable des réponses participants

As a participant Radar,
I want soumettre mes réponses avec validation claire,
So that mes données sont prises en compte sans erreur silencieuse.

**FRs:** FR-042
**Acceptance Criteria:**

**Given** un participant dans une session démarrée
**When** il soumet des réponses valides
**Then** les réponses sont persistées
**And** une confirmation actionnable est affichée.

**Given** un payload invalide
**When** la soumission est envoyée
**Then** l'API retourne une erreur explicite
**And** l'état de session n'est pas corrompu.

### Story 4.3: Calcul et restitution radar individuel avec insights

As a participant,
I want voir mon radar individuel et des insights compréhensibles,
So that je peux identifier mes axes d'amélioration.

**FRs:** FR-043
**Acceptance Criteria:**

**Given** une soumission participant complète
**When** le moteur de scoring s'exécute
**Then** un radar individuel est généré
**And** des insights individuels sont restitués dans l'UI.

### Story 4.4: Agrégation équipe et restitution collective

As a facilitateur,
I want obtenir une vue radar équipe consolidée,
So that je peux animer une discussion collective orientée action.

**FRs:** FR-044
**Acceptance Criteria:**

**Given** plusieurs soumissions valides
**When** l'agrégation équipe est calculée
**Then** le radar équipe et les insights associés sont disponibles
**And** les logs permettent le diagnostic en cas d'erreur de calcul.

### Story 4.5: Vue progression temps réel des participants pour le host

As a host Radar,
I want suivre l'avancement des participants en direct,
So that je sais quand passer à la restitution.

**FRs:** FR-045
**Acceptance Criteria:**

**Given** une session Radar active
**When** les participants progressent ou se reconnectent
**Then** la vue de progression host se met à jour en temps réel
**And** le statut global de readiness reste fiable.

## Epic 5: Facilitation durable (comptes, templates, pilotage KPI)

Le facilitateur sécurise son usage (auth), industrialise ses ateliers (templates) et mesure la valeur (analytics KPI).

### Story 5.1: Auth complète dans le shell AgileSuite

As a facilitateur,
I want m'inscrire, me connecter, me déconnecter et récupérer mon profil,
So that je sécurise l'accès à mes sessions et préférences.

**FRs:** FR-050
**Acceptance Criteria:**

**Given** un utilisateur non authentifié
**When** il réalise register/login avec des données valides
**Then** la session cookie sécurisée est créée
**And** l'endpoint `me` retourne le profil courant.

**Given** une tentative d'accès non authentifiée à une ressource protégée
**When** la requête est exécutée
**Then** l'API retourne `401`
**And** l'UI redirige vers le flux de connexion approprié.

### Story 5.2: Réinitialisation mot de passe par email

As a facilitateur,
I want réinitialiser mon mot de passe via email,
So that je récupère mon accès sans intervention manuelle.

**FRs:** FR-051
**Acceptance Criteria:**

**Given** une demande de reset
**When** l'email utilisateur est fourni
**Then** un token de reset sécurisé est généré
**And** la réponse ne permet pas d'énumérer les comptes.

**Given** un token valide
**When** un nouveau mot de passe est soumis
**Then** le mot de passe est mis à jour
**And** les sessions existantes sont révoquées.

### Story 5.3: Gestion templates (CRUD + organisation)

As a facilitateur,
I want créer, éditer, supprimer et organiser mes templates,
So that je prépare mes sessions plus vite.

**FRs:** FR-052
**Acceptance Criteria:**

**Given** un utilisateur authentifié
**When** il accède à `Prepare` et `TemplateEditor`
**Then** il peut effectuer CRUD sur templates et questions
**And** les validations/form feedback sont cohérents avec le shell UX.

### Story 5.4: Lancer une room depuis un template

As a facilitateur,
I want lancer une room préconfigurée depuis un template,
So that je réduis le temps entre préparation et démarrage.

**FRs:** FR-053
**Acceptance Criteria:**

**Given** un template valide sélectionné
**When** l'utilisateur clique lancer
**Then** une room est créée avec la configuration du template
**And** l'utilisateur est redirigé vers le lobby correspondant.

**Given** un template invalide ou non autorisé
**When** le lancement est demandé
**Then** l'API retourne une erreur métier explicite
**And** aucune room incohérente n'est créée.

### Story 5.5: Instrumentation analytics pour KPI V1

As a product owner,
I want tracer les événements clés et vérifier leur qualité,
So that je peux mesurer les KPI V1 de façon fiable.

**FRs:** FR-060, FR-061
**Acceptance Criteria:**

**Given** les parcours critiques (vue hub, sélection module, action primaire, complétion session)
**When** un utilisateur exécute ces actions
**Then** des événements analytics conformes au schéma sont émis
**And** ils permettent de calculer temps entrée->lobby, taux de session lancée et satisfaction facilitateur.

**Given** un incident backend sur un parcours critique
**When** il survient
**Then** les logs structurés sont exploitables pour diagnostic
**And** la perte d'observabilité est détectable.


