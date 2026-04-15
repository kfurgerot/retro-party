# Wireframes détaillés - Écrans critiques AgileSuite (V1)

Date: 2026-04-13  
Source maquette: https://www.figma.com/design/R3n4UCPVs0aTxOjC3Xtntn/Agile-suite?node-id=59-2&p=f&t=ZiQypZVu0HDvmXJe-0  
Référence code: `src/pages/Home.tsx`, `src/components/screens/OnlineOnboardingScreen.tsx`, `src/components/screens/OnlineLobbyScreen.tsx`, `src/pages/Prepare.tsx`

## 1) Hypothèses de cadrage

- Le scope prioritaire porte sur le parcours critique: `accueil -> création/rejoindre -> onboarding -> lobby -> lancement`.
- La direction visuelle retenue reste "Hybrid Enterprise Game" avec:
  - typographie plus sobre,
  - densité aérée,
  - accessibilité WCAG AA.
- L'architecture fonctionnelle existante est conservée (optimisation UX/UI, pas refonte backend).

## 2) Règles transverses des wireframes

- Une seule action primaire visible par étape.
- Header de progression constant sur les étapes de flux.
- Barre d'actions sticky en bas (desktop et mobile) conservée.
- Information critique toujours visible: état connexion, rôle, code session, participants.
- États d'erreur et de récupération toujours actionnables.

## 3) WF-01 Accueil + sélection d'expérience

Correspondance: `Home.tsx` (stages `press-start` + `select-experience`)

### Desktop

```txt
+----------------------------------------------------------------------------------+
| LOGO AGILESUITE                                          [Étape 1/5]           |
|----------------------------------------------------------------------------------|
|                         H1 "Choisissez votre expérience"                         |
|----------------------------------------------------------------------------------|
| [Card Retro Party]    [Card Planning Party]    [Card Radar Party]               |
| description courte    description courte         description courte               |
| [CTA secondaire]      [CTA secondaire]          [CTA secondaire]                 |
|----------------------------------------------------------------------------------|
| [Retour]                                                    [Continuer]          |
+----------------------------------------------------------------------------------+
```

### Mobile

```txt
+--------------------------------------+
| AGILESUITE            [Étape 1/5]    |
|--------------------------------------|
| H1                                   |
| [Card Retro Party]                   |
| [Card Planning Party]                |
| [Card Radar Party]                   |
|--------------------------------------|
| [Retour]          [Continuer]        |
+--------------------------------------+
```

### États clés

- `default`: aucune carte sélectionnée, CTA "Continuer" désactivé.
- `selected`: carte active avec bordure visible + résumé.
- `keyboard`: focus visible sur chaque carte.

## 4) WF-02 Choix d'entrée (Jouer / Préparer)

Correspondance: `Home.tsx` (stage `select-entry`)

### Desktop

```txt
+----------------------------------------------------------------------------------+
| MODULE SÉLECTIONNÉ                                          [Étape 2/5]         |
|-------------------------------------progress-------------------------------------|
|                           H1 "Comment voulez-vous entrer ?"                      |
|----------------------------------------------------------------------------------|
| [Card Jouer maintenant]                [Card Préparer la session]                |
| bénéfices immédiats                    bénéfices préparateur                      |
| état sélection visible                 état sélection visible                      |
|----------------------------------------------------------------------------------|
| [Retour expérience]                                      [Suivant]               |
+----------------------------------------------------------------------------------+
```

### Mobile

```txt
+--------------------------------------+
| MODULE                 [Étape 2/5]   |
|------------progress------------------|
| H1                                   |
| [Jouer maintenant]                   |
| [Préparer la session]                |
|--------------------------------------|
| [Retour]          [Suivant]          |
+--------------------------------------+
```

### États clés

- `play selected` / `prepare selected`.
- `double click shortcut` (comportement existant) reste possible mais invisible.
- `next loading` lors de la transition vers écran suivant.

## 5) WF-03 Onboarding profil - pseudo

Correspondance: `OnlineOnboardingScreen.tsx` (step 1)

### Desktop

```txt
+----------------------------------------------------------------------------------+
| RETRO PARTY                                                    [Étape 3/5]      |
|-------------------------------------progress-------------------------------------|
|                              H1 "Choisissez un pseudo"                           |
|----------------------------------------------------------------------------------|
| [Champ pseudo.................................................]                  |
| [Aide: min 2 caractères] (si invalide)                                           |
|                                                                                  |
|                           [Card aperçu profil]                                  |
|                           avatar + pseudo                                        |
|----------------------------------------------------------------------------------|
| [Retour]                                                    [Suivant]            |
+----------------------------------------------------------------------------------+
```

### Mobile

```txt
+--------------------------------------+
| RETRO PARTY            [Étape 3/5]   |
|------------progress------------------|
| H1                                   |
| [Pseudo...........................]  |
| [Aide erreur éventuelle]             |
| [Aperçu avatar + nom]                |
|--------------------------------------|
| [Retour]          [Suivant]          |
+--------------------------------------+
```

### États clés

- `invalid name`: bouton suivant désactivé + aide textuelle.
- `valid name`: passage step 2 possible.
- `enter key`: active "Suivant" si valide.

## 6) WF-04 Onboarding profil - avatar

Correspondance: `OnlineOnboardingScreen.tsx` (step 2)

### Desktop

```txt
+----------------------------------------------------------------------------------+
| RETRO PARTY                                                    [Étape 4/5]      |
|-------------------------------------progress-------------------------------------|
|                                H1 "Choisissez un avatar"                         |
|----------------------------------------------------------------------------------|
| [😀] [😎] [🤖] [🐼] [🚀] [🎯] ... (grille)                                       |
| sélection active: contour fort                                                   |
|                                                                                  |
| [Card aperçu profil live] avatar + pseudo                                        |
| [Etat connexion]                                                                  |
|----------------------------------------------------------------------------------|
| [Retour]                                                    [Continuer]          |
+----------------------------------------------------------------------------------+
```

### Mobile

```txt
+--------------------------------------+
| RETRO PARTY            [Étape 4/5]   |
|------------progress------------------|
| H1                                   |
| [grille avatars 5xN]                 |
| [Aperçu profil]                      |
| [Etat connexion]                     |
|--------------------------------------|
| [Retour]         [Continuer]         |
+--------------------------------------+
```

### États clés

- `connecting`: message de connexion en cours, CTA désactivée.
- `connected`: CTA activée.
- `selected avatar`: feedback immédiat dans l'aperçu.

## 7) WF-05 Lobby - avant room (Host/Join)

Correspondance: `OnlineLobbyScreen.tsx` (`!roomCode`)

### Desktop

```txt
+----------------------------------------------------------------------------------+
| RETRO PARTY                                                    [Étape 5/5]      |
|-------------------------------------progress-------------------------------------|
|                             H1 "Configuration rapide"                             |
|----------------------------------------------------------------------------------|
| [Card Profil: avatar, nom, statut connexion, bouton Modifier]                    |
|----------------------------------------------------------------------------------|
| [Tab Host] [Tab Join]                                                             |
| Si Join: [Champ code room.......] + hint min 4 caractères                         |
|----------------------------------------------------------------------------------|
| Message de statut (action primaire courante)                                      |
|----------------------------------------------------------------------------------|
| [Retour]                                                    [Suivant]            |
+----------------------------------------------------------------------------------+
```

### Mobile

```txt
+--------------------------------------+
| RETRO PARTY            [Étape 5/5]   |
|------------progress------------------|
| H1                                   |
| [Card profil]                        |
| [Host] [Join]                        |
| [Code room si Join]                  |
| [Message statut]                     |
|--------------------------------------|
| [Retour]          [Suivant]          |
+--------------------------------------+
```

### États clés

- `host mode`: CTA = créer une session.
- `join mode`: CTA = rejoindre une session.
- `server unavailable`: bannière erreur persistante.

## 8) WF-06 Lobby room prête - vue Host

Correspondance: `OnlineLobbyScreen.tsx` (`roomCode` + `canStart=true`)

### Desktop

```txt
+----------------------------------------------------------------------------------+
| RETRO PARTY                                                     ROOM READY       |
|----------------------------------------------------------------------------------|
| [Bloc orchestration]                       [Bloc invitation]                      |
| - hint lancement                           - code room + copie                    |
| - slider nombre de rounds                  - aide invitation                      |
| - setup panel (optionnel)                                                          |
|----------------------------------------------------------------------------------|
| [Liste participants scrollable, statut online/offline, badge HOST]               |
|----------------------------------------------------------------------------------|
| [Annuler la session]                                      [Lancer la partie]     |
+----------------------------------------------------------------------------------+
```

### Mobile

```txt
+--------------------------------------+
| ROOM READY                            |
|--------------------------------------|
| [Bloc invitation: code + copier]     |
| [Bloc rounds / setup]                |
| [Liste participants]                 |
|--------------------------------------|
| [Annuler]         [Lancer]           |
+--------------------------------------+
```

### États clés

- `canStart=false`: bloc "en attente de l'host" pour participants.
- `launching`: CTA principale en chargement.
- `copied`: feedback local sur bouton copier.

## 9) WF-07 Lobby room prête - vue Participant

Correspondance: `OnlineLobbyScreen.tsx` (`roomCode` + `canStart=false`)

### Desktop/Mobile (structure identique allégée)

```txt
+--------------------------------------+
| ROOM ACTIVE                           |
|--------------------------------------|
| [Message attente host: {nom}]        |
| [Code room + copie]                  |
| [Liste participants + statuts]       |
|--------------------------------------|
| [Quitter la session]                 |
+--------------------------------------+
```

### États clés

- `waiting host`: message clair et stable.
- `host started`: transition automatique vers session de jeu.

## 10) WF-08 Préparer (templates) - écran utilitaire

Correspondance: `Prepare.tsx`

### Desktop

```txt
+----------------------------------------------------------------------------------+
| "Mes templates - {utilisateur}"                               [Accueil]          |
|----------------------------------------------------------------------------------|
| [Nouveau template] [Description] [Créer] [Se déconnecter]                        |
|----------------------------------------------------------------------------------|
| [Template A] [Éditer] [Lancer] [Supprimer]                                       |
| [Template B] [Éditer] [Lancer] [Supprimer]                                       |
| ...                                                                               |
+----------------------------------------------------------------------------------+
```

### Mobile

```txt
+--------------------------------------+
| Mes templates          [Accueil]     |
|--------------------------------------|
| [Nom template]                        |
| [Description]                         |
| [Créer] [Déconnexion]                 |
|--------------------------------------|
| [Template card]                       |
| [Éditer] [Lancer] [Supprimer]         |
+--------------------------------------+
```

### États clés

- `non connecté`: formulaire login/register.
- `chargement templates`: état intermédiaire explicite.
- `liste vide`: empty-state actionnable.

## 11) Tokens d'UI à appliquer sur tous les wireframes

- Typographie:
  - Titres: sobre, poids 600 max.
  - Texte courant: 14-16px desktop, 14-15px mobile.
- Espacements:
  - Grille 8pt.
  - Blocs majeurs: 24-32px desktop, 16-24px mobile.
- Accessibilité:
  - Contraste AA minimum.
  - Cibles tactiles min 44x44.
  - Focus visible sur composants interactifs.

## 12) Points à challenger (Discovery)

- Le `double click` pour navigation rapide est efficace mais peu découvrable: proposer un raccourci explicite ou le réserver aux power users.
- Le flux `Prepare` est fonctionnel mais visuellement moins aligné au parcours principal: harmoniser le shell visuel.
- Le lobby pourrait afficher un indicateur de progression collective (ex: "3/5 prêts") pour renforcer la lisibilité du "ready to launch".

## 13) Vérifications manuelles

1. Vérifier que chaque écran conserve une CTA primaire unique.
2. Vérifier les états disabled avec raison visible.
3. Vérifier le parcours clavier complet (Tab, Enter, Esc) sur onboarding + lobby.
4. Vérifier mobile portrait (390px) et desktop (1440px) sur les 8 wireframes.
5. Vérifier la lisibilité des statuts temps réel (connecté, en attente, lancement).

