# HOWTOCONTRIBUTE.md

Ce document explique comment étendre le moteur d'automatisation (Action → REAction) et le système d'événements WebSocket de VIGIL. Il s'adresse à toute personne souhaitant ajouter un nouveau service tiers, une nouvelle Action, une nouvelle REAction, ou un nouvel événement temps réel.

---

## 1. Ajouter un nouveau service

Un "service" (`github`, `discord`, etc.) n'est pas une entité stockée en base : c'est simplement une **chaîne de caractères** utilisée pour identifier la provenance d'un événement (`trigger.service`) ou la destination d'une réaction. Ajouter un service consiste donc à :

1. Choisir un identifiant court en minuscules (ex. `gitlab`, `discord`, `email`)
2. L'exposer dans le catalogue dynamique `/about.json`, servi par `server/src/handlers/about_handler.rs`
3. Implémenter au moins une Action et/ou une REAction pour ce service (voir sections suivantes)

### Déclarer le service dans `/about.json`

Dans `about_handler.rs`, la fonction `get_about` construit la liste `services: Vec<ServiceInfo>`. Ajoute une nouvelle entrée :

```rust
ServiceInfo {
    name: "discord".to_string(),
    actions: vec![], // ce service n'émet pas d'Action
    reactions: vec![ReactionInfo {
        name: "send_message".to_string(),
        description: "Send a message to a Discord channel".to_string(),
    }],
},
```

Le client ne doit **jamais** coder en dur la liste des services : il lit toujours `/about.json` pour construire son catalogue.

### Si le service nécessite une authentification (OAuth2 ou token personnel)

Le stockage chiffré existe déjà dans `token_service.rs` / `token_repository.rs` (table `user_tokens`, colonnes `access_token` et `refresh_token` chiffrées via `crypto_service::encrypt`). Pour connecter un nouveau service :

1. Ajoute un endpoint dans `token_handler.rs` (ou réutilise `save_token` si le flux est un simple token personnel)
2. Si le service utilise OAuth2, ajoute le flow d'échange de code dans un nouveau handler dédié, puis appelle `token_service::save_token` avec le `access_token` obtenu
3. Au moment d'utiliser le service dans une REAction, récupère le token avec `token_service::get_decrypted_token(pool, user_id, "nom_du_service")`

---

## 2. Ajouter une nouvelle Action

Une Action est un événement **entrant**, reçu depuis un service externe via un webhook, qui peut déclencher une ou plusieurs règles.

### Étape 1 — Créer le endpoint webhook

Suis le modèle de `webhook_handler.rs` (`github_webhook`). Pour un nouveau service, crée une fonction équivalente, par exemple `gitlab_webhook`, dans le même fichier ou dans un nouveau `webhook_handler_gitlab.rs` :

```rust
pub async fn gitlab_webhook(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    // 1. Récupérer le secret stocké pour ce service
    let stored_secret =
        match crate::repositories::webhook_repository::get_secret(&state.pool, team_id, "gitlab").await {
            Ok(Some(s)) => s,
            Ok(None) => {
                return (StatusCode::NOT_FOUND, Json(serde_json::json!(ApiError::new(
                    "Aucun webhook GitLab configuré pour cette team", "WEBHOOK_NOT_CONFIGURED"
                ))));
            }
            Err(_) => {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!(ApiError::new(
                    "Erreur interne", "INTERNAL_ERROR"
                ))));
            }
        };

    // 2. Déchiffrer le secret (une seule fois — voir la note ci-dessous sur github_webhook)
    let (nonce_b64, ciphertext_b64) = match stored_secret.split_once(':') {
        Some(pair) => pair,
        None => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!(ApiError::new(
                "Erreur interne", "INTERNAL_ERROR"
            ))));
        }
    };
    let key = match crate::services::crypto_service::load_encryption_key() {
        Ok(k) => k,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!(ApiError::new(
                "Erreur de configuration du chiffrement", "ENCRYPTION_CONFIG_ERROR"
            ))));
        }
    };
    let secret = match crate::services::crypto_service::decrypt(ciphertext_b64, nonce_b64, &key) {
        Ok(s) => s,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!(ApiError::new(
                "Erreur interne", "INTERNAL_ERROR"
            ))));
        }
    };

    // 3. Vérifier la signature — GitLab utilise un header différent (X-Gitlab-Token,
    //    comparaison directe du secret plutôt qu'une signature HMAC comme GitHub).
    //    Adapter webhook_verify.rs si nécessaire, ou comparer directement le header au secret déchiffré.

    // 4. Extraire l'event_type et parser le payload (identique au modèle github_webhook)
    let event_type = headers.get("X-Gitlab-Event").and_then(|v| v.to_str().ok()).unwrap_or("unknown").to_string();
    let payload: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!(ApiError::new(
                "Payload JSON invalide", "INVALID_PAYLOAD"
            ))));
        }
    };

    // 5. Transmettre au moteur de règles
    rule_engine_service::process_incoming_event(&state, team_id, "gitlab", &event_type, payload).await;

    (StatusCode::OK, Json(serde_json::json!(ApiResponse::<()>::success_no_data("Webhook traité avec succès"))))
}
```

**Note sur `github_webhook` :** le handler suit exactement ce modèle (récupération du secret, déchiffrement, vérification de signature, extraction du payload, transmission au moteur de règles) ,reprends la même structure pour tout nouveau service webhook.

### Étape 2 — Déclarer la route

`server/src/routes/webhook_routes.rs` expose une fonction `webhook_routes()` qui retourne le `Router`. Ajoute la nouvelle route dans la même chaîne :

```rust
pub fn webhook_routes() -> Router<AppState> {
    Router::new()
        .route("/webhooks/github/:team_id", post(webhook_handler::github_webhook))
        .route("/webhooks/gitlab/:team_id", post(webhook_handler::gitlab_webhook))
}
```

### Étape 3 — Documenter l'Action dans `/about.json`

Dans `about_handler.rs`, ajoute l'entrée `actions` correspondante pour ce service :

```rust
ActionInfo {
    name: "pipeline_failed".to_string(),
    description: "A GitLab pipeline completes with a failed status".to_string(),
},
```

### Étape 4 — Vérifier le matching des filtres

Le moteur de règles (`filters_match` dans `rule_engine_service.rs`) compare `trigger.filters` au payload reçu via `find_in_payload`. Si le nouveau service a une structure de payload différente de GitHub (clé imbriquée différente), ajoute un cas spécifique dans `find_in_payload` :

```rust
if key == "pipeline_status" {
    if let Some(status) = payload.get("object_attributes").and_then(|o| o.get("status")) {
        return Some(status);
    }
}
```

Aucune règle existante n'est impactée : `find_in_payload` ne fait que chercher une clé à plusieurs emplacements possibles, sans rien casser pour les services déjà supportés.

---

## 3. Ajouter une nouvelle REAction

Une REAction est une action **sortante**, exécutée par VIGIL en réponse à une règle déclenchée. Le point d'entrée unique est la fonction `execute_reaction` dans `rule_engine_service.rs`, qui fait un `match` sur `reaction_type`.

### Étape 1 — Ajouter un nouveau cas dans `execute_reaction`

```rust
"discord_send_message" => {
    let webhook_url = reaction_payload
        .get("webhook_url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| "webhook_url manquant pour la REAction discord_send_message".to_string())?;

    let content = interpolate(
        reaction_payload.get("content").and_then(|c| c.as_str()).unwrap_or(""),
        payload,
    );

    let client = reqwest::Client::new();
    match client.post(webhook_url).json(&serde_json::json!({ "content": content })).send().await {
        Ok(resp) if resp.status().is_success() => Ok(None),
        Ok(resp) => Err(format!("Discord a répondu avec le statut {}", resp.status())),
        Err(_) => Err("service_unavailable".to_string()),
    }
}
```

**Convention de retour :** chaque branche retourne soit `Ok(Some(incident_id))` (si la REAction crée un incident VIGIL), soit `Ok(None)` (pour toute autre REAction réussie), soit `Err(message)` en cas d'échec. Ce message d'erreur est ensuite diffusé tel quel dans l'événement WebSocket `rule_failed`.

### Étape 2 — Réutiliser `interpolate` pour les templates

La fonction `interpolate` remplace déjà `{{repository.name}}`, `{{workflow.name}}` et `{{run.url}}` à partir du payload GitHub. Si ta REAction a besoin d'autres variables (propres à un nouveau service Action), étends `interpolate` avec les mêmes conventions de nommage `{{objet.champ}}`.

### Étape 3 — Documenter la REAction dans `/about.json`

```rust
ReactionInfo {
    name: "send_message".to_string(),
    description: "Send a message to a Discord channel via webhook".to_string(),
},
```

### Étape 4 — Exemple de règle complète utilisant la nouvelle REAction

```json
{
  "name": "Pipeline failed > Discord alert",
  "enabled": true,
  "trigger": {
    "service": "gitlab",
    "event": "pipeline_failed",
    "filters": { "pipeline_status": "failed" }
  },
  "reaction": {
    "type": "discord_send_message",
    "payload": {
      "webhook_url": "https://discord.com/api/webhooks/...",
      "content": "Pipeline cassé sur {{repository.name}}"
    }
  }
}
```

---

## 4. Ajouter un nouvel événement WebSocket

Tous les événements sont définis dans `server/src/websocket/events.rs` (enum `WsEvent`) et diffusés via `state.broadcaster.broadcast(...)`.

### Étape 1 — Déclarer le nouveau variant

Dans `websocket/events.rs` :

```rust
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsEvent {
    // ... variants existants
    ReleaseAutoLinked {
        release_id: Uuid,
        incident_id: Uuid,
    },
}
```

Le champ `type` est ajouté automatiquement par `#[serde(tag = "type")]` — pas besoin de le déclarer manuellement dans chaque variant.

### Étape 2 — Déclencher l'événement depuis le service concerné

Là où la logique métier correspondante s'exécute (par exemple dans `incident_service.rs` si un incident se lie automatiquement à une release) :

```rust
state.broadcaster.broadcast(WsEvent::ReleaseAutoLinked {
    release_id: release.id,
    incident_id: incident.id,
});
```

**Règle de diffusion :** le `Broadcaster` (`server/src/websocket/broadcaster.rs`) expose deux méthodes de diffusion :

- `broadcast(event)` — envoie l'événement à **tous** les clients connectés. C'est le comportement de la majorité des événements VIGIL (changements d'état d'incident, de release, etc.).
- `send_to_user(user_id, event)` — envoie l'événement à **un seul** utilisateur précis, identifié par son `user_id`.

Pour un événement ciblé vers plusieurs destinataires précis (comme `private_message_received`, qui doit atteindre l'expéditeur et le destinataire, mais personne d'autre dans la team), appelle `send_to_user` une fois par destinataire plutôt que `broadcast` :

```rust
state.broadcaster.send_to_user(sender_id, WsEvent::PrivateMessageReceived { /* ... */ }).await;
state.broadcaster.send_to_user(receiver_id, WsEvent::PrivateMessageReceived { /* ... */ }).await;
```

`send_to_user` est asynchrone (`await` obligatoire), contrairement à `broadcast` qui est synchrone.

### Étape 3 — Mettre à jour le client

Côté client (`client_web/lib/types.ts`), ajoute le type correspondant à l'union `WsEvent` :

```typescript
export interface WsReleaseAutoLinked {
  type: 'release_auto_linked';
  release_id: string;
  incident_id: string;
}
```

Puis ajoute-le à l'union `WsEvent` du fichier. Le composant qui doit réagir à cet événement s'abonne ensuite normalement via `vigilWs.on('release_auto_linked', handler)`.

### Étape 4 — Documenter dans `WEBSOCKET_SPEC.md`

Chaque nouvel événement doit être ajouté à `WEBSOCKET_SPEC.md` avec : le déclencheur exact, la structure JSON complète, et les destinataires (tous les clients ou une liste ciblée). C'est ce fichier qui fait foi pour la spécification du socket, conformément à l'exigence du cahier des charges.

---

## Résumé des fichiers à toucher

| Ajout | Fichiers concernés |
|---|---|
| Nouveau service | `about_handler.rs` (+ éventuellement `token_handler.rs`, `token_service.rs`) |
| Nouvelle Action | `webhook_handler.rs`, `routes/webhook_routes.rs`, `about_handler.rs`, éventuellement `rule_engine_service.rs::find_in_payload` |
| Nouvelle REAction | `rule_engine_service.rs::execute_reaction`, `about_handler.rs` |
| Nouvel événement WebSocket | `websocket/events.rs`, le service métier déclencheur, `client_web/lib/types.ts`, `WEBSOCKET_SPEC.md` |

Dans tous les cas, aucune modification du client web n'est nécessaire pour les services/Actions/REActions : le catalogue `/about.json` est lu dynamiquement, conformément à l'exigence du cahier des charges ("clients never hard-code any service").