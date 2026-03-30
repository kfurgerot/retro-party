# AGENTS.md

## Projet
Retro Party est une suite d'outils Agile en ligne comprenant :
- Retro Party : jeu de rétrospective multijoueur
- Planning Party : planning poker multijoueur
- Radar Party : diagnostic d’équipe Agile avec restitution radar

## Priorités
- cohérence UX/UI entre modules
- simplicité d’usage
- expérience fluide sur desktop et mobile
- changements incrémentaux
- robustesse des parcours multijoueurs / temps réel

## Règles globales
1. Toujours lire `docs/product-context.md` avant de cadrer une feature.
2. Toujours lire `docs/tech-context.md` avant toute proposition technique ou implémentation.
3. Toujours privilégier le MVP le plus simple.
4. Ne jamais faire de refonte globale non demandée.
5. Préserver la cohérence entre Retro Party, Planning Party et Radar Party.
6. Préférer des changements testables, réversibles et lisibles.
7. En cas de besoin flou :
   - analyser
   - structurer
   - implémenter
   - vérifier
   - challenger côté usage / facilitation si nécessaire
8. Toujours expliciter les hypothèses.
9. Toute implémentation doit finir par une section `Vérifications manuelles`.
10. Ne pas ajouter de dépendance sans justification explicite.