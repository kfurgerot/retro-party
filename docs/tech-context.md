# Tech Context

## Principes techniques
- changements incrémentaux
- pas de refonte globale non demandée
- découpage en sous-fonctionnalités testables
- compatibilité desktop/mobile
- compatibilité Docker

## Attentes
- composants lisibles
- logique identifiable
- séparation raisonnable UI / état / logique
- pas de sur-ingénierie

## Vigilances
- ne pas casser les parcours multijoueurs
- attention à la synchronisation temps réel
- attention aux régressions UI sur petit écran
- attention aux effets de bord entre modules