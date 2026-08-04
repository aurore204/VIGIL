# UI Guidelines — VIGIL

VIGIL est une salle de contrôle opérationnelle. L'interface doit permettre à un opérateur d'identifier l'état critique d'un incident ou d'une release en moins d'une seconde, même sous stress et en conditions dégradées.

---

## Palette de couleurs

Le thème est sombre pour réduire la fatigue oculaire lors des interventions nocturnes et faire ressortir les alertes critiques. C'est le standard des outils opérationnels professionnels (PagerDuty, Grafana, Datadog).

Les couleurs sont exprimées en **oklch()** plutôt qu'en hexadécimal, pour garantir un contraste perceptuellement cohérent entre les teintes (essentiel sur un fond sombre où le contraste doit rester lisible quelle que soit la couleur sémantique utilisée).

### Couleurs de fond

| Rôle           | Valeur                     | Usage                             |
|----------------|-----------------------------|------------------------------------|
| Background     | `oklch(0.16 0.015 260)`     | Fond général de l'application     |
| Surface        | `oklch(0.195 0.015 260)`    | Cartes, panneaux, modales         |
| Surface raised | `oklch(0.22 0.02 260)`      | Éléments surélevés, blocs mis en avant |
| Border         | `oklch(0.30 0.02 260)`      | Séparateurs, bordures de cartes   |

### Couleurs de texte

| Rôle             | Valeur                     | Usage                                      |
|------------------|------------------------------|--------------------------------------------|
| Text primary     | `oklch(0.95 0.005 260)`     | Contenu principal, titres                  |
| Text secondary   | `oklch(0.72 0.01 260)`      | Métadonnées, timestamps, labels discrets   |
| Text disabled    | `oklch(0.45 0.01 260)`      | Éléments inactifs, valeurs non renseignées |

### Couleurs sémantiques

Chaque couleur a un rôle strict et n'est jamais utilisée en dehors de ce rôle, pour ne pas créer de confusion chez l'opérateur.

| Rôle      | Valeur                     | Usage strict                                              |
|-----------|------------------------------|-------------------------------------------------------------|
| Primary   | `oklch(0.66 0.16 255)`      | Actions principales, boutons CTA, liens actifs, focus      |
| Success   | `oklch(0.72 0.14 150)`      | Résolu, complété, validé — tout ce qui va bien              |
| Warning   | `oklch(0.82 0.14 85)`       | Attention requise, sévérité moyenne, état acquitté          |
| Danger    | `oklch(0.78 0.14 25)`       | Alerte critique, actions destructives, état escaladé        |
| Neutral   | `oklch(0.65 0.01 260)`      | États neutres, informations secondaires, sévérité faible    |

---

## Hiérarchie typographique

Police principale : **Inter** (fallback : `system-ui, sans-serif`), choisie pour sa lisibilité exceptionnelle sur écran, y compris en petite taille et sur fond sombre.

| Niveau    | Taille | Poids | Usage                                          |
|-----------|--------|-------|-------------------------------------------------|
| Title     | 22–24px | 700   | Titre de page, nom d'un incident ou d'une release |
| Subtitle  | 15–16px | 700   | Titre de section, nom de team                  |
| Body      | 13–14px | 400–600 | Contenu principal, entrées de timeline        |
| Caption   | 11–12px | 400–600 | Timestamps, métadonnées, labels de champs      |

---

## Spacing grid

Unité de base : **4px**. Les espacements observés dans l'interface (padding des cartes, gaps entre éléments) sont des multiples de cette unité, garantissant un alignement cohérent sur tous les écrans.

| Token | Valeur | Usage typique                                  |
|-------|--------|--------------------------------------------------|
| xs    | 4px    | Espacement entre icône et texte                  |
| sm    | 8px    | Padding interne des badges, gap entre boutons     |
| md    | 12–16px | Padding des cartes, espacement entre champs      |
| lg    | 20–24px | Espacement entre sections d'une page             |
| xl    | 28–32px | Marges de page                                   |

---

## Mapping état vers représentation visuelle

**Règle fondamentale :** la couleur n'est jamais le seul signal. Chaque état est communiqué simultanément par trois éléments : couleur + icône + texte. Cette règle garantit la lisibilité pour les utilisateurs daltoniens et s'applique à tous les badges de l'application (composant `Badge`, `components/ui/Badge.tsx`).

### États des Incidents

| État         | Couleur  | Icône (lucide-react) | Texte affiché |
|--------------|----------|------------------------|---------------|
| open         | Neutral  | `Circle`               | Ouvert        |
| acknowledged | Primary  | `CheckCircle2`         | Acquitté      |
| escalated    | Warning  | `ArrowUpCircle`        | Escaladé      |
| resolved     | Success  | `CheckCircle2`         | Résolu        |

### Niveaux de sévérité

| Sévérité | Couleur  | Icône (lucide-react) | Texte affiché |
|----------|----------|------------------------|---------------|
| low      | Success  | `Info`                 | Faible        |
| medium   | Warning  | `AlertTriangle`        | Moyen         |
| high     | Warning  | `AlertTriangle`        | Élevé         |
| critical | Danger   | `Flame`                | Critique      |

### États des Releases

| État        | Couleur  | Icône (lucide-react) | Texte affiché |
|-------------|----------|------------------------|---------------|
| created     | Neutral  | `Square`                | Créée         |
| in_progress | Primary  | `RefreshCw`             | En cours      |
| completed   | Success  | `CheckCircle2`          | Terminée      |
| cancelled   | Neutral  | `XCircle`               | Annulée       |
| blocked     | Danger   | `Lock`                  | Bloquée       |

---

## Composants réutilisables

### Badge (`IncidentStateBadge`, `SeverityBadge`, `ReleaseStateBadge`, `RoleBadge`)
Composant unique paramétré par variante. Toujours composé de : fond coloré semi-transparent + icône `lucide-react` + texte. Aucune variante n'utilise la couleur seule.

### Button
Variants : `primary` (action principale), `secondary` (action secondaire, contour), `danger` (action destructive), `ghost` (action discrète, sans fond). Tous les boutons sont focusables au clavier et affichent un état `loading` avec spinner intégré.

### Input
Chaque champ de formulaire a un label explicite (`<label htmlFor>`) positionné au-dessus du champ. Aucun champ n'utilise le placeholder comme seul indicateur du contenu attendu — le placeholder, quand il existe, est purement indicatif. L'état d'erreur affiche un message descriptif sous le champ en couleur Danger.

### ConfirmDialog
Modale de confirmation obligatoire pour toute action destructive (supprimer un incident/une team, kick, ban, annuler une release, transférer le rôle Manager). Structure : titre de l'action + description nommant explicitement la ressource affectée + bouton d'annulation (`secondary`) + bouton de confirmation (`danger`), toujours positionné à droite. Se ferme au clavier via `Escape`, et le focus se pose automatiquement sur le bouton d'annulation à l'ouverture.

### Toast
Notification temporaire (4 secondes) affichée en bas à droite de l'écran après chaque action serveur. Variants : `success`, `error`, `warning`, `info`, chacun avec sa propre couleur et icône.

### PresenceIndicator
Bandeau affichant la liste des membres consultant actuellement une même ressource (incident ou release), sous forme de pastilles avatar + nom. Alimenté en temps réel par l'événement WebSocket `presence_update`.

---

## Dark patterns identifiés et évités

| Dark pattern                    | Comment VIGIL l'évite                                                        |
|----------------------------------|-------------------------------------------------------------------------------|
| Confirmation inversée            | Le bouton de confirmation correspond toujours à l'action réellement souhaitée par l'utilisateur, jamais à son inverse |
| Options critiques cachées        | Toutes les actions destructives (supprimer, kick, ban) sont des boutons visibles et étiquetés en clair, jamais dissimulées dans un sous-menu |
| Suppression sans confirmation    | Toute action irréversible déclenche une `ConfirmDialog` nommant explicitement la ressource concernée |
| Placeholder comme seul label     | Chaque champ de formulaire a un `<label>` HTML associé, indépendamment du placeholder |
| Bouton d'annulation en rouge     | La couleur Danger est réservée exclusivement à l'action destructive ; le bouton d'annulation reste neutre |

---

## Accessibilité

Niveau ciblé : **WCAG 2.1 AA**.

### Navigation clavier
Les actions principales sont accessibles au clavier (`Tab` pour naviguer, `Enter` pour valider, `Escape` pour fermer une modale) :
- Créer, acquitter, escalader, résoudre un incident
- Valider une étape de release
- Ajouter ou modifier une entrée de timeline
- Rejoindre une team, générer un code d'invitation

### Contraste
- Texte courant : rapport de contraste minimum 4.5:1 sur le fond associé
- Grands textes et composants d'interface (icônes, bordures de boutons) : rapport de contraste minimum 3:1
- Vérifié manuellement sur chaque couple (texte, fond) de la palette ci-dessus

### Couleur non exclusive
Chaque état (incident, sévérité, release) associe systématiquement couleur, icône et texte. Un utilisateur daltonien identifie l'état affiché grâce à l'icône et au texte, indépendamment de sa capacité à distinguer les teintes.

### Labels explicites
Tous les champs de formulaire ont un label HTML associé via `htmlFor`. Aucun champ n'est identifiable uniquement par son placeholder.

---

