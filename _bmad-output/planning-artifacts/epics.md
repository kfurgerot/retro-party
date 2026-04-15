---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/ux-wireframes-ecrans-critiques.md
  - _bmad-output/planning-artifacts/ux-prototype-interactif-plan.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
---

# retro-party-dev - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for retro-party-dev, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1 (FR-001): Le systeme doit afficher les 3 modules dans un hub unique.
FR2 (FR-002): Le systeme doit permettre les intentions Creer, Rejoindre, Reprendre.
FR3 (FR-003): Le systeme doit memoriser la derniere session par module (code + profil) pour Reprendre.
FR4 (FR-004): Le systeme doit conserver des conventions UI coherentes inter-modules (header, step, action bar).
FR5 (FR-010): Le systeme doit permettre creation de room et generation de code unique.
FR6 (FR-011): Le systeme doit permettre rejoindre une room via code ou lien.
FR7 (FR-012): Le systeme doit gerer les roles host/participant.
FR8 (FR-013): Le systeme doit afficher un lobby avec presence et statut de connexion.
FR9 (FR-014): Le systeme doit supporter reconnexion avec reprise de session via sessionId.
FR10 (FR-015): Le systeme doit limiter la capacite d'une room a 20 participants.
FR11 (FR-016): Le systeme doit empecher le lancement par un non-host.
FR12 (FR-020): Le module Retro doit permettre demarrage de partie depuis lobby.
FR13 (FR-021): La logique de partie online doit rester autoritaire cote serveur.
FR14 (FR-022): Le module Retro doit supporter les interactions temps reel principales de partie.
FR15 (FR-030): Le module Planning Poker doit permettre creation/join de table poker.
FR16 (FR-031): Le host doit pouvoir demarrer une session d'estimation.
FR17 (FR-032): Le module doit supporter vote, reveal, reset et gestion de story title.
FR18 (FR-033): Le module doit gerer role joueur/spectateur.
FR19 (FR-040): Le module Radar doit exposer le questionnaire Radar.
FR20 (FR-041): Le host doit pouvoir creer une session et definir la participation host.
FR21 (FR-042): Les participants doivent pouvoir soumettre leurs reponses.
FR22 (FR-043): Le systeme doit calculer radar individuel + insights individuels.
FR23 (FR-044): Le systeme doit calculer radar equipe + insights equipe.
FR24 (FR-045): Le systeme doit exposer une vue progression des participants pour le host.
FR25 (FR-050): Le systeme doit fournir auth register/login/logout/me.
FR26 (FR-051): Le systeme doit permettre reset password par email.
FR27 (FR-052): Le systeme doit permettre creation et gestion de templates.
FR28 (FR-053): Le systeme doit permettre lancement de room depuis template.
FR29 (FR-060): Le systeme doit tracer les evenements cles produit.
FR30 (FR-061): Le systeme doit permettre calcul des KPI V1 avec ces evenements.

### NonFunctional Requirements

NFR1 (NFR-001): Les ecrans critiques doivent rester fluides sur desktop et mobile modernes.
NFR2 (NFR-002): Le parcours entree -> lobby doit etre optimise pour une execution rapide.
NFR3 (NFR-010): Les mises a jour lobby/session doivent etre coherentes pour tous les participants.
NFR4 (NFR-011): La reconnexion doit restaurer le contexte session de maniere fiable.
NFR5 (NFR-020): Sessions auth avec cookie HttpOnly + SameSite.
NFR6 (NFR-021): Validation stricte des payloads API.
NFR7 (NFR-022): Requetes SQL parametrees uniquement.
NFR8 (NFR-023): Rate limits API/auth maintenus.
NFR9 (NFR-030): Cible minimale WCAG AA sur les ecrans critiques.
NFR10 (NFR-031): Navigation clavier et focus visible sur create/join/lobby/start.
NFR11 (NFR-032): Messages d'erreur actionnables et non dependants de la couleur seule.
NFR12 (NFR-040): Support desktop + mobile.
NFR13 (NFR-041): Compatibilite execution locale via Docker Compose.
NFR14 (NFR-050): Logs erreurs backend exploitables pour diagnostic.
NFR15 (NFR-051): Evenements analytics suffisants pour pilotage produit.

### Additional Requirements

- Starter/baseline technique retenue: continuite Vite + React + TypeScript (pas de migration de framework en V1).
- Architecture cible: monolithe modulaire (frontend SPA + backend API/realtime unique).
- Contrat runtime: serveur autoritaire pour l'etat de session et les transitions de jeu.
- Communication hybride obligatoire: REST pour operations deterministes + Socket.IO pour collaboration temps reel.
- Persistence principale: PostgreSQL 16.x, schema relationnel unique par domaines.
- Creation obligatoire de migrations SQL versionnees (`server/migrations/`) comme priorite technique initiale.
- Regles de securite obligatoires: auth session cookie, validation payload stricte, rate limiting, SQL parametre.
- Format d'erreur API standard a respecter sur l'ensemble des endpoints.
- Nommage et patterns events Socket a unifier (`session:*`, `retro:*`, `poker:*`, `radar:*`).
- Versioning des payloads Socket a formaliser (meta/version) pour evolutivite.
- Cohabitation frontend state: React Query pour server-state + hooks de domaine pour etat interactif/realtime.
- Observabilite obligatoire: logs backend structures + instrumentation KPI end-to-end.
- Respect strict des conventions et frontieres du `project-context.md` (imports, structure, tests, realtime cleanup).
- Compatibilite Docker/Nginx a conserver pour local et cible deploiement.

### UX Design Requirements

UX-DR1: Implementer un shell UX transversal AgileSuite (navigation, statuts, CTA, feedback) commun aux 3 modules.
UX-DR2: Garantir une seule action primaire visible par ecran/etape sur les parcours critiques.
UX-DR3: Implementer un stepper de progression explicite (Accueil -> Config -> Lobby) avec etat courant lisible.
UX-DR4: Assurer la lisibilite persistante des informations critiques de session (role, etat, presence, code, prochaine action).
UX-DR5: Implementer un composant SessionStatusBar reusable avec etats `connecting/synced/degraded/error`.
UX-DR6: Implementer un composant InvitePanel reusable (code + lien + actions copier + feedback local persistant).
UX-DR7: Implementer un composant LobbyReadinessBoard reusable (participants, readiness, seuil de lancement).
UX-DR8: Implementer un composant PrimaryFlowCTA reusable avec raisons de disabled explicites.
UX-DR9: Implementer un composant RecoveryBanner pour deconnexion/reconnexion/session introuvable avec actions de reprise.
UX-DR10: Harmoniser les microcopies d'etat et d'action sur les 3 modules (host/participant/lancement/attente).
UX-DR11: Respecter une densite aerée avec systeme d'espacement 8pt et hierarchie d'information stable.
UX-DR12: Appliquer une typographie sobre et lisible avec hierarchy claire (hero/titres/body/caption).
UX-DR13: Garantir le responsive mobile-first avec breakpoints definis (`sm/md/lg/xl`) et priorisation des infos critiques.
UX-DR14: Garantir des cibles tactiles minimum 44x44 sur mobile.
UX-DR15: Atteindre WCAG 2.2 AA minimum sur ecrans critiques.
UX-DR16: Garantir navigation clavier complete et focus visible sur create/join/lobby/start.
UX-DR17: Garantir feedbacks non dependants de la couleur (texte + icone + etat).
UX-DR18: Uniformiser les patterns de formulaires (progressive disclosure, validation inline, prevention double soumission).
UX-DR19: Implementer les etats de chargement/erreur/recovery de maniere persistante (pas uniquement via toasts).
UX-DR20: Couvrir les wireframes critiques WF-01 a WF-08 en desktop et mobile sans rupture de parcours.
UX-DR21: Integrer explicitement les etats critiques prototype: code invalide, serveur indisponible, attente host, reconnexion.
UX-DR22: Verifier la coherence visuelle et comportementale du flux Prepare avec le shell principal AgileSuite.
UX-DR23: Ajouter un indicateur de progression collective lobby (ex: n/20 connectes, readiness) pour renforcer la lisibilite.
UX-DR24: Aligner chaque ecran prototype/handoff avec les ecrans code cibles (`Home`, `OnlineOnboardingScreen`, `OnlineLobbyScreen`, `Prepare`).

### FR Coverage Map

FR1 (FR-001): Epic 1 - Hub unique AgileSuite
FR2 (FR-002): Epic 1 - Intentions Creer/Rejoindre/Reprendre
FR3 (FR-003): Epic 1 - Reprise de session memorisee
FR4 (FR-004): Epic 1 - Cohesion UI inter-modules
FR5 (FR-010): Epic 1 - Creation de room avec code unique
FR6 (FR-011): Epic 1 - Join via code/lien
FR7 (FR-012): Epic 1 - Gestion roles host/participant
FR8 (FR-013): Epic 1 - Lobby presence/statut connexion
FR9 (FR-014): Epic 1 - Reconnexion + reprise session
FR10 (FR-015): Epic 1 - Cap 20 participants
FR11 (FR-016): Epic 1 - Restriction lancement non-host
FR12 (FR-020): Epic 2 - Demarrage Retro depuis lobby
FR13 (FR-021): Epic 2 - Autorite serveur Retro
FR14 (FR-022): Epic 2 - Interactions temps reel Retro
FR15 (FR-030): Epic 3 - Creation/join table poker
FR16 (FR-031): Epic 3 - Demarrage estimation host
FR17 (FR-032): Epic 3 - Vote/reveal/reset/story title
FR18 (FR-033): Epic 3 - Roles joueur/spectateur
FR19 (FR-040): Epic 4 - Questionnaire Radar
FR20 (FR-041): Epic 4 - Session Radar + participation host
FR21 (FR-042): Epic 4 - Soumission reponses participants
FR22 (FR-043): Epic 4 - Radar individuel + insights
FR23 (FR-044): Epic 4 - Radar equipe + insights
FR24 (FR-045): Epic 4 - Progression participants pour host
FR25 (FR-050): Epic 5 - Auth register/login/logout/me
FR26 (FR-051): Epic 5 - Reset password email
FR27 (FR-052): Epic 5 - Creation/gestion templates
FR28 (FR-053): Epic 5 - Lancement room depuis template
FR29 (FR-060): Epic 5 - Traces evenements cles
FR30 (FR-061): Epic 5 - Calcul KPI via analytics

## Epic List

### Epic 1: Entrée en session AgileSuite fluide et unifiée
Permettre aux facilitateurs et participants de choisir un module, creer/rejoindre/reprendre une session, et atteindre un lobby lisible et pret au lancement.
**FRs covered:** FR-001, FR-002, FR-003, FR-004, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016

### Epic 2: Expérience Retro Party modernisée et intégrée
Permettre de lancer et jouer une session Retro avec nouveaux patterns UX, etat temps reel fiable et autorite serveur.
**FRs covered:** FR-020, FR-021, FR-022

### Epic 3: Expérience Planning Poker modernisée et intégrée
Permettre des estimations collaboratives robustes (vote/reveal/reset/story title) avec parcours host/participants/spectateurs cohérent.
**FRs covered:** FR-030, FR-031, FR-032, FR-033

### Epic 4: Expérience Radar Agile de bout en bout
Permettre la creation de session Radar, la collecte des reponses, la progression visible, et la restitution individuelle/equipe actionnable.
**FRs covered:** FR-040, FR-041, FR-042, FR-043, FR-044, FR-045

### Epic 5: Facilitation avancée (comptes, templates, pilotage KPI)
Donner aux facilitateurs les capacites de compte, templates reutilisables et instrumentation KPI pour piloter l'usage.
**FRs covered:** FR-050, FR-051, FR-052, FR-053, FR-060, FR-061

## Epic 1: Entree en session AgileSuite fluide et unifiee

Permettre aux facilitateurs et participants de passer de l'accueil au lobby pret au lancement avec une experience coherente, accessible et robuste.

### Story 1.1: Set up initial project from starter template et initialiser les migrations

As a developpeur,
I want aligner le projet courant avec la baseline starter approuvee et creer le socle de migrations SQL,
So that les futures stories UI/realtime s'appuient sur une base technique stable et versionnee.

**FRs:** FR-004  
**Additional:** starter continuity baseline, migrations `server/migrations/`  

**Acceptance Criteria:**

**Given** le projet existant retro-party-dev  
**When** la story est terminee  
**Then** une structure de migrations versionnees existe sous `server/migrations/`  
**And** la convention de migration (naming, ordre d'execution, rollback) est documentee dans le repo.

**Given** la baseline React/Vite/TS deja active  
**When** un developpeur lance l'environnement local  
**Then** aucun changement de framework n'est introduit  
**And** la compatibilite Docker Compose reste intacte.

### Story 1.2: Mettre en place le shell UX transversal et le stepper de flux

As a facilitateur,
I want un shell commun avec progression explicite sur les ecrans critiques,
So that je garde mes reperes quel que soit le module choisi.

**FRs:** FR-004  
**UX-DRs:** UX-DR1, UX-DR2, UX-DR3, UX-DR11, UX-DR12, UX-DR24  

**Acceptance Criteria:**

**Given** les ecrans Accueil, Onboarding et Lobby  
**When** l'utilisateur navigue entre les etapes  
**Then** le meme shell (header, stepper, action bar) est applique  
**And** une seule action primaire est visuellement dominante par ecran.

**Given** un affichage desktop et mobile  
**When** le shell est rendu  
**Then** l'ordre des informations critiques reste coherent  
**And** la navigation clavier conserve un focus visible et predictible.

**Given** les ecrans `Home`, `OnlineOnboardingScreen`, `OnlineLobbyScreen` et `Prepare`  
**When** le shell transversal est integre  
**Then** les patterns de structure et d'action restent alignes avec la maquette/handoff  
**And** la correspondance ecran prototype -> ecran code est explicite dans le scope de livraison.

### Story 1.3: Livrer le hub modules avec create/join/resume

As a facilitateur Agile,
I want selectionner un module puis entrer via creer/rejoindre/reprendre,
So that je lance une session rapidement sans friction.

**FRs:** FR-001, FR-002, FR-003  
**UX-DRs:** UX-DR2, UX-DR4, UX-DR20  

**Acceptance Criteria:**

**Given** la page d'accueil AgileSuite  
**When** l'utilisateur choisit un module  
**Then** les intentions Creer, Rejoindre et Reprendre sont accessibles  
**And** l'etat de selection module est explicite.

**Given** une session precedente stockee pour un module  
**When** l'utilisateur choisit Reprendre  
**Then** le code room et le profil sont pre-remplis correctement  
**And** l'utilisateur atteint le flux de reprise sans ressaisie manuelle.

### Story 1.4: Integrer l'onboarding profil (pseudo/avatar) avec validation

As a participant,
I want renseigner rapidement pseudo et avatar avec feedback clair,
So that je rejoins la session sans confusion.

**FRs:** FR-002, FR-011  
**NFRs:** NFR-030, NFR-031, NFR-032  
**UX-DRs:** UX-DR14, UX-DR16, UX-DR17, UX-DR18, UX-DR20  

**Acceptance Criteria:**

**Given** l'etape onboarding pseudo/avatar  
**When** une saisie invalide est detectee  
**Then** le message d'erreur est actionnable  
**And** le bouton principal reste desactive avec raison explicite.

**Given** un parcours clavier complet  
**When** l'utilisateur navigue sans souris  
**Then** tous les champs et actions sont accessibles  
**And** le focus visible respecte la cible WCAG AA.

### Story 1.5: Livrer le lobby avant room (modes host/join)

As a facilitateur ou participant,
I want configurer rapidement mon mode d'entree dans le lobby,
So that je comprends immediatement l'action suivante.

**FRs:** FR-010, FR-011, FR-012, FR-013  
**UX-DRs:** UX-DR4, UX-DR10, UX-DR19, UX-DR21  

**Acceptance Criteria:**

**Given** l'ecran lobby sans room  
**When** l'utilisateur bascule Host/Join  
**Then** l'UI affiche le bon formulaire/context  
**And** le statut courant de connexion est visible de maniere persistante.

**Given** un code room invalide en mode Join  
**When** l'utilisateur tente de continuer  
**Then** un etat d'erreur explicite est affiche  
**And** une action de correction immediate est proposee.

### Story 1.6: Livrer le lobby room-ready (invite, roles, lancement)

As a host,
I want inviter, verifier la presence et lancer depuis un lobby lisible,
So that l'equipe demarre l'activite au bon moment.

**FRs:** FR-013, FR-016  
**UX-DRs:** UX-DR5, UX-DR6, UX-DR7, UX-DR8, UX-DR23  

**Acceptance Criteria:**

**Given** une room creee et des participants connectes  
**When** le host ouvre le lobby room-ready  
**Then** le code/lien d'invitation sont visibles et copiables avec feedback local  
**And** la progression collective participants/readiness est affichee.

**Given** un participant non-host  
**When** il tente de lancer l'activite  
**Then** l'action est refusee cote UI et cote serveur  
**And** un message clair indique que seul le host peut lancer.

### Story 1.7: Fiabiliser reconnexion, reprise et garde-fous de capacite

As a participant ou host,
I want recuperer ma session apres coupure et voir les limites de room appliquees,
So that la session reste fiable meme en conditions degradees.

**FRs:** FR-014, FR-015  
**NFRs:** NFR-010, NFR-011  
**UX-DRs:** UX-DR9, UX-DR19, UX-DR21  

**Acceptance Criteria:**

**Given** une deconnexion reseau temporaire  
**When** la reconnexion est tentee avec `sessionId` valide  
**Then** role, room et etat de phase sont restaures  
**And** un feedback de recovery est visible pour l'utilisateur.

**Given** une room ayant atteint 20 participants  
**When** un nouveau participant tente de rejoindre  
**Then** l'acces est refuse de facon deterministe  
**And** un message utilisateur explicite est retourne.

## Epic 2: Experience Retro Party modernisee et integree

Permettre une experience Retro alignee avec les nouveaux standards UX, sans casser la logique realtime serveur autoritaire.

### Story 2.1: Integrer le lancement Retro depuis le lobby unifie

As a host,
I want lancer Retro directement depuis le lobby room-ready,
So that la transition vers la partie est immediate et comprehensible.

**FRs:** FR-020  
**UX-DRs:** UX-DR1, UX-DR2, UX-DR20  

**Acceptance Criteria:**

**Given** un lobby Retro pret au lancement  
**When** le host clique sur l'action primaire Lancer  
**Then** la transition vers l'ecran de jeu est executee sans ambiguite  
**And** l'ensemble des participants est notifie du changement de phase.

**Given** un participant en attente  
**When** le host lance la partie  
**Then** le participant est bascule automatiquement vers la session active  
**And** l'UI conserve les reperes de module.

### Story 2.2: Garantir l'autorite serveur de la logique de partie Retro

As a product owner,
I want que les transitions et resolutions Retro soient validees cote serveur,
So that le gameplay reste coherent pour tous les joueurs.

**FRs:** FR-021  
**NFRs:** NFR-010  

**Acceptance Criteria:**

**Given** une action de jeu emise par un client  
**When** elle est traitee  
**Then** la validation metier est executee cote serveur  
**And** seul l'etat serveur est diffuse aux clients.

**Given** une tentative client invalide (ordre de tour, action interdite)  
**When** elle est envoyee  
**Then** l'etat global n'est pas corrompu  
**And** un retour d'erreur metier est fourni.

### Story 2.3: Couvrir les interactions temps reel principales Retro

As a joueur,
I want voir mes actions et celles des autres synchronisees en temps reel,
So that la partie reste fluide et juste.

**FRs:** FR-022  
**NFRs:** NFR-001, NFR-010  

**Acceptance Criteria:**

**Given** une room Retro active avec plusieurs joueurs  
**When** une action principale est executee  
**Then** la mise a jour est visible pour tous les clients connectes  
**And** les etats lobby/playing/results restent coherents.

**Given** un joueur reconnecte en cours de partie  
**When** il revient dans la room  
**Then** il recupere un etat de jeu coherent  
**And** il peut reprendre sans reinitialisation globale.

### Story 2.4: Appliquer les standards UX/accessibilite sur les ecrans Retro critiques

As a participant,
I want une interface Retro lisible, accessible et responsive,
So that je peux participer efficacement sur desktop comme mobile.

**FRs:** FR-022  
**NFRs:** NFR-030, NFR-031, NFR-040  
**UX-DRs:** UX-DR11, UX-DR13, UX-DR15, UX-DR16, UX-DR17, UX-DR20  

**Acceptance Criteria:**

**Given** les ecrans Retro de flux critique  
**When** ils sont testes au clavier et sur mobile  
**Then** la navigation est complete et le focus visible  
**And** les cibles tactiles respectent 44x44 minimum.

**Given** les textes et etats critiques  
**When** ils sont audites contraste/accessibilite  
**Then** le niveau WCAG AA est respecte  
**And** les messages critiques ne reposent pas uniquement sur la couleur.

## Epic 3: Experience Planning Poker modernisee et integree

Permettre des estimations collectives robustes et lisibles dans le nouveau flux UX AgileSuite.

### Story 3.1: Integrer creation/join de table Poker dans le flux unifie

As a facilitateur,
I want creer ou rejoindre une table Poker depuis le parcours standard,
So that l'entree en estimation est homogene avec les autres modules.

**FRs:** FR-030  
**UX-DRs:** UX-DR1, UX-DR2, UX-DR20  

**Acceptance Criteria:**

**Given** le module Planning Poker selectionne  
**When** l'utilisateur choisit creer ou rejoindre  
**Then** le parcours reprend les patterns de shell/lobby communs  
**And** les transitions sont cohérentes avec le reste de la suite.

**Given** une table existante  
**When** un participant rejoint via code/lien  
**Then** il est rattache a la bonne room  
**And** son etat de presence est visible cote host.

### Story 3.2: Permettre au host de demarrer la session d'estimation

As a host,
I want demarrer explicitement la session d'estimation,
So that l'equipe commence dans un etat synchronise.

**FRs:** FR-031  
**NFRs:** NFR-010  

**Acceptance Criteria:**

**Given** un lobby Poker pret  
**When** le host declenche le demarrage  
**Then** la phase d'estimation est activee pour tous les participants  
**And** un non-host ne peut pas executer cette action.

**Given** un changement de phase poker  
**When** l'evenement est emis  
**Then** tous les clients affichent le meme etat  
**And** aucun participant ne reste bloque en phase precedente.

### Story 3.3: Couvrir vote, reveal, reset et story title

As a participant d'estimation,
I want voter, reveler, reset et gerer le titre de story,
So that la ceremonie d'estimation est complete et exploitable.

**FRs:** FR-032  
**NFRs:** NFR-001  

**Acceptance Criteria:**

**Given** une story active en estimation  
**When** les participants votent  
**Then** les votes sont enregistres selon les regles de role  
**And** le reveal affiche un resultat coherent pour tous.

**Given** une nouvelle story a estimer  
**When** le host reset/reouvre le vote et met a jour le story title  
**Then** l'interface et l'etat serveur sont alignes  
**And** l'historique utile a la facilitation est conserve.

### Story 3.4: Gerer roles joueur/spectateur et reprise session Poker

As a facilitateur,
I want distinguer joueurs et spectateurs avec reprise fiable,
So that je controle la dynamique d'estimation sans perte de contexte.

**FRs:** FR-033, FR-014  
**NFRs:** NFR-011  
**UX-DRs:** UX-DR4, UX-DR9, UX-DR10

**Acceptance Criteria:**

**Given** une room Poker avec roles mixtes  
**When** les roles sont modifies  
**Then** les permissions de vote/reveal sont appliquees correctement  
**And** l'etat UI reflète clairement le role courant.

**Given** une coupure puis reconnexion d'un joueur ou spectateur  
**When** la session est reprise  
**Then** le role et le contexte de vote sont restaures  
**And** l'utilisateur peut continuer sans reset global.

## Epic 4: Experience Radar Agile de bout en bout

Permettre un diagnostic Radar complet, de la creation de session a la restitution individuelle et equipe.

### Story 4.1: Creer et demarrer une session Radar avec parametres host

As a host Radar,
I want creer une session et configurer la participation host avant demarrage,
So that le cadre du diagnostic est clair pour toute l'equipe.

**FRs:** FR-040, FR-041  
**UX-DRs:** UX-DR4, UX-DR7, UX-DR10, UX-DR20

**Acceptance Criteria:**

**Given** l'acces au module Radar  
**When** le host cree une session  
**Then** le questionnaire officiel est disponible  
**And** le parametre hostParticipates est configurable avant start.

**Given** une session Radar en lobby  
**When** le host demarre la session  
**Then** le statut passe a started  
**And** les participants voient immediatement la nouvelle phase.

### Story 4.2: Permettre la soumission des reponses participants

As a participant Radar,
I want soumettre mes reponses au questionnaire de facon fiable,
So that mes resultats soient pris en compte dans l'analyse.

**FRs:** FR-042  
**NFRs:** NFR-010, NFR-021  

**Acceptance Criteria:**

**Given** un participant inscrit dans une session started  
**When** il soumet un questionnaire valide  
**Then** la soumission est acceptee et persistee  
**And** une confirmation explicite est retournee cote UI.

**Given** un payload invalide  
**When** la soumission est tentee  
**Then** la requete est refusee avec erreur actionnable  
**And** l'etat des autres participants n'est pas impacte.

### Story 4.3: Calculer et restituer le radar individuel avec insights

As a participant,
I want recevoir mon radar individuel et des insights exploitables,
So that je comprends mes points forts et axes de vigilance.

**FRs:** FR-043  
**NFRs:** NFR-001  

**Acceptance Criteria:**

**Given** une soumission complete valide  
**When** le moteur Radar calcule le resultat individuel  
**Then** le radar individuel et les insights associes sont disponibles  
**And** la restitution est stable et lisible dans l'UI.

**Given** une mise a jour/re-soumission  
**When** le calcul est relance  
**Then** le resultat individuel est actualise proprement  
**And** la coherence des scores est preservee.

### Story 4.4: Calculer et restituer le radar equipe avec insights

As a facilitateur,
I want une vue equipe consolidee avec insights,
So that je puisse animer une discussion basee sur des signaux objectifs.

**FRs:** FR-044  
**NFRs:** NFR-001, NFR-050

**Acceptance Criteria:**

**Given** plusieurs reponses participants disponibles  
**When** l'agregation equipe est effectuee  
**Then** un radar equipe consolide est produit  
**And** les insights equipe sont accessibles cote host.

**Given** l'evolution du nombre de soumissions  
**When** de nouvelles reponses arrivent  
**Then** la vue equipe se met a jour sans incoherence  
**And** les journaux backend permettent de diagnostiquer un calcul en erreur.

### Story 4.5: Exposer la progression participants pour le host en temps reel

As a host Radar,
I want suivre la progression des participants en direct,
So that je sache quand lancer la restitution collective.

**FRs:** FR-045  
**UX-DRs:** UX-DR7, UX-DR23

**Acceptance Criteria:**

**Given** une session Radar active  
**When** les participants avancent dans le questionnaire  
**Then** la progression individuelle et globale est visible cote host  
**And** les mises a jour temps reel sont cohérentes.

**Given** un participant deconnecte/reconnecte  
**When** son etat evolue  
**Then** le board de progression se met a jour correctement  
**And** le host conserve une vision fiable du readiness.

## Epic 5: Facilitation avancee (comptes, templates, pilotage KPI)

Permettre aux facilitateurs de gerer compte, templates et indicateurs produit pour industrialiser l'usage AgileSuite.

### Story 5.1: Integrer les parcours auth register/login/logout/me dans la nouvelle UI

As a facilitateur,
I want creer un compte, me connecter et me deconnecter dans une interface coherente,
So that je securise l'acces a mes sessions et templates.

**FRs:** FR-050  
**NFRs:** NFR-020, NFR-021, NFR-023  
**UX-DRs:** UX-DR1, UX-DR18, UX-DR19

**Acceptance Criteria:**

**Given** les ecrans auth dans le shell AgileSuite  
**When** l'utilisateur complete register/login avec donnees valides  
**Then** la session cookie est etablie et l'etat utilisateur est recupere via `/api/auth/me`  
**And** les erreurs de validation sont affichees de facon actionnable.

**Given** une requete non authentifiee sur ressource protegee  
**When** elle est executee  
**Then** la reponse est `401 Unauthorized`  
**And** l'UI redirige vers le flux de connexion approprie.

### Story 5.2: Livrer le reset password email de bout en bout

As a facilitateur,
I want demander puis appliquer une reinitialisation de mot de passe,
So that je recupere l'acces a mon compte sans intervention manuelle.

**FRs:** FR-051  
**NFRs:** NFR-020, NFR-023

**Acceptance Criteria:**

**Given** une demande forgot-password valide  
**When** la requete est envoyee  
**Then** un token de reset est genere selon les regles de securite  
**And** la reponse reste non-enumerative pour la confidentialite.

**Given** un token reset valide  
**When** l'utilisateur soumet un nouveau mot de passe  
**Then** le mot de passe est mis a jour et les sessions precedentes sont revoquees  
**And** un token invalide/expire est rejete proprement.

### Story 5.3: Moderniser la gestion des templates (CRUD + questions)

As a facilitateur,
I want creer, editer, organiser et supprimer mes templates,
So that je prepare mes ateliers plus vite.

**FRs:** FR-052  
**NFRs:** NFR-001, NFR-030  
**UX-DRs:** UX-DR22

**Acceptance Criteria:**

**Given** un utilisateur authentifie  
**When** il utilise Prepare/TemplateEditor  
**Then** il peut gerer les templates et questions (create, update, delete, reorder)  
**And** les validations et etats de chargement sont cohérents.

**Given** une liste vide ou en erreur  
**When** l'ecran templates est affiche  
**Then** un empty/error state actionnable est present  
**And** la navigation reste alignee avec le shell principal.

### Story 5.4: Permettre le lancement de room depuis template

As a facilitateur,
I want lancer une room directement depuis un template,
So that je demarre une session preconfiguree en un minimum de clics.

**FRs:** FR-053  
**NFRs:** NFR-010

**Acceptance Criteria:**

**Given** un template valide selectionne  
**When** l'utilisateur clique Lancer  
**Then** une room est creee avec snapshot de config/template  
**And** l'utilisateur est dirige vers le lobby correspondant.

**Given** un template non autorise ou inexistant  
**When** le lancement est tente  
**Then** l'API retourne une erreur metier explicite  
**And** aucun etat room incoherent n'est cree.

### Story 5.5: Instrumenter les evenements produits pour piloter les KPI V1

As a product owner,
I want tracer les evenements cle et verifier leur qualite,
So that je peux mesurer les KPI V1 de facon fiable.

**FRs:** FR-060, FR-061  
**NFRs:** NFR-050, NFR-051

**Acceptance Criteria:**

**Given** les parcours critiques (hub, selection module, action primaire, completion session)  
**When** un utilisateur execute ces actions  
**Then** les evenements analytics sont emis avec schema stable  
**And** ils permettent de calculer temps entree->lobby, taux de lancement et satisfaction.

**Given** un incident backend sur un parcours critique  
**When** il survient  
**Then** les logs sont suffisamment structures pour diagnostic  
**And** la perte d'observabilite est detectable.
