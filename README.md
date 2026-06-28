# VIGIL

Plateforme de contrôle opérationnel collaboratif pour la gestion des Releases et des Incidents en temps réel.

## Stack technique

| Composant        | Technologie    |
|------------------|----------------|
| Serveur          | Rust (Axum)    |
| Client Web       | Next.js        |
| Client Desktop   | Tauri          |
| Base de données  | PostgreSQL     |
| Temps réel       | WebSockets     |
| Conteneurisation | Docker Compose |
| CI/CD            | GitHub Actions |

## Justification des choix techniques

### Rust (Axum) vs NodeJS

Rust a été retenu pour sa gestion mémoire sans garbage collector, ce qui garantit des performances stables et prévisibles sous forte charge. VIGIL est une salle de contrôle temps réel qui doit gérer des milliers de connexions WebSocket simultanées sans latence. L'écosystème Axum + sqlx + Tokio est particulièrement adapté à ce cas d'usage : Tokio gère la concurrence asynchrone nativement, Axum fournit un routing HTTP ergonomique, et sqlx permet des requêtes PostgreSQL typées et vérifiées à la compilation.

### PostgreSQL vs SQLite

PostgreSQL a été retenu car VIGIL est une application multi-utilisateurs avec des écritures concurrentes : plusieurs Responders peuvent acquitter des Incidents simultanément, plusieurs Managers peuvent modifier des Releases en parallèle. PostgreSQL gère cette concurrence nativement avec son système de verrous et de transactions ACID. SQLite est conçu pour un usage mono-utilisateur et aurait posé des problèmes de performance et de cohérence dans ce contexte.

### Tauri vs Electron

Tauri a été retenu car le backend est déjà en Rust. Tauri utilise Rust pour sa partie native, ce qui permet de partager des connaissances et des outils entre le serveur et le client desktop. Le binaire produit par Tauri est significativement plus léger qu'Electron car il utilise le moteur de rendu natif du système d'exploitation plutôt d'embarquer Chromium.

## Architecture

    vigil/
      server/           -> Logique métier, API REST, WebSockets (Rust/Axum)
      client_web/       -> Interface web (Next.js)
      client_desktop/   -> Application native (Tauri)
      locales/          -> Traductions FR/EN partagées
      docker-compose.yml
      README.md
      WEBSOCKET_SPEC.md
      HOWTOCONTRIBUTE.md
      UI_GUIDELINES.md

### Où vit chaque responsabilité

- **Handlers** : `server/src/handlers/` — reçoivent les requêtes HTTP et appellent les services
- **Services** : `server/src/services/` — contiennent toute la logique métier
- **Repositories** : `server/src/repositories/` — accès à la base de données PostgreSQL
- **WebSocket** : `server/src/websocket/` — diffusion des événements temps réel
- **Middleware** : `server/src/middleware/` — vérification des tokens JWT et permissions

## Schéma de la base de données

    users
      id, email, password_hash, username, language, created_at, updated_at

    teams
      id, name, description, manager_id (-> users), created_at, updated_at

    team_members
      id, team_id (-> teams), user_id (-> users), role, joined_at

    team_invitations
      id, team_id (-> teams), created_by (-> users), code, expires_at, created_at

    team_bans
      id, team_id (-> teams), user_id (-> users), banned_by (-> users), reason, expires_at, created_at

    incidents
      id, team_id (-> teams), created_by (-> users), assigned_to (-> users),
      title, description, state, severity, resolved_at, created_at, updated_at

    incident_timeline
      id, incident_id (-> incidents), author_id (-> users),
      content (max 2000 chars), edited_at, created_at

    timeline_reactions
      id, entry_id (-> incident_timeline), user_id (-> users), emoji, created_at
      UNIQUE (entry_id, user_id, emoji)

    releases
      id, team_id (-> teams), created_by (-> users),
      title, description, state, created_at, updated_at

    release_steps
      id, release_id (-> releases), validated_by (-> users),
      name, description, position, state, validated_at, created_at, updated_at

    release_incidents
      id, release_id (-> releases), incident_id (-> incidents), created_at
      UNIQUE (release_id, incident_id)

    private_messages
      id, sender_id (-> users), receiver_id (-> users),
      content (max 2000 chars), read_at, created_at

    user_tokens
      id, user_id (-> users), service_name, token_type,
      access_token (chiffre), refresh_token (chiffre), expires_at, created_at, updated_at

    rules
      id, team_id (-> teams), created_by (-> users),
      name, enabled, trigger (JSONB), reaction (JSONB), created_at, updated_at

    rule_logs
      id, rule_id (-> rules), status, result (JSONB), error, triggered_at

## Variables d'environnement

Copie `.env.example` en `.env` et remplis les valeurs :

    cp .env.example .env

Ne committe jamais le fichier `.env`. Il est listé dans `.gitignore`.

## Installation et lancement en local

### Prérequis

- Rust (stable)
- Docker
- Node.js 18+
- sqlx-cli : `cargo install sqlx-cli --no-default-features --features postgres`

### Étapes

    # 1. Cloner le projet
    git clone https://github.com/TON_USERNAME/vigil.git
    cd vigil

    # 2. Configurer les variables d'environnement
    cp .env.example .env
    # Ouvrir .env et remplir toutes les valeurs

    # 3. Lancer PostgreSQL
    docker run --name vigil-db \
      -e POSTGRES_USER=<POSTGRES_USER> \
      -e POSTGRES_PASSWORD=<POSTGRES_PASSWORD> \
      -e POSTGRES_DB=vigil \
      -p 5433:5432 \
      -d postgres:16

    # 4. Créer la base de données
    cd server
    sqlx database create

    # 5. Lancer les migrations
    sqlx migrate run

    # 6. Lancer le serveur
    cargo run

    # 7. Lancer le client web (dans un autre terminal)
    cd ../client_web
    npm install
    npm run dev

## Ports

| Service    | Port |
|------------|------|
| Serveur    | 8080 |
| Client web | 8081 |

## Exemptions T-DEV-600

- `repo_cicd` : pipeline CI/CD validé lors du T-DEV-600, exemption déclarée au kickoff.

## OS cible pour le client desktop

Linux — le binaire est exposé via GET http://localhost:8081/client.AppImage
