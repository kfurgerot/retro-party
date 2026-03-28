# Module Radar Party

Radar Party est un module de diagnostic Agile integre a Retro Party.

## Capacites

- questionnaire de 40 questions (1 a 5)
- scoring sur 4 axes opposes
- radar individuel (0-100)
- creation et participation a des sessions equipe
- radar moyen d'equipe
- insights automatiques pour atelier de retro/coaching

## Axes

- Collaboration: solo ? equipe
- Approche produit: delivery ? qualite
- Decision: data ? intuition/humain
- Organisation: structure ? adaptatif

Convention radar:

- collaboration = % team
- product = % quality
- decision = % data
- organization = % structured

## Ecrans

- Accueil Radar Party (`/radar-party`)
- Explication
- Questionnaire question par question + progression
- Resultat individuel
- Creation/rejoindre session equipe
- Radar equipe
- Insights atelier

## API backend

- `GET /api/radar/questions`
- `POST /api/radar/sessions`
- `POST /api/radar/sessions/:code/participants`
- `POST /api/radar/sessions/:code/submissions`
- `GET /api/radar/sessions/:code`

## Persistence

Tables ajoutees:

- `radar_sessions`
- `radar_participants`
- `radar_responses`
- `radar_team_results`

## Lancement Docker

Aucun service supplementaire n'est requis.
Le module fonctionne avec la stack existante:

```bash
docker compose up -d --build
```

Puis ouvrir `http://localhost:8088` et choisir l'experience **Radar Party**.

## Notes implementation

- scoring conforme aux regles demandees (somme par pole, puis normalisation en pourcentage)
- detection d'axe divergent equipe quand min/max > 25 points
- labels interface en francais
