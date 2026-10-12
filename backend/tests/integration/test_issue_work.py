import io
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
    project = await api_create_project(client, world.manager)
    for user in (world.member, world.other_member, world.viewer):
        await api_add_member(client, world.manager, project["id"], user)
    return project


async def test_logging_work_updates_spent_and_remaining(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], original_estimate_minutes=240
    )

    response = await client.post(
        f"/tasks/{task['id']}/worklogs",
        json={"minutes": 90, "comment": "Wired it up"},
        headers=auth_headers(world.member),
    )
    refreshed = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.member))

    assert response.status_code == 201
    assert response.json()["author"]["name"] == world.member.name
    assert refreshed.json()["time_spent_minutes"] == 90
    assert refreshed.json()["remaining_estimate_minutes"] == 150


async def test_worklog_can_override_remaining_estimate(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], original_estimate_minutes=240
    )

    await client.post(
        f"/tasks/{task['id']}/worklogs",
        json={"minutes": 30, "remaining_minutes": 600},
        headers=auth_headers(world.member),
    )
    refreshed = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.member))

    assert refreshed.json()["remaining_estimate_minutes"] == 600


async def test_viewer_cannot_log_work(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    response = await client.post(
        f"/tasks/{task['id']}/worklogs", json={"minutes": 30}, headers=auth_headers(world.viewer)
    )

    assert response.status_code == 403


async def test_worklog_edit_and_delete_adjust_totals(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], original_estimate_minutes=120
    )
    created = await client.post(
        f"/tasks/{task['id']}/worklogs", json={"minutes": 60}, headers=auth_headers(world.member)
    )
    log_id = created.json()["id"]

    edited = await client.patch(
        f"/worklogs/{log_id}", json={"minutes": 30}, headers=auth_headers(world.member)
    )
    after_edit = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.member))
    await client.delete(f"/worklogs/{log_id}", headers=auth_headers(world.member))
    after_delete = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.member))

    assert edited.json()["minutes"] == 30
    assert after_edit.json()["time_spent_minutes"] == 30
    assert after_delete.json()["time_spent_minutes"] == 0
    assert after_delete.json()["remaining_estimate_minutes"] == 120


async def test_other_member_cannot_change_someone_elses_worklog(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])
    created = await client.post(
        f"/tasks/{task['id']}/worklogs", json={"minutes": 20}, headers=auth_headers(world.member)
    )

    response = await client.delete(
        f"/worklogs/{created.json()['id']}", headers=auth_headers(world.other_member)
    )
    manager_delete = await client.delete(
        f"/worklogs/{created.json()['id']}", headers=auth_headers(world.manager)
    )

    assert response.status_code == 403
    assert manager_delete.status_code == 204


async def test_link_issues_and_see_both_directions(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    blocker = await api_create_task(client, world.manager, project["id"], title="Blocker")
    blocked = await api_create_task(client, world.manager, project["id"], title="Blocked")

    created = await client.post(
        f"/tasks/{blocker['id']}/links",
        json={"target": blocked["key"], "link_type": "blocks"},
        headers=auth_headers(world.manager),
    )
    inverse = await client.get(f"/tasks/{blocked['id']}/links", headers=auth_headers(world.manager))
    refreshed = await client.get(f"/tasks/{blocked['id']}", headers=auth_headers(world.manager))

    assert created.status_code == 201
    assert created.json()[0]["label"] == "blocks"
    assert inverse.json()[0]["label"] == "is blocked by"
    assert inverse.json()[0]["issue"]["key"] == blocker["key"]
    assert refreshed.json()["blocked_by_open"] == 1


async def test_blocking_cycles_and_self_links_are_rejected(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    first = await api_create_task(client, world.manager, project["id"])
    second = await api_create_task(client, world.manager, project["id"])
    await client.post(
        f"/tasks/{first['id']}/links",
        json={"target": second["key"], "link_type": "blocks"},
        headers=auth_headers(world.manager),
    )

    cycle = await client.post(
        f"/tasks/{second['id']}/links",
        json={"target": first["key"], "link_type": "blocks"},
        headers=auth_headers(world.manager),
    )
    own = await client.post(
        f"/tasks/{first['id']}/links",
        json={"target": first["key"], "link_type": "relates_to"},
        headers=auth_headers(world.manager),
    )
    duplicate = await client.post(
        f"/tasks/{first['id']}/links",
        json={"target": second["key"], "link_type": "blocks"},
        headers=auth_headers(world.manager),
    )

    assert cycle.json()["code"] == "link_cycle"
    assert own.json()["code"] == "self_link"
    assert duplicate.status_code == 409


async def test_unlink_removes_relationship(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    first = await api_create_task(client, world.manager, project["id"])
    second = await api_create_task(client, world.manager, project["id"])
    created = await client.post(
        f"/tasks/{first['id']}/links",
        json={"target": second["key"], "link_type": "relates_to"},
        headers=auth_headers(world.manager),
    )

    removed = await client.delete(
        f"/links/{created.json()[0]['id']}", headers=auth_headers(world.manager)
    )
    remaining = await client.get(f"/tasks/{first['id']}/links", headers=auth_headers(world.manager))

    assert removed.status_code == 204
    assert remaining.json() == []


async def upload(client: AsyncClient, user: Any, task_id: str, name: str, content: bytes) -> Any:
    return await client.post(
        f"/tasks/{task_id}/attachments",
        files={"file": (name, io.BytesIO(content), "application/octet-stream")},
        headers=auth_headers(user),
    )


async def test_upload_list_download_and_delete_attachment(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    created = await upload(client, world.member, task["id"], "notes.txt", b"hello world")
    listing = await client.get(
        f"/tasks/{task['id']}/attachments", headers=auth_headers(world.viewer)
    )
    download = await client.get(
        f"/attachments/{created.json()['id']}/download", headers=auth_headers(world.viewer)
    )
    removed = await client.delete(
        f"/attachments/{created.json()['id']}", headers=auth_headers(world.member)
    )

    assert created.status_code == 201
    assert listing.json()[0]["filename"] == "notes.txt"
    assert download.content == b"hello world"
    assert "attachment" in download.headers["content-disposition"]
    assert removed.status_code == 204


async def test_attachment_rules_reject_bad_files(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    blocked = await upload(client, world.member, task["id"], "malware.exe", b"MZ")
    empty = await upload(client, world.member, task["id"], "empty.txt", b"")
    too_big = await upload(
        client, world.member, task["id"], "big.txt", b"x" * (10 * 1024 * 1024 + 1)
    )
    viewer = await upload(client, world.viewer, task["id"], "a.txt", b"x")

    assert blocked.json()["code"] == "attachment_type_not_allowed"
    assert empty.json()["code"] == "attachment_empty"
    assert too_big.json()["code"] == "attachment_too_large"
    assert viewer.status_code == 403


async def test_attachment_download_requires_project_visibility(
    client: AsyncClient, world: World
) -> None:
    project = await api_create_project(client, world.manager)
    task = await api_create_task(client, world.manager, project["id"])
    created = await upload(client, world.manager, task["id"], "secret.txt", b"classified")

    response = await client.get(
        f"/attachments/{created.json()['id']}/download", headers=auth_headers(world.member)
    )

    assert response.status_code == 404


async def test_comment_mentions_and_watchers_are_notified(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.other_member.pk)
    )

    await client.post(
        f"/tasks/{task['id']}/comments",
        json={"body": f"Please look, @{world.member.name}"},
        headers=auth_headers(world.manager),
    )
    mentioned = await client.get("/notifications", headers=auth_headers(world.member))
    assignee = await client.get("/notifications", headers=auth_headers(world.other_member))

    assert "mentioned" in [item["type"] for item in mentioned.json()["items"]]
    assert "comment_added" in [item["type"] for item in assignee.json()["items"]]
    assert mentioned.json()["items"][0]["task_key"] == task["key"]
