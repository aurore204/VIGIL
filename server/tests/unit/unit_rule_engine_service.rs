use serde_json::json;
use vigil_server::services::rule_engine_service::{filters_match, find_in_payload, interpolate};

#[test]
fn filters_match_returns_true_when_no_filters() {
    let trigger = json!({"service": "github", "event": "workflow_run"});
    let payload = json!({"anything": "here"});

    assert!(filters_match(&trigger, &payload));
}

#[test]
fn filters_match_returns_true_when_all_filters_match() {
    let trigger = json!({
        "filters": { "conclusion": "failure" }
    });
    let payload = json!({"conclusion": "failure"});

    assert!(filters_match(&trigger, &payload));
}

#[test]
fn filters_match_returns_false_when_a_filter_does_not_match() {
    let trigger = json!({
        "filters": { "conclusion": "failure" }
    });
    let payload = json!({"conclusion": "success"});

    assert!(!filters_match(&trigger, &payload));
}

#[test]
fn filters_match_returns_false_when_filter_key_missing_in_payload() {
    let trigger = json!({
        "filters": { "conclusion": "failure" }
    });
    let payload = json!({"unrelated": "value"});

    assert!(!filters_match(&trigger, &payload));
}

#[test]
fn find_in_payload_finds_top_level_key() {
    let payload = json!({"conclusion": "failure"});

    let result = find_in_payload(&payload, "conclusion");

    assert_eq!(result, Some(&json!("failure")));
}

#[test]
fn find_in_payload_finds_key_nested_in_workflow_run() {
    let payload = json!({
        "workflow_run": { "conclusion": "failure" }
    });

    let result = find_in_payload(&payload, "conclusion");

    assert_eq!(result, Some(&json!("failure")));
}

#[test]
fn find_in_payload_finds_repository_full_name() {
    let payload = json!({
        "repository": { "full_name": "my-org/my-repo" }
    });

    let result = find_in_payload(&payload, "repository");

    assert_eq!(result, Some(&json!({"full_name": "my-org/my-repo"})));
}

#[test]
fn find_in_payload_returns_none_when_key_absent() {
    let payload = json!({"unrelated": "value"});

    let result = find_in_payload(&payload, "conclusion");

    assert!(result.is_none());
}

#[test]
fn interpolate_replaces_repository_name_placeholder() {
    let payload = json!({
        "repository": { "full_name": "my-org/my-repo" }
    });

    let result = interpolate("CI broken on {{repository.name}}", &payload);

    assert_eq!(result, "CI broken on my-org/my-repo");
}

#[test]
fn interpolate_replaces_workflow_name_and_url_placeholders() {
    let payload = json!({
        "workflow_run": {
            "name": "CI",
            "html_url": "https://github.com/run/123"
        }
    });

    let result = interpolate(
        "Workflow {{workflow.name}} failed — [View run]({{run.url}})",
        &payload,
    );

    assert_eq!(
        result,
        "Workflow CI failed — [View run](https://github.com/run/123)"
    );
}

#[test]
fn interpolate_leaves_template_unchanged_when_no_matching_data() {
    let payload = json!({});

    let result = interpolate("Static text without placeholders", &payload);

    assert_eq!(result, "Static text without placeholders");
}

#[test]
fn interpolate_leaves_placeholder_untouched_when_data_missing() {
    let payload = json!({});

    let result = interpolate("CI broken on {{repository.name}}", &payload);

    assert_eq!(result, "CI broken on {{repository.name}}");
}
