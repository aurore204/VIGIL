# VIGIL

Plateforme de contrôle opérationnel collaboratif pour la gestion des Releases et des Incidents en temps réel.

VIGIL permet à une équipe technique de coordonner ses déploiements (Releases) et de gérer les incidents de production (Incidents) depuis une interface unifiée, avec mise à jour en temps réel pour tous les membres connectés, sur navigateur ou sur application desktop native.

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

---

## Justification des choix techniques

### Rust (Axum) vs NodeJS

Rust a été retenu pour sa gestion mémoire sans garbage collector, garantissant des performances stables et prévisibles sous forte charge. VIGIL gère des milliers de connexions WebSocket simultanées — l'écosystème Axum + sqlx + Tokio est particulièrement adapté : Tokio gère la concurrence asynchrone nativement, Axum fournit un routing HTTP ergonomique, et sqlx permet des requêtes PostgreSQL typées et vérifiées à la compilation.

### PostgreSQL vs SQLite

PostgreSQL a été retenu car VIGIL est une application multi-utilisateurs avec des écritures concurrentes : plusieurs Responders peuvent acquitter des Incidents simultanément, plusieurs Managers peuvent modifier des Releases en parallèle. PostgreSQL gère cette concurrence nativement avec son système de verrous et de transactions ACID. SQLite est conçu pour un usage mono-utilisateur et aurait posé des problèmes de cohérence dans ce contexte.

### Tauri vs Electron

Tauri a été retenu car le backend est déjà en Rust. Tauri utilise Rust pour sa partie native, ce qui permet de partager des connaissances et des outils entre le serveur et le client desktop. Le binaire produit est significativement plus léger qu'Electron car il utilise le moteur de rendu natif du système d'exploitation plutôt que d'embarquer Chromium.

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
    Web Client    Desktop Client   (même codebase Next.js,
    (Next.js)     (Tauri)          export statique pour Tauri)

### Où vit chaque responsabilité

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

    -- Liaison release/incident déclenchant le blocage automatique.
    -- Le lien est créé explicitement via POST /releases/:id/incidents/:iid
    -- (par exemple depuis le formulaire de création d'incident, en sélectionnant
    -- une release "in_progress" de la même team). Quand tous les incidents liés
    -- à une release sont résolus, la release repasse automatiquement à in_progress.
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

Voir [WEBSOCKET_SPEC.md](./WEBSOCKET_SPEC.md) pour la documentation complète des événements.

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

Le client desktop réutilise intégralement le code de `client_web` (export statique Next.js), sans logique métier dupliquée, avec deux comportements natifs additionnels :

### Tray icon

L'application reste active en arrière-plan lorsque la fenêtre est fermée : la fermeture cache la fenêtre au lieu de tuer le processus, ce qui permet à la connexion WebSocket de rester ouverte. Une icône dans la zone de notification système permet de rouvrir la fenêtre (clic gauche ou "Ouvrir VIGIL" dans le menu) ou de quitter réellement l'application ("Quitter").

### Notifications natives

Trois déclencheurs envoient une notification OS via `tauri-plugin-notification`, en plus du toast affiché dans l'interface :

| Déclencheur                        | Condition exacte                                              |
|--------------------------------------|-------------------------------------------------------------------|
| Assignation à un incident          | `incident_assigned` reçu et `assigned_to` correspond à l'utilisateur connecté |
| Incident en sévérité critique      | `incident_escalated` reçu avec `new_severity == "critical"`  |
| Release bloquée par un incident    | `release_state_changed` reçu avec `new_state == "blocked"`   |

La permission système est demandée automatiquement au premier événement recevable.

---

## Variables d'environnement

Copie `.env.example` en `.env` et remplis les valeurs :

    cp .env.example .env

Ne committe jamais le fichier `.env`. Il est listé dans `.gitignore`.

### Variables requises

| Variable      | Description                              |
|---------------|--------------------------------------------|
| DATABASE_URL  | URL de connexion PostgreSQL              |
| SERVER_HOST   | Hôte du serveur (0.0.0.0)               |
| SERVER_PORT   | Port du serveur (8080)                   |
| JWT_SECRET    | Clé secrète pour signer les tokens JWT  |
| RUST_LOG      | Niveau de logs (debug en développement) |

---

## Installation et lancement en local

### Prérequis

- Rust (stable)
- Docker et Docker Compose
- Node.js 18+
- sqlx-cli :

    cargo install sqlx-cli --version "^0.7" --no-default-features --features postgres

### Étapes — serveur et client web

    # 1. Cloner le projet
    git clone https://github.com/TON_USERNAME/vigil.git
    cd vigil

    # 2. Configurer les variables d'environnement
    cp .env.example .env

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

    # Lancement en mode développement (serveur + client web doivent déjà tourner) :
    cd client_desktop/src-tauri
    cargo tauri dev

    # Build de l'exécutable final :
    cargo tauri build

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

## Exemptions T-DEV-600

- `repo_cicd` : pipeline CI/CD validé lors du T-DEV-600, exemption déclarée au kickoff.

---

## État du Docker Compose (Phase 3)

Le service `client_desktop` exposant le binaire desktop via `client_web` (port 8081) est en cours de finalisation et n'est pas encore intégré au `docker-compose.yml`. Cette section sera complétée une fois le service ajouté.