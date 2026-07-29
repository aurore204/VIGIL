# UI Guidelines — VIGIL

VIGIL est une salle de contrôle opérationnelle. L'interface doit permettre à un opérateur d'identifier l'état critique d'un incident ou d'une release en moins d'une seconde, même sous stress et en conditions dégradées.

---

## Palette de couleurs

Le thème est sombre pour réduire la fatigue oculaire lors des interventions nocturnes et faire ressortir les alertes critiques. C'est le standard des outils opérationnels professionnels (PagerDuty, Grafana, Datadog).

### Couleurs de fond

| Rôle           | Valeur    | Usage                                        |
|----------------|-----------|----------------------------------------------|
| Background     | `#0F1117` | Fond général de l'application                |
| Surface        | `#1A1D27` | Cartes, panneaux, modales                    |
| Surface raised | `#232637` | Éléments surélevés, dropdowns                |
| Border         | `#2D3148` | Séparateurs, bordures de cartes              |

### Couleurs de texte

| Rôle             | Valeur    | Usage                                      |
|------------------|-----------|--------------------------------------------|
| Text primary     | `#E2E8F0` | Contenu principal, titres                  |
| Text secondary   | `#8892A4` | Métadonnées, timestamps, labels discrets   |
| Text disabled    | `#4A5568` | Éléments inactifs                          |

### Couleurs sémantiques

Chaque couleur a un rôle strict. Elle ne doit jamais être utilisée en dehors de ce rôle pour ne pas créer de confusion chez l'opérateur.

| Rôle      | Valeur    | Usage strict                                              |
|-----------|-----------|-----------------------------------------------------------|
| Primary   | `#3B82F6` | Actions principales, boutons CTA, liens actifs, focus     |
| Success   | `#10B981` | Résolu, complété, validé, tout ce qui va bien             |
| Warning   | `#F59E0B` | Attention requise, sévérité medium, état acknowledged     |
| Danger    | `#EF4444` | Alerte critique, actions destructives, état escalated     |
| Neutral   | `#8892A4` | États neutres, informations secondaires, sévérité low     |

---

## Hiérarchie typographique

Police principale : **Inter** (fallback : system-ui, sans-serif)

Inter a été choisie pour sa lisibilité exceptionnelle sur écran, même en petite taille et sur fond sombre.

| Niveau    | Taille | Poids | Usage                                         |
|-----------|--------|-------|-----------------------------------------------|
| Title     | 24px   | 700   | Titre de page, nom d'un incident              |
| Subtitle  | 18px   | 600   | Titre de section, nom de team, nom de release |
| Body      | 14px   | 400   | Contenu principal, entrées de timeline        |
| Caption   | 12px   | 400   | Timestamps, métadonnées, labels de champs     |

---

## Spacing grid

Unité de base : **4px**. Tous les espacements sont des multiples de 4 pour garantir un alignement pixel-perfect sur tous les écrans.

| Token | Valeur | Usage typique                          |
|-------|--------|----------------------------------------|
| xs    | 4px    | Espacement entre icône et texte        |
| sm    | 8px    | Padding interne des badges             |
| md    | 16px   | Padding des cartes, espacement entre éléments |
| lg    | 24px   | Espacement entre sections              |
| xl    | 32px   | Marges de page                         |
| 2xl   | 48px   | Espacement entre blocs majeurs         |

---

## Mapping état vers représentation visuelle

**Règle fondamentale :** la couleur n'est jamais le seul signal. Chaque état est toujours communiqué par trois éléments simultanément : couleur + icône + texte. Cette règle garantit la lisibilité pour les utilisateurs daltoniens.

### États des Incidents

| État         | Couleur  | Icône               | Texte affiché |
|--------------|----------|---------------------|---------------|
| open         | Danger   | Cercle vide         | Ouvert        |
| acknowledged | Warning  | Demi-cercle         | Acquitté      |
| escalated    | Danger   | Triangle d'alerte   | Escaladé      |
| resolved     | Success  | Cercle coché        | Résolu        |

### Niveaux de sévérité

| Sévérité | Couleur  | Icône               | Texte affiché |
|----------|----------|---------------------|---------------|
| low      | Neutral  | Cercle info         | Faible        |
| medium   | Warning  | Triangle attention  | Moyen         |
| high     | Danger   | Triangle plein      | Élevé         |
| critical | Danger   | Hexagone alerte     | Critique      |

### États des Releases

| État        | Couleur  | Icône               | Texte affiché |
|-------------|----------|---------------------|---------------|
| created     | Neutral  | Carré vide          | Créée         |
| in_progress | Primary  | Cercle en rotation  | En cours      |
| completed   | Success  | Cercle coché        | Terminée      |
| cancelled   | Neutral  | Cercle barré        | Annulée       |
| blocked     | Danger   | Cadenas             | Bloquée       |

---

## Composants réutilisables

### IncidentStateBadge
Affiche l'état d'un incident. Toujours composé de : fond coloré semi-transparent + icône + texte.
Variants : open, acknowledged, escalated, resolved.

### SeverityBadge
Affiche le niveau de sévérité. Toujours composé de : fond coloré semi-transparent + icône + texte.
Variants : low, medium, high, critical.

### ReleaseStateBadge
Affiche l'état d'une release. Toujours composé de : fond coloré semi-transparent + icône + texte.
Variants : created, in_progress, completed, cancelled, blocked.

### ConfirmDialog
Modale de confirmation obligatoire pour toutes les actions destructives (supprimer, kick, ban, annuler une release, transférer le rôle Manager).
Structure : titre de l'action + nom de la ressource affectée + bouton d'annulation + bouton de confirmation en Danger.
Le bouton de confirmation est toujours à droite et en couleur Danger.

### Button
Variants : primary (action principale), secondary (action secondaire), danger (action destructive), ghost (action discrète).
Tous les boutons ont un état focus visible au clavier avec un outline de 2px en couleur Primary.

### Input
Chaque champ de formulaire a un label explicite positionné au-dessus du champ.
Aucun champ n'utilise le placeholder comme seul indicateur du contenu attendu.
L'état d'erreur affiche un message descriptif sous le champ en couleur Danger.
Le focus est visible au clavier avec un outline de 2px en couleur Primary.

### Toast
Notification temporaire (3 secondes) affichée en bas à droite de l'écran après chaque action.
Variants : success (action réussie), error (erreur), warning (avertissement), info (information).

---

## Dark patterns identifiés et évités

| Dark pattern                         | Comment on l'évite                                                      |
|--------------------------------------|-------------------------------------------------------------------------|
| Confirmation inversée                | Le bouton de confirmation est toujours l'action souhaitée, jamais l'inverse |
| Options critiques cachées            | Toutes les actions destructives sont étiquetées clairement et visibles  |
| Suppression sans confirmation        | Chaque action DELETE déclenche une ConfirmDialog avec le nom de la ressource |
| Placeholder comme seul label         | Chaque champ a un label explicite, le placeholder est optionnel         |
| Bouton de cancel en rouge            | Le rouge est réservé à l'action destructive, jamais à l'annulation     |

---

## Accessibilité

Niveau ciblé : WCAG 2.1 AA

### Navigation clavier
Toutes les actions principales sont accessibles au clavier :
- Créer un incident, acquitter, escalader, résoudre
- Valider une étape de release
- Ajouter une entrée de timeline
- Rejoindre une team, générer un code d'invitation

Touches supportées : Tab pour naviguer, Enter pour confirmer, Escape pour fermer les modales.

### Contraste
- Texte normal : rapport de contraste minimum 4.5:1
- Grands textes et composants UI : rapport de contraste minimum 3:1

### Couleur non exclusive
Chaque état utilise couleur + icône + texte. Un utilisateur daltonien peut identifier l'état d'un incident uniquement grâce à l'icône et au texte, sans avoir besoin de distinguer les couleurs.

### Labels explicites
Tous les champs de formulaire ont un label HTML associé via l'attribut `htmlFor`. Aucun champ n'est identifiable uniquement par son placeholder.
