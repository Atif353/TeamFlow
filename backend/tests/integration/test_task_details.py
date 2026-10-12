from typing import Any

from httpx import AsyncClient

from app.permissions.roles import Role
from tests.factories import (
    World,
    api_add_member,
    api_create_project,
    api_create_task,
    auth_headers,
    create_user,
)


async def setup_project(client: AsyncClient, world: World) -> dict[str, Any]:
    project = await api_create_project(client, world.manager)
    for user in (world.member, world.other_member, world.viewer):
        await api_add_member(client, world.manager, project["id"], user)
    return project


def status_id(project: dict[str, Any], name: str) -> str:
    return str(next(s["id"] for s in project["statuses"] if s["name"] == name))


async def test_subtask_links_to_parent_and_parent_reports_progress(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    parent = await api_create_task(client, world.manager, project["id"], title="Parent")
    child = await api_create_task(
        client, world.manager, project["id"], title="Child", parent_id=parent["id"]
    )
    await client.patch(
        f"/tasks/{child['id']}/move",
        json={"status_id": status_id(project, "Done")},
        headers=auth_headers(world.manager),
    )

    refreshed = await client.get(f"/tasks/{parent['id']}", headers=auth_headers(world.manager))

    assert child["parent_id"] == parent["id"]
    assert refreshed.json()["subtask_total"] == 1
    assert refreshed.json()["subtask_done"] == 1


async def test_subtask_of_subtask_is_rejected(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    parent = await api_create_task(client, world.manager, project["id"])
    child = await api_create_task(client, world.manager, project["id"], parent_id=parent["id"])

    response = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "nested", "parent_id": child["id"]},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 422
    assert response.json()["code"] == "subtask_depth_exceeded"


async def test_deleting_parent_removes_subtasks(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    parent = await api_create_task(client, world.manager, project["id"])
    child = await api_create_task(client, world.manager, project["id"], parent_id=parent["id"])

    await client.delete(f"/tasks/{parent['id']}", headers=auth_headers(world.manager))
    response = await client.get(f"/tasks/{child['id']}", headers=auth_headers(world.manager))

    assert response.status_code == 404


async def test_checklist_add_toggle_delete(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])
    headers = auth_headers(world.member)

    added = await client.post(
        f"/tasks/{task['id']}/checklist", json={"text": "Write tests"}, headers=headers
    )
    item_id = added.json()["checklist"][0]["id"]
    toggled = await client.patch(
        f"/tasks/{task['id']}/checklist/{item_id}", json={"done": True}, headers=headers
    )
    reloaded = await client.get(f"/tasks/{task['id']}", headers=headers)
    removed = await client.delete(f"/tasks/{task['id']}/checklist/{item_id}", headers=headers)
    missing = await client.delete(f"/tasks/{task['id']}/checklist/{item_id}", headers=headers)

    assert added.status_code == 201
    assert toggled.json()["checklist_done"] == 1
    assert reloaded.json()["checklist"][0]["done"] is True
    assert reloaded.json()["checklist_total"] == 1
    assert removed.json()["checklist"] == []
    assert missing.status_code == 404


async def test_checklist_respects_ownership(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.other_member, project["id"])

    response = await client.post(
        f"/tasks/{task['id']}/checklist",
        json={"text": "nope"},
        headers=auth_headers(world.member),
    )

    assert response.status_code == 403


async def test_labels_assign_and_cascade_on_delete(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    headers = auth_headers(world.member)
    label = (
        await client.post(
            f"/projects/{project['id']}/labels",
            json={"name": "Bug", "color": "#F43F5E"},
            headers=headers,
        )
    ).json()
    duplicate = await client.post(
        f"/projects/{project['id']}/labels", json={"name": "bug"}, headers=headers
    )
    task = await api_create_task(client, world.member, project["id"], label_ids=[label["id"]])
    member_delete = await client.delete(f"/labels/{label['id']}", headers=headers)
    manager_delete = await client.delete(
        f"/labels/{label['id']}", headers=auth_headers(world.manager)
    )
    refreshed = await client.get(f"/tasks/{task['id']}", headers=headers)
    listing = await client.get(f"/projects/{project['id']}/labels", headers=headers)

    assert task["labels"][0]["name"] == "Bug"
    assert duplicate.status_code == 409
    assert member_delete.status_code == 403
    assert manager_delete.status_code == 204
    assert refreshed.json()["labels"] == []
    assert listing.json() == []


async def test_label_from_other_project_is_rejected(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    other = await api_create_project(client, world.manager, name="Other")
    label = (
        await client.post(
            f"/projects/{other['id']}/labels",
            json={"name": "Foreign"},
            headers=auth_headers(world.manager),
        )
    ).json()

    response = await client.post(
        f"/projects/{project['id']}/tasks",
        json={"title": "x", "label_ids": [label["id"]]},
        headers=auth_headers(world.manager),
    )

    assert response.status_code == 422


async def test_delete_status_with_tasks_conflicts_until_reassigned(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    headers = auth_headers(world.manager)
    task = await api_create_task(client, world.manager, project["id"])
    without_todo = [
        {"id": s["id"], "name": s["name"], "color": s["color"], "is_done": s["is_done"]}
        for s in project["statuses"]
        if s["name"] != "To Do"
    ]

    blocked = await client.put(
        f"/projects/{project['id']}/statuses", json={"statuses": without_todo}, headers=headers
    )
    await client.patch(
        f"/tasks/{task['id']}/move",
        json={"status_id": status_id(project, "In Progress")},
        headers=headers,
    )
    allowed = await client.put(
        f"/projects/{project['id']}/statuses", json={"statuses": without_todo}, headers=headers
    )

    assert blocked.status_code == 409
    assert blocked.json()["code"] == "status_has_tasks"
    assert allowed.status_code == 200
    assert [s["name"] for s in allowed.json()["statuses"]] == ["In Progress", "In Review", "Done"]


async def test_statuses_can_be_added_renamed_recolored_and_reordered(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    headers = auth_headers(world.manager)
    original = project["statuses"]
    reordered = [
        {"id": original[3]["id"], "name": "Shipped", "color": "#0EA5E9", "is_done": True},
        {"id": original[0]["id"], "name": original[0]["name"], "color": original[0]["color"]},
        {"name": "Blocked", "color": "#F43F5E"},
    ]

    response = await client.put(
        f"/projects/{project['id']}/statuses", json={"statuses": reordered}, headers=headers
    )
    reloaded = await client.get(f"/projects/{project['id']}", headers=headers)

    names = [s["name"] for s in reloaded.json()["statuses"]]
    assert names == ["Shipped", "To Do", "Blocked"]
    assert [s["order"] for s in response.json()["statuses"]] == [0, 1, 2]
    assert response.json()["statuses"][0]["color"] == "#0EA5E9"
    assert response.json()["statuses"][2]["id"] not in {s["id"] for s in original}


async def test_status_validation_and_permissions(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    duplicate_names = {
        "statuses": [
            {"name": "A", "color": "#111111"},
            {"name": "a", "color": "#222222"},
        ]
    }
    unknown_id = {"statuses": [{"id": "ghost", "name": "A", "color": "#111111"}]}

    dup = await client.put(
        f"/projects/{project['id']}/statuses",
        json=duplicate_names,
        headers=auth_headers(world.manager),
    )
    ghost = await client.put(
        f"/projects/{project['id']}/statuses", json=unknown_id, headers=auth_headers(world.manager)
    )
    forbidden = await client.put(
        f"/projects/{project['id']}/statuses",
        json=duplicate_names,
        headers=auth_headers(world.member),
    )

    assert dup.status_code == ghost.status_code == 422
    assert forbidden.status_code == 403


async def test_toggling_done_flag_updates_completion_of_existing_tasks(
    client: AsyncClient, world: World
) -> None:
    project = await setup_project(client, world)
    headers = auth_headers(world.manager)
    task = await api_create_task(client, world.manager, project["id"])
    statuses = [
        {
            "id": s["id"],
            "name": s["name"],
            "color": s["color"],
            "is_done": s["is_done"] or s["name"] == "To Do",
        }
        for s in project["statuses"]
    ]

    await client.put(
        f"/projects/{project['id']}/statuses", json={"statuses": statuses}, headers=headers
    )
    refreshed = await client.get(f"/tasks/{task['id']}", headers=headers)

    assert refreshed.json()["completed_at"] is not None


async def test_comment_mentions_only_project_members(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    outsider = await create_user(world.workspace, Role.MEMBER, "Olivia Outsider")
    task = await api_create_task(client, world.member, project["id"])

    response = await client.post(
        f"/tasks/{task['id']}/comments",
        json={"body": "Hi @Omar Other and @Olivia Outsider, please review"},
        headers=auth_headers(world.member),
    )

    assert response.status_code == 201
    assert [m["id"] for m in response.json()["mentions"]] == [str(world.other_member.pk)]
    assert str(outsider.pk) not in response.text


async def test_viewer_cannot_comment_but_can_read(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])
    await client.post(
        f"/tasks/{task['id']}/comments", json={"body": "hello"}, headers=auth_headers(world.member)
    )

    blocked = await client.post(
        f"/tasks/{task['id']}/comments", json={"body": "x"}, headers=auth_headers(world.viewer)
    )
    listing = await client.get(f"/tasks/{task['id']}/comments", headers=auth_headers(world.viewer))

    assert blocked.status_code == 403
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["author"]["name"] == "Mark Member"


async def test_comment_edit_and_delete_rules(client: AsyncClient, world: World) -> None:
    project = await setup_project(client, world)
    task = await api_create_task(client, world.member, project["id"])
    comment = (
        await client.post(
            f"/tasks/{task['id']}/comments",
            json={"body": "first"},
            headers=auth_headers(world.member),
        )
    ).json()
    url = f"/comments/{comment['id']}"

    edited = await client.patch(url, json={"body": "second"}, headers=auth_headers(world.member))
    foreign_edit = await client.patch(
        url, json={"body": "hack"}, headers=auth_headers(world.manager)
    )
    foreign_delete = await client.delete(url, headers=auth_headers(world.other_member))
    manager_delete = await client.delete(url, headers=auth_headers(world.manager))
    own = (
        await client.post(
            f"/tasks/{task['id']}/comments",
            json={"body": "mine"},
            headers=auth_headers(world.other_member),
        )
    ).json()
    own_delete = await client.delete(
        f"/comments/{own['id']}", headers=auth_headers(world.other_member)
    )

    assert edited.json()["body"] == "second"
    assert edited.json()["edited_at"] is not None
    assert foreign_edit.status_code == 403
    assert foreign_delete.status_code == 403
    assert manager_delete.status_code == 204
    assert own_delete.status_code == 204
