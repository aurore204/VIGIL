# VIGIL

Une équipe qui déploie en production gère deux types de situations très différentes. D'un côté, du **planifié** : une release préparée à l'avance, validée étape par étape avant d'atteindre la prod. De l'autre, de **l'imprévu** : un incident détecté qui doit être trié, escaladé, assigné et résolu, souvent dans l'urgence. La plupart des outils traitent ces deux réalités séparément — VIGIL les traite ensemble, dans une seule salle de contrôle collaborative, parce qu'elles sont liées dans la vraie vie : un incident actif peut bloquer une release en cours, et une release peut déclencher un incident si elle échoue.

VIGIL est ce produit : une plateforme temps réel où une équipe technique coordonne ses Releases et ses Incidents, avec un rôle par personne (Observer, Responder, Manager), une timeline collaborative, et — en Phase 2 — un moteur de règles qui connecte VIGIL à des services externes comme GitHub.

Trois interfaces partagent le même serveur et la même logique métier : un client web, un client desktop natif (avec tray icon et notifications système), et une API REST/WebSocket ouverte.

---

## Vue d'ensemble fonctionnelle

Avant le détail technique, voici comment le produit s'utilise concrètement :

1. Un utilisateur s'inscrit, crée une **Team** ou en rejoint une via un code d'invitation généré par le Manager.
2. Chaque membre a un rôle : **Observer** (lecture seule), **Responder** (acquitte, escalade, commente), **Manager** (crée, assigne, modère).
3. Un **Incident** suit un cycle de vie linéaire — `open → acknowledged → escalated → resolved` — pendant que sa **sévérité** (`low → medium → high → critical`) peut continuer à monter tant qu'il n'est pas résolu.
4. Une **Release** avance par étapes séquentielles validées une à une. Si elle est explicitement liée à un incident actif, elle se **bloque automatiquement** et reprend dès que l'incident est résolu.
5. Tout ce qui se passe est diffusé en temps réel via WebSocket à tous les membres connectés — timeline, changements d'état, présence, messages privés.
6. En Phase 2, des **règles Action → REAction** automatisent des réponses : par exemple, un échec de CI sur GitHub crée automatiquement un incident dans VIGIL.
7. Le client desktop ajoute deux choses que le web ne peut pas faire : rester actif en arrière-plan via une icône dans la zone de notification, et envoyer de vraies notifications système (assignation, sévérité critique, release bloquée).

Le reste de ce document détaille l'implémentation : stack, architecture, schéma de données, API, et procédures d'installation.

---

## Stack technique

| Composant        | Technologie     | Justification                          |
|------------------|-----------------|----------------------------------------|
| Serveur          | Rust (Axum)     | Performance, sécurité mémoire, async   |
| Client Web       | Next.js         | SSR, routing, écosystème React         |
| Client Desktop   | Tauri           | Rust natif, binaire léger              |
| Base de données  | PostgreSQL      | Concurrence, transactions ACID         |
| Temps réel       | WebSockets      | Diffusion bidirectionnelle             |
| Conteneurisation | Docker Compose  | Environnement reproductible            |
| CI/CD            | GitHub Actions  | Exemption T-DEV-600 déclarée au kickoff|

### Pourquoi ces choix, concrètement

**Rust plutôt que NodeJS.** Le vrai argument n'est pas la vitesse brute mais la prévisibilité : pas de garbage collector qui pause le serveur au mauvais moment quand plusieurs centaines de connexions WebSocket sont ouvertes en même temps. Axum + Tokio gèrent cette concurrence nativement, et sqlx vérifie les requêtes SQL à la compilation — une erreur de colonne ou de type se voit à `cargo build`, pas en production.

**PostgreSQL plutôt que SQLite.** VIGIL a des écritures concurrentes réelles : deux Responders qui acquittent des incidents en même temps, un Manager qui valide une étape de release pendant qu'un autre modifie l'équipe. SQLite verrouille la base entière à l'écriture, ce qui devient vite un goulot d'étranglement dès qu'on sort d'un usage mono-utilisateur — pas adapté ici.

**Tauri plutôt qu'Electron.** Puisque le serveur est déjà en Rust, autant réutiliser cette compétence côté desktop plutôt que d'ajouter un runtime Node embarqué. Le binaire produit est nettement plus léger (quelques dizaines de Mo contre plusieurs centaines pour Electron) parce que Tauri s'appuie sur le moteur de rendu déjà présent sur l'OS au lieu d'embarquer Chromium.

---

## Architecture globale

    External services (GitHub, webhooks...)
              |
              | POST /webhooks/{service}
              v
    +----------------------------------+
    |        Application Server        |
    |                                  |
    |  Webhook Receiver (HMAC)         |
    |         |                        |
    |         v                        |
    |  Hook Engine (rule evaluation)   |
    |         |                        |
    |         v                        |
    |  WS Broadcaster                  |
    |  REST API - Business Logic - DB  |
    +----------------------------------+
              |
              | WebSocket + REST
        +-----+------+------------+
        v             v            v
    Web Client    Desktop Client   (même codebase Next.js ;
    (Next.js)     (Tauri)          export statique pour le desktop)

### Où vit chaque responsabilité

Pour naviguer rapidement dans le code :

| Couche        | Chemin                        | Rôle                                              |
|---------------|--------------------------------|----------------------------------------------------|
| Handlers      | `server/src/handlers/`        | Reçoivent les requêtes HTTP, appellent les services |
| Services      | `server/src/services/`        | Logique métier, règles de validation               |
| Repositories  | `server/src/repositories/`    | Accès exclusif à la base de données               |
| WebSocket     | `server/src/websocket/`       | Broadcaster et handler de connexions WS           |
| Middleware    | `server/src/middleware/`      | Vérification JWT et permissions par rôle          |
| Models        | `server/src/models/`          | Structures de données et types                    |
| State         | `server/src/state.rs`         | État partagé : pool PostgreSQL + broadcaster      |
| Desktop natif | `client_desktop/src-tauri/`   | Tray icon, notifications OS, wrapper de `client_web` |

---

## Schéma de la base de données

    -- Comptes utilisateurs, authentification JWT et préférences
    users (
      id UUID PK,
      email VARCHAR UNIQUE,
      password_hash VARCHAR,        -- nullable pour OAuth2
      username VARCHAR UNIQUE,
      language VARCHAR(2),          -- 'fr' ou 'en', persisté côté serveur
      token_invalidated_at TIMESTAMPTZ, -- invalidation lors du logout
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )

    -- Espaces de travail partagés entre membres
    teams (
      id UUID PK,
      name VARCHAR,
      description TEXT,
      manager_id UUID -> users,     -- un seul Manager par team
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )

    -- Appartenance d'un user à une team avec son rôle
    team_members (
      id UUID PK,
      team_id UUID -> teams,
      user_id UUID -> users,
      role team_role,               -- observer | responder | manager
      joined_at TIMESTAMPTZ,
      UNIQUE (team_id, user_id)
    )

    -- Codes d'invitation générés par le Manager pour rejoindre une team
    team_invitations (
      id UUID PK,
      team_id UUID -> teams,
      created_by UUID -> users,
      code VARCHAR UNIQUE,          -- code aléatoire de 8 caractères
      expires_at TIMESTAMPTZ,       -- nullable = pas d'expiration
      created_at TIMESTAMPTZ
    )

    -- Bans temporaires et permanents appliqués par le Manager
    team_bans (
      id UUID PK,
      team_id UUID -> teams,
      user_id UUID -> users,
      banned_by UUID -> users,
      reason TEXT,
      expires_at TIMESTAMPTZ,       -- NULL = ban permanent
      created_at TIMESTAMPTZ,
      UNIQUE (team_id, user_id)
    )

    -- Problèmes détectés en production, cycle de vie complet
    incidents (
      id UUID PK,
      team_id UUID -> teams,
      created_by UUID -> users,
      assigned_to UUID -> users,    -- nullable, assigné par le Manager
      title VARCHAR,
      description TEXT,
      state incident_state,         -- open | acknowledged | escalated | resolved
      severity incident_severity,   -- low | medium | high | critical
      resolved_at TIMESTAMPTZ,      -- renseigné à la résolution
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )

    -- Journal collaboratif d'un incident, visible par tous en temps réel
    incident_timeline (
      id UUID PK,
      incident_id UUID -> incidents,
      author_id UUID -> users,
      content TEXT,                 -- max 2000 caractères
      edited_at TIMESTAMPTZ,        -- NULL = jamais modifié
      created_at TIMESTAMPTZ
    )

    -- Réactions emoji sur les entrées de timeline
    timeline_reactions (
      id UUID PK,
      entry_id UUID -> incident_timeline,
      user_id UUID -> users,
      emoji VARCHAR,                -- parmi la liste définie par le serveur
      created_at TIMESTAMPTZ,
      UNIQUE (entry_id, user_id, emoji) -- un emoji par user par entrée
    )

    -- Déploiements planifiés avec étapes séquentielles
    releases (
      id UUID PK,
      team_id UUID -> teams,
      created_by UUID -> users,
      title VARCHAR,
      description TEXT,
      state release_state,          -- created | in_progress | completed | cancelled | blocked
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )

    -- Étapes séquentielles d'une release (build, staging, go_no_go, production...)
    release_steps (
      id UUID PK,
      release_id UUID -> releases,
      validated_by UUID -> users,   -- nullable avant validation
      name VARCHAR,
      description TEXT,
      position INTEGER,             -- ordre d'exécution, étape précédente obligatoire
      state step_state,             -- pending | in_progress | completed | cancelled
      validated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      UNIQUE (release_id, position)
    )

    -- Liaison release/incident, créée explicitement via
    -- POST /releases/:id/incidents/:iid (depuis le formulaire de création
    -- d'incident, en choisissant une release "in_progress" de la même team).
    -- Quand tous les incidents liés à une release sont résolus, la release
    -- repasse automatiquement à in_progress.
    release_incidents (
      id UUID PK,
      release_id UUID -> releases,
      incident_id UUID -> incidents,
      created_at TIMESTAMPTZ,
      UNIQUE (release_id, incident_id)
    )

    -- Messages directs 1-to-1 entre membres partageant une team
    private_messages (
      id UUID PK,
      sender_id UUID -> users,
      receiver_id UUID -> users,
      content TEXT,                 -- max 2000 caractères
      read_at TIMESTAMPTZ,          -- NULL = non lu
      created_at TIMESTAMPTZ
    )

    -- Tokens OAuth2 et personnels chiffrés pour les services tiers (Phase 2)
    user_tokens (
      id UUID PK,
      user_id UUID -> users,
      service_name VARCHAR,
      token_type token_type,        -- oauth2 | personal
      access_token TEXT,            -- chiffré côté serveur
      refresh_token TEXT,           -- chiffré côté serveur
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      UNIQUE (user_id, service_name)
    )

    -- Règles Action-REAction du moteur d'automatisation (Phase 2)
    rules (
      id UUID PK,
      team_id UUID -> teams,
      created_by UUID -> users,
      name VARCHAR,
      enabled BOOLEAN,
      trigger JSONB,                -- service, event, filters
      reaction JSONB,               -- type, payload
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    )

    -- Historique des déclenchements de règles (Phase 2)
    rule_logs (
      id UUID PK,
      rule_id UUID -> rules,
      status rule_log_status,       -- success | failed
      result JSONB,                 -- données du résultat
      error TEXT,                   -- message d'erreur si échec
      triggered_at TIMESTAMPTZ
    )

---

## API REST complète

### Authentification

| Méthode | Route            | Description                              | Auth |
|---------|------------------|-------------------------------------------|------|
| POST    | /auth/register   | Inscription email/password               | Non  |
| POST    | /auth/login      | Connexion, retourne un token JWT         | Non  |
| GET     | /me              | Utilisateur connecté                     | Oui  |
| POST    | /auth/logout     | Déconnexion avec invalidation du token   | Oui  |

### Teams

| Méthode | Route                              | Description                    | Rôle requis |
|---------|--------------------------------------|---------------------------------|-------------|
| GET     | /teams                             | Mes teams                      | Membre      |
| POST    | /teams                             | Créer une team                 | Tout user   |
| GET     | /teams/:id                         | Détail d'une team              | Membre      |
| PATCH   | /teams/:id                         | Modifier nom/description       | Manager     |
| DELETE  | /teams/:id                         | Supprimer une team             | Manager     |
| GET     | /teams/:id/members                 | Liste des membres              | Membre      |
| POST    | /teams/join                        | Rejoindre via code             | Tout user   |
| DELETE  | /teams/:id/leave                   | Quitter la team                | Membre      |
| POST    | /teams/:id/invitations             | Générer un code d'invitation   | Manager     |
| POST    | /teams/:id/transfer                | Transférer le rôle Manager     | Manager     |
| PATCH   | /teams/:id/members/:uid/role       | Modifier le rôle d'un membre   | Manager     |
| DELETE  | /teams/:id/members/:uid            | Kick un membre                 | Manager     |
| POST    | /teams/:id/members/:uid/ban        | Bannir un membre               | Manager     |
| DELETE  | /teams/:id/members/:uid/ban        | Lever un ban                   | Manager     |

### Incidents

| Méthode | Route                                    | Description                    | Rôle requis        |
|---------|-------------------------------------------|----------------------------------|--------------------|
| GET     | /teams/:id/incidents                     | Liste des incidents            | Membre             |
| POST    | /teams/:id/incidents                     | Créer un incident               | Manager            |
| GET     | /incidents/:id                           | Détail d'un incident           | Membre             |
| PATCH   | /incidents/:id                           | Modifier titre/sévérité        | Manager            |
| DELETE  | /incidents/:id                           | Supprimer un incident          | Manager            |
| PATCH   | /incidents/:id/acknowledge               | Acquitter                      | Responder/Manager  |
| PATCH   | /incidents/:id/escalate                  | Escalader (état + sévérité, répétable jusqu'à `critical`) | Responder/Manager |
| PATCH   | /incidents/:id/resolve                   | Résoudre (débloque les releases liées) | Manager     |
| POST    | /incidents/:id/assign                    | Assigner un Responder           | Manager            |
| POST    | /incidents/:id/timeline                  | Ajouter une entrée timeline    | Responder/Manager  |
| PATCH   | /incidents/:id/timeline/:eid             | Modifier son entrée            | Auteur uniquement  |

### Réactions

| Méthode | Route                                          | Description              | Rôle requis |
|---------|---------------------------------------------------|-----------------------------|-------------|
| GET     | /reactions/available                           | Liste des emojis         | Non         |
| POST    | /incidents/:id/timeline/:eid/reactions         | Ajouter une réaction     | Membre      |
| DELETE  | /incidents/:id/timeline/:eid/reactions/:emoji  | Retirer une réaction     | Membre      |

### Releases

| Méthode | Route                                  | Description                    | Rôle requis        |
|---------|-------------------------------------------|-----------------------------------|--------------------|
| GET     | /teams/:id/releases                    | Liste des releases             | Membre             |
| POST    | /teams/:id/releases                    | Créer une release               | Manager            |
| GET     | /releases/:id                          | Détail d'une release           | Membre             |
| PATCH   | /releases/:id/start                    | Démarrer une release           | Manager            |
| PATCH   | /releases/:id/cancel                   | Annuler une release            | Manager            |
| PATCH   | /releases/:id/steps/:sid/validate      | Valider une étape              | Responder/Manager  |
| POST    | /releases/:id/incidents/:iid           | Lier un incident (bloque la release si elle est `in_progress`) | Manager |

### Messages privés

| Méthode | Route                | Description              | Rôle requis |
|---------|-------------------------|------------------------------|-------------|
| POST    | /users/:id/messages  | Envoyer un message       | Membre      |
| GET     | /users/:id/messages  | Historique conversation  | Membre      |
| PATCH   | /messages/:id/read   | Marquer comme lu         | Destinataire|

### WebSocket

| Méthode | Route | Description                                    |
|---------|-------|--------------------------------------------------|
| GET     | /ws   | Connexion WebSocket (token via header ou query)|

### Phase 2

| Méthode | Route        | Description                        |
|---------|--------------|---------------------------------------|
| GET     | /about.json  | Catalogue des services disponibles |

---

## WebSockets

Voir [WEBSOCKET_SPEC.md](./WEBSOCKET_SPEC.md) pour la documentation complète des événements : type, payload, déclencheur et destinataires.

---

## Emojis disponibles

Le serveur expose 6 emojis fixes via `GET /reactions/available` :

| Code    | Description     |
|---------|-----------------|
| +1      | Pouce levé      |
| -1      | Pouce baissé    |
| eyes    | Yeux            |
| warning | Avertissement   |
| check   | Validation      |
| fire    | Feu             |

---

## Limites

| Ressource            | Limite          |
|-----------------------|-----------------|
| Entrées de timeline  | 2000 caractères |
| Messages privés      | 2000 caractères |

---

## Application desktop (Tauri)

Le client desktop réutilise tel quel le code de `client_web` (export statique Next.js) — aucune logique métier dupliquée. Deux comportements natifs s'ajoutent par-dessus :

**Tray icon.** Fermer la fenêtre la cache au lieu de tuer le processus, ce qui laisse la connexion WebSocket ouverte en arrière-plan. Une icône dans la zone de notification système permet de rouvrir la fenêtre (clic gauche, ou "Ouvrir VIGIL" dans le menu contextuel) ou de quitter réellement l'application.

**Notifications natives.** Trois déclencheurs envoient une notification OS via `tauri-plugin-notification`, en plus du toast affiché dans l'interface :

| Déclencheur                        | Condition exacte                                              |
|--------------------------------------|-------------------------------------------------------------------|
| Assignation à un incident          | `incident_assigned` reçu et `assigned_to` correspond à l'utilisateur connecté |
| Incident en sévérité critique      | `incident_escalated` reçu avec `new_severity == "critical"`  |
| Release bloquée par un incident    | `release_state_changed` reçu avec `new_state == "blocked"`   |

La permission système est demandée automatiquement au premier événement recevable.

---

## Variables d'environnement

Deux fichiers `.env` distincts sont nécessaires, à ne jamais committer (les deux sont dans `.gitignore`) :

### `server/.env` — pour lancer le serveur en local (`cargo run`)

    cp server/.env.example server/.env

| Variable      | Description                              |
|---------------|--------------------------------------------|
| DATABASE_URL  | URL de connexion PostgreSQL              |
| SERVER_HOST   | Hôte du serveur (0.0.0.0)               |
| SERVER_PORT   | Port du serveur (8080)                   |
| JWT_SECRET    | Clé secrète pour signer les tokens JWT  |
| RUST_LOG      | Niveau de logs (debug en développement) |

### `.env` à la racine — pour Docker Compose

Docker Compose ne lit **que** le `.env` placé à la racine du projet, jamais celui de `server/`. Il n'a besoin que d'une seule variable :

    JWT_SECRET=une_valeur_secrete_a_toi

Sans ce fichier, le conteneur `server` démarre puis panique dès la première requête d'authentification (`JWT_SECRET doit être défini`) — c'est la première chose à vérifier si `docker compose up` semble fonctionner mais que l'inscription échoue.

---

## Installation et lancement en local

### Prérequis

- Rust (stable)
- Docker et Docker Compose
- Node.js 18+
- sqlx-cli :

    cargo install sqlx-cli --no-default-features --features postgres

### Étapes — serveur et client web

    # 1. Cloner le projet
    git clone https://github.com/TON_USERNAME/vigil.git
    cd vigil

    # 2. Configurer les variables d'environnement (les deux fichiers, voir ci-dessus)
    cp server/.env.example server/.env
    echo "JWT_SECRET=une_valeur_secrete_a_toi" > .env

    # 3. Lancer la base de données
    docker compose up -d db

    # 4. Lancer les migrations
    cd server
    sqlx migrate run

    # 5. Lancer le serveur
    cargo run

    # 6. Lancer le client web (dans un autre terminal)
    cd ../client_web
    npm install
    npm run dev

### Étapes — client desktop (Tauri)

    # Prérequis système Linux (Debian/Ubuntu) :
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
      libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

    # Mode développement (serveur + client web doivent déjà tourner) :
    cd client_desktop/src-tauri
    cargo tauri dev

    # Build de l'exécutable final :
    cargo tauri build

### Tout lancer via Docker

    docker compose up --build

Construit et démarre les 4 services (`db`, `server`, `client_desktop`, `client_web`). Le service `client_desktop` ne reste pas actif : il compile le binaire `.AppImage`, le dépose dans un volume partagé, puis s'arrête — c'est normal de le voir `Exited (0)` dans `docker compose ps`. Le client web attend que ce build se termine avant de démarrer, pour pouvoir exposer le binaire à `http://localhost:8081/client.AppImage`.

Premier build à prévoir large : le service `client_desktop` compile Rust + toutes les dépendances GTK/WebKit depuis zéro, ça prend facilement 10 à 15 minutes selon la machine.

---

## Ports

| Service      | Port |
|--------------|------|
| Serveur      | 8080 |
| Client web   | 8081 |

---

## OS cible pour le client desktop

Linux — le binaire est exposé via :

    GET http://localhost:8081/client.AppImage

---

## Linting et formatage

### Rust

    cargo clippy
    cargo fmt --check

### TypeScript

    cd client_web
    npx eslint .
    npx prettier --check .

---

## Tests

    cd server
    cargo test

Coverage :

    cargo tarpaulin --out Html

---

## Méthodologie

Le projet a été découpé selon les 3 phases imposées, en respectant la règle "core avant extended avant phase suivante" plutôt que de picorer des fonctionnalités dans le désordre. Phase 1 validée d'abord dans son intégralité (auth, teams, incidents, WebSocket, reconnexion automatique), puis Phase 2 (moteur de règles, chiffrement des tokens, CI/CD), puis Phase 3 (desktop, notifications, Docker).

Un point notable : plusieurs bugs de Phase 1 — pourtant déjà validée — ont été découverts tardivement en testant les notifications de Phase 3 de bout en bout (impossibilité d'escalader un incident deux fois, blocage automatique de release trop large par rapport à la spec). Ça a confirmé l'intérêt de tester les parcours complets plutôt que fonctionnalité par fonctionnalité isolée, même une fois une phase "terminée".

---

## Limites connues et choix assumés

- **Lien Incident ↔ Release** : le lien est manuel, choisi par le Manager dans un menu déroulant au moment de créer l'incident (releases `in_progress` de la même team). Il n'y a pas de suggestion automatique ni de lien à distance après coup — un choix pragmatique pour rester fidèle à la spec (*"an Incident created and linked to an in_progress Release"*) sans complexifier le modèle de données à ce stade.
- **Contenu des notifications OS** : les messages restent volontairement génériques ("Vous avez été assigné à un incident") car le payload WebSocket `incident_assigned` ne transporte que l'identifiant de l'incident et le nom de l'assigné, pas le titre ni l'auteur de l'action — cohérent avec le format imposé par le sujet.
- **Tray icon** : implémenté selon l'API standard Tauri v2, testé fonctionnel sur Windows natif. Le rendu visuel n'a pas pu être vérifié dans l'environnement de développement WSL2 initial, qui ne propage pas le protocole de tray Linux vers l'hôte Windows — limitation de l'environnement de dev, pas du code.

---

## Exemptions T-DEV-600

- `repo_cicd` : pipeline CI/CD validé lors du T-DEV-600, exemption déclarée au kickoff.