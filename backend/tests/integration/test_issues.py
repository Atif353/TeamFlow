from typing import Any

from httpx import AsyncClient

from tests.factories import (
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
)


async def setup_project(client: AsyncClient, world: World) -> dict[str, Any]:
    project = await api_create_project(client, world.manager, key="JIRA")
    for user in (world.member, world.other_member, world.viewer):
        await api_add_member(client, world.manager, project["id"], user)
    return project


def status_id(project: dict[str, Any], name: str) -> str:
    return str(next(s["id"] for s in project["statuses"] if s["name"] == name))


async def test_issues_get_sequential_keys_and_resolve_by_key(
    client: AsyncClient, world: World
) -> None:
    project = await api_create_project(client, world.manager, key="KEYS")
    first = await api_create_task(client, world.manager, project["id"], title="One")
    second = await api_create_task(client, world.manager, project["id"], title="Two")

    by_key = await client.get("/tasks/keys-2", headers=auth_headers(world.manager))

    assert (first["key"], second["key"]) == ("KEYS-1", "KEYS-2")
    assert by_key.status_code == 200
    assert by_key.json()["id"] == second["id"]


async def test_issue_by_key_is_hidden_from_non_members(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager, key="HIDE")
    await api_create_task(client, world.manager, project["id"])

    response = await client.get("/tasks/HIDE-1", headers=auth_headers(world.member))

    assert response.status_code == 404


async def test_create_issue_with_each_type_and_estimates(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    types = ["epic", "story", "task", "bug", "feature", "improvement", "merge_request"]

    created = [
        await api_create_task(
            client,
            world.manager,
            project["id"],
            title=f"A {issue_type}",
            issue_type=issue_type,
            story_points=3,
            original_estimate_minutes=120,
        )
        for issue_type in types
    ]

    assert [item["issue_type"] for item in created] == types
    assert created[1]["story_points"] == 3
    assert created[1]["original_estimate_minutes"] == 120
    assert created[1]["remaining_estimate_minutes"] == 120


async def test_epic_links_children_and_reports_progress(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    epic = await api_create_task(client, world.manager, project["id"], issue_type="epic")
    story = await api_create_task(
        client, world.manager, project["id"], issue_type="story", epic_id=epic["id"]
    )
    await api_create_task(client, world.manager, project["id"], epic_id=epic["id"])
    await client.patch(
        f"/tasks/{story['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )

    refreshed = await client.get(f"/tasks/{epic['id']}", headers=auth_headers(world.manager))
    child = await client.get(f"/tasks/{story['id']}", headers=auth_headers(world.manager))

    assert refreshed.json()["child_total"] == 2
    assert refreshed.json()["child_done"] == 1
    assert child.json()["epic"]["key"] == epic["key"]


async def test_epic_must_be_an_epic(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    plain = await api_create_task(client, world.manager, project["id"])

    response = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Child", "epic_id": plain["id"]},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 422
    assert response.json()["code"] == "invalid_epic"


async def test_epics_cannot_have_subtasks_or_sprints(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    epic = await api_create_task(client, world.manager, project["id"], issue_type="epic")

    subtask = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Sub", "parent_id": epic["id"]},
        headers=auth_headers(world.manager),
    )

    assert subtask.status_code == 422
    assert subtask.json()["code"] == "invalid_parent_type"


async def test_subtask_type_is_forced_and_standalone_subtask_rejected(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    parent = await api_create_task(client, world.manager, project["id"], issue_type="story")
    child = await api_create_task(
        client, world.manager, project["id"], title="Sub", parent_id=parent["id"]
    )

    orphan = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Orphan", "issue_type": "subtask"},
        headers=auth_headers(world.manager),
    )

    assert child["issue_type"] == "subtask"
    assert child["parent"]["key"] == parent["key"]
    assert orphan.status_code == 422
    assert orphan.json()["code"] == "subtask_requires_parent"


async def test_changing_type_updates_activity_history(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    await client.patch(
        f"/tasks/{task['id']}",
        json={"issue_type": "bug", "priority": "urgent", "story_points": 5},
        headers=auth_headers(world.manager),
    )
    activity = await client.get(
        f"/tasks/{task['id']}/activity", headers=auth_headers(world.manager)
    )

    fields = {entry["field"] for entry in activity.json()}
    assert {"type", "priority", "story points"} <= fields
    assert activity.json()[-1]["action"] == "created"


async def test_status_change_is_recorded_and_notifies_watchers(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.member, project["id"], assignee_id=str(world.other_member.pk)
    )
    await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "In Progress")},
        headers=auth_headers(world.member),
    )

    notifications = await client.get("/notifications", headers=auth_headers(world.other_member))
    activity = await client.get(f"/tasks/{task['id']}/activity", headers=auth_headers(world.member))

    types = [item["type"] for item in notifications.json()["items"]]
    assert "status_changed" in types
    assert any(
        entry["field"] == "status" and entry["new_value"] == "In Progress"
        for entry in activity.json()
    )


async def test_watch_and_unwatch(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    watching = await client.put(f"/tasks/{task['id']}/watch", headers=auth_headers(world.viewer))
    stopped = await client.delete(f"/tasks/{task['id']}/watch", headers=auth_headers(world.viewer))

    assert watching.json()["is_watching"] is True
    assert stopped.json()["is_watching"] is False


async def test_flagged_and_environment_updates(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"], issue_type="bug")

    response = await client.patch(
        f"/tasks/{task['id']}",
        json={"flagged": True, "environment": "Staging, Chrome 120"},
        headers=auth_headers(world.manager),
    )

    assert response.json()["flagged"] is True
    assert response.json()["environment"] == "Staging, Chrome 120"


async def test_list_filters_by_type_epic_and_key_query(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    epic = await api_create_task(client, world.manager, project["id"], issue_type="epic")
    bug = await api_create_task(
        client, world.manager, project["id"], issue_type="bug", epic_id=epic["id"]
    )
    await api_create_task(client, world.manager, project["id"], issue_type="story")

    bugs = await client.get(
        f"/projects/{project['id']}/tasks?issue_type=bug", headers=auth_headers(world.manager)
    )
    in_epic = await client.get(
        f"/projects/{project['id']}/tasks?epic_id={epic['id']}", headers=auth_headers(world.manager)
    )
    no_epics = await client.get(
        f"/projects/{project['id']}/tasks?exclude_epics=true", headers=auth_headers(world.manager)
    )
    by_key = await client.get(
        f"/projects/{project['id']}/tasks?q={bug['key']}", headers=auth_headers(world.manager)
    )

    assert [item["id"] for item in bugs.json()["items"]] == [bug["id"]]
    assert [item["id"] for item in in_epic.json()["items"]] == [bug["id"]]
    assert all(item["issue_type"] != "epic" for item in no_epics.json()["items"])
    assert [item["id"] for item in by_key.json()["items"]] == [bug["id"]]


async def test_components_must_exist_on_project(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    await client.put(
        f"/projects/{project['id']}/components",
        json={"components": ["API", "Web"]},
        headers=auth_headers(world.manager),
    )

    good = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "With component", "components": ["API"]},
        headers=auth_headers(world.manager),
    )
    bad = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "Unknown", "components": ["Nope"]},
        headers=auth_headers(world.manager),
    )

    assert good.json()["components"] == ["API"]
    assert bad.status_code == 422
    assert bad.json()["code"] == "invalid_component"


async def test_deleting_epic_detaches_children(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    epic = await api_create_task(client, world.manager, project["id"], issue_type="epic")
    child = await api_create_task(client, world.manager, project["id"], epic_id=epic["id"])

    await client.delete(f"/tasks/{epic['id']}", headers=auth_headers(world.manager))
    refreshed = await client.get(f"/tasks/{child['id']}", headers=auth_headers(world.manager))

    assert refreshed.status_code == 200
    assert refreshed.json()["epic_id"] is None
