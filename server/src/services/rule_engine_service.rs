use serde_json::Value;
use uuid::Uuid;

use crate::state::AppState;
use crate::websocket::events::WsEvent;

/// Point d'entrée appelé par les webhook handlers dès qu'un événement externe arrive.
pub async fn process_incoming_event(
    state: &AppState,
    team_id: Uuid,
    service: &str,
    event_type: &str,
    payload: Value,
) {
    let rules = match crate::repositories::rule_repository::find_matching_rules(
        &state.pool, team_id, service, event_type,
    ).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Erreur lors de la recherche de règles: {:?}", e);
            return;
        }
    };

    for rule in rules {
        if !filters_match(&rule.trigger, &payload) {
            continue;
        }

        let result = execute_reaction(state, &rule, &payload).await;

        let (status, result_str, incident_id) = match &result {
            Ok(incident_id) => (
                crate::models::rule::RuleLogStatus::Success,
                "incident_created".to_string(),
                *incident_id,
            ),
            Err(err_msg) => (
                crate::models::rule::RuleLogStatus::Failed,
                err_msg.clone(),
                None,
            ),
        };

        let _ = crate::repositories::rule_repository::log_execution(
            &state.pool, rule.id, status.clone(), &result_str, incident_id,
        ).await;

        match result {
            Ok(incident_id) => {
                state.broadcaster.broadcast(WsEvent::RuleTriggered {
                    rule_name: rule.name.clone(),
                    result: result_str.to_string(),
                    incident_id,
                });
            }
            Err(err_msg) => {
                state.broadcaster.broadcast(WsEvent::RuleFailed {
                    rule_name: rule.name.clone(),
                    error: err_msg,
                });
            }
        }
    }
}

// Vérifie que les filtres définis dans le trigger de la règle correspondent au payload reçu.
fn filters_match(trigger: &Value, payload: &Value) -> bool {
    let filters = match trigger.get("filters").and_then(|f| f.as_object()) {
        Some(f) => f,
        None => return true, 
    };

    for (key, expected_value) in filters {
        let actual_value = find_in_payload(payload, key);
        if actual_value != Some(expected_value) {
            return false;
        }
    }

    true
}

// Cherche une clé dans le payload GitHub, en tentant plusieurs emplacements usuels
fn find_in_payload<'a>(payload: &'a Value, key: &str) -> Option<&'a Value> {
    if let Some(v) = payload.get(key) {
        return Some(v);
    }
    if let Some(workflow_run) = payload.get("workflow_run") {
        if let Some(v) = workflow_run.get(key) {
            return Some(v);
        }
    }
    if key == "repository" {
        if let Some(repo) = payload.get("repository").and_then(|r| r.get("full_name")) {
            return Some(repo);
        }
    }
    None
}

//Exécute la REAction définie dans la règle.
async fn execute_reaction(
    state: &AppState,
    rule: &crate::models::rule::Rule,
    payload: &Value,
) -> Result<Option<Uuid>, String> {
    let reaction_type = rule.reaction.get("type").and_then(|t| t.as_str()).unwrap_or("");
    let reaction_payload = rule.reaction.get("payload").cloned().unwrap_or(Value::Null);

    match reaction_type {
        "vigil_create_incident" => {
            let title = interpolate(
                reaction_payload.get("title").and_then(|t| t.as_str()).unwrap_or("Incident automatique"),
                payload,
            );
            let severity_str = reaction_payload.get("severity").and_then(|s| s.as_str()).unwrap_or("medium");
            let description = reaction_payload.get("body").and_then(|b| b.as_str())
                .map(|b| interpolate(b, payload));

            let severity = match severity_str {
                "low" => crate::models::incident::IncidentSeverity::Low,
                "high" => crate::models::incident::IncidentSeverity::High,
                "critical" => crate::models::incident::IncidentSeverity::Critical,
                _ => crate::models::incident::IncidentSeverity::Medium,
            };

            match crate::repositories::incident_repository::create_incident(
                &state.pool, rule.team_id, rule.created_by, &title, description.as_deref(), severity,
            ).await {
                Ok(incident) => {
                    state.broadcaster.broadcast(WsEvent::IncidentStateChanged {
                        incident_id: incident.id,
                        new_state: "open".to_string(),
                        by: "rule_engine".to_string(),
                    });
                    Ok(Some(incident.id))
                }
                Err(e) => Err(format!("Échec de création de l'incident: {}", e)),
            }
        }
        "http_post" => {
            let url = reaction_payload.get("url").and_then(|u| u.as_str())
                .ok_or_else(|| "URL manquante pour la REAction http_post".to_string())?;

            let client = reqwest::Client::new();
            match client.post(url).json(payload).send().await {
                Ok(resp) if resp.status().is_success() => Ok(None),
                Ok(resp) => Err(format!("Le service HTTP a répondu avec le statut {}", resp.status())),
                Err(_) => Err("service_unavailable".to_string()),
            }
        }
        other => Err(format!("Type de REAction inconnu: {}", other)),
    }
}

// Remplace les placeholders dans un template par les valeurs du payload.
fn interpolate(template: &str, payload: &Value) -> String {
    let mut result = template.to_string();
    if let Some(repo_name) = payload.get("repository").and_then(|r| r.get("full_name")).and_then(|n| n.as_str()) {
        result = result.replace("{{repository.name}}", repo_name);
    }
    if let Some(workflow) = payload.get("workflow_run") {
        if let Some(name) = workflow.get("name").and_then(|n| n.as_str()) {
            result = result.replace("{{workflow.name}}", name);
        }
        if let Some(url) = workflow.get("html_url").and_then(|u| u.as_str()) {
            result = result.replace("{{run.url}}", url);
        }
    }
    result
}