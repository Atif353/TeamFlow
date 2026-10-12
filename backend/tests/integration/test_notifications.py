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
    for user in (world.member, world.other_member):
        await api_add_member(client, world.manager, project["id"], user)
    return project


async def unread(client: AsyncClient, user_headers: dict[str, str]) -> int:
    response = await client.get("/notifications/unread-count", headers=user_headers)
    return int(response.json()["count"])


async def test_assigning_to_someone_else_notifies_them(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)

    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.member.pk)
    )
    listing = await client.get("/notifications", headers=auth_headers(world.member))

    assert listing.json()["total"] == 1
    item = listing.json()["items"][0]
    assert item["task_id"] == task["id"]
    assert item["task_title"] == "Write specs"
    assert item["actor"]["name"] == "Maya Manager"
    assert item["project_key"] == project["key"]
    assert item["is_read"] is False


async def test_self_assignment_creates_no_notification(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])

    await client.patch(
        f"/tasks/{task['id']}",
        json={"assignee_id": str(world.member.pk)},
        headers=auth_headers(world.member),
    )

    assert await unread(client, auth_headers(world.member)) == 0


async def test_reassignment_notifies_new_assignee_only(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.member.pk)
    )

    await client.patch(
        f"/tasks/{task['id']}",
        json={"assignee_id": str(world.other_member.pk)},
        headers=auth_headers(world.manager),
    )
    await client.patch(
        f"/tasks/{task['id']}", json={"title": "Renamed"}, headers=auth_headers(world.manager)
    )

    assert await unread(client, auth_headers(world.other_member)) == 1
    assert await unread(client, auth_headers(world.member)) == 1


async def test_mark_read_and_read_all_update_unread_count(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    for _ in range(3):
        await api_create_task(
            client, world.manager, project["id"], assignee_id=str(world.member.pk)
        )
    headers = auth_headers(world.member)
    first = (await client.get("/notifications", headers=headers)).json()["items"][0]

    marked = await client.patch(f"/notifications/{first['id']}/read", headers=headers)
    after_one = await unread(client, headers)
    only_unread = await client.get("/notifications?unread_only=true", headers=headers)
    everything = await client.post("/notifications/read-all", headers=headers)

    assert marked.json()["is_read"] is True
    assert after_one == 2
    assert only_unread.json()["total"] == 2
    assert everything.json()["updated"] == 2
    assert await unread(client, headers) == 0


async def test_cannot_touch_another_users_notification(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    await api_create_task(client, world.manager, project["id"], assignee_id=str(world.member.pk))
    notification = (await client.get("/notifications", headers=auth_headers(world.member))).json()[
        "items"
    ][0]

    response = await client.patch(
        f"/notifications/{notification['id']}/read", headers=auth_headers(world.other_member)
    )

    assert response.status_code == 404
    assert await unread(client, auth_headers(world.member)) == 1


async def test_deleting_task_removes_its_notifications(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.member.pk)
    )

    await client.delete(f"/tasks/{task['id']}", headers=auth_headers(world.manager))

    assert await unread(client, auth_headers(world.member)) == 0
