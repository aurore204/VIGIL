# WEBSOCKET_SPEC.md

## Vue d'ensemble

VIGIL utilise **une seule connexion WebSocket par client**, ouverte à l'authentification et maintenue pendant toute la session. Cette connexion sert deux usages distincts qui transitent par le même canal : recevoir les événements temps réel émis par le serveur, et signaler au serveur quelles ressources l'utilisateur regarde activement (présence).

### Comment le serveur diffuse les événements

Côté serveur, chaque connexion s'abonne à **deux flux en parallèle** :

- Un **flux global**, partagé par toutes les connexions actives sur le serveur. La quasi-totalité des événements métier (changements d'état d'incident, de release, réactions, modération...) y sont diffusés. Le filtrage par team ne se fait pas au niveau du canal serveur mais côté client : chaque écran ignore les événements qui ne concernent pas les ressources qu'il affiche (via l'`id` de l'incident/release/team porté dans le payload).
- Un **flux privé**, propre à chaque utilisateur connecté. Seul `private_message_received` y transite — c'est le seul événement qui n'est jamais diffusé à l'ensemble des clients.

Cette distinction explique pourquoi la colonne "Destinataires" de ce document ne prend que deux valeurs : *tous les clients connectés* (flux global) ou *expéditeur et destinataire uniquement* (flux privé).

### Cycle de vie d'une connexion

1. Le client se connecte à `/ws` avec son token JWT.
2. Le serveur authentifie, enregistre l'utilisateur comme en ligne, puis diffuse `presence_online` avec la liste à jour des utilisateurs connectés.
3. Pendant la session, le client peut envoyer `watch`/`unwatch` pour signaler qu'il consulte une ressource précise (voir plus bas) ; le serveur répond en diffusant `presence_update`.
4. À la déconnexion (fermeture d'onglet, perte réseau, logout), le serveur désenregistre l'utilisateur et diffuse un nouveau `presence_online` sans lui.
5. Le client détecte la coupure via `onclose` et relance une reconnexion automatique (voir section suivante). Une fois reconnecté, tout le cycle reprend au point 2.

### watch / unwatch et présence par ressource

`presence_online` (qui est en ligne, globalement) et `presence_update` (qui regarde *cette* ressource précise) sont deux mécanismes différents qu'il ne faut pas confondre :

- Ouvrir la page de détail d'un incident déclenche un `watch` avec l'`id` de cet incident.
- Le serveur ajoute ce client à la liste des observateurs de cette ressource et diffuse `presence_update` à tous, avec la liste des observateurs actuels.
- Quitter la page (navigation, fermeture) déclenche `unwatch`, qui retire le client de cette liste et redéclenche `presence_update`.

C'est ce qui alimente le bandeau "Présents actuellement" visible sur les pages de détail.

### Robustesse de la connexion

**Reconnexion automatique :** le client détecte la fermeture (`onclose`) et relance une tentative avec un backoff exponentiel (1 seconde jusqu'à 30 secondes maximum), réinitialisé dès qu'une reconnexion aboutit.

**Heartbeat :** le client envoie `{ "type": "ping" }` toutes les 25 secondes pour empêcher toute coupure par timeout d'inactivité côté serveur ou proxy intermédiaire.

**Format des timestamps :** tous les champs temporels (`at`, `edited_at`, `until`) sont sérialisés en **ISO 8601** (ex: `"2026-08-04T10:30:00Z"`), et non en timestamp Unix numérique comme illustré à titre d'exemple dans le brief projet — choix fait pour la compatibilité native avec l'objet `Date` en JavaScript/TypeScript côté client, sans conversion manuelle à chaque réception.

### Exemple de flux complet — escalade d'un incident jusqu'à critique

Pour illustrer comment plusieurs événements s'enchaînent en pratique, voici ce que déclenche un Responder qui escalade deux fois de suite le même incident (`medium` → `high` → `critical`) :

1. Premier clic sur "Escalader" : le serveur diffuse `incident_state_changed` (`new_state: "escalated"`) **puis** `incident_escalated` (`new_severity: "high"`) — deux événements distincts car état et sévérité sont deux attributs indépendants qui évoluent tous les deux à ce moment-là.
2. Deuxième clic : l'état ne change plus (déjà `escalated`), seul `incident_escalated` est diffusé, cette fois avec `new_severity: "critical"`.
3. Si cet incident est lié à une release `in_progress`, aucun événement release n'est déclenché par l'escalade elle-même — le blocage automatique ne se produit qu'à la **création** du lien (`POST /releases/:id/incidents/:iid`), pas à chaque changement de sévérité.
4. Côté client desktop, seule l'étape 2 déclenche une notification OS (`new_severity === "critical"`) ; l'étape 1 ne produit qu'un toast dans l'interface.

---

## Connexion

**Endpoint :** `ws://localhost:8080/ws`

**Authentification :** Token JWT transmis via le paramètre de requête `?token=<token>` (ou header `Authorization: Bearer <token>` en repli si le paramètre est absent).

**Une connexion WebSocket par client.**

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

**Déclencheur :** Un incident est escaladé avec une nouvelle sévérité. Peut se déclencher plusieurs fois sur le même incident tant que `critical` n'est pas atteint (voir exemple de flux ci-dessus).

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

**Destinataires :** Tous les clients connectés. Le client desktop filtre localement pour ne déclencher une notification OS que si `assigned_to` correspond à l'utilisateur connecté.

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

**Déclencheur :** Un client envoie un message `watch` ou `unwatch` sur une ressource (incident ou release). Voir "watch / unwatch et présence par ressource" ci-dessus.

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

**Déclencheur :** Une release change d'état (`in_progress`, `completed`, `cancelled`, `blocked`). Le passage à `blocked` se produit quand un incident lui est explicitement lié (`POST /releases/:id/incidents/:iid`) alors qu'elle est `in_progress` ; le retour à `in_progress` se produit quand tous ses incidents liés sont résolus.

**Destinataires :** Tous les clients connectés.

```json
{
  "type": "release_state_changed",
  "release_id": "uuid",
  "new_state": "blocked",
  "by": "username"
}
```

`by` vaut `null` pour les transitions sans acteur direct (ex: passage à `completed` déclenché par la validation de la dernière étape).

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

**Destinataires :** Uniquement l'expéditeur et le destinataire, via le flux privé (voir "Comment le serveur diffuse les événements" ci-dessus) — jamais diffusé à toute la team.

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