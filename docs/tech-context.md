# Tech Context

## Modes techniques

### 🔍 Mode Discovery (exploration / conception)
Objectif : permettre l’exploration technique et les refontes si nécessaires

- Les refontes globales sont autorisées si justifiées
- Les agents peuvent proposer de nouvelles architectures
- Les contraintes techniques existantes peuvent être challengées
- Les propositions doivent rester réalistes et implémentables
- L’objectif est d’identifier la meilleure solution, pas la plus rapide

---

### 🛠️ Mode Delivery (implémentation)
Objectif : livrer de manière fiable, stable et incrémentale

- changements incrémentaux privilégiés
- découpage en sous-fonctionnalités testables
- pas de refonte globale sans validation explicite
- compatibilité desktop/mobile obligatoire
- compatibilité Docker obligatoire

---

## Principes techniques

- composants lisibles
- logique identifiable
- séparation claire UI / état / logique
- éviter la sur-ingénierie
- privilégier des solutions simples et maintenables

---

## Attentes

- code compréhensible et structuré
- architecture cohérente avec le projet
- facilité de maintenance
- capacité à évoluer

---

## Vigilances

- ne pas casser les parcours multijoueurs
- attention à la synchronisation temps réel
- attention aux régressions UI sur mobile
- attention aux effets de bord entre modules

---

## Règle clé

En mode Discovery :
→ proposer la meilleure solution possible, même si elle implique des changements importants

En mode Delivery :
→ sécuriser, simplifier et fiabiliser l’implémentation