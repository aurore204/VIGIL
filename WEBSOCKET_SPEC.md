# WEBSOCKET_SPEC.md

## Connexion

**Endpoint :** `ws://localhost:8080/ws`

**Authentification :** Token JWT transmis via le paramètre de requête `?token=<token>` (ou header `Authorization: Bearer <token>` en repli si le paramètre est absent).

**Une connexion WebSocket par client.**

**Format des timestamps :** Tous les champs temporels (`at`, `edited_at`, `until`) sont sérialisés au format **ISO 8601** (ex: `"2026-08-04T10:30:00Z"`), et non en timestamp Unix numérique comme illustré à titre d'exemple dans le brief projet. Ce choix a été fait pour la lisibilité et la compatibilité native avec l'objet `Date` en JavaScript/TypeScript côté client, évitant une conversion manuelle sur chaque réception d'événement.

**Reconnexion automatique :** Le client détecte la fermeture de la connexion (`onclose`) et relance une nouvelle tentative avec un délai croissant (backoff exponentiel, de 1 seconde jusqu'à 30 secondes maximum), réinitialisé à chaque reconnexion réussie.

**Heartbeat :** Le client envoie un message `{ "type": "ping" }` toutes les 25 secondes pour maintenir la connexion active et éviter les déconnexions par timeout d'inactivité.

---

## Messages envoyés par le client

### watch — S'abonner à la présence sur une ressource

Signale au serveur que ce client consulte activement une ressource (incident ou release), afin d'apparaître dans la liste des observateurs diffusée aux autres membres.

```json
{
  "type": "watch",
  "resource_id": "uuid",
  "resource_type": "incident",
  "team_id": "uuid"
}
```

`resource_type` accepte `"incident"` ou `"release"`.

### unwatch — Se désabonner d'une ressource

Envoyé à la fermeture ou au changement de page, pour retirer ce client de la liste des observateurs.

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

**Déclencheur :** Un incident change d'état (`acknowledged`, `escalated`, `resolved`), ou est modifié par un Manager (titre, description, sévérité).

**Destinataires :** Tous les clients connectés.

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

**Déclencheur :** Un incident est escaladé avec une nouvelle sévérité.

**Destinataires :** Tous les clients connectés.

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

**Déclencheur :** Un Manager assigne un Responder à un incident.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "incident_assigned",
  "incident_id": "uuid",
  "assigned_to": "username"
}
```

---

### timeline_entry_added

**Déclencheur :** Un membre (Responder ou Manager) ajoute une entrée dans la timeline d'un incident.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "timeline_entry_added",
  "incident_id": "uuid",
  "entry": {
    "content": "Investigation en cours",
    "author": "username",
    "at": "2026-08-04T10:30:00Z"
  }
}
```

---

### timeline_entry_edited

**Déclencheur :** L'auteur d'une entrée modifie son contenu. Seul l'auteur original peut éditer.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "timeline_entry_edited",
  "incident_id": "uuid",
  "entry_id": "uuid",
  "new_content": "Contenu modifié",
  "edited_at": "2026-08-04T10:32:15Z"
}
```

---

### presence_update

**Déclencheur :** Un client envoie un message `watch` ou `unwatch` sur une ressource (incident ou release).

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "presence_update",
  "resource_id": "uuid",
  "resource_type": "incident",
  "watchers": ["alice", "bob"]
}
```

---

### presence_online

**Déclencheur :** Un client se connecte ou se déconnecte du serveur WebSocket.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "presence_online",
  "usernames": ["alice", "bob"]
}
```

---

### release_state_changed

**Déclencheur :** Une release change d'état (`in_progress`, `completed`, `cancelled`, `blocked`), notamment lorsqu'elle est automatiquement bloquée par un incident actif ou débloquée à sa résolution.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "release_state_changed",
  "release_id": "uuid",
  "new_state": "blocked"
}
```

---

### release_step_validated

**Déclencheur :** Un membre (Responder ou Manager) valide une étape d'une release.

**Destinataires :** Tous les clients connectés.

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

**Déclencheur :** Un Manager retire un membre de la team. Le membre conserve son historique (entrées de timeline, validations) mais perd l'accès immédiat ; il peut revenir via un nouveau code d'invitation.

**Destinataires :** Tous les clients connectés.

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

**Déclencheur :** Un Manager bannit un membre de la team, temporairement ou définitivement.

**Destinataires :** Tous les clients connectés.

**Note :** `until` vaut `null` pour un bannissement permanent.

```json
{
  "type": "member_banned",
  "team_id": "uuid",
  "member": "username",
  "until": "2026-08-15T14:30:00Z",
  "by": "username"
}
```

---

### member_unbanned

**Déclencheur :** Un Manager lève manuellement un ban (temporaire ou permanent) sur un membre.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "member_unbanned",
  "team_id": "uuid",
  "member": "username",
  "by": "username"
}
```

---

### private_message_received

**Déclencheur :** Un membre envoie un message privé à un autre membre partageant au moins une team.

**Destinataires :** Uniquement l'expéditeur et le destinataire (envoi ciblé, jamais diffusé à toute la team).

```json
{
  "type": "private_message_received",
  "from": "alice",
  "to": "bob",
  "content": "Bonjour !",
  "at": "2026-08-04T10:30:00Z"
}
```

---

### reaction_added

**Déclencheur :** Un membre ajoute une réaction sur une entrée de timeline. Un utilisateur ne peut pas ajouter deux fois le même emoji sur la même entrée.

**Destinataires :** Tous les clients connectés.

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

**Déclencheur :** Un membre retire sa propre réaction d'une entrée de timeline.

**Destinataires :** Tous les clients connectés.

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

### rule_triggered *(Phase 2)*

**Déclencheur :** Une règle Action → REAction se déclenche avec succès.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "rule_triggered",
  "rule_name": "CI failure > Critical Incident",
  "result": "incident_created",
  "incident_id": "uuid"
}
```

---

### rule_failed *(Phase 2)*

**Déclencheur :** Une règle Action → REAction échoue lors de son exécution.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "rule_failed",
  "rule_name": "CI failure > Critical Incident",
  "error": "service_unavailable"
}
```