from typing import Any

from httpx import AsyncClient

from app.core.migrations import backfill_issue_numbers
from app.models.task import Task
from app.services import automation_service
from tests.factories import (
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
)
from tests.integration.test_reports import status_id


async def setup_project(client: AsyncClient, world: World) -> dict[str, Any]:
    project = await api_create_project(client, world.manager)
    for user in (world.member, world.viewer, world.other_member):
        await api_add_member(client, world.manager, project["id"], user)
    return project


async def create_doc(
    client: AsyncClient, user: Any, project_id: str, title: str = "Spec", content: str = "<p>v1</p>"
) -> dict[str, Any]:
    response = await client.post(
        f"/projects/{project_id}/docs",
        json={"title": title, "content": content},
        headers=auth_headers(user),
    )
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def test_doc_html_is_sanitised(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)

    doc = await create_doc(
        client,
        world.member,
        project["id"],
        content='<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:evil()">l</a>',
    )

    assert "script" not in doc["content"]
    assert "onclick" not in doc["content"]
    assert "javascript:" not in doc["content"]
    assert "Hi" in doc["content"]


async def test_viewer_reads_docs_but_cannot_edit(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    doc = await create_doc(client, world.member, project["id"])

    read = await client.get(f"/docs/{doc['id']}", headers=auth_headers(world.viewer))
    edit = await client.patch(
        f"/docs/{doc['id']}", json={"title": "Changed"}, headers=auth_headers(world.viewer)
    )
    create = await client.post(
        f"/projects/{project['id']}/docs", json={"title": "x"}, headers=auth_headers(world.viewer)
    )

    assert read.status_code == 200
    assert edit.status_code == 403
    assert create.status_code == 403


async def test_saving_creates_versions_and_restore_creates_a_new_one(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    doc = await create_doc(client, world.member, project["id"])
    await client.patch(
        f"/docs/{doc['id']}", json={"content": "<p>v2</p>"}, headers=auth_headers(world.member)
    )
    second = await client.patch(
        f"/docs/{doc['id']}", json={"content": "<p>v3</p>"}, headers=auth_headers(world.member)
    )

    restored = await client.post(
        f"/docs/{doc['id']}/versions/1/restore", headers=auth_headers(world.member)
    )

    assert [v["number"] for v in second.json()["versions"]] == [2, 1]
    assert restored.json()["content"] == "<p>v1</p>"
    assert len(restored.json()["versions"]) == 3


async def test_doc_keeps_only_twenty_versions(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    doc = await create_doc(client, world.member, project["id"])

    last: dict[str, Any] = {}
    for index in range(25):
        response = await client.patch(
            f"/docs/{doc['id']}",
            json={"content": f"<p>{index}</p>"},
            headers=auth_headers(world.member),
        )
        last = response.json()

    assert len(last["versions"]) == 20


async def test_link_and_unlink_task_to_doc(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    doc = await create_doc(client, world.member, project["id"])
    task = await api_create_task(client, world.manager, project["id"])

    linked = await client.post(
        f"/docs/{doc['id']}/links", json={"task": task["key"]}, headers=auth_headers(world.member)
    )
    from_task = await client.get(f"/tasks/{task['id']}/docs", headers=auth_headers(world.viewer))
    unlinked = await client.delete(
        f"/docs/{doc['id']}/links/{task['key']}", headers=auth_headers(world.member)
    )

    assert linked.json()["linked_tasks"][0]["key"] == task["key"]
    assert from_task.json()[0]["id"] == doc["id"]
    assert unlinked.json()["linked_tasks"] == []


async def test_status_automation_notifies_assignee_once(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    created = await client.post(
        f"/projects/{project['id']}/automation",
        json={
            "name": "Tell assignee",
            "trigger": "status_changed",
            "trigger_status_id": status_id(project, "In Review"),
            "action": "notify_assignee",
        },
        headers=auth_headers(world.manager),
    )
    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.other_member.pk)
    )

    await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "In Review")},
        headers=auth_headers(world.manager),
    )
    notifications = await client.get("/notifications", headers=auth_headers(world.other_member))
    rules = await client.get(
        f"/projects/{project['id']}/automation", headers=auth_headers(world.viewer)
    )

    status_changes = [i for i in notifications.json()["items"] if i["type"] == "status_changed"]
    assert created.status_code == 201
    assert len(status_changes) == 2
    assert rules.json()[0]["run_count"] == 1


async def test_disabled_rule_does_nothing(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    created = await client.post(
        f"/projects/{project['id']}/automation",
        json={
            "name": "Escalate",
            "trigger": "status_changed",
            "trigger_status_id": status_id(project, "Done"),
            "action": "set_priority",
            "action_value": "urgent",
        },
        headers=auth_headers(world.manager),
    )
    await client.patch(
        f"/automation/{created.json()['id']}",
        json={"enabled": False},
        headers=auth_headers(world.manager),
    )
    task = await api_create_task(client, world.manager, project["id"])

    moved = await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )
    refreshed = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.manager))

    assert moved.status_code == 200
    assert refreshed.json()["priority"] == "medium"


async def test_set_priority_automation_applies(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    await client.post(
        f"/projects/{project['id']}/automation",
        json={
            "name": "Escalate",
            "trigger": "status_changed",
            "trigger_status_id": status_id(project, "In Review"),
            "action": "set_priority",
            "action_value": "high",
        },
        headers=auth_headers(world.manager),
    )
    task = await api_create_task(client, world.manager, project["id"])

    await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "In Review")},
        headers=auth_headers(world.manager),
    )
    refreshed = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.manager))

    assert refreshed.json()["priority"] == "high"


async def test_only_managers_manage_automation(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    payload = {
        "name": "x",
        "trigger": "issue_created",
        "action": "flag_issue",
    }

    member = await client.post(
        f"/projects/{project['id']}/automation", json=payload, headers=auth_headers(world.member)
    )
    invalid = await client.post(
        f"/projects/{project['id']}/automation",
        json={"name": "x", "trigger": "status_changed", "action": "flag_issue"},
        headers=auth_headers(world.manager),
    )

    assert member.status_code == 403
    assert invalid.status_code == 422


async def test_overdue_scan_notifies_once(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    await api_create_task(
        client,
        world.manager,
        project["id"],
        title="Late",
        due_date="2020-01-01",
        assignee_id=str(world.member.pk),
    )

    first = await automation_service.notify_overdue_tasks()
    second = await automation_service.notify_overdue_tasks()
    notifications = await client.get("/notifications", headers=auth_headers(world.member))

    assert first >= 1
    assert second == 0
    assert [i["type"] for i in notifications.json()["items"]].count("task_overdue") == 1


async def test_migration_numbers_legacy_issues(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager, key="LEGACY")
    task = await api_create_task(client, world.manager, project["id"])
    stored = await Task.get(task["id"])
    assert stored is not None
    stored.issue_number = 0
    await stored.save()

    await backfill_issue_numbers()
    refreshed = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.manager))

    assert refreshed.json()["key"].startswith("LEGACY-")
    assert refreshed.json()["issue_number"] >= 1
