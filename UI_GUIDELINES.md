# UI Guidelines — VIGIL

Ce document décrit les règles visuelles et d'accessibilité appliquées dans les deux clients (web et desktop) de VIGIL, ainsi que la manière dont l'application évite les dark patterns.

## 1. Palette de couleurs

VIGIL utilise une palette de 5 couleurs primaires (format `oklch`), chacune avec un usage défini.

| Couleur | Valeur de référence | Usage |
|---|---|---|
| **Bleu** (action primaire) | `oklch(0.66 0.16 255)` | Boutons principaux, liens actifs, éléments sélectionnés, rôle Manager |
| **Gris neutre** (surface / texte) | `oklch(0.16–0.20 0.015 260)` (fonds) / `oklch(0.55–0.95 0.01 260)` (texte) | Fonds de page, cartes, texte principal et secondaire |
| **Vert** (succès) | `oklch(0.72 0.14 150)` | États résolus/complétés, connexion active, validation |
| **Ambre / Orange** (avertissement) | `oklch(0.78–0.82 0.14 60–85)` | Sévérité moyenne/élevée, états d'escalade, actions d'automatisation |
| **Rouge** (danger) | `oklch(0.55–0.78 0.15–0.18 25)` | Actions destructives, sévérité critique, erreurs, bannissements |

Une seule couleur d'accent est utilisée à la fois par composant interactif, et le rouge est **exclusivement réservé** aux actions destructives ou aux états critiques.

## 2. Hiérarchie typographique

| Niveau | Taille | Poids | Exemple d'usage |
|---|---|---|---|
| **Titre** | 22–26px | 700 | Nom de la page, titre d'un incident/release |
| **Sous-titre / en-tête de section** | 11–13px, majuscules | 700 | En-têtes de carte ("INFORMATIONS", "ÉTAPES") |
| **Corps** | 12–14px | 400–600 | Texte courant, labels, contenu des messages |

Police unique dans toute l'application : **Inter** (system-ui en repli).

## 3. Grille d'espacement

Échelle régulière basée sur des multiples de 4px : `4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32px`. Cartes : padding 18–24px. Listes : espacement interne 12–16px. Rayons de bordure : 6–9px pour les éléments interactifs, 12–14px pour les cartes.

## 4. Mapping état → représentation visuelle

Chaque état métier est représenté par la **combinaison** couleur + icône + texte, jamais par la couleur seule.

### États d'incident
| État | Couleur | Icône |
|---|---|---|
| `open` | Rouge | Cercle |
| `acknowledged` | Bleu | Coche |
| `escalated` | Ambre | Flèche vers le haut |
| `resolved` | Vert | Coche |

### Sévérité
| Niveau | Couleur | Icône |
|---|---|---|
| `low` | Vert | Info |
| `medium` | Ambre | Triangle d'alerte |
| `high` | Orange | Triangle d'alerte |
| `critical` | Rouge | Flamme |

### États de release
| État | Couleur | Icône |
|---|---|---|
| `created` | Gris | Carré |
| `in_progress` | Bleu | Flèches de rafraîchissement |
| `completed` | Vert | Coche |
| `cancelled` | Gris | Croix |
| `blocked` | Rouge | Cadenas |

## 5. Composants réutilisables

| Composant | Variantes | Description |
|---|---|---|
| **Button** | `primary`, `secondary`, `danger`, `ghost` | État de chargement intégré, désactivation visuelle claire |
| **Badge** | `IncidentStateBadge`, `SeverityBadge`, `ReleaseStateBadge`, `RoleBadge` | Toujours icône + couleur + texte |
| **Modal** | — | Conteneur standard pour formulaires de création |
| **ConfirmDialog** | — | Systématique pour toute action destructive |
| **Input** | avec `label` et `hint` optionnel | Jamais de champ sans label explicite |
| **Toast** | `success`, `error`, `warning`, `info` | Notifications non bloquantes |
| **Carte à en-tête iconique** | — | Icône colorée dans un cadre + titre de section |

Deux écrans effectuant une action similaire (créer un incident vs créer une release) partagent la même structure de formulaire et les mêmes composants.

## 6. Dark patterns : identification et mitigation

- **Confirmation obligatoire sur toute action destructive.** `ConfirmDialog` est utilisé pour : suppression d'incident, kick, ban, annulation de release, transfert du rôle Manager, suppression de team. Chaque dialogue **nomme explicitement la ressource concernée** (voir capture 2).
- **Pas d'inversion de confirmation.** Le bouton d'annulation dit toujours "Annuler", le bouton de confirmation reprend le nom de l'action ("Supprimer", "Bannir") — jamais de formulation piégeuse.
- **Pas d'option critique cachée.** Toutes les actions destructives sont visuellement identifiables et accessibles au même niveau que les autres actions.

## 7. Accessibilité

- **Navigation clavier** : toutes les actions primaires sont des `<button>` natifs, focusables et activables au clavier. `ConfirmDialog` place le focus sur "Annuler" à l'ouverture, et se ferme sur `Escape`.
- **Labels explicites** : tous les champs utilisent `Input` avec une prop `label` obligatoire.
- **Redondance de l'information de couleur** : couleur + icône + texte pour chaque état (voir section 4), lisible pour les utilisateurs daltoniens.
- **Attributs ARIA** : icônes décoratives en `aria-hidden="true"`, boutons sans texte visible avec `aria-label`/`title`.

## 8. Captures annotées

**Capture 1 — Mapping état/sévérité sur la page de détail d'un incident**

![Page de détail d'un incident, sévérité et état annotés](./image.png)

La sévérité (`Critique`, rouge, icône flamme) et l'état (`Ouvert`, ambre, icône cercle) sont deux informations distinctes affichées côte à côte, chacune avec sa propre combinaison couleur + icône + texte — conforme à la règle de la section 4.

**Capture 2 — Boîte de dialogue de confirmation**

![Dialogue de confirmation avant de quitter une team, ressource nommée](./image-1.png)

Le message nomme explicitement la ressource concernée ("Quitter la team 'Data Enginneer' ?"), et les deux boutons ne sont jamais inversés : "Annuler" reste neutre, "Confirmer" porte le nom de l'action.

---
*Document rédigé dans le cadre du projet VIGIL — Epitech.*