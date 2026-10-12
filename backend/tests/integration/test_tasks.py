from datetime import date, timedelta
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


def status_id(project: dict[str, Any], name: str) -> str:
    return str(next(s["id"] for s in project["statuses"] if s["name"] == name))


async def test_create_task_with_required_fields(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)

    task = await api_create_task(
        client,
        world.member,
        project["id"],
        description="Details",
        priority="high",
        assignee_id=str(world.other_member.pk),
        due_date="2026-12-31",
    )

    assert task["status_id"] == status_id(project, "To Do")
    assert task["priority"] == "high"
    assert task["due_date"] == "2026-12-31"
    assert task["assignee"]["name"] == "Omar Other"
    assert task["creator_id"] == str(world.member.pk)


async def test_create_task_without_title_is_validation_error(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)

    response = await client.post(
        f"/projects/{project['id']}/tasks", json={}, headers=auth_headers(world.member)
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert "title" in response.json()["details"]


async def test_assignee_must_belong_to_project(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    await api_add_member(client, world.manager, project["id"], world.member)

    response = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "x", "assignee_id": str(world.other_member.pk)},
        headers=auth_headers(world.member),
    )

    assert response.status_code == 422
    assert response.json()["code"] == "assignee_not_project_member"


async def test_member_edits_own_tasks_only(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    created = await api_create_task(client, world.member, project["id"])
    assigned = await api_create_task(
        client, world.manager, project["id"], assignee_id=str(world.member.pk)
    )
    foreign = await api_create_task(client, world.other_member, project["id"])
    headers = auth_headers(world.member)

    own = await client.patch(f"/tasks/{created['id']}", json={"title": "Mine"}, headers=headers)
    assigned_edit = await client.patch(
        f"/tasks/{assigned['id']}", json={"priority": "low"}, headers=headers
    )
    other = await client.patch(f"/tasks/{foreign['id']}", json={"title": "Hack"}, headers=headers)
    delete_other = await client.delete(f"/tasks/{foreign['id']}", headers=headers)

    assert own.status_code == 200 and own.json()["title"] == "Mine"
    assert assigned_edit.status_code == 200
    assert other.status_code == 403
    assert delete_other.status_code == 403


async def test_manager_edits_and_deletes_any_task(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])
    headers = auth_headers(world.manager)

    edited = await client.patch(f"/tasks/{task['id']}", json={"title": "Managed"}, headers=headers)
    deleted = await client.delete(f"/tasks/{task['id']}", headers=headers)
    gone = await client.get(f"/tasks/{task['id']}", headers=headers)

    assert edited.status_code == 200
    assert deleted.status_code == 204
    assert gone.status_code == 404


async def test_viewer_cannot_write_but_can_read(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])
    headers = auth_headers(world.viewer)

    create = await client.post(
        f"/projects/{project['id']}/tasks", json={"title": "x"}, headers=headers
    )
    edit = await client.patch(f"/tasks/{task['id']}", json={"title": "x"}, headers=headers)
    move = await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=headers,
    )
    read = await client.get(f"/tasks/{task['id']}", headers=headers)

    assert create.status_code == edit.status_code == move.status_code == 403
    assert read.status_code == 200


async def test_non_member_cannot_see_task(client: AsyncClient, world: World) -> None:
    project = await api_create_project(client, world.manager)
    task = await api_create_task(client, world.manager, project["id"])

    response = await client.get(f"/tasks/{task['id']}", headers=auth_headers(world.member))

    assert response.status_code == 404


async def test_list_filters_and_combinations(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    pid = project["id"]
    today = date(2026, 10, 10)
    await api_create_task(
        client,
        world.manager,
        pid,
        title="Alpha login",
        priority="urgent",
        assignee_id=str(world.member.pk),
        due_date=str(today),
    )
    await api_create_task(
        client,
        world.manager,
        pid,
        title="Beta report",
        priority="low",
        assignee_id=str(world.other_member.pk),
        due_date=str(today + timedelta(days=10)),
    )
    await api_create_task(client, world.manager, pid, title="Gamma", priority="urgent")
    headers = auth_headers(world.member)

    async def titles(query: str) -> list[str]:
        response = await client.get(f"/projects/{pid}/tasks?{query}&sort=title", headers=headers)
        return [item["title"] for item in response.json()["items"]]

    assert await titles("priority=urgent") == ["Alpha login", "Gamma"]
    assert await titles(f"assignee_id={world.other_member.pk}") == ["Beta report"]
    assert await titles("q=LOGIN") == ["Alpha login"]
    assert await titles(f"due_before={today}") == ["Alpha login"]
    assert await titles(f"due_after={today + timedelta(days=1)}") == ["Beta report"]
    assert await titles(f"status_id={status_id(project, 'To Do')}") == [
        "Alpha login",
        "Beta report",
        "Gamma",
    ]
    assert await titles(f"priority=urgent&assignee_id={world.member.pk}") == ["Alpha login"]
    assert await titles(f"status_id={status_id(project, 'Done')}") == []


async def test_list_sorting_pagination_and_toplevel_only(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    pid = project["id"]
    parent = await api_create_task(client, world.manager, pid, title="Parent", priority="low")
    await api_create_task(client, world.manager, pid, title="Child", parent_id=parent["id"])
    await api_create_task(client, world.manager, pid, title="Hot", priority="urgent")
    headers = auth_headers(world.member)

    by_priority = await client.get(
        f"/projects/{pid}/tasks?sort=priority&order=desc", headers=headers
    )
    page = await client.get(f"/projects/{pid}/tasks?page=2&page_size=1", headers=headers)
    children = await client.get(f"/projects/{pid}/tasks?parent_id={parent['id']}", headers=headers)
    too_big = await client.get(f"/projects/{pid}/tasks?page_size=101", headers=headers)

    assert [t["title"] for t in by_priority.json()["items"]] == ["Hot", "Parent"]
    assert page.json()["total"] == 2
    assert len(page.json()["items"]) == 1
    assert [t["title"] for t in children.json()["items"]] == ["Child"]
    assert too_big.status_code == 422


async def test_moving_into_done_status_sets_and_clears_completed_at(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])
    headers = auth_headers(world.member)

    done = await client.patch(
        f"/tasks/{task['id']}/move", json={"status_id": status_id(project, "Done")}, headers=headers
    )
    reopened = await client.patch(
        f"/tasks/{task['id']}",
        json={"status_id": status_id(project, "In Progress")},
        headers=headers,
    )

    assert done.json()["completed_at"] is not None
    assert reopened.json()["completed_at"] is None


async def test_move_persists_status_and_fractional_position(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    pid = project["id"]
    first = await api_create_task(client, world.manager, pid, title="first")
    second = await api_create_task(client, world.manager, pid, title="second")
    third = await api_create_task(client, world.manager, pid, title="third")
    headers = auth_headers(world.manager)

    moved = await client.patch(
        f"/tasks/{third['id']}/move",
        json={
            "status_id": first["status_id"],
            "previous_task_id": first["id"],
            "next_task_id": second["id"],
        },
        headers=headers,
    )
    other_column = await client.patch(
        f"/tasks/{first['id']}/move",
        json={"status_id": status_id(project, "In Progress")},
        headers=headers,
    )
    listing = await client.get(f"/projects/{pid}/tasks", headers=headers)

    assert moved.status_code == 200
    todo = [t["title"] for t in listing.json()["items"] if t["status_id"] == first["status_id"]]
    assert todo == ["third", "second"]
    assert other_column.json()["status_id"] == status_id(project, "In Progress")


async def test_move_to_top_of_column_and_rebalance(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    pid = project["id"]
    a = await api_create_task(client, world.manager, pid, title="a")
    b = await api_create_task(client, world.manager, pid, title="b")
    c = await api_create_task(client, world.manager, pid, title="c")
    headers = auth_headers(world.manager)
    for _ in range(3):
        await client.patch(
            f"/tasks/{c['id']}/move",
            json={
                "status_id": a["status_id"],
                "previous_task_id": a["id"],
                "next_task_id": b["id"],
            },
            headers=headers,
        )
        await client.patch(
            f"/tasks/{b['id']}/move",
            json={
                "status_id": a["status_id"],
                "previous_task_id": a["id"],
                "next_task_id": c["id"],
            },
            headers=headers,
        )
    top = await client.patch(
        f"/tasks/{c['id']}/move", json={"status_id": a["status_id"]}, headers=headers
    )
    listing = await client.get(f"/projects/{pid}/tasks", headers=headers)

    assert top.status_code == 200
    assert listing.json()["items"][0]["title"] == "c"


async def test_member_cannot_move_someone_elses_task(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.other_member, project["id"])

    response = await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.member),
    )

    assert response.status_code == 403


async def test_move_with_invalid_status_or_neighbor_is_rejected(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])
    headers = auth_headers(world.manager)

    bad_status = await client.patch(
        f"/tasks/{task['id']}/move", json={"status_id": "nope"}, headers=headers
    )
    bad_neighbor = await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": task["status_id"], "previous_task_id": task["id"]},
        headers=headers,
    )

    assert bad_status.status_code == 422
    assert bad_neighbor.status_code == 422


async def test_unknown_task_fields_are_rejected(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.manager, project["id"])

    response = await client.patch(
        f"/tasks/{task['id']}",
        json={"creator_id": str(world.viewer.pk), "title": None},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 422


async def test_clearing_assignee_and_due_date(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(
        client,
        world.manager,
        project["id"],
        assignee_id=str(world.member.pk),
        due_date="2026-11-01",
    )

    response = await client.patch(
        f"/tasks/{task['id']}",
        json={"assignee_id": None, "due_date": None},
        headers=auth_headers(world.manager),
    )

    assert response.json()["assignee"] is None
    assert response.json()["due_date"] is None
