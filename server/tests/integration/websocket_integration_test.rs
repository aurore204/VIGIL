use uuid::Uuid;
use vigil_server::websocket::broadcaster::Broadcaster;
use vigil_server::websocket::events::WsEvent;

#[tokio::test]
async fn test_broadcaster_sends_event_to_subscriber() {
    let broadcaster = Broadcaster::new();
    let mut rx = broadcaster.subscribe();

    let incident_id = Uuid::new_v4();
    broadcaster.broadcast(WsEvent::IncidentStateChanged {
        incident_id,
        new_state: "acknowledged".to_string(),
        by: "alice".to_string(),
    });

    let event = rx.recv().await.unwrap();
    match event {
        WsEvent::IncidentStateChanged { new_state, by, .. } => {
            assert_eq!(new_state, "acknowledged");
            assert_eq!(by, "alice");
        }
        _ => panic!("Mauvais type d'événement reçu"),
    }
}

#[tokio::test]
async fn test_broadcaster_sends_to_multiple_subscribers() {
    let broadcaster = Broadcaster::new();
    let mut rx1 = broadcaster.subscribe();
    let mut rx2 = broadcaster.subscribe();

    broadcaster.broadcast(WsEvent::IncidentAssigned {
        incident_id: Uuid::new_v4(),
        assigned_to: "alice".to_string(),
    });

    let event1 = rx1.recv().await.unwrap();
    let event2 = rx2.recv().await.unwrap();

    match (event1, event2) {
        (
            WsEvent::IncidentAssigned {
                assigned_to: a1, ..
            },
            WsEvent::IncidentAssigned {
                assigned_to: a2, ..
            },
        ) => {
            assert_eq!(a1, "alice");
            assert_eq!(a2, "alice");
        }
        _ => panic!("Mauvais type d'événement reçu"),
    }
}

#[tokio::test]
async fn test_presence_add_and_get_watchers() {
    let broadcaster = Broadcaster::new();
    let resource_id = Uuid::new_v4();
    let team_id = Uuid::new_v4();
    let user1 = Uuid::new_v4();
    let user2 = Uuid::new_v4();

    broadcaster.add_presence(resource_id, user1, team_id).await;
    broadcaster.add_presence(resource_id, user2, team_id).await;

    let watchers = broadcaster.get_watchers(resource_id, team_id).await;
    assert_eq!(watchers.len(), 2);
    assert!(watchers.contains(&user1));
    assert!(watchers.contains(&user2));
}

#[tokio::test]
async fn test_presence_remove_watcher() {
    let broadcaster = Broadcaster::new();
    let resource_id = Uuid::new_v4();
    let team_id = Uuid::new_v4();
    let user1 = Uuid::new_v4();
    let user2 = Uuid::new_v4();

    broadcaster.add_presence(resource_id, user1, team_id).await;
    broadcaster.add_presence(resource_id, user2, team_id).await;
    broadcaster
        .remove_presence(resource_id, user1, team_id)
        .await;

    let watchers = broadcaster.get_watchers(resource_id, team_id).await;
    assert_eq!(watchers.len(), 1);
    assert!(!watchers.contains(&user1));
    assert!(watchers.contains(&user2));
}

#[tokio::test]
async fn test_presence_empty_for_unknown_resource() {
    let broadcaster = Broadcaster::new();
    let watchers = broadcaster
        .get_watchers(Uuid::new_v4(), Uuid::new_v4())
        .await;
    assert_eq!(watchers.len(), 0);
}

#[tokio::test]
async fn test_broadcaster_no_receiver_does_not_panic() {
    let broadcaster = Broadcaster::new();
    broadcaster.broadcast(WsEvent::IncidentStateChanged {
        incident_id: Uuid::new_v4(),
        new_state: "resolved".to_string(),
        by: "alice".to_string(),
    });
}
