# WEBSOCKET_SPEC.md

## Connexion

**Endpoint :** `ws://localhost:8080/ws`

**Authentification :** Token JWT via header `Authorization: Bearer <token>` ou query parameter `?token=<token>`

**Une connexion WebSocket par client.**

La reconnexion automatique est gérée côté client.

---

## Messages envoyés par le client

### Watch — S'abonner à une ressource

```json
{
  "type": "watch",
  "resource_id": "uuid",
  "resource_type": "incident",
  "team_id": "uuid"
}
```

### Unwatch — Se désabonner d'une ressource

```json
{
  "type": "unwatch",
  "resource_id": "uuid",
  "resource_type": "incident",
  "team_id": "uuid"
}
```

---

## Événements envoyés par le serveur

### incident_state_changed

**Déclencheur :** Un incident change d'état (acknowledged, escalated, resolved)

**Destinataires :** Tous les clients connectés

```json
{
  "type": "incident_state_changed",
  "incident_id": "uuid",
  "new_state": "acknowledged",
  "by": "username"
}
```

---

### incident_escalated

**Déclencheur :** Un incident est escaladé avec une nouvelle sévérité

**Destinataires :** Tous les clients connectés

```json
{
  "type": "incident_escalated",
  "incident_id": "uuid",
  "new_severity": "critical",
  "by": "username"
}
```

---

### incident_assigned

**Déclencheur :** Un Manager assigne un Responder à un incident

**Destinataires :** Tous les clients connectés

```json
{
  "type": "incident_assigned",
  "incident_id": "uuid",
  "assigned_to": "username"
}
```

---

### timeline_entry_added

**Déclencheur :** Un membre ajoute une entrée dans la timeline d'un incident

**Destinataires :** Tous les clients connectés

```json
{
  "type": "timeline_entry_added",
  "incident_id": "uuid",
  "entry": {
    "content": "Investigation en cours",
    "author": "username",
    "at": 1718000000
  }
}
```

---

### timeline_entry_edited

**Déclencheur :** L'auteur modifie une entrée de timeline

**Destinataires :** Tous les clients connectés

```json
{
  "type": "timeline_entry_edited",
  "incident_id": "uuid",
  "entry_id": "uuid",
  "new_content": "Contenu modifié",
  "edited_at": 1718000000
}
```

---

### presence_update

**Déclencheur :** Un client envoie un message watch ou unwatch

**Destinataires :** Tous les clients connectés

```json
{
  "type": "presence_update",
  "resource_id": "uuid",
  "resource_type": "incident",
  "watchers": ["alice", "bob"]
}
```

---

### release_state_changed

**Déclencheur :** Une release change d'état (in_progress, completed, cancelled, blocked)

**Destinataires :** Tous les clients connectés

```json
{
  "type": "release_state_changed",
  "release_id": "uuid",
  "new_state": "blocked"
}
```

---

### release_step_validated

**Déclencheur :** Un membre valide une étape d'une release

**Destinataires :** Tous les clients connectés

```json
{
  "type": "release_step_validated",
  "release_id": "uuid",
  "step": "staging",
  "by": "username"
}
```

---

### member_kicked

**Déclencheur :** Un Manager retire un membre de la team

**Destinataires :** Tous les clients connectés

```json
{
  "type": "member_kicked",
  "team_id": "uuid",
  "member": "username",
  "by": "username"
}
```

---

### member_banned

**Déclencheur :** Un Manager bannit un membre de la team

**Destinataires :** Tous les clients connectés

**Note :** `until` est `null` pour les bans permanents

```json
{
  "type": "member_banned",
  "team_id": "uuid",
  "member": "username",
  "until": null,
  "by": "username"
}
```

---

### private_message_received

**Déclencheur :** Un membre envoie un message privé à un autre membre

**Destinataires :** Uniquement le sender et le receiver (pas broadcast à toute la team)

```json
{
  "type": "private_message_received",
  "from": "alice",
  "to": "bob",
  "content": "Bonjour !",
  "at": 1718000000
}
```

---

### reaction_added

**Déclencheur :** Un membre ajoute une réaction sur une entrée de timeline

**Destinataires :** Tous les clients connectés

```json
{
  "type": "reaction_added",
  "incident_id": "uuid",
  "entry_id": "uuid",
  "emoji": "+1",
  "by": "username"
}
```

---

### reaction_removed

**Déclencheur :** Un membre retire sa réaction d'une entrée de timeline

**Destinataires :** Tous les clients connectés

```json
{
  "type": "reaction_removed",
  "incident_id": "uuid",
  "entry_id": "uuid",
  "emoji": "+1",
  "by": "username"
}
```

---

### rule_triggered (Phase 2)

**Déclencheur :** Une règle Action→REAction se déclenche avec succès

**Destinataires :** Tous les clients connectés

```json
{
  "type": "rule_triggered",
  "rule_name": "CI failure > Critical Incident",
  "result": "incident_created",
  "incident_id": "uuid"
}
```

---

### rule_failed (Phase 2)

**Déclencheur :** Une règle Action→REAction échoue

**Destinataires :** Tous les clients connectés

```json
{
  "type": "rule_failed",
  "rule_name": "CI failure > Critical Incident",
  "error": "service_unavailable"
}
```